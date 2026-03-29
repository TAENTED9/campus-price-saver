"""Reviews & Ratings router."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import Review, User, Price, Inquiry, Notification, PointsTransaction
from app.routers.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/reviews", tags=["Reviews"])


def _award_points(db: Session, user_id: int, amount: int, reason: str, listing_id: int | None = None):
    """Award or deduct karma points and log the transaction."""
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.seller_points = max(0, user.seller_points + amount)
        tx = PointsTransaction(user_id=user_id, amount=amount, reason=reason, related_price_id=listing_id)
        db.add(tx)
        _recalc_trust_tier(user)


def _recalc_trust_tier(user: User):
    """Recalculate trust tier from points + rating + sales."""
    pts = user.seller_points
    if pts >= 500:
        user.trust_tier = "top_seller"
    elif pts >= 200:
        user.trust_tier = "trusted"
    elif pts >= 50:
        user.trust_tier = "rising"
    else:
        user.trust_tier = "new_seller"


def _push_notification(db: Session, user_id: int, ntype: str, title: str, body: str,
                        related_id: int | None = None, related_type: str | None = None):
    notif = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        related_id=related_id, related_type=related_type,
    )
    db.add(notif)


class ReviewCreateBody(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None
    photo_url: str | None = None


class ReviewResponseBody(BaseModel):
    response: str = Field(..., min_length=1)


# ─────────────────────────────────────────────────────────────────────────────
# POST /reviews — submit a review
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/listing/{listing_id}", status_code=201)
async def submit_review(
    listing_id: int,
    body: ReviewCreateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer submits a review for a listing after interaction."""
    listing = db.query(Price).filter(Price.id == listing_id).first()
    if not listing or not listing.submitted_by:
        raise HTTPException(status_code=404, detail="Listing not found")

    seller_id = listing.submitted_by
    if seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot review your own listing")

    msg_count = db.query(Inquiry).filter(
        Inquiry.listing_id == listing_id,
        Inquiry.buyer_id == current_user.id,
    ).count()
    if msg_count < 3:
        raise HTTPException(
            status_code=403,
            detail="You can only review after at least 3 messages have been exchanged",
        )

    existing = db.query(Review).filter(
        Review.reviewer_id == current_user.id,
        Review.listing_id == listing_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this seller")

    verified = db.query(Inquiry).filter(
        Inquiry.listing_id == listing_id,
        Inquiry.buyer_id == current_user.id,
        Inquiry.label == "Completed",
    ).first() is not None

    review = Review(
        listing_id=listing_id,
        reviewer_id=current_user.id,
        seller_id=seller_id,
        rating=body.rating,
        comment=body.comment,
        photo_url=body.photo_url,
        is_verified_interaction=verified,
    )
    db.add(review)

    if body.rating == 5:
        _award_points(db, seller_id, 20, "five_star_review", listing_id)

    reviewer_name = current_user.display_name or current_user.username or "Someone"
    _push_notification(
        db, seller_id, "review",
        f"New {body.rating}★ review",
        f"{reviewer_name} left you a {body.rating}-star review on '{listing.name}'.",
        related_id=review.id, related_type="Review",
    )

    db.commit()
    db.refresh(review)
    return _review_dict(review)


@router.get("/listing/{listing_id}")
async def get_listing_reviews(
    listing_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Public: get all reviews for a listing."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.listing_id == listing_id, Review.is_flagged == False)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(Review.id)).filter(
        Review.listing_id == listing_id, Review.is_flagged == False
    ).scalar()
    avg = db.query(func.avg(Review.rating)).filter(
        Review.listing_id == listing_id, Review.is_flagged == False
    ).scalar()
    return {
        "total": total,
        "avg_rating": round(float(avg), 1) if avg else None,
        "reviews": [_review_dict(r) for r in reviews],
    }


@router.get("/seller/{seller_id}")
async def get_seller_reviews(
    seller_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Public: get all reviews for a seller (across all listings)."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.seller_id == seller_id, Review.is_flagged == False)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(Review.id)).filter(
        Review.seller_id == seller_id, Review.is_flagged == False
    ).scalar()
    avg = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == seller_id, Review.is_flagged == False
    ).scalar()
    dist = {}
    for star in range(1, 6):
        count = db.query(func.count(Review.id)).filter(
            Review.seller_id == seller_id,
            Review.is_flagged == False,
            Review.rating == star,
        ).scalar()
        dist[str(star)] = count
    return {
        "total": total,
        "avg_rating": round(float(avg), 1) if avg else None,
        "rating_distribution": dist,
        "reviews": [_review_dict(r) for r in reviews],
    }


@router.post("/{review_id}/respond")
async def seller_respond(
    review_id: int,
    body: ReviewResponseBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller publicly responds to a review."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing's review")
    review.seller_response = body.response
    review.seller_response_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/{review_id}/flag")
async def flag_review(
    review_id: int,
    body: dict = Body(default={}),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Flag a review to go to admin queue."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_flagged = True
    review.flag_reason = body.get("reason", "")
    db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# Admin: list flagged reviews, unflag, delete
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/admin/flagged")
async def list_flagged_reviews(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.is_flagged == True)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [_review_dict(r) for r in reviews]


@router.delete("/admin/{review_id}")
async def admin_delete_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"success": True}


@router.patch("/admin/{review_id}/unflag")
async def admin_unflag_review(
    review_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_flagged = False
    review.flag_reason = None
    db.commit()
    return {"success": True}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _review_dict(r: Review) -> dict:
    reviewer = r.reviewer  # loaded via joinedload or lazy-load
    return {
        "id": r.id,
        "listing_id": r.listing_id,
        "reviewer_id": r.reviewer_id,
        "reviewer_name": reviewer.display_name or reviewer.username if reviewer else "Anonymous",
        "reviewer_avatar": reviewer.avatar_url if reviewer else None,
        "seller_id": r.seller_id,
        "rating": r.rating,
        "comment": r.comment,
        "photo_url": r.photo_url,
        "is_verified_interaction": r.is_verified_interaction,
        "seller_response": r.seller_response,
        "seller_response_at": r.seller_response_at.isoformat() if r.seller_response_at else None,
        "is_flagged": r.is_flagged,
        "flag_reason": r.flag_reason,
        "created_at": r.created_at.isoformat(),
    }
