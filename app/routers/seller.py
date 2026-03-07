"""
Seller Dashboard API — stats, listings management, analytics.
All endpoints require a valid JWT token (seller role).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field

import json
from app.database import SessionLocal
from app.models import Price, User, PointsTransaction, SellerVerification, FlashSale, Inquiry, Notification, Review
from app.routers.auth import get_current_user

router = APIRouter(prefix="/seller", tags=["Seller Dashboard"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ──────────────────────────────────────────────────────────────

class ListingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category_id: int = Field(..., gt=0)
    price: float = Field(..., gt=0, le=10000000)
    brand: Optional[str] = Field(None, max_length=100)
    pack_size: Optional[str] = Field(None, max_length=50)
    pack_unit: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=200)
    store_id: Optional[int] = Field(None, gt=0)
    # New marketplace fields
    description: Optional[str] = Field(None, max_length=2000)
    subcategory: Optional[str] = Field(None, max_length=100)
    condition: Optional[str] = Field("New")              # New / Fairly Used / Used
    quantity: Optional[int] = Field(1, ge=1, le=9999)
    is_negotiable: Optional[bool] = Field(False)
    delivery_options: Optional[str] = Field(None)        # "pickup", "delivery", "pickup,delivery"
    duration_days: Optional[int] = Field(30)             # 7 / 14 / 30
    listing_status: Optional[str] = Field("active")      # draft / active
    photos: Optional[list] = Field(default_factory=list) # up to 5 Cloudinary URLs


class ListingUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[float] = Field(None, gt=0, le=10000000)
    brand: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    subcategory: Optional[str] = Field(None, max_length=100)
    condition: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1, le=9999)
    is_negotiable: Optional[bool] = None
    delivery_options: Optional[str] = None
    duration_days: Optional[int] = None
    listing_status: Optional[str] = None
    photos: Optional[list] = None


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)


# ── Dashboard Overview ───────────────────────────────────────────────────

@router.get("/stats")
async def get_seller_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller dashboard overview stats."""
    uid = current_user.id

    total_listings = db.query(Price).filter(Price.submitted_by == uid).count()
    active_listings = db.query(Price).filter(
        Price.submitted_by == uid, Price.listing_status == "active"
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
    confirmed_sales = (
        db.query(PointsTransaction)
        .filter(PointsTransaction.user_id == uid, PointsTransaction.reason == "purchase_confirmed")
        .count()
    )

    # Verification status
    verification = (
        db.query(SellerVerification)
        .filter(SellerVerification.user_id == uid)
        .order_by(SellerVerification.submitted_at.desc())
        .first()
    )

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
            "verificationStatus": verification.status if verification else "Not submitted",
        },
    }


# ── Listings CRUD ────────────────────────────────────────────────────────

def _listing_dict(p: Price) -> dict:
    """Serialize a Price/listing to dict including all marketplace fields."""
    return {
        "id": p.id,
        "name": p.name,
        "brand": p.brand,
        "price": p.price,
        "location": p.location,
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
        "duration_days": p.duration_days,
        "expires_at": p.expires_at.isoformat() if p.expires_at else None,
        "photos": json.loads(p.photos) if p.photos else [],
        "pack_size": p.pack_size,
        "pack_unit": p.pack_unit,
    }


@router.get("/listings")
async def get_seller_listings(
    status_filter: Optional[str] = Query(None),
    listing_status: Optional[str] = Query(None),
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
    expires_at = None
    if data.duration_days:
        expires_at = datetime.utcnow() + timedelta(days=data.duration_days)

    listing = Price(
        name=data.name,
        category_id=data.category_id,
        price=data.price,
        brand=data.brand,
        pack_size=data.pack_size,
        pack_unit=data.pack_unit,
        location=data.location,
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
        duration_days=data.duration_days,
        expires_at=expires_at,
        listing_status=data.listing_status or "active",
        photos=json.dumps(data.photos[:5]) if data.photos else None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    # Notify followers if listing is active (not draft)
    if listing.listing_status != "draft":
        try:
            from app.routers.wishlist import notify_new_listing
            notify_new_listing(db, listing, current_user)
            db.commit()
        except Exception:
            pass

    msg = "Listing saved as draft" if listing.listing_status == "draft" else "Listing submitted for approval"
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

    # Handle photos serialization
    if "photos" in update_data and update_data["photos"] is not None:
        update_data["photos"] = json.dumps(update_data["photos"][:5])
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

    # Fire restock alert if listing went back to active from sold/paused
    new_status = listing.listing_status
    if "listing_status" in update_data and new_status == "active" and old_status in ("sold", "paused", "expired"):
        try:
            from app.routers.wishlist import notify_restock
            notify_restock(db, listing)
            db.commit()
        except Exception:
            pass

    return {"success": True, "message": "Listing updated"}


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a listing owned by this seller."""
    listing = (
        db.query(Price)
        .filter(Price.id == listing_id, Price.submitted_by == current_user.id)
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.delete(listing)
    db.commit()
    return {"success": True, "message": "Listing deleted"}


# ── Analytics ────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_seller_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller analytics — monthly submission count + top listings."""
    uid = current_user.id
    now = datetime.utcnow()

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
        },
    }


# ── Verification status ─────────────────────────────────────────────────

@router.get("/verification")
async def get_seller_verification(
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
            "submittedAt": v.submitted_at.isoformat(),
            "reviewedAt": v.reviewed_at.isoformat() if v.reviewed_at else None,
        },
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
    """Set the listing_status of a seller's listing."""
    allowed = {"draft", "active", "paused", "sold", "expired"}
    if data.listing_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {allowed}")
    listing = db.query(Price).filter(
        Price.id == listing_id, Price.submitted_by == current_user.id
    ).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.listing_status = data.listing_status
    db.commit()
    return {"success": True, "listing_status": data.listing_status}


@router.post("/listings/{listing_id}/duplicate", status_code=201)
async def duplicate_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clone an existing listing as a new draft."""
    src = db.query(Price).filter(
        Price.id == listing_id, Price.submitted_by == current_user.id
    ).first()
    if not src:
        raise HTTPException(status_code=404, detail="Listing not found")
    clone = Price(
        name=f"{src.name} (Copy)",
        category_id=src.category_id,
        price=src.price,
        brand=src.brand,
        pack_size=src.pack_size,
        pack_unit=src.pack_unit,
        location=src.location,
        store_id=src.store_id,
        submitted_by=current_user.id,
        status="pending",
        description=src.description,
        subcategory=src.subcategory,
        condition=src.condition,
        quantity=src.quantity,
        is_negotiable=src.is_negotiable,
        delivery_options=src.delivery_options,
        duration_days=src.duration_days,
        expires_at=(datetime.utcnow() + timedelta(days=src.duration_days)) if src.duration_days else None,
        listing_status="draft",
        photos=src.photos,
        view_count=0,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return {"success": True, "id": clone.id, "message": "Listing duplicated as draft"}


@router.post("/vacation")
async def toggle_vacation_mode(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle vacation mode. Active → pauses all listings; Off → restores them to active."""
    new_mode = not (current_user.vacation_mode or False)
    current_user.vacation_mode = new_mode

    if new_mode:
        # Pause all active listings
        db.query(Price).filter(
            Price.submitted_by == current_user.id,
            Price.listing_status == "active",
        ).update({"listing_status": "paused"}, synchronize_session=False)
    else:
        # Restore paused → active
        db.query(Price).filter(
            Price.submitted_by == current_user.id,
            Price.listing_status == "paused",
        ).update({"listing_status": "active"}, synchronize_session=False)

    db.commit()
    return {"success": True, "vacation_mode": new_mode}


# ── Inquiries ─────────────────────────────────────────────────────────────

@router.get("/inquiries")
async def get_seller_inquiries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all inquiries sent to this seller's listings."""
    rows = (
        db.query(Inquiry)
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
                "buyer_name": i.buyer.display_name or i.buyer.username if i.buyer else "Unknown",
                "message": i.message,
                "is_read": i.is_read,
                "created_at": i.created_at.isoformat(),
            }
            for i in rows
        ],
        "unread_count": sum(1 for i in rows if not i.is_read),
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
    label: Optional[str] = None   # Pending / Completed / Spam / None (clear)


@router.patch("/inquiries/{inquiry_id}/label")
async def set_inquiry_label(
    inquiry_id: int,
    data: InquiryLabelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set a conversation label (Pending / Completed / Spam) on an inquiry."""
    allowed = {None, "Pending", "Completed", "Spam"}
    if data.label not in allowed:
        raise HTTPException(status_code=400, detail="Label must be Pending, Completed, Spam, or null")
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
    message: Optional[str] = Field(None, max_length=500)


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
        Review.seller_id == uid, Review.is_flagged == False
    ).scalar()
    avg_rating = round(float(avg_rating_row), 1) if avg_rating_row else None
    review_count = db.query(Review).filter(
        Review.seller_id == uid, Review.is_flagged == False
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

def _award_points(db: Session, user: User, amount: int, reason: str, listing_id: Optional[int] = None):
    """Award karma points and update trust tier."""
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
        PointsTransaction.reason == "profile_complete",
    ).first()
    if already:
        return {"success": False, "message": "Points already awarded for profile completion"}
    if not (current_user.bio and current_user.avatar_url and current_user.display_name):
        return {"success": False, "message": "Please complete bio, display name, and avatar first"}
    _award_points(db, current_user, 50, "profile_complete")
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
