"""
Public storefront endpoints — listing detail, seller pages, follow, inquiry, report, stats.
No auth required for read endpoints; auth required for follow/inquiry/report.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json
from datetime import datetime
from app.utils.timezone import now_wat, format_wat_iso
from typing import Optional

from app.database import get_db
from app.models import Price, User, Category, Follow, Inquiry, Report, BlockedUser, Review, Notification, SellerVerification, Announcement
from app.routers.auth import get_current_user, decode_access_token
from sqlalchemy import func

router = APIRouter(prefix="/storefront", tags=["Storefront"])


def _seller_info(seller: User, db: Session) -> dict:
    follower_count = db.query(Follow).filter(Follow.seller_id == seller.id).count()
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == seller.id, Review.is_flagged == False
    ).scalar()
    review_count = db.query(Review).filter(
        Review.seller_id == seller.id, Review.is_flagged == False
    ).count()

    # 3b — Verified badge: role is seller AND has an approved verification record
    verification = (
        db.query(SellerVerification)
        .filter(SellerVerification.user_id == seller.id)
        .order_by(SellerVerification.submitted_at.desc())
        .first()
    )
    is_verified = seller.role == "seller" and (
        verification is not None and verification.status == "Approved"
    )

    # Normalised verification status for Feature 3
    if verification is None:
        verification_status = "none"
    else:
        s = verification.status.lower()
        if s == "approved":
            verification_status = "approved"
        elif s in ("pending", "under review"):
            verification_status = "pending"
        elif s == "rejected":
            verification_status = "rejected"
        else:
            verification_status = "none"

    # 3c — Departmental trust signal from verification record
    faculty = verification.faculty if verification else getattr(seller, "department", None)
    trust_signal = f"Seller is in {faculty}" if faculty else None

    # Pull social / policy data from the Profile row if it exists
    prof = seller.profile
    meta = (prof.metadata_ or {}) if prof else {}
    policies = meta.get("policies", {}) if isinstance(meta, dict) else {}

    # Policy fields: prefer dedicated columns, fall back to metadata_ for old records
    def _policy(col_val, meta_key: str) -> str | None:
        if col_val:
            return col_val
        return policies.get(meta_key) or None

    return {
        "id": seller.id,
        "uuid": seller.uuid,
        "username": seller.username,
        "display_name": (prof.display_name if prof and prof.display_name else None) or seller.display_name or seller.username,
        "avatar_url": (prof.avatar_url if prof else None) or seller.avatar_url,
        "banner_url": (prof.banner_url if prof else None) or seller.banner_url,
        "bio": seller.bio,
        "availability_status": seller.availability_status or "open",
        "vacation_mode": seller.vacation_mode or False,
        "auto_reply_message": seller.auto_reply_message,
        # Social links
        "whatsapp": prof.whatsapp if prof else None,
        "show_whatsapp": (prof.show_whatsapp if prof else False) or False,
        "instagram": prof.instagram if prof else None,
        # Store policies — dedicated columns (with metadata_ fallback for existing records)
        "pickup_policy":  _policy(prof.pickup_policy  if prof else None, "pickup_policy"),
        "return_policy":  _policy(prof.return_policy  if prof else None, "return_policy"),
        "payment_policy": _policy(prof.payment_policy if prof else None, "payment_policy"),
        # Legacy field kept for backward compat — prefer verification_status
        "verified": is_verified,
        # Feature 3
        "is_verified": is_verified,
        "verification_status": verification_status,
        # 3c
        "trust_signal": trust_signal,
        "follower_count": follower_count,
        "trust_tier": seller.trust_tier or "new_seller",
        "seller_points": seller.seller_points or 0,
        "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
        "review_count": review_count,
        "response_rate": seller.response_rate or 100.0,
        "completion_rate": seller.completion_rate or 100.0,
    }


def _price_to_dict(p: Price) -> dict:
    # Resolve active flash sale from the relationship (no extra query)
    now = now_wat()
    active_sale = next(
        (
            s for s in (p.flash_sales or [])
            if s.is_active and s.end_time and s.end_time > now
        ),
        None,
    )
    flash_sale_data = None
    if active_sale:
        flash_sale_data = {
            "id": active_sale.id,
            "title": active_sale.title,
            "sale_price": active_sale.sale_price,
            "original_price": active_sale.original_price,
            "discount_pct": active_sale.discount_pct,
            "end_time": active_sale.end_time.isoformat(),
        }
    return {
        "id": p.id,
        "uuid": p.uuid,
        "name": p.name,
        "brand": p.brand,
        "price": p.price,
        "location": p.location,
        "category_id": p.category_id,
        "subcategory": p.subcategory,
        "description": p.description,
        "condition": p.condition or "New",
        "quantity": p.quantity or 1,
        "is_negotiable": p.is_negotiable or False,
        "delivery_options": p.delivery_options,
        "photos": json.loads(p.photos) if p.photos else [],
        "status": p.status,
        "listing_status": p.listing_status or "active",
        "view_count": p.view_count,
        "is_featured": p.is_featured,
        "submitted_at": format_wat_iso(p.submitted_at),
        "expires_at": format_wat_iso(p.expires_at) if p.expires_at else None,
        "pack_size": p.pack_size,
        "pack_unit": p.pack_unit,
        "flash_sale": flash_sale_data,
    }


# ── Platform stats ─────────────────────────────────────────────────────────

@router.get("/stats")
async def get_platform_stats(db: Session = Depends(get_db)):
    """
    Real platform stats for the homepage strip.
    Cached in Redis for 60s — see app.services.cache.TTL["platform_stats"].
    Falls back to a live query if Redis is unavailable.
    """
    from app.services.cache import (
        cache_get, cache_set, key_platform_stats, TTL,
    )

    cached = await cache_get(key_platform_stats())
    if cached:
        return cached

    total_users = db.query(User).filter(User.is_deleted != True).count()
    active_listings = db.query(Price).filter(
        Price.status == "approved", Price.listing_status == "active"
    ).count()
    total_sellers = db.query(User).filter(
        User.role == "seller", User.is_deleted != True
    ).count()
    total_categories = db.query(Category).count()
    result = {
        "total_users": total_users,
        "total_sellers": total_sellers,
        "active_listings": active_listings,
        "total_categories": total_categories,
        "last_updated": format_wat_iso(now_wat()),
    }
    await cache_set(key_platform_stats(), result, TTL["platform_stats"])
    return result


@router.get("/featured")
async def get_featured_sellers(limit: int = 6, db: Session = Depends(get_db)):
    """Top sellers ordered by listing count. Used on homepage."""
    sellers = (
        db.query(User)
        .filter(User.role == "seller")
        .order_by(User.seller_points.desc().nullslast(), User.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for s in sellers:
        listing_count = db.query(Price).filter(
            Price.submitted_by == s.id,
            Price.status == "approved",
            Price.listing_status == "active",
        ).count()
        avg_rating = db.query(func.avg(Review.rating)).filter(
            Review.seller_id == s.id, Review.is_flagged == False
        ).scalar()
        results.append({
            "id": s.id,
            "display_name": s.display_name or s.username,
            "avatar_url": s.avatar_url,
            "banner_url": getattr(s, "banner_url", None),
            "slug": s.username,
            "category": getattr(s, "category", None),
            "listing_count": listing_count,
            "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
        })
    return results


# ── Listing detail ─────────────────────────────────────────────────────────

_optional_bearer = HTTPBearer(auto_error=False)


@router.get("/listing/{listing_id}")
async def get_listing_detail(
    listing_id: int,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
):
    """Full listing detail. Increments view_count on every call."""
    p = db.query(Price).filter(Price.id == listing_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Increment view count
    p.view_count = (p.view_count or 0) + 1
    db.commit()

    # Log view to user's activity table (best-effort, no auth required)
    if credentials:
        try:
            payload = decode_access_token(credentials.credentials)
            uid = int(payload.get("sub", 0))
            if uid:
                from app.services.user_db import log_user_activity
                from app.database import engine as _engine
                log_user_activity(uid, "listing_viewed", {"listing_id": listing_id}, None, _engine)
        except Exception:
            pass  # Don't break listing view for logging failures

    seller = db.query(User).filter(User.id == p.submitted_by).first()
    data = _price_to_dict(p)
    data["seller"] = _seller_info(seller, db) if seller else None
    return data


@router.get("/listing/{listing_id}/similar")
async def get_similar_listings(
    listing_id: int,
    db: Session = Depends(get_db),
):
    """6 listings from the same category, excluding this one."""
    p = db.query(Price).filter(Price.id == listing_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Listing not found")
    rows = (
        db.query(Price)
        .filter(
            Price.category_id == p.category_id,
            Price.id != listing_id,
            Price.status == "approved",
            Price.listing_status == "active",
        )
        .order_by(Price.view_count.desc())
        .limit(6)
        .all()
    )
    return [_price_to_dict(r) for r in rows]


# ── Seller public storefront ───────────────────────────────────────────────

@router.get("/store/{username}")
async def get_seller_storefront(
    username: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Seller's public storefront page — user info + active listings (paginated)."""
    seller = db.query(User).filter(User.username == username).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    base_query = db.query(Price).filter(
        Price.submitted_by == seller.id,
        Price.status == "approved",
        Price.listing_status == "active",
    )
    total = base_query.count()
    listings = (
        base_query
        .order_by(Price.submitted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    seller_info = _seller_info(seller, db)
    return {
        "seller": seller_info,
        "listings": [_price_to_dict(p) for p in listings],
        "listing_count": total,
        "owner_user_id": seller.id,
        "owner_uuid": seller.uuid,
    }


# ── Storefront edit endpoints (owner only) — Feature 1C ──────────────────

class _CoverPhotoBody(BaseModel):
    cover_photo_url: str = Field(..., min_length=1, max_length=1000)


class _AboutBody(BaseModel):
    about: str = Field(..., max_length=2000)


@router.patch("/cover-photo")
async def update_cover_photo(
    data: _CoverPhotoBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the logged-in seller's banner/cover photo URL."""
    current_user.banner_url = data.cover_photo_url
    db.commit()
    return {"success": True, "banner_url": current_user.banner_url}


@router.patch("/about")
async def update_about(
    data: _AboutBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the logged-in seller's bio/about text."""
    current_user.bio = data.about
    db.commit()
    return {"success": True, "bio": current_user.bio}


# ── Follow / Unfollow ──────────────────────────────────────────────────────

@router.post("/follow/{seller_id}")
async def toggle_follow(
    seller_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle follow/unfollow a seller. Returns new state + follower count."""
    if seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id, Follow.seller_id == seller_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        following = False
    else:
        db.add(Follow(follower_id=current_user.id, seller_id=seller_id))
        db.commit()
        following = True

    count = db.query(Follow).filter(Follow.seller_id == seller_id).count()
    return {"following": following, "follower_count": count}


@router.get("/follow/{seller_id}/status")
async def get_follow_status(
    seller_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if current user is following a seller."""
    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id, Follow.seller_id == seller_id
    ).first()
    count = db.query(Follow).filter(Follow.seller_id == seller_id).count()
    return {"following": existing is not None, "follower_count": count}


# ── Inquiry (Message Seller) ───────────────────────────────────────────────

class InquiryCreate(BaseModel):
    message: str = Field(..., min_length=5, max_length=1000)


@router.post("/listing/{listing_id}/inquiry", status_code=201)
async def send_inquiry(
    listing_id: int,
    data: InquiryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send an inquiry message to a seller about their listing."""
    p = db.query(Price).filter(Price.id == listing_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Listing not found")
    if p.submitted_by == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot message yourself")

    seller = db.query(User).filter(User.id == p.submitted_by).first()

    # Check if buyer is blocked by seller
    if seller:
        blocked = db.query(BlockedUser).filter(
            BlockedUser.blocker_id == seller.id,
            BlockedUser.blocked_id == current_user.id,
        ).first()
        if blocked:
            raise HTTPException(status_code=403, detail="You cannot contact this seller")

    inq = Inquiry(
        listing_id=listing_id,
        buyer_id=current_user.id,
        seller_id=p.submitted_by,
        message=data.message,
    )
    db.add(inq)

    # In-app notification for seller
    if seller:
        buyer_name = current_user.display_name or current_user.username or "Someone"
        auto_reply = seller.auto_reply_message
        notif = Notification(
            user_id=seller.id, type="new_message",
            title=f"New message from {buyer_name}",
            body=data.message[:120],
            related_id=p.id, related_type="Listing",
        )
        db.add(notif)

    db.commit()

    # Return auto-reply if seller has one set
    response = {"success": True, "message": "Message sent to seller"}
    if seller and seller.auto_reply_message:
        response["auto_reply"] = seller.auto_reply_message
    return response


# ── Report listing ─────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    reason: str = Field(..., min_length=3, max_length=200)
    note: str | None = Field(None, max_length=500)


@router.post("/listing/{listing_id}/report", status_code=201)
async def report_listing(
    listing_id: int,
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Report a listing for review."""
    p = db.query(Price).filter(Price.id == listing_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Listing not found")

    full_reason = data.reason
    if data.note:
        full_reason += f" — {data.note}"

    report = Report(
        reporter_id=current_user.id,
        target_type="Listing",
        target_id=listing_id,
        target_name=p.name,
        reason=full_reason,
    )
    db.add(report)
    db.commit()
    return {"success": True, "message": "Report submitted"}


# ── Report a user ──────────────────────────────────────────────────────────

class UserReportCreate(BaseModel):
    reason: str = Field(..., min_length=3, max_length=200)
    note: str | None = Field(None, max_length=500)


@router.post("/user/{user_id}/report", status_code=201)
async def report_user(
    user_id: int,
    data: UserReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Report another user (buyer or seller)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    full_reason = data.reason
    if data.note:
        full_reason += f" — {data.note}"

    report = Report(
        reporter_id=current_user.id,
        target_type="User",
        target_id=user_id,
        target_name=target.display_name or target.username,
        reason=full_reason,
    )
    db.add(report)
    db.commit()

    # Auto-suspend if 3+ confirmed open reports
    open_reports = db.query(Report).filter(
        Report.target_type == "User",
        Report.target_id == user_id,
        Report.status == "Open",
    ).count()
    if open_reports >= 3 and not target.is_suspended:
        target.is_suspended = True
        target.suspension_reason = "Auto-suspended: 3+ user reports — pending admin review"
        db.commit()

    return {"success": True, "message": "Report submitted"}


# ── Block / Unblock a user ─────────────────────────────────────────────────

@router.post("/user/{user_id}/block")
async def toggle_block_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block or unblock a user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    existing = db.query(BlockedUser).filter(
        BlockedUser.blocker_id == current_user.id,
        BlockedUser.blocked_id == user_id,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"blocked": False}
    db.add(BlockedUser(blocker_id=current_user.id, blocked_id=user_id))
    db.commit()
    return {"blocked": True}


@router.get("/user/{user_id}/block-status")
async def get_block_status(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exists = db.query(BlockedUser).filter(
        BlockedUser.blocker_id == current_user.id,
        BlockedUser.blocked_id == user_id,
    ).first() is not None
    return {"blocked": exists}


# ── Buyer inbox (their sent inquiries) ────────────────────────────────────

# ── Section 6: ISR slug list ───────────────────────────────────────────────

@router.get("/slugs")
async def get_seller_slugs(db: Session = Depends(get_db)):
    """
    Returns the 50 most recent active seller usernames.
    Used by Next.js generateStaticParams() to pre-build storefront pages at deploy time.
    """
    rows = (
        db.query(User.username)
        .filter(User.role == "seller", User.username.isnot(None))
        .order_by(User.created_at.desc())
        .limit(50)
        .all()
    )
    return {"slugs": [r[0] for r in rows]}


# ── Public banners (active announcements for HeroCarousel) ────────────────

@router.get("/banners")
async def get_banners(db: Session = Depends(get_db)):
    """Returns active type=banner announcements for the homepage hero carousel."""
    items = (
        db.query(Announcement)
        .filter(Announcement.is_active == True, Announcement.type == "banner")
        .order_by(Announcement.created_at.desc())
        .limit(5)
        .all()
    )
    return {
        "data": [
            {
                "id": a.id,
                "title": a.title,
                "message": a.message,
                "banner_url": a.banner_url,
                "cta_label": a.cta_label or "Explore Now",
                "cta_href": a.cta_href or "/search",
            }
            for a in items
        ]
    }

@router.get("/buyer/inbox")
async def get_buyer_inbox(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer sees all inquiries they've sent, grouped by listing."""
    rows = (
        db.query(Inquiry)
        .filter(Inquiry.buyer_id == current_user.id)
        .order_by(Inquiry.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": i.id,
            "listing_id": i.listing_id,
            "listing_name": i.listing.name if i.listing else "",
            "seller_id": i.seller_id,
            "seller_name": (i.seller.display_name or i.seller.username) if i.seller else "Unknown",
            "message": i.message,
            "label": i.label,
            "created_at": i.created_at.isoformat(),
        }
        for i in rows
    ]


def _ensure_thread_column() -> None:
    """Add thread_json column to inquiries if it doesn't exist yet (SQLite-safe)."""
    from app.database import engine
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE inquiries ADD COLUMN thread_json TEXT"))
            conn.commit()
        except Exception:
            pass  # Column already exists


def _get_thread_json(i: Inquiry) -> list:
    raw = getattr(i, "thread_json", None)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def _build_full_thread(i: Inquiry) -> list:
    """Build the full thread from stored fields + thread_json follow-ups."""
    thread = [{"sender": "buyer", "text": i.message, "at": i.created_at.isoformat()}]
    if i.seller_reply:
        thread.append({"sender": "seller", "text": i.seller_reply, "at": (i.replied_at or i.created_at).isoformat()})
    thread.extend(_get_thread_json(i))
    return thread


@router.get("/my-inquiries")
async def get_my_inquiries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/storefront/my-inquiries — all inquiries sent by the current buyer."""
    _ensure_thread_column()
    rows = (
        db.query(Inquiry)
        .filter(Inquiry.buyer_id == current_user.id)
        .order_by(Inquiry.created_at.desc())
        .limit(100)
        .all()
    )
    unread_replies = sum(
        1 for i in rows if i.seller_reply and not i.is_read
    )
    data = [
        {
            "id": i.id,
            "listing_id": i.listing_id,
            "listing_name": i.listing.name if i.listing else "",
            "seller_id": i.seller_id,
            "seller_name": (i.seller.display_name or i.seller.username) if i.seller else "Unknown",
            "message": i.message,
            "seller_reply": i.seller_reply,
            "replied_at": i.replied_at.isoformat() if i.replied_at else None,
            "thread": _build_full_thread(i),
            "created_at": i.created_at.isoformat(),
        }
        for i in rows
    ]
    return {"success": True, "data": data, "unread_replies": unread_replies}


class FollowUpCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


@router.post("/inquiry/{inquiry_id}/followup")
async def send_followup(
    inquiry_id: int,
    data: FollowUpCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /api/storefront/inquiry/{id}/followup — buyer sends a follow-up message."""
    _ensure_thread_column()
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inq:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if inq.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your inquiry")

    thread = _build_full_thread(inq)
    thread.append({
        "sender": "buyer",
        "text": data.message,
        "at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    })

    # Store only the follow-up messages (beyond initial message + seller_reply)
    followups = [m for m in thread if not (m["sender"] == "buyer" and m["text"] == inq.message)]
    if inq.seller_reply:
        followups = [m for m in followups if not (m["sender"] == "seller" and m["text"] == inq.seller_reply)]

    from sqlalchemy import text as sa_text
    from app.database import engine
    with engine.connect() as conn:
        conn.execute(
            sa_text("UPDATE inquiries SET thread_json = :tj WHERE id = :id"),
            {"tj": json.dumps(followups), "id": inq.id},
        )
        conn.commit()

    # Notify seller of follow-up
    seller = db.query(User).filter(User.id == inq.seller_id).first()
    if seller:
        buyer_name = current_user.display_name or current_user.username or "Buyer"
        db.add(Notification(
            user_id=seller.id,
            type="new_message",
            title=f"Follow-up from {buyer_name}",
            body=data.message[:120],
            related_id=inq.listing_id,
            related_type="Listing",
        ))
        db.commit()

    return {"success": True, "thread": thread}
