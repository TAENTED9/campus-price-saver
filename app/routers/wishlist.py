"""Wishlist router — save listings, price-drop / restock / new-listing email alerts."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import SessionLocal
from app.models import Wishlist, Price, User, Follow, Notification
from app.services import email as email_svc

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str, db: Session) -> User:
    from app.routers.auth import decode_access_token
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _push_notification(db: Session, user_id: int, ntype: str, title: str, body: str,
                        related_id=None, related_type=None):
    notif = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        related_id=related_id, related_type=related_type,
    )
    db.add(notif)


# ─────────────────────────────────────────────────────────────────────────────
# Toggle wishlist (heart button)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/toggle/{listing_id}")
async def toggle_wishlist(
    listing_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Add or remove a listing from the user's wishlist."""
    user = get_current_user(token, db)

    listing = db.query(Price).filter(Price.id == listing_id, Price.listing_status == "active").first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    existing = db.query(Wishlist).filter(
        Wishlist.user_id == user.id,
        Wishlist.listing_id == listing_id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"wishlisted": False}

    wish = Wishlist(user_id=user.id, listing_id=listing_id)
    db.add(wish)
    db.commit()
    return {"wishlisted": True}


@router.get("/status/{listing_id}")
async def wishlist_status(
    listing_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(token, db)
    exists = db.query(Wishlist).filter(
        Wishlist.user_id == user.id,
        Wishlist.listing_id == listing_id,
    ).first() is not None
    return {"wishlisted": exists}


@router.get("/")
async def get_wishlist(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Get the current user's full wishlist."""
    user = get_current_user(token, db)
    items = (
        db.query(Wishlist)
        .filter(Wishlist.user_id == user.id)
        .order_by(Wishlist.created_at.desc())
        .all()
    )
    result = []
    for w in items:
        listing = w.listing
        if not listing:
            continue
        import json
        photos = []
        if listing.photos:
            try:
                photos = json.loads(listing.photos)
            except Exception:
                pass
        result.append({
            "wishlist_id": w.id,
            "listing_id": listing.id,
            "name": listing.name,
            "price": listing.price,
            "location": listing.location,
            "listing_status": listing.listing_status,
            "photos": photos,
            "saved_at": w.created_at.isoformat(),
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers — called from seller.py when prices / stock change
# ─────────────────────────────────────────────────────────────────────────────

def notify_price_drop(db: Session, listing: Price, old_price: float):
    """Send email + in-app notification to everyone who wishlisted this listing."""
    wishers = db.query(Wishlist).filter(Wishlist.listing_id == listing.id).all()
    for w in wishers:
        buyer = db.query(User).filter(User.id == w.user_id).first()
        if not buyer:
            continue
        _push_notification(
            db, buyer.id, "price_drop",
            f"Price dropped on '{listing.name}'",
            f"The price dropped from ₦{old_price:,.0f} to ₦{listing.price:,.0f}. Grab it now!",
            related_id=listing.id, related_type="Listing",
        )
        if buyer.email:
            email_svc.send_price_drop_alert(
                to=buyer.email,
                buyer_name=buyer.display_name or buyer.username or "there",
                listing_name=listing.name,
                old_price=old_price,
                new_price=listing.price,
                listing_id=listing.id,
            )


def notify_restock(db: Session, listing: Price):
    """Send email + in-app notification when a sold/paused listing goes active again."""
    wishers = db.query(Wishlist).filter(Wishlist.listing_id == listing.id).all()
    for w in wishers:
        buyer = db.query(User).filter(User.id == w.user_id).first()
        if not buyer:
            continue
        _push_notification(
            db, buyer.id, "restock",
            f"'{listing.name}' is back!",
            f"A listing you saved is now available again at ₦{listing.price:,.0f}.",
            related_id=listing.id, related_type="Listing",
        )
        if buyer.email:
            email_svc.send_restock_alert(
                to=buyer.email,
                buyer_name=buyer.display_name or buyer.username or "there",
                listing_name=listing.name,
                price=listing.price,
                listing_id=listing.id,
            )


def notify_new_listing(db: Session, listing: Price, seller: User):
    """Send email + in-app notification to seller's followers when they post a new listing."""
    followers = db.query(Follow).filter(Follow.seller_id == seller.id).all()
    for f in followers:
        follower = db.query(User).filter(User.id == f.follower_id).first()
        if not follower:
            continue
        _push_notification(
            db, follower.id, "new_listing",
            f"{seller.display_name or seller.username} posted a new listing",
            f"'{listing.name}' — ₦{listing.price:,.0f}",
            related_id=listing.id, related_type="Listing",
        )
        if follower.email:
            email_svc.send_new_listing_alert(
                to=follower.email,
                buyer_name=follower.display_name or follower.username or "there",
                seller_name=seller.display_name or seller.username or "A seller",
                listing_name=listing.name,
                price=listing.price,
                listing_id=listing.id,
            )
