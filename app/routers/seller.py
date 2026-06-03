"""
Seller Dashboard API — stats, listings management, analytics.
All endpoints require a valid JWT token (seller role).
"""
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract, text as sa_text
from datetime import datetime, timedelta
from app.utils.timezone import now_wat, to_wat, format_wat_iso
from pydantic import BaseModel, Field

import asyncio
import hashlib
import json
import os
from app.database import get_db
from app.models import Price, User, Profile, PointsTransaction, SellerVerification, Inquiry, Notification, Review, Order, Lead, KarmaLedger, Follow
from app.routers.auth import get_current_user, get_user_allow_paused
from app.routers.items import invalidate_search_cache
from app.routers.seller_orders import _order_dict
from app.limiter import limiter
from app.constants.locations import LOCATION_SET, validate_locations as _validate_locations

router = APIRouter(prefix="/seller", tags=["Seller Dashboard"])


def get_current_seller(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: ensure authenticated user has seller (or admin) role."""
    if current_user.role not in ("seller", "admin"):
        raise HTTPException(status_code=403, detail="Seller account required")
    return current_user


# ── Schemas ──────────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category_id: int = Field(..., gt=0)
    price: float = Field(..., gt=0, le=10000000)
    brand: str | None = Field(None, max_length=100)
    pack_size: str | None = Field(None, max_length=50)
    pack_unit: str | None = Field(None, max_length=20)
    # Seller's primary / specific spot (free text, ≤100 chars). Required when publishing; optional for drafts.
    location: str | None = Field(None, max_length=100)
    # Required on publish — list of canonical UNILAG pickup spots. Empty list allowed only for drafts.
    locations: list[str] = Field(default_factory=list)
    store_id: int | None = Field(None, gt=0)
    # New marketplace fields
    description: str | None = Field(None, max_length=2000)
    subcategory: str | None = Field(None, max_length=100)
    condition: str | None = Field("New")              # New / Fairly Used / Used
    quantity: int | None = Field(1, ge=1, le=9999)
    is_negotiable: bool | None = Field(False)
    delivery_options: str | None = Field(None)        # "pickup", "delivery", "pickup,delivery"
    delivery_fee: float | None = Field(None, ge=0, le=10000000)
    duration_days: int | None = Field(30)             # 7 / 14 / 30
    listing_status: str | None = Field("active")      # draft / active
    photos: list | None = Field(default_factory=list) # up to 5 Cloudinary URLs
    videos: list | None = Field(default_factory=list) # Cloudinary video URLs — capped at 3 per user account-wide


class ListingUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    price: float | None = Field(None, gt=0, le=10000000)
    brand: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=100)  # seller's primary / specific spot
    locations: list[str] | None = Field(None)
    description: str | None = Field(None, max_length=2000)
    subcategory: str | None = Field(None, max_length=100)
    condition: str | None = None
    quantity: int | None = Field(None, ge=1, le=9999)
    is_negotiable: bool | None = None
    delivery_options: str | None = None
    delivery_fee: float | None = Field(None, ge=0, le=10000000)
    duration_days: int | None = None
    listing_status: str | None = None
    photos: list | None = None
    videos: list | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    email: str | None = Field(None, max_length=255)


# ── Dashboard Overview ───────────────────────────────────────────────────

@router.get("/stats")
async def get_seller_stats(
    current_user: User = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    """Seller dashboard overview stats."""
    uid = current_user.id

    total_listings = db.query(Price).filter(Price.submitted_by == uid).count()
    active_listings = db.query(Price).filter(
        Price.submitted_by == uid,
        Price.status == "approved",
        Price.listing_status == "active",
    ).count()
    pending_listings = db.query(Price).filter(
        Price.submitted_by == uid, Price.status == "pending"
    ).count()
    draft_listings = db.query(Price).filter(
        Price.submitted_by == uid, Price.listing_status == "draft"
    ).count()
    expired_listings = db.query(Price).filter(
        Price.submitted_by == uid, Price.listing_status == "expired"
    ).count()
    total_views = (
        db.query(func.sum(Price.view_count))
        .filter(Price.submitted_by == uid, Price.status == "approved")
        .scalar() or 0
    )
    # FIX #3 + Block 6: count from PointsTransaction. After FIX #3,
    # completions write reason="purchase_confirmed"; older rows wrote
    # "order_completed". Count both, then fall back to the Order table
    # if neither produced anything (covers schemas where points
    # transactions were not back-filled).
    from app.models import Order
    confirmed_sales = (
        db.query(PointsTransaction)
        .filter(
            PointsTransaction.user_id == uid,
            PointsTransaction.reason.in_(("purchase_confirmed", "order_completed")),
        )
        .count()
    )
    if confirmed_sales == 0:
        confirmed_sales = (
            db.query(Order)
            .filter(Order.seller_id == uid, Order.status == "completed")
            .count()
        )

    # Verification status
    verification = (
        db.query(SellerVerification)
        .filter(SellerVerification.user_id == uid)
        .order_by(SellerVerification.submitted_at.desc())
        .first()
    )

    avg_rating_row = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == current_user.id, Review.is_flagged == False
    ).scalar()
    avg_rating = round(float(avg_rating_row), 1) if avg_rating_row else None
    review_count = db.query(Review).filter(
        Review.seller_id == current_user.id, Review.is_flagged == False
    ).count()

    followers_count = db.query(Follow).filter(Follow.seller_id == uid).count()
    # "Inquiries" = distinct buyers who have reached out to this seller. Buyers
    # now contact sellers through the chat system (Conversation), but older
    # contacts live in the legacy Inquiry table — count the union so neither
    # channel is missed and a buyer using both is only counted once.
    from sqlalchemy import or_ as _or
    from app.routers.messages import Conversation
    buyer_ids: set[int] = set()
    for ua, ub in (
        db.query(Conversation.user_a_id, Conversation.user_b_id)
        .filter(_or(Conversation.user_a_id == uid, Conversation.user_b_id == uid))
        .all()
    ):
        buyer_ids.add(ub if ua == uid else ua)
    for (bid,) in db.query(Inquiry.buyer_id).filter(Inquiry.seller_id == uid).all():
        buyer_ids.add(bid)
    total_inquiries = len(buyer_ids)

    # Compute avg response time string from stored hours
    avg_resp_hours = current_user.avg_response_hours or 0.0
    if avg_resp_hours < 1:
        avg_response_time = f"{int(avg_resp_hours * 60)} min"
    elif avg_resp_hours < 24:
        avg_response_time = f"{avg_resp_hours:.1f} hrs"
    else:
        avg_response_time = f"{avg_resp_hours / 24:.1f} days"

    return {
        "success": True,
        "data": {
            "totalListings": total_listings,
            "activeListings": active_listings,
            "pendingListings": pending_listings,
            "draftListings": draft_listings,
            "expiredListings": expired_listings,
            "totalViews": int(total_views),
            "confirmedSales": confirmed_sales,
            "sellerPoints": current_user.seller_points or 0,
            "vacationMode": current_user.vacation_mode or False,
            "availabilityStatus": "closed" if current_user.vacation_mode else (current_user.availability_status or "open"),
            "verificationStatus": verification.status if verification else "Not submitted",
            "avgRating": avg_rating,
            "reviewCount": review_count,
            "followersCount": followers_count,
            "totalInquiries": total_inquiries,
            "responseRate": current_user.response_rate or 100.0,
            "completionRate": current_user.completion_rate or 100.0,
            "noShowRate": round((current_user.no_show_count or 0) / max(confirmed_sales, 1) * 100, 1),
            "avgResponseTime": avg_response_time,
        },
    }


# ── Karma ────────────────────────────────────────────────────────────────

@router.get("/karma-history")
async def get_karma_history(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return recent karma ledger entries for the current seller."""
    entries = (
        db.query(KarmaLedger)
        .filter(KarmaLedger.seller_id == current_user.id)
        .order_by(KarmaLedger.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "total": current_user.seller_points or 0,
        "history": [
            {
                "id": e.id,
                "points": e.points,
                "reason": e.reason,
                "reference_id": e.reference_id,
                "created_at": format_wat_iso(e.created_at),
            }
            for e in entries
        ],
    }


@router.post("/karma/check-profile")
async def check_profile_karma(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Award +50 one-time karma if the seller's profile is complete."""
    try:
        from app.services.karma import check_and_award_profile_complete
        awarded = check_and_award_profile_complete(current_user.id, db)
        db.commit()
        return {
            "success": True,
            "awarded": awarded,
            "new_total": current_user.seller_points or 0,
        }
    except Exception:
        return {"success": False, "awarded": False, "new_total": 0}


# ── Listings CRUD ────────────────────────────────────────────────────────

def _listing_dict(p: Price) -> dict:
    """Serialize a Price/listing to dict including all marketplace fields."""
    try:
        loc_list = json.loads(p.locations) if p.locations else []
        if not isinstance(loc_list, list):
            loc_list = []
    except Exception:
        loc_list = []
    return {
        "id": p.id,
        "name": p.name,
        "brand": p.brand,
        "price": p.price,
        "location": p.location,            # seller's primary / specific spot
        "locations": loc_list,             # canonical UNILAG picks
        "needs_location_update": bool(getattr(p, "needs_location_update", False)),
        "category_id": p.category_id,
        "status": p.status,
        "listing_status": p.listing_status or "active",
        "view_count": p.view_count,
        "is_featured": p.is_featured,
        "featured_until": p.featured_until.isoformat() if p.featured_until else None,
        "submitted_at": p.submitted_at.isoformat(),
        # Marketplace fields
        "description": p.description,
        "subcategory": p.subcategory,
        "condition": p.condition or "New",
        "quantity": p.quantity or 1,
        "is_negotiable": p.is_negotiable or False,
        "delivery_options": p.delivery_options,
        "delivery_fee": p.delivery_fee,
        "duration_days": p.duration_days,
        "expires_at": p.expires_at.isoformat() if p.expires_at else None,
        "photos": json.loads(p.photos) if p.photos else [],
        "videos": json.loads(p.videos) if p.videos else [],
        "pack_size": p.pack_size,
        "pack_unit": p.pack_unit,
    }


@router.get("/listings")
async def get_seller_listings(
    status_filter: str | None = Query(None),
    listing_status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all listings by this seller. Filter by approval status or listing_status."""
    query = db.query(Price).filter(Price.submitted_by == current_user.id)
    if status_filter:
        query = query.filter(Price.status == status_filter)
    if listing_status:
        query = query.filter(Price.listing_status == listing_status)
    rows = query.order_by(Price.submitted_at.desc()).offset(skip).limit(limit).all()
    return {"success": True, "data": [_listing_dict(p) for p in rows]}


@router.post("/listings", status_code=201)
async def create_listing(
    data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new price listing (pending admin approval)."""
    is_draft = (data.listing_status or "active") == "draft"

    # Publishing requires an approved seller verification. Saving a DRAFT does
    # not — drafts are private work-in-progress, so a seller can prepare listings
    # while their verification is still pending review.
    if not is_draft:
        verif = (
            db.query(SellerVerification)
            .filter(SellerVerification.user_id == current_user.id)
            .order_by(SellerVerification.submitted_at.desc())
            .first()
        )
        if not (verif and verif.status == "Approved"):
            raise HTTPException(
                status_code=403,
                detail="Seller verification required. Complete verification to publish listings. You can still save this as a draft.",
            )

    expires_at = None
    if data.duration_days:
        expires_at = now_wat() + timedelta(days=data.duration_days)

    # Validate canonical locations. Drafts may have an empty list; publishing requires ≥1.
    try:
        canonical_locations = _validate_locations(data.locations or [])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid delivery locations: {e}")
    if not is_draft and not canonical_locations:
        raise HTTPException(
            status_code=422,
            detail="Pick at least one delivery / meetup location before publishing.",
        )

    # Seller's primary spot — required when publishing, optional on drafts.
    primary_spot = (data.location or "").strip() or None
    if not is_draft and not primary_spot:
        raise HTTPException(
            status_code=422,
            detail="Enter your primary meetup spot before publishing.",
        )

    # Block 5: hard caps — reject (not silently truncate) when sellers exceed.
    if data.photos and len(data.photos) > 4:
        raise HTTPException(
            status_code=422,
            detail="Maximum 4 photos allowed per listing.",
        )
    if data.videos and len(data.videos) > 2:
        raise HTTPException(
            status_code=422,
            detail="Maximum 2 videos allowed per listing.",
        )

    listing = Price(
        name=data.name,
        category_id=data.category_id,
        price=data.price,
        brand=data.brand,
        pack_size=data.pack_size,
        pack_unit=data.pack_unit,
        location=primary_spot,
        locations=json.dumps(canonical_locations),
        store_id=data.store_id,
        submitted_by=current_user.id,
        status="pending",
        # Marketplace fields
        description=data.description,
        subcategory=data.subcategory,
        condition=data.condition or "New",
        quantity=data.quantity or 1,
        is_negotiable=data.is_negotiable or False,
        delivery_options=data.delivery_options,
        delivery_fee=data.delivery_fee,
        duration_days=data.duration_days,
        expires_at=expires_at,
        listing_status=data.listing_status or "active",
        photos=json.dumps(data.photos[:4]) if data.photos else None,
        videos=json.dumps(data.videos[:2]) if data.videos else None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Award one-time +25 karma for publishing the first non-draft listing
    if listing.listing_status != "draft":
        try:
            from app.services.karma import award_karma
            prior_count = (
                db.query(Price)
                .filter(
                    Price.submitted_by == current_user.id,
                    Price.id != listing.id,
                    Price.listing_status != "draft",
                )
                .count()
            )
            if prior_count == 0:
                award_karma(current_user.id, 25, "first_listing", db, reference_id="first_listing")
                db.commit()
        except Exception:
            pass

    # Notify followers if listing is active (not draft)
    if listing.listing_status != "draft":
        try:
            from app.routers.wishlist import notify_new_listing
            notify_new_listing(db, listing, current_user)
            db.commit()
        except Exception:
            pass

    # Block 2D — notify admin of new listing
    try:
        from app.services.admin_notifications import notify_admin
        await notify_admin(
            db, "new_listing", current_user.id,
            current_user.email or "", current_user.role,
            {"listing_id": listing.id, "title": listing.name, "price": listing.price},
        )
    except Exception:
        pass

    msg = "Listing saved as draft" if is_draft else "Listing submitted for admin review"
    return {"success": True, "id": listing.id, "message": msg}


@router.patch("/listings/{listing_id}")
async def update_listing(
    listing_id: int,
    data: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a listing owned by this seller."""
    listing = (
        db.query(Price)
        .filter(Price.id == listing_id, Price.submitted_by == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    update_data = data.dict(exclude_unset=True)
    old_price = listing.price
    old_status = listing.listing_status
    old_category_id = listing.category_id  # captured for cache invalidation

    # Locations: validate against canonical list. Publishing (non-draft) requires ≥1.
    canonical_after: list[str] | None = None
    if "locations" in update_data:
        try:
            canonical_after = _validate_locations(update_data["locations"] or [])
        except ValueError as e:
            raise HTTPException(status_code=422, detail=f"Invalid delivery locations: {e}")
        target_status = update_data.get("listing_status", listing.listing_status)
        if target_status != "draft" and not canonical_after:
            raise HTTPException(
                status_code=422,
                detail="Pick at least one delivery / meetup location before publishing.",
            )
        update_data["locations"] = json.dumps(canonical_after)

    # Primary spot (free text) — required when publishing (or staying published).
    if "location" in update_data:
        primary_after = (update_data.get("location") or "").strip() or None
        target_status = update_data.get("listing_status", listing.listing_status)
        if target_status != "draft" and not primary_after:
            raise HTTPException(
                status_code=422,
                detail="Enter your primary meetup spot before publishing.",
            )
        update_data["location"] = primary_after

    # If this save provides a real primary spot AND a non-empty canonical list,
    # the migration prompt has been resolved — clear the flag automatically.
    final_primary = update_data.get("location", listing.location)
    final_canonical = (
        canonical_after if canonical_after is not None
        else (json.loads(listing.locations) if listing.locations else [])
    )
    if final_primary and final_canonical:
        update_data["needs_location_update"] = False

    # Handle photos / videos serialization. Block 5: reject explicit overcounts
    # rather than silently truncating — callers should know they sent too many.
    if "photos" in update_data and update_data["photos"] is not None:
        if len(update_data["photos"]) > 4:
            raise HTTPException(status_code=422, detail="Maximum 4 photos allowed per listing.")
        update_data["photos"] = json.dumps(update_data["photos"][:4])
    if "videos" in update_data and update_data["videos"] is not None:
        if len(update_data["videos"]) > 2:
            raise HTTPException(status_code=422, detail="Maximum 2 videos allowed per listing.")
        update_data["videos"] = json.dumps(update_data["videos"][:2])
    # Recompute expires_at if duration_days changed
    if "duration_days" in update_data and update_data["duration_days"]:
        update_data["expires_at"] = datetime.utcnow() + timedelta(days=update_data["duration_days"])
    for field, value in update_data.items():
        setattr(listing, field, value)
    db.commit()

    # Fire price-drop alert if price decreased
    new_price = listing.price
    if "price" in update_data and new_price < old_price:
        try:
            from app.routers.wishlist import notify_price_drop
            notify_price_drop(db, listing, old_price)
            db.commit()
        except Exception:
            pass
        # Also fan out to anyone whose PriceAlert just started matching after
        # the drop — but only for approved/visible listings.
        if listing.status == "approved":
            try:
                from app.services.price_alerts import notify_matching_price_alerts
                notify_matching_price_alerts(db, listing)
                db.commit()
            except Exception:
                pass

    # Fire restock alert if listing went back to active from paused/expired.
    # Block 2: a sold listing can NEVER be revived via a status flip — sellers
    # must use the Relist endpoint, which creates a fresh draft.
    new_status = listing.listing_status
    if "listing_status" in update_data and new_status == "active" and old_status in ("paused", "expired"):
        try:
            from app.routers.wishlist import notify_restock
            notify_restock(db, listing)
            db.commit()
        except Exception:
            pass

    # Notify wishlist owners if the listing was just marked sold.
    if "listing_status" in update_data and new_status == "sold" and old_status != "sold":
        try:
            from app.routers.wishlist import notify_listing_sold
            notify_listing_sold(db, listing)
            db.commit()
        except Exception:
            pass

    # Bust search caches whenever an already-approved (visible) listing is
    # edited, so name/price/photo/status changes appear within seconds
    # instead of waiting for the 60s search-cache TTL. Surgical: only the
    # affected category's bucket + the no-filter bucket. If the seller
    # changed category, bust both old and new.
    if listing.status == "approved":
        try:
            await invalidate_search_cache(old_category_id)
            new_category_id = listing.category_id
            if new_category_id and new_category_id != old_category_id:
                await invalidate_search_cache(new_category_id)
        except Exception:
            pass

    return {"success": True, "message": "Listing updated"}


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a listing owned by this seller.

    FIX #15: collect the listing's CloudinaryAsset IDs BEFORE the cascade
    delete drops them, then enqueue a Celery task to destroy them in
    Cloudinary off the request path.
    """
    from app.models import CloudinaryAsset
    listing = (
        db.query(Price)
        .filter(Price.id == listing_id, Price.submitted_by == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    asset_ids = [
        row[0]
        for row in db.query(CloudinaryAsset.id)
        .filter(CloudinaryAsset.listing_id == listing.id)
        .all()
    ]
    deleted_category_id = listing.category_id  # captured before cascade

    # FK-aware delete: clear every child row referencing prices.id first.
    # Plain db.delete(listing) leaves SQLAlchemy to set-null children, which
    # crashes on NOT NULL FKs like flash_sales.price_id.
    from app.services.listing_cleanup import delete_listing_with_children
    delete_listing_with_children(db, listing)
    db.commit()

    if asset_ids:
        try:
            from app.tasks.media_tasks import delete_cloudinary_assets
            delete_cloudinary_assets.delay(asset_ids)
        except Exception as e:
            # Broker down: log and continue. The DB rows are already gone;
            # orphans can be reconciled with a periodic sweep.
            print(f"[seller] Cloudinary cleanup enqueue failed: {e}")

    # Deleted listing must vanish from search results immediately.
    try:
        await invalidate_search_cache(deleted_category_id)
    except Exception:
        pass

    return {"success": True, "message": "Listing deleted"}


# ── Analytics ────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_seller_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller analytics — monthly submission count + top listings."""
    uid = current_user.id
    now = now_wat()

    # Monthly submissions (last 6 months)
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    months_labels = []
    listings_data = []
    views_data = []

    for offset in range(5, -1, -1):
        m = (now.month - offset - 1) % 12 + 1
        y = now.year - ((now.month - offset - 1) // 12)

        count = (
            db.query(Price)
            .filter(
                Price.submitted_by == uid,
                extract("month", Price.submitted_at) == m,
                extract("year", Price.submitted_at) == y,
            )
            .count()
        )

        total_views = (
            db.query(func.sum(Price.view_count))
            .filter(
                Price.submitted_by == uid,
                extract("month", Price.submitted_at) == m,
                extract("year", Price.submitted_at) == y,
            )
            .scalar() or 0
        )

        months_labels.append(month_names[m - 1])
        listings_data.append(count)
        views_data.append(int(total_views))

    # Top performing listings
    top_listings = (
        db.query(Price)
        .filter(Price.submitted_by == uid, Price.status == "approved")
        .order_by(Price.view_count.desc())
        .limit(5)
        .all()
    )

    # Price benchmarking: find avg price per category for seller's items
    benchmarks = []
    seller_prices = (
        db.query(Price)
        .filter(Price.submitted_by == uid, Price.status == "approved")
        .limit(10)
        .all()
    )
    for p in seller_prices:
        avg = (
            db.query(func.avg(Price.price))
            .filter(
                Price.category_id == p.category_id,
                Price.status == "approved",
                Price.name.ilike(f"%{p.name.split()[0]}%"),
                Price.id != p.id,
            )
            .scalar()
        )
        if avg:
            benchmarks.append({
                "listing_id": p.id,
                "name": p.name,
                "your_price": p.price,
                "avg_market_price": round(float(avg), 2),
                "competitive": p.price <= float(avg),
            })

    # Block 9 — real order / revenue / rating numbers, no hardcoded values.
    # Pulled here at the end so they layer onto the existing months/charts
    # response without changing the shape the frontend already consumes.
    total_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == uid
    ).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == uid, Order.status == "completed"
    ).scalar() or 0
    revenue_estimate = db.execute(
        sa_text(
            "SELECT COALESCE(SUM(p.price), 0) FROM orders o "
            "JOIN prices p ON p.id = o.listing_id "
            "WHERE o.seller_id = :sid AND o.status = 'completed'"
        ),
        {"sid": uid},
    ).scalar() or 0
    avg_rating_row = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == uid, Review.is_flagged == False
    ).scalar()
    category_dist_rows = db.execute(
        sa_text(
            "SELECT c.name, COUNT(p.id) AS cnt "
            "FROM prices p JOIN categories c ON p.category_id = c.id "
            "WHERE p.submitted_by = :sid "
            "GROUP BY c.name ORDER BY cnt DESC"
        ),
        {"sid": uid},
    ).fetchall()

    return {
        "success": True,
        "data": {
            "months": months_labels,
            "listings": listings_data,
            "views": views_data,
            "topListings": [
                {"id": p.id, "name": p.name, "views": p.view_count, "price": p.price}
                for p in top_listings
            ],
            "benchmarks": benchmarks[:5],
            # Block 9 additions — all real DB-derived values
            "total_views": int(sum(views_data)),
            "total_orders": int(total_orders),
            "completed_orders": int(completed_orders),
            "revenue_estimate": float(revenue_estimate),
            "avg_rating": (
                round(float(avg_rating_row), 1) if avg_rating_row else None
            ),
            "category_distribution": [
                {"category": r[0], "count": r[1]} for r in category_dist_rows
            ],
        },
    }


# ── Verification status ─────────────────────────────────────────────────

@router.get("/verification")
@limiter.limit("120/minute")
async def get_seller_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get this seller's verification status."""
    v = (
        db.query(SellerVerification)
        .filter(SellerVerification.user_id == current_user.id)
        .order_by(SellerVerification.submitted_at.desc())
        .first()
    )
    if not v:
        return {"success": True, "data": None}
    return {
        "success": True,
        "data": {
            "id": v.id,
            "sellerName": v.seller_name,
            "matricNo": v.matric_no,
            "faculty": v.faculty,
            "businessName": v.business_name,
            "businessDescription": v.business_description,
            "email": v.email,
            "status": v.status,
            "adminNotes": v.admin_notes,
            "documentUrl": v.document_url,
            "portalScreenshotUrl": v.portal_screenshot_url,
            "submittedAt": v.submitted_at.isoformat(),
            "reviewedAt": v.reviewed_at.isoformat() if v.reviewed_at else None,
        },
    }


@router.post("/verification/docs")
@limiter.limit("3/day")
async def submit_seller_verification_docs(
    request: Request,
    matric_number: str = Form(...),
    seller_name: str = Form(...),
    email: str = Form(...),
    id_card_url: str | None = Form(None),
    portal_url: str | None = Form(None),
    faculty: str | None = Form(None),
    business_name: str | None = Form(None),
    business_description: str | None = Form(None),
    business_category: str | None = Form(None),
    pickup_location: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Seller submits/updates their verification documents.
    Creates a new SellerVerification row (or updates an existing Pending/Rejected one).

    FIX #6: user identity comes from the JWT (`current_user`) — the old
    `user_id` Form field has been removed so clients can't impersonate.
    FIX #7: both ID card and portal screenshot are required.
    """
    matric_number = matric_number.strip().upper()
    if not id_card_url or not portal_url:
        raise HTTPException(
            status_code=422,
            detail="Both ID card and portal screenshot are required.",
        )

    # Block resubmission if THIS email is already tied to an approved verification
    # under a different account. One verified seller per email — full stop.
    email_norm = (email or current_user.email or "").strip().lower()
    if email_norm:
        from sqlalchemy import func as _func
        approved_other = (
            db.query(SellerVerification)
            .filter(
                _func.lower(SellerVerification.email) == email_norm,
                SellerVerification.status == "Approved",
                SellerVerification.user_id != current_user.id,
            )
            .first()
        )
        if approved_other:
            support_addr = (os.getenv("SUPPORT_EMAIL") or os.getenv("ADMIN_EMAIL") or "").strip()
            contact_clause = (
                f"If you've lost access, contact support at {support_addr}."
                if support_addr
                else "If you've lost access, please contact support."
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "EMAIL_ALREADY_VERIFIED",
                    "message": (
                        "This email is already linked to a verified seller account. "
                        "Each email can only be verified once. "
                        f"{contact_clause}"
                    ),
                },
            )

    # Reuse an existing Pending/Under Review/Rejected row for the same user
    existing = (
        db.query(SellerVerification)
        .filter(SellerVerification.user_id == current_user.id)
        .order_by(SellerVerification.submitted_at.desc())
        .first()
    )

    if existing and existing.status in ("Pending", "Under Review", "Rejected"):
        existing.matric_no = matric_number
        existing.seller_name = seller_name or existing.seller_name
        existing.email = email or existing.email
        if faculty:
            existing.faculty = faculty
        if business_name:
            existing.business_name = business_name
        if business_description is not None:
            existing.business_description = business_description
        if business_category is not None:
            existing.business_category = business_category
        if pickup_location is not None:
            existing.pickup_location = pickup_location
        existing.document_url = id_card_url
        if portal_url:
            existing.portal_screenshot_url = portal_url
        # Reset to Pending on resubmit from Rejected
        existing.status = "Pending"
        existing.admin_notes = None
        existing.submitted_at = now_wat()
        db.commit()
        db.refresh(existing)
        verification = existing
    else:
        if existing and existing.status == "Approved":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "USER_ALREADY_VERIFIED",
                    "message": "Your seller account is already verified. No resubmission needed.",
                },
            )
        verification = SellerVerification(
            user_id=current_user.id,
            seller_name=seller_name or current_user.display_name or current_user.username,
            matric_no=matric_number,
            faculty=faculty or "Unknown",
            business_name=business_name or (current_user.display_name or current_user.username),
            business_description=business_description,
            business_category=business_category,
            pickup_location=pickup_location,
            email=email or current_user.email,
            document_url=id_card_url,
            portal_screenshot_url=portal_url,
            status="Pending",
        )
        db.add(verification)
        db.commit()
        db.refresh(verification)

    # Notify admin (best-effort)
    try:
        from app.services.admin_notifications import notify_admin
        await notify_admin(
            db, "verification_docs_uploaded", current_user.id,
            current_user.email, "seller",
            {"seller_name": verification.seller_name, "matric_no": matric_number},
            requires_action=True,
        )
    except Exception:
        pass

    # ── Admin email + seller confirmation email (best-effort) ──────────────
    # Sent on every submission (new + resubmit) so admins always see the
    # latest documents — even when admins aren't logged in.
    try:
        from app.services.email_templates import (
            SELLER_VERIFICATION_ADMIN_EMAIL,
            SELLER_VERIFICATION_SUBMITTED_EMAIL,
        )
        from app.tasks.email_tasks import send_email
        from app.config import settings as _settings

        now_str = datetime.utcnow().strftime("%d %b %Y at %H:%M UTC")
        display_seller_name = (
            verification.seller_name
            or current_user.display_name
            or current_user.username
        )
        matric_value = matric_number or verification.matric_no

        # Build the admin URL purely from APP_URL so a domain change only
        # needs an env update — no production-only hardcoded host.
        admin_url = (_settings.APP_URL or "").rstrip("/")
        if admin_url and not admin_url.endswith("/admin"):
            admin_url = f"{admin_url}/admin"

        admin_to = _settings.ADMIN_EMAIL
        if admin_to:
            send_email.delay(
                to=admin_to,
                subject=(
                    f"[Action Required] New Seller Verification "
                    f"— @{current_user.username} ({display_seller_name})"
                ),
                body=(
                    f"New seller verification request from "
                    f"{display_seller_name} (@{current_user.username})\n"
                    f"Email: {current_user.email}\n"
                    f"Matric: {matric_value or 'Not provided'}\n"
                    f"ID Card: {id_card_url}\n"
                    f"Portal: {portal_url}\n"
                    f"Submitted: {now_str}\n\n"
                    f"Review at: {admin_url}/verifications"
                ),
                html=SELLER_VERIFICATION_ADMIN_EMAIL(
                    seller_name=display_seller_name,
                    seller_email=current_user.email or "",
                    seller_username=current_user.username,
                    matric_number=matric_value,
                    id_card_url=id_card_url,
                    portal_url=portal_url,
                    submitted_at=now_str,
                    admin_url=admin_url,
                    verif_id=verification.id,
                ),
            )

        # Confirmation to the seller
        if current_user.email:
            send_email.delay(
                to=current_user.email,
                subject="Verification submitted — Campify",
                body=(
                    f"Hi {display_seller_name},\n\n"
                    f"We received your verification documents and will review "
                    f"them within 24-48 hours.\n\n"
                    f"We'll notify you by email once reviewed.\n\n"
                    f"— Campify Team"
                ),
                html=SELLER_VERIFICATION_SUBMITTED_EMAIL(display_seller_name),
            )
    except Exception:
        # Emails are best-effort; never fail the submission because of them.
        pass

    return {
        "success": True,
        "message": "Verification documents submitted. An admin will review shortly.",
        "verification_id": verification.id,
        "status": verification.status,
    }


# ── Listing status management ────────────────────────────────────────────

class ListingStatusUpdate(BaseModel):
    listing_status: str  # draft / active / paused / sold / expired


@router.patch("/listings/{listing_id}/listing-status")
async def set_listing_status(
    listing_id: int,
    data: ListingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set the listing_status of a seller's listing.

    Block 2: sold listings are terminal — they can be edited and viewed in the
    seller dashboard, but the only path back to the marketplace is the Relist
    endpoint (which creates a fresh draft copy). Trying to flip sold→anything-
    else returns 409.
    """
    allowed = {"draft", "active", "paused", "sold", "expired"}
    if data.listing_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {allowed}")
    listing = db.query(Price).filter(
        Price.id == listing_id, Price.submitted_by == current_user.id
    ).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    old_status = listing.listing_status
    if old_status == "sold" and data.listing_status != "sold":
        raise HTTPException(
            status_code=409,
            detail="This listing is marked sold. Use Relist to put it back on the marketplace as a fresh listing.",
        )

    listing.listing_status = data.listing_status
    db.commit()

    # Notify wishlist owners on the sold transition.
    if data.listing_status == "sold" and old_status != "sold":
        try:
            from app.routers.wishlist import notify_listing_sold
            notify_listing_sold(db, listing)
            db.commit()
        except Exception:
            pass

    # Status flips on an approved listing directly change its visibility in
    # search results — bust caches so the change is immediate.
    if listing.status == "approved":
        try:
            await invalidate_search_cache(listing.category_id)
        except Exception:
            pass
    return {"success": True, "listing_status": data.listing_status}


def _clone_as_draft(src: Price, current_user_id: int, *, name_suffix: str = " (Copy)") -> Price:
    """Build (don't persist) a fresh draft clone of `src`.

    Copies: listing identity (name+suffix, brand, pack info, category, condition,
    description), commercial terms (price, delivery options/fee, duration_days,
    is_negotiable, quantity), media (photos, videos), and locations (free-text
    primary spot + canonical array).

    Resets: status=pending (re-approval required), listing_status=draft,
    view_count=0, is_featured=False, featured_until=None, paused_by_vacation=False.
    """
    return Price(
        name=f"{src.name}{name_suffix}",
        category_id=src.category_id,
        price=src.price,
        brand=src.brand,
        pack_size=src.pack_size,
        pack_unit=src.pack_unit,
        location=src.location,
        locations=src.locations or "[]",
        store_id=src.store_id,
        submitted_by=current_user_id,
        status="pending",
        description=src.description,
        subcategory=src.subcategory,
        condition=src.condition,
        quantity=src.quantity,
        is_negotiable=src.is_negotiable,
        delivery_options=src.delivery_options,
        delivery_fee=src.delivery_fee,
        duration_days=src.duration_days,
        expires_at=(datetime.utcnow() + timedelta(days=src.duration_days)) if src.duration_days else None,
        listing_status="draft",
        paused_by_vacation=False,
        photos=src.photos,
        videos=src.videos,
        view_count=0,
        is_featured=False,
        featured_until=None,
    )


@router.post("/listings/{listing_id}/duplicate", status_code=201)
async def duplicate_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clone an existing listing as a new draft. Source may be any status."""
    src = db.query(Price).filter(
        Price.id == listing_id, Price.submitted_by == current_user.id
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail="Listing not found")
    clone = _clone_as_draft(src, current_user.id)
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {"success": True, "id": clone.id, "message": "Listing duplicated as draft"}


@router.post("/listings/{listing_id}/relist", status_code=201)
async def relist_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Relist a SOLD listing as a fresh draft.

    Block 2: sold listings are terminal — this is the only sanctioned path
    back onto the marketplace. The source listing stays in 'sold' state so the
    seller's history is preserved; the response carries the new draft's id so
    the UI can route the seller into edit mode for the fresh copy.
    """
    src = db.query(Price).filter(
        Price.id == listing_id, Price.submitted_by == current_user.id
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail="Listing not found")
    if src.listing_status != "sold":
        raise HTTPException(
            status_code=409,
            detail="Only sold listings can be relisted. To copy any other listing, use Duplicate.",
        )
    clone = _clone_as_draft(src, current_user.id, name_suffix="")
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {
        "success": True,
        "id": clone.id,
        "uuid": str(clone.uuid) if clone.uuid else None,
        "message": "Relisted as a fresh draft — review and publish when ready.",
    }


@router.post("/vacation")
async def toggle_vacation_mode(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle vacation mode. Active → pauses all listings; Off → restores only vacation-paused listings."""
    from sqlalchemy import text as _text
    new_mode = not (current_user.vacation_mode or False)
    current_user.vacation_mode = new_mode

    if new_mode:
        # Mark active listings as paused_by_vacation so we only restore these later
        db.execute(
            _text("UPDATE prices SET listing_status='paused', paused_by_vacation=1 "
                  "WHERE submitted_by=:uid AND listing_status='active'"),
            {"uid": current_user.id},
        )
    else:
        # Only restore listings that were paused by vacation, not manually-paused ones
        db.execute(
            _text("UPDATE prices SET listing_status='active', paused_by_vacation=0 "
                  "WHERE submitted_by=:uid AND listing_status='paused' AND paused_by_vacation=1"),
            {"uid": current_user.id},
        )

    db.commit()
    # Vacation toggles flip many listings at once — always bust caches.
    try:
        await invalidate_search_cache()
    except Exception:
        pass
    return {"success": True, "vacation_mode": new_mode}


# ── Inquiries ─────────────────────────────────────────────────────────────

@router.get("/inquiries")
async def get_seller_inquiries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all inquiries sent to this seller's listings."""
    # Block 5 — eager-load listing + buyer (+ buyer.profile) to avoid N+1
    # when serializing inquiry.listing.name / inquiry.buyer.uuid below.
    rows = (
        db.query(Inquiry)
        .options(
            joinedload(Inquiry.listing),
            joinedload(Inquiry.buyer).joinedload(User.profile),
        )
        .filter(Inquiry.seller_id == current_user.id)
        .order_by(Inquiry.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": i.id,
                "listing_id": i.listing_id,
                "listing_name": i.listing.name if i.listing else "",
                "buyer_id": i.buyer_id,
                "buyer_uuid": i.buyer.uuid if i.buyer else None,
                "buyer_name": i.buyer.display_name or i.buyer.username if i.buyer else "Unknown",
                "message": i.message,
                "seller_reply": i.seller_reply,
                "replied_at": i.replied_at.isoformat() if i.replied_at else None,
                "is_read": i.is_read,
                "label": i.label,
                "created_at": i.created_at.isoformat(),
            }
            for i in rows
        ],
        "unread_count": sum(1 for i in rows if not i.is_read),
    }


class InquiryReplyBody(BaseModel):
    reply: str = Field(..., min_length=1, max_length=4000)


@router.post("/inquiries/{inquiry_id}/reply")
async def reply_to_inquiry(
    inquiry_id: int,
    body: InquiryReplyBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a reply to a buyer inquiry. Also mirrors message into direct_messages
    so both parties see it in their unified inbox."""
    inquiry = db.query(Inquiry).filter(
        Inquiry.id == inquiry_id, Inquiry.seller_id == current_user.id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    text = body.reply.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Reply cannot be empty")

    from datetime import datetime as _dt
    inquiry.seller_reply = text
    inquiry.replied_at = _dt.utcnow()

    # Also store in direct messages so the buyer receives it in /messages
    try:
        from app.routers.messages import Conversation, DirectMessage, _get_or_create_conversation
        conv = _get_or_create_conversation(current_user.id, inquiry.buyer_id, db)
        dm = DirectMessage(conversation_id=conv.id, sender_id=current_user.id, content=text)
        db.add(dm)
        conv.last_message_at = _dt.utcnow()
        conv.last_message_preview = text[:200]
    except Exception:
        pass

    # Notify buyer
    try:
        notif = Notification(
            user_id=inquiry.buyer_id,
            type="inquiry_reply",
            title=f"Reply from {current_user.display_name or current_user.username}",
            body=text[:140],
            related_id=inquiry.id,
            related_type="Inquiry",
        )
        db.add(notif)
    except Exception:
        pass

    db.commit()
    return {
        "success": True,
        "replied_at": inquiry.replied_at.isoformat() if inquiry.replied_at else None,
    }


@router.patch("/inquiries/{inquiry_id}/read")
async def mark_inquiry_read(
    inquiry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inquiry = db.query(Inquiry).filter(
        Inquiry.id == inquiry_id, Inquiry.seller_id == current_user.id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    inquiry.is_read = True
    db.commit()
    return {"success": True}


class InquiryLabelUpdate(BaseModel):
    label: str | None = None   # Hot Lead / Pending / Completed / Spam / None (clear)


@router.patch("/inquiries/{inquiry_id}/label")
async def set_inquiry_label(
    inquiry_id: int,
    data: InquiryLabelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set a conversation label (Hot Lead / Pending / Completed / Spam) on an inquiry."""
    allowed = {None, "", "Hot Lead", "Pending", "Completed", "Spam"}
    if data.label not in allowed:
        raise HTTPException(status_code=400, detail="Label must be Hot Lead, Pending, Completed, Spam, or null")
    inquiry = db.query(Inquiry).filter(
        Inquiry.id == inquiry_id, Inquiry.seller_id == current_user.id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    inquiry.label = data.label
    db.commit()
    return {"success": True, "label": data.label}


# ── Profile update ───────────────────────────────────────────────────────

@router.patch("/profile")
async def update_seller_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update seller display name / email."""
    if data.display_name:
        current_user.display_name = data.display_name
    if data.email:
        current_user.email = data.email
    db.commit()
    return {
        "success": True,
        "message": "Profile updated",
        "display_name": current_user.display_name,
        "email": current_user.email,
    }


# ── Storefront & Profile Settings ───────────────────────────────────────

def _get_or_create_profile(user: User, db: Session) -> Profile:
    """Return the seller's Profile row, creating one if it doesn't exist yet."""
    if user.profile:
        return user.profile
    p = Profile(user_id=user.id)
    db.add(p)
    db.flush()
    return p


@router.get("/profile-settings")
async def get_profile_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all data needed to populate the seller settings form."""
    p = current_user.profile
    meta = (p.metadata_ or {}) if p else {}
    legacy = meta.get("policies", {}) if isinstance(meta, dict) else {}

    def _pol(col_val, key: str) -> str:
        return (col_val or "") or legacy.get(key, "")

    return {
        "success": True,
        "display_name": current_user.display_name or "",
        "avatar_url": (p.avatar_url if p else None) or current_user.avatar_url or "",
        "banner_url": (p.banner_url if p else None) or current_user.banner_url or "",
        "bio": current_user.bio or "",
        "slug": p.slug if p else "",
        "category": p.category if p else "",
        "business_name": p.business_name if p else "",
        "whatsapp": p.whatsapp if p else "",
        "show_whatsapp": (p.show_whatsapp if p else False) or False,
        "instagram": p.instagram if p else "",
        "availability_status": current_user.availability_status or "open",
        "vacation_mode": current_user.vacation_mode or False,
        "auto_reply": current_user.auto_reply_message or "",
        "pickup_policy":  _pol(p.pickup_policy  if p else None, "pickup_policy"),
        "return_policy":  _pol(p.return_policy  if p else None, "return_policy"),
        "payment_policy": _pol(p.payment_policy if p else None, "payment_policy"),
    }


class StorefrontUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    bio: str | None = Field(None, max_length=2000)
    avatar_url: str | None = None
    banner_url: str | None = None
    slug: str | None = Field(None, max_length=80)
    category: str | None = Field(None, max_length=100)
    whatsapp: str | None = Field(None, max_length=30)
    show_whatsapp: bool | None = None
    instagram: str | None = Field(None, max_length=80)


@router.patch("/storefront")
async def update_storefront(
    data: StorefrontUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update seller's storefront — display name, bio, avatar, banner, slug, socials."""
    # Validate slug uniqueness if changing
    if data.slug is not None:
        safe_slug = data.slug.strip().lower().replace(" ", "-")
        if safe_slug:
            conflict = (
                db.query(Profile)
                .filter(Profile.slug == safe_slug, Profile.user_id != current_user.id)
                .first()
            )
            if conflict:
                raise HTTPException(status_code=409, detail="That store URL is already taken")
        data.slug = safe_slug or None

    # Update User columns
    if data.display_name is not None:
        current_user.display_name = data.display_name.strip() or None
    if data.bio is not None:
        current_user.bio = data.bio.strip() or None
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url.strip() or None
    if data.banner_url is not None:
        current_user.banner_url = data.banner_url.strip() or None

    # Update Profile columns
    p = _get_or_create_profile(current_user, db)
    if data.display_name is not None:
        p.display_name = data.display_name.strip() or None
    if data.avatar_url is not None:
        p.avatar_url = data.avatar_url.strip() or None
    if data.banner_url is not None:
        p.banner_url = data.banner_url.strip() or None
    if data.slug is not None:
        p.slug = data.slug or None
    if data.category is not None:
        p.category = data.category.strip() or None
    if data.whatsapp is not None:
        p.whatsapp = data.whatsapp.strip() or None
    if data.show_whatsapp is not None:
        p.show_whatsapp = data.show_whatsapp
    if data.instagram is not None:
        p.instagram = data.instagram.strip().lstrip("@") or None

    db.commit()
    return {
        "success": True,
        "message": "Storefront updated",
        "display_name": current_user.display_name,
        "avatar_url": p.avatar_url or current_user.avatar_url,
        "banner_url": p.banner_url or current_user.banner_url,
    }


class PoliciesUpdate(BaseModel):
    pickup_policy: str | None = Field(None, max_length=1000)
    return_policy: str | None = Field(None, max_length=1000)
    payment_policy: str | None = Field(None, max_length=1000)


@router.patch("/policies")
async def update_policies(
    data: PoliciesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store pick-up, return, and payment policy text in dedicated Profile columns."""
    p = _get_or_create_profile(current_user, db)
    p.pickup_policy  = (data.pickup_policy  or "").strip() or None
    p.return_policy  = (data.return_policy  or "").strip() or None
    p.payment_policy = (data.payment_policy or "").strip() or None
    db.commit()
    return {"success": True, "message": "Policies updated"}


class ListingDefaultsUpdate(BaseModel):
    default_location: str | None = Field(None, max_length=200)
    default_duration: int | None = Field(None, ge=1, le=365)
    auto_renew: bool | None = None
    default_negotiable: bool | None = None


@router.patch("/listing-defaults")
async def update_listing_defaults(
    data: ListingDefaultsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Persist default listing preferences in seller profile metadata."""
    p = _get_or_create_profile(current_user, db)
    meta = dict(p.metadata_ or {})
    defaults = dict(meta.get("listing_defaults") or {})
    if data.default_location is not None:
        defaults["default_location"] = data.default_location.strip()
    if data.default_duration is not None:
        defaults["default_duration"] = data.default_duration
    if data.auto_renew is not None:
        defaults["auto_renew"] = data.auto_renew
    if data.default_negotiable is not None:
        defaults["default_negotiable"] = data.default_negotiable
    meta["listing_defaults"] = defaults
    p.metadata_ = meta
    db.commit()
    return {"success": True, "message": "Listing defaults updated", "listing_defaults": defaults}


@router.post("/downgrade")
async def downgrade_to_buyer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Voluntarily downgrade a seller account back to buyer role.

    Pauses all active listings so they disappear from the storefront,
    flips role to "buyer" (matches admin_stats filter), and notifies
    the user by email.
    """
    if current_user.role != "seller":
        raise HTTPException(status_code=400, detail="Account is not a seller account")

    db.query(Price).filter(
        Price.submitted_by == current_user.id,
        Price.listing_status == "active",
    ).update({"listing_status": "paused"})

    current_user.role = "buyer"
    db.commit()

    try:
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import SELLER_DOWNGRADE_EMAIL
        display = (
            (current_user.profile.display_name if current_user.profile else None)
            or current_user.display_name
            or current_user.username
            or "there"
        )
        asyncio.create_task(send_user_email_bg(
            current_user.email or "",
            "Your Campify seller account has been downgraded",
            SELLER_DOWNGRADE_EMAIL(display),
        ))
    except Exception:
        pass

    return {
        "success": True,
        "message": "Account downgraded to buyer. Your listings have been paused.",
    }


class AvailabilityUpdate(BaseModel):
    availability_status: str | None = Field(None, pattern="^(open|limited|closed)$")


@router.patch("/availability")
async def update_availability(
    data: AvailabilityUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the seller's store availability status (open / limited / closed)."""
    if data.availability_status:
        current_user.availability_status = data.availability_status
    db.commit()
    return {
        "success": True,
        "availability_status": current_user.availability_status,
    }


@router.get("/check-slug")
async def check_slug_available(
    slug: str = Query(..., min_length=2, max_length=80),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check whether a store URL slug is available."""
    safe = slug.lower().strip().replace(" ", "-")
    taken = (
        db.query(Profile)
        .filter(Profile.slug == safe, Profile.user_id != current_user.id)
        .first()
    )
    return {"available": taken is None, "slug": safe}


# ── Quick Replies ─────────────────────────────────────────────────────────

class QuickRepliesUpdate(BaseModel):
    replies: list = Field(..., description="Up to 5 preset reply strings")


@router.get("/quick-replies")
async def get_quick_replies(
    current_user: User = Depends(get_current_user),
):
    """Get seller's preset quick replies (up to 5)."""
    replies = []
    if current_user.quick_replies:
        try:
            replies = json.loads(current_user.quick_replies)
        except Exception:
            pass
    return {"success": True, "replies": replies}


@router.put("/quick-replies")
async def update_quick_replies(
    data: QuickRepliesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save up to 5 quick reply presets."""
    replies = [str(r).strip() for r in data.replies if str(r).strip()][:5]
    current_user.quick_replies = json.dumps(replies)
    db.commit()
    return {"success": True, "replies": replies}


# ── Auto-reply message ────────────────────────────────────────────────────

class AutoReplyUpdate(BaseModel):
    message: str | None = Field(None, max_length=500)


@router.get("/auto-reply")
async def get_auto_reply(current_user: User = Depends(get_current_user)):
    """Get seller's auto-reply/away message."""
    return {"success": True, "message": current_user.auto_reply_message}


@router.put("/auto-reply")
async def update_auto_reply(
    data: AutoReplyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or clear the seller's auto-reply message."""
    current_user.auto_reply_message = data.message
    db.commit()
    return {"success": True, "message": data.message}


# ── Seller Scorecard ─────────────────────────────────────────────────────

@router.get("/scorecard")
async def get_seller_scorecard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return seller's trust scorecard metrics."""
    uid = current_user.id
    total_inquiries = db.query(Inquiry).filter(Inquiry.seller_id == uid).count()
    read_inquiries = db.query(Inquiry).filter(
        Inquiry.seller_id == uid, Inquiry.is_read == True
    ).count()
    completed = db.query(Inquiry).filter(
        Inquiry.seller_id == uid, Inquiry.label == "Completed"
    ).count()

    response_rate = round((read_inquiries / total_inquiries * 100) if total_inquiries else 100.0, 1)
    completion_rate = round((completed / total_inquiries * 100) if total_inquiries else 100.0, 1)

    avg_rating_row = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == current_user.id, Review.is_flagged == False
    ).scalar()
    avg_rating = round(float(avg_rating_row), 1) if avg_rating_row else None
    review_count = db.query(Review).filter(
        Review.seller_id == current_user.id, Review.is_flagged == False
    ).count()

    # Recalculate trust tier based on current points
    pts = current_user.seller_points or 0
    if pts >= 500:
        tier = "top_seller"
    elif pts >= 200:
        tier = "trusted"
    elif pts >= 50:
        tier = "rising"
    else:
        tier = "new_seller"

    if current_user.trust_tier != tier:
        current_user.trust_tier = tier
        db.commit()

    return {
        "success": True,
        "data": {
            "response_rate": response_rate,
            "avg_response_hours": current_user.avg_response_hours or 0.0,
            "completion_rate": completion_rate,
            "no_show_count": current_user.no_show_count or 0,
            "avg_rating": avg_rating,
            "review_count": review_count,
            "seller_points": pts,
            "trust_tier": tier,
        },
    }


# ── Karma / Points ────────────────────────────────────────────────────────

KARMA_POINTS: dict[str, int] = {
    "first_listing":      10,
    "first_sale":         25,
    "five_star_review":   15,
    "four_star_review":    8,
    "three_star_review":   3,
    "review_left":         5,
    "profile_completed":  50,
    "order_completed":    10,
    "purchase_confirmed": 10,
    "seller_verified":   100,
    "email_verified":     20,
    "price_submission":    5,
    "fast_reply_week":     5,
    "referral_signup":    30,
}


def _award_points(db: Session, user: User, reason: str, listing_id: int | None = None):
    """Award karma points using KARMA_POINTS map and update trust tier."""
    amount = KARMA_POINTS.get(reason, 0)
    if amount == 0:
        return
    user.seller_points = max(0, (user.seller_points or 0) + amount)
    tx = PointsTransaction(user_id=user.id, amount=amount, reason=reason, related_price_id=listing_id)
    db.add(tx)
    # Recalc tier
    pts = user.seller_points
    if pts >= 500:
        user.trust_tier = "top_seller"
    elif pts >= 200:
        user.trust_tier = "trusted"
    elif pts >= 50:
        user.trust_tier = "rising"
    else:
        user.trust_tier = "new_seller"


@router.post("/karma/profile-complete")
async def award_profile_complete_points(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Award 50 points for completing seller profile (one-time)."""
    already = db.query(PointsTransaction).filter(
        PointsTransaction.user_id == current_user.id,
        PointsTransaction.reason == "profile_completed",
    ).first()
    if already:
        return {"success": False, "message": "Points already awarded for profile completion"}
    if not (current_user.bio and current_user.avatar_url and current_user.display_name):
        return {"success": False, "message": "Please complete bio, display name, and avatar first"}
    _award_points(db, current_user, "profile_completed")
    db.commit()
    return {"success": True, "points_awarded": 50, "new_total": current_user.seller_points}


@router.get("/karma/history")
async def get_karma_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get karma points transaction history."""
    txs = (
        db.query(PointsTransaction)
        .filter(PointsTransaction.user_id == current_user.id)
        .order_by(PointsTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "success": True,
        "total_points": current_user.seller_points,
        "trust_tier": current_user.trust_tier,
        "history": [
            {
                "id": t.id,
                "amount": t.amount,
                "reason": t.reason,
                "listing_id": t.related_price_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in txs
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# Section 4 — Orders & Leads
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/orders")
async def get_seller_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller sees incoming orders."""
    orders = (
        db.query(Order)
        .filter(Order.seller_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [_order_dict(o) for o in orders]


@router.post("/listings/{listing_id}/interested", status_code=201)
async def log_interested(
    listing_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Called when a buyer clicks 'Message Seller'. Logs a Lead record.
    Works for both authenticated and anonymous users.
    """
    listing = db.query(Price).filter(Price.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    raw_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(raw_ip.encode()).hexdigest()[:16]

    lead = Lead(
        listing_id=listing_id,
        buyer_id=current_user.id if current_user else None,
        ip_hash=ip_hash,
    )
    db.add(lead)
    db.commit()
    return {"success": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 5 — Seller self-service: pause / reactivation request / delete request
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class DeletionRequestBody(BaseModel):
    reason: str | None = None


@router.post("/pause-account")
async def seller_pause_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block 5A — Seller pauses their own account and hides all listings."""
    current_user.is_paused  = True
    current_user.paused_at  = datetime.utcnow()
    current_user.paused_by  = "self"
    current_user.pause_reason = "Paused by seller"

    db.query(Price).filter(
        Price.submitted_by == current_user.id, Price.listing_status == "active"
    ).update({"listing_status": "paused"})

    db.commit()

    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import SELLER_SELF_PAUSED_EMAIL
    await notify_admin(db, "account_paused", current_user.id,
                       current_user.email or "", "seller", {"paused_by": "self"})
    asyncio.create_task(send_user_email_bg(
        current_user.email or "",
        "Your Campify seller account is now paused",
        SELLER_SELF_PAUSED_EMAIL(current_user.display_name or current_user.username or "Seller"),
    ))

    return {"success": True, "message": "Account paused. All listings are now hidden."}


@router.post("/request-reactivate")
async def seller_request_reactivate(
    current_user: User = Depends(get_user_allow_paused),
    db: Session = Depends(get_db),
):
    """
    Block 5B — Paused seller requests reactivation.
    Uses get_user_allow_paused so paused users can still hit this endpoint.
    """
    current_user.reactivation_requested_at = datetime.utcnow()
    db.commit()

    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import REACTIVATION_REQUEST_EMAIL
    await notify_admin(
        db, "reactivation_requested", current_user.id,
        current_user.email or "", current_user.role,
        {"requested_at": datetime.utcnow().isoformat()},
        requires_action=True,
    )
    asyncio.create_task(send_user_email_bg(
        current_user.email or "",
        "Reactivation request received — Campify",
        REACTIVATION_REQUEST_EMAIL(current_user.display_name or current_user.username or "Seller"),
    ))

    return {
        "success": True,
        "message": "Reactivation request submitted. Admin will review within 24 hours.",
    }


@router.post("/request-deletion")
async def seller_request_deletion(
    body: DeletionRequestBody,
    current_user: User = Depends(get_user_allow_paused),
    db: Session = Depends(get_db),
):
    """
    Block 5C — Seller requests account deletion.
    Uses get_user_allow_paused so paused users can still submit.
    """
    current_user.deletion_requested_at    = datetime.utcnow()
    current_user.deletion_request_reason  = body.reason or "No reason provided"
    db.commit()

    listing_count = db.query(Price).filter(Price.submitted_by == current_user.id).count()

    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import DELETION_REQUEST_EMAIL
    await notify_admin(
        db, "account_delete_request",
        current_user.id, current_user.email or "", current_user.role,
        {
            "reason":       current_user.deletion_request_reason,
            "requested_at": datetime.utcnow().isoformat(),
            "listing_count": listing_count,
        },
        requires_action=True,
    )
    asyncio.create_task(send_user_email_bg(
        current_user.email or "",
        "Account deletion request received — Campify",
        DELETION_REQUEST_EMAIL(current_user.display_name or current_user.username or "Seller"),
    ))

    return {
        "success": True,
        "message": (
            "Deletion request submitted. Admin will process within 48 hours. "
            "You will receive a confirmation email."
        ),
    }
