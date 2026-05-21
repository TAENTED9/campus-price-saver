"""
Seller Orders router — buyer-facing order endpoints.
All endpoints require a valid JWT token via get_current_user.
"""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lead, Notification, Order, Price, User
from app.routers.auth import get_current_user

orders_router = APIRouter(prefix="/orders", tags=["Orders"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    listing_id: int = Field(..., gt=0)
    meetup_location: str | None = None


class OrderStatusUpdate(BaseModel):
    status: str  # met_up / completed / cancelled


class ExpressInterestBody(BaseModel):
    listing_uuid: str


# ── Helper ────────────────────────────────────────────────────────────────────

def _order_dict(o: Order) -> dict:
    photos_raw = (o.listing.photos if o.listing else None) or "[]"
    try:
        photos = json.loads(photos_raw) if isinstance(photos_raw, str) else photos_raw
    except Exception:
        photos = []
    seller = o.seller
    return {
        "id": o.id,
        "uuid": o.uuid,
        "listing_id": o.listing_id,
        "listing_uuid": o.listing.uuid if o.listing else None,
        "listing_name": o.listing.name if o.listing else None,
        "listing_price": o.listing.price if o.listing else 0,
        "listing_condition": o.listing.condition if o.listing else None,
        "listing_photos": photos,
        "buyer_id": o.buyer_id,
        "seller_id": o.seller_id,
        "seller_name": (seller.display_name or seller.username) if seller else "Unknown",
        "seller_avatar": seller.avatar_url if seller else None,
        "status": o.status,
        "meetup_location": o.meetup_location,
        "created_at": o.created_at.isoformat(),
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@orders_router.post("", status_code=201)
async def create_order(
    body: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer creates an order on a listing."""
    listing = db.query(Price).filter(Price.id == body.listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.submitted_by == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot order your own listing")

    order = Order(
        listing_id=body.listing_id,
        buyer_id=current_user.id,
        seller_id=listing.submitted_by,
        meetup_location=body.meetup_location,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Notify seller
    notif = Notification(
        user_id=listing.submitted_by,
        type="new_message",
        title="New order",
        body=f"{current_user.display_name or current_user.username} placed an order for '{listing.name}'.",
        related_id=order.id,
        related_type="Order",
    )
    db.add(notif)
    db.commit()
    return _order_dict(order)


@orders_router.post("/express-interest/{listing_uuid}", status_code=201)
async def express_interest(
    listing_uuid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer expresses interest in a listing: creates a pending order and opens a chat thread."""
    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        try:
            listing = db.query(Price).filter(Price.id == int(listing_uuid)).first()
        except (ValueError, TypeError):
            pass
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.submitted_by == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot express interest in your own listing")

    from app.routers.messages import Conversation, DirectMessage

    _lo = min(current_user.id, listing.submitted_by)
    _hi = max(current_user.id, listing.submitted_by)
    conv = db.query(Conversation).filter(
        Conversation.user_a_id == _lo,
        Conversation.user_b_id == _hi,
    ).first()
    _is_new_conv = conv is None
    if not conv:
        conv = Conversation(user_a_id=_lo, user_b_id=_hi)
        db.add(conv)
        db.flush()

    auto_text = (
        f"Hi! I'm interested in '{listing.name}' (\u20a6{listing.price:,.0f}). "
        f"Is it still available?"
    )
    msg = DirectMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=auto_text,
        is_automated=True,
    )
    db.add(msg)

    lead = Lead(listing_id=listing.id, buyer_id=current_user.id)
    db.add(lead)

    order = Order(
        listing_id=listing.id,
        buyer_id=current_user.id,
        seller_id=listing.submitted_by,
        status="interest_expressed",
    )
    db.add(order)

    seller = db.query(User).filter(User.id == listing.submitted_by).first()
    notif = Notification(
        user_id=listing.submitted_by,
        type="new_message",
        title="New interest in your listing",
        body=(
            f"{current_user.display_name or current_user.username} is interested in "
            f"'{listing.name}'. Check your messages."
        ),
        related_id=conv.id,
        related_type="Conversation",
    )
    db.add(notif)
    db.commit()
    db.refresh(order)

    if seller and seller.email:
        try:
            # FIX #11 / Block 4: email now goes via Celery so it survives
            # cold-stops and retries on Resend outages.
            from app.tasks.email_tasks import send_interest_email
            send_interest_email.delay(
                to=seller.email,
                seller_name=seller.display_name or seller.username,
                buyer_username=current_user.username,
                buyer_display_name=current_user.display_name or current_user.username,
                listing_title=listing.name,
                listing_price=str(listing.price),
                auto_message="",
            )
        except Exception:
            pass

    return {
        "success": True,
        "order_uuid": order.uuid,
        "conversation_id": conv.id,
        "conversation_uuid": conv.uuid,
        "is_new_conversation": _is_new_conv,
        "message": "Interest expressed. A message has been sent to the seller.",
    }


@orders_router.post("/express-interest", status_code=201)
async def express_interest_body(
    body: ExpressInterestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Body-based express interest — used by InterestButton component."""
    listing = db.query(Price).filter(Price.uuid == body.listing_uuid).first()
    if not listing:
        try:
            listing = db.query(Price).filter(Price.id == int(body.listing_uuid)).first()
        except (ValueError, TypeError):
            pass
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.submitted_by == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot express interest in your own listing")

    from app.routers.messages import Conversation, DirectMessage

    _lo = min(current_user.id, listing.submitted_by)
    _hi = max(current_user.id, listing.submitted_by)
    conv = db.query(Conversation).filter(
        Conversation.user_a_id == _lo,
        Conversation.user_b_id == _hi,
    ).first()
    created_new_conv = conv is None
    if not conv:
        conv = Conversation(user_a_id=_lo, user_b_id=_hi)
        db.add(conv)
        db.flush()

    auto_text = (
        f"Hi! I'm @{current_user.username} and I'm interested "
        f"in your listing: **{listing.name}** (₦{listing.price:,.0f}). "
        f"I'd like to know more about it. "
        f"\nCan We Discuss?"
    )
    msg = DirectMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=auto_text,
        is_automated=True,
    )
    db.add(msg)

    lead = Lead(listing_id=listing.id, buyer_id=current_user.id)
    db.add(lead)

    order = Order(
        listing_id=listing.id,
        buyer_id=current_user.id,
        seller_id=listing.submitted_by,
        status="interest_expressed",
    )
    db.add(order)

    seller = db.query(User).filter(User.id == listing.submitted_by).first()
    notif = Notification(
        user_id=listing.submitted_by,
        type="new_order_interest",
        title=f"@{current_user.username} is interested!",
        body=f"They want to buy: {listing.name} (₦{listing.price:,.0f})",
        related_id=conv.id,
        related_type="Conversation",
    )
    db.add(notif)
    db.commit()
    db.refresh(order)

    if seller and seller.email:
        try:
            # FIX #11 / Block 4: email now goes via Celery so it survives
            # cold-stops and retries on Resend outages.
            from app.tasks.email_tasks import send_interest_email
            send_interest_email.delay(
                to=seller.email,
                seller_name=seller.display_name or seller.username,
                buyer_username=current_user.username,
                buyer_display_name=current_user.display_name or current_user.username,
                listing_title=listing.name,
                listing_price=str(listing.price),
                auto_message="",
            )
        except Exception:
            pass

    return {
        "order_uuid": order.uuid,
        "conversation_uuid": conv.uuid,
        "is_new_conversation": created_new_conv,
        "message": "Your interest has been sent to the seller!",
    }


@orders_router.get("")
async def get_buyer_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str | None = Query(None),
):
    """Buyer sees their own orders."""
    q = db.query(Order).filter(Order.buyer_id == current_user.id)
    if status:
        q = q.filter(Order.status == status)
    orders = q.order_by(Order.created_at.desc()).all()
    return {"success": True, "data": [_order_dict(o) for o in orders]}


@orders_router.patch("/{order_ref}/status")
async def update_order_status(
    order_ref: str,
    body: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer or seller updates order status. order_ref may be a UUID or numeric ID."""
    order = db.query(Order).filter(Order.uuid == order_ref).first()
    if not order:
        try:
            order = db.query(Order).filter(Order.id == int(order_ref)).first()
        except (ValueError, TypeError):
            pass
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.id not in (order.buyer_id, order.seller_id):
        raise HTTPException(status_code=403, detail="Not your order")

    valid = {"met_up", "completed", "cancelled"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")

    order.status = body.status
    order.updated_at = datetime.utcnow()

    # MISS-005 — notify the other party about the status change
    other_id = order.buyer_id if current_user.id == order.seller_id else order.seller_id
    listing_name = order.listing.name if order.listing else "your listing"
    notif = Notification(
        user_id=other_id,
        type="order_update",
        title="Order status updated",
        body=f"Order for '{listing_name}' has been marked as '{body.status}'.",
        related_id=order.id,
        related_type="Order",
    )
    db.add(notif)

    # ── FIX #3 + #6: completion side-effects ──────────────────────────────
    if body.status == "completed":
        from app.routers.seller import _award_points

        listing = db.query(Price).filter(Price.id == order.listing_id).first()
        seller = db.query(User).filter(User.id == order.seller_id).first()

        # Decrement listing quantity / mark sold_out
        if listing:
            listing.quantity = max(0, (listing.quantity or 1) - 1)
            if listing.quantity == 0:
                listing.listing_status = "sold_out"

        if seller:
            # FIX #3: canonical karma award via _award_points (writes
            # PointsTransaction with reason="purchase_confirmed" — the
            # exact row /api/seller/stats counts as a "confirmed sale").
            _award_points(db, seller, "purchase_confirmed", order.listing_id)

            # FIX #3: check first-ever completed sale and award the
            # one-time +25 first_sale bonus that previously never fired.
            completed_count = (
                db.query(func.count(Order.id))
                .filter(
                    Order.seller_id == seller.id,
                    Order.status == "completed",
                )
                .scalar() or 0
            ) + 1  # +1 because the current order is not yet committed
            if completed_count == 1:
                _award_points(db, seller, "first_sale", order.listing_id)

        # Notify buyer to leave a review
        if order.buyer_id and listing:
            review_notif = Notification(
                user_id=order.buyer_id,
                type="order_completed",
                title="Order completed!",
                body=(
                    f"Your order for '{listing.name}' is complete. "
                    "Leave a review to help other buyers."
                ),
                related_id=order.id,
                related_type="Order",
            )
            db.add(review_notif)

    db.commit()
    return _order_dict(order)
