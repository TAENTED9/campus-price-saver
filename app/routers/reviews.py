"""Reviews & Ratings router."""
from datetime import datetime
from app.utils.timezone import now_wat, format_wat_iso

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel, Field, model_validator

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


REVIEW_EDIT_WINDOW_MINUTES = 30


class ReviewEditBody(BaseModel):
    comment: str = Field(..., min_length=10, max_length=1000)
    photo_url: str | None = None


class ReviewResponseBody(BaseModel):
    response: str | None = Field(None, min_length=1)
    reply: str | None = Field(None, min_length=1)

    @model_validator(mode="after")
    def require_at_least_one(self) -> "ReviewResponseBody":
        if not self.response and not self.reply:
            raise ValueError("Either 'response' or 'reply' must be provided")
        return self


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

    # BUG-006: check DirectMessage count between buyer and seller (not Inquiry)
    from app.routers.messages import Conversation, DirectMessage as _DM
    _lo, _hi = min(current_user.id, seller_id), max(current_user.id, seller_id)
    _conv = db.query(Conversation).filter(
        Conversation.user_a_id == _lo,
        Conversation.user_b_id == _hi,
    ).first()
    msg_count = 0
    if _conv:
        msg_count = db.query(_DM).filter(_DM.conversation_id == _conv.id).count()
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

    if body.rating >= 4:
        pts = 15 if body.rating == 5 else 8
        reason = "five_star_review" if body.rating == 5 else "four_star_review"
        _award_points(db, seller_id, pts, reason, listing_id)
        try:
            from app.services.karma import award_karma
            award_karma(seller_id, pts, reason, db, reference_id=str(review.id))
        except Exception:
            pass
    elif body.rating == 3:
        _award_points(db, seller_id, 3, "three_star_review", listing_id)
    _award_points(db, current_user.id, 5, "review_left", listing_id)

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
    listing_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Public: get all reviews for a listing (accepts integer ID or UUID)."""
    listing = None
    try:
        listing = db.query(Price).filter(Price.id == int(listing_id)).first()
    except (ValueError, TypeError):
        pass
    if listing is None:
        listing = db.query(Price).filter(Price.uuid == listing_id).first()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    lid = listing.id
    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer), joinedload(Review.listing))
        .filter(Review.listing_id == lid, Review.is_flagged == False)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(Review.id)).filter(
        Review.listing_id == lid, Review.is_flagged == False
    ).scalar()
    avg = db.query(func.avg(Review.rating)).filter(
        Review.listing_id == lid, Review.is_flagged == False
    ).scalar()
    return {
        "total": total,
        "avg_rating": round(float(avg), 1) if avg else None,
        "reviews": [_review_dict(r) for r in reviews],
        "skip": skip,
        "limit": limit,
        "has_more": (skip + limit) < (total or 0),
    }


@router.get("/seller/{seller_id}")
async def get_seller_reviews(
    seller_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Public: get all reviews for a seller (accepts integer ID or UUID)."""
    seller = None
    try:
        seller = db.query(User).filter(User.id == int(seller_id)).first()
    except (ValueError, TypeError):
        pass
    if seller is None:
        seller = db.query(User).filter(User.uuid == seller_id).first()
    if seller is None:
        raise HTTPException(status_code=404, detail="Seller not found")
    sid = seller.id
    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.seller_id == sid, Review.is_flagged == False)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(Review.id)).filter(
        Review.seller_id == sid, Review.is_flagged == False
    ).scalar()
    avg = db.query(func.avg(Review.rating)).filter(
        Review.seller_id == sid, Review.is_flagged == False
    ).scalar()
    dist = {}
    for star in range(1, 6):
        count = db.query(func.count(Review.id)).filter(
            Review.seller_id == sid,
            Review.is_flagged == False,
            Review.rating == star,
        ).scalar()
        dist[str(star)] = count
    return {
        "total": total,
        "avg_rating": round(float(avg), 1) if avg else None,
        "rating_distribution": dist,
        "distribution": dist,
        "reviews": [_review_dict(r) for r in reviews],
        "skip": skip,
        "limit": limit,
        "has_more": (skip + limit) < (total or 0),
    }


@router.patch("/{review_ref}")
async def edit_review(
    review_ref: str,
    body: ReviewEditBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reviewer edits their own review within 30 minutes of posting."""
    review = db.query(Review).filter(Review.uuid == review_ref).first()
    if not review:
        try:
            review = db.query(Review).filter(Review.id == int(review_ref)).first()
        except (ValueError, TypeError):
            pass
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own reviews")
    from datetime import timezone, timedelta
    created = review.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    elapsed_minutes = (now_wat() - created).total_seconds() / 60
    if elapsed_minutes > REVIEW_EDIT_WINDOW_MINUTES:
        raise HTTPException(
            status_code=403,
            detail=f"Reviews can only be edited within {REVIEW_EDIT_WINDOW_MINUTES} minutes of posting"
        )
    review.comment = body.comment
    if body.photo_url is not None:
        review.photo_url = body.photo_url
    review.is_edited = True
    review.edited_at = now_wat()
    db.commit()
    db.refresh(review)
    return {"success": True, "review": _review_dict(review)}


@router.post("/{review_ref}/respond")
async def seller_respond(
    review_ref: str,
    body: ReviewResponseBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seller publicly responds to a review. Accepts integer ID or UUID."""
    review = db.query(Review).filter(Review.uuid == review_ref).first()
    if not review:
        try:
            review = db.query(Review).filter(Review.id == int(review_ref)).first()
        except (ValueError, TypeError):
            pass
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing's review")
    if review.seller_response:
        raise HTTPException(status_code=409, detail="You have already replied to this review")
    reply_text = getattr(body, "reply", None) or body.response
    review.seller_response = reply_text
    review.seller_response_at = now_wat()
    db.commit()
    return {"success": True, "review": _review_dict(review)}


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
    reviewer_profile = getattr(reviewer, 'profile', None) if reviewer else None
    _name = (
        (reviewer_profile.display_name if reviewer_profile and reviewer_profile.display_name else None)
        or (reviewer.display_name or reviewer.username if reviewer else "Anonymous")
    )
    _avatar = (
        (reviewer_profile.avatar_url if reviewer_profile else None)
        or (reviewer.avatar_url if reviewer else None)
    )
    _reply_at = format_wat_iso(r.seller_response_at) if r.seller_response_at else None
    _listing = getattr(r, 'listing', None)
    return {
        "id": r.uuid or str(r.id),
        "uuid": r.uuid or str(r.id),
        "listing_id": r.listing_id,
        "reviewer_name": _name,
        "reviewer_avatar": _avatar,
        "rating": r.rating,
        "comment": r.comment,
        "text": r.comment,
        "photo_url": r.photo_url,
        "is_verified_interaction": r.is_verified_interaction,
        "is_verified_purchase": r.is_verified_interaction,
        "seller_response": r.seller_response,
        "seller_reply": r.seller_response,
        "seller_response_at": _reply_at,
        "replied_at": _reply_at,
        "is_flagged": r.is_flagged,
        "flag_reason": getattr(r, 'flag_reason', None),
        "is_edited": getattr(r, 'is_edited', False) or False,
        "edited_at": format_wat_iso(r.edited_at) if getattr(r, 'edited_at', None) else None,
        "created_at": format_wat_iso(r.created_at),
        "listing_title": _listing.name if _listing else None,
        "listing": {
            "uuid": _listing.uuid if _listing else None,
            "title": _listing.name if _listing else None,
        } if _listing else None,
        "reviewer": {
            "display_name": _name,
            "avatar_url": _avatar,
        },
    }
