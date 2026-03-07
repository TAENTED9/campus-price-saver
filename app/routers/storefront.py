"""
Public storefront endpoints — listing detail, seller pages, follow, inquiry, report, stats.
No auth required for read endpoints; auth required for follow/inquiry/report.
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
import json

from app.database import SessionLocal
from app.models import Price, User, Category, Follow, Inquiry, Report, BlockedUser, Review, Notification
from app.routers.auth import get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/storefront", tags=["Storefront"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seller_info(seller: User, db: Session) -> dict:
    follower_count = db.query(Follow).filter(Follow.seller_id == seller.id).count()
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == seller.id, Review.is_flagged == False
    ).scalar()
    review_count = db.query(Review).filter(
        Review.seller_id == seller.id, Review.is_flagged == False
    ).count()
    return {
        "id": seller.id,
        "username": seller.username,
        "display_name": seller.display_name or seller.username,
        "avatar_url": seller.avatar_url,
        "bio": seller.bio,
        "availability_status": seller.availability_status or "open",
        "vacation_mode": seller.vacation_mode or False,
        "auto_reply_message": seller.auto_reply_message,
        "verified": seller.role == "seller",
        "follower_count": follower_count,
        "trust_tier": seller.trust_tier or "new_seller",
        "seller_points": seller.seller_points or 0,
        "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
        "review_count": review_count,
        "response_rate": seller.response_rate or 100.0,
        "completion_rate": seller.completion_rate or 100.0,
    }


def _price_to_dict(p: Price) -> dict:
    return {
        "id": p.id,
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
        "submitted_at": p.submitted_at.isoformat(),
        "expires_at": p.expires_at.isoformat() if p.expires_at else None,
        "pack_size": p.pack_size,
        "pack_unit": p.pack_unit,
    }


# ── Platform stats ─────────────────────────────────────────────────────────

@router.get("/stats")
async def get_platform_stats(db: Session = Depends(get_db)):
    """Real platform stats for the homepage strip."""
    from sqlalchemy import func
    total_users = db.query(User).count()
    active_listings = db.query(Price).filter(
        Price.status == "approved", Price.listing_status == "active"
    ).count()
    total_categories = db.query(Category).count()
    return {
        "total_users": total_users,
        "active_listings": active_listings,
        "total_categories": total_categories,
    }


# ── Listing detail ─────────────────────────────────────────────────────────

@router.get("/listing/{listing_id}")
async def get_listing_detail(
    listing_id: int,
    db: Session = Depends(get_db),
):
    """Full listing detail. Increments view_count on every call."""
    p = db.query(Price).filter(Price.id == listing_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Increment view count
    p.view_count = (p.view_count or 0) + 1
    db.commit()

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
    db: Session = Depends(get_db),
):
    """Seller's public storefront page — user info + active listings."""
    seller = db.query(User).filter(User.username == username).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    listings = (
        db.query(Price)
        .filter(
            Price.submitted_by == seller.id,
            Price.status == "approved",
            Price.listing_status == "active",
        )
        .order_by(Price.submitted_at.desc())
        .all()
    )

    return {
        "seller": _seller_info(seller, db),
        "listings": [_price_to_dict(p) for p in listings],
        "listing_count": len(listings),
    }


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
    note: Optional[str] = Field(None, max_length=500)


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
    note: Optional[str] = Field(None, max_length=500)


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
