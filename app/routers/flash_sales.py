"""
Flash Sales router — seller self-service + public endpoints.
Seller write endpoints require JWT authentication via get_current_user.
Admin override endpoints require get_current_admin.
"""
import json as _json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FlashSale, Price, User
from app.routers.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/flash-sales", tags=["Flash Sales"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FlashSaleCreateBody(BaseModel):
    listing_id: int = Field(..., gt=0)
    discount_pct: Optional[float] = Field(None, gt=0, le=100)
    discount_price: Optional[float] = Field(None, gt=0)
    end_time: datetime
    title: Optional[str] = Field(None, max_length=100)


class FlashSaleUpdateBody(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    end_time: Optional[datetime] = None
    discount_pct: Optional[float] = Field(None, gt=0, le=100)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sale_dict(sale: FlashSale) -> dict:
    """Serialize a FlashSale to a response dict including joined listing fields."""
    item = sale.price_item
    first_photo = None
    if item and item.photos:
        try:
            photos = _json.loads(item.photos)
            first_photo = photos[0] if photos else None
        except Exception:
            pass
    return {
        "id": sale.id,
        "listing_id": sale.price_id,
        "seller_id": sale.seller_id,
        "title": sale.title,
        "original_price": sale.original_price,
        "sale_price": sale.sale_price,
        "discount_pct": sale.discount_pct,
        "start_time": sale.start_time.isoformat() if sale.start_time else None,
        "end_time": sale.end_time.isoformat() if sale.end_time else None,
        "is_active": sale.is_active,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
        "item_name": item.name if item else None,
        "item_brand": item.brand if item else None,
        "item_location": item.location if item else None,
        "item_uuid": item.uuid if item else None,
        "item_photo": first_photo,
    }


def _notify_wishlisters(db: Session, listing: Price, old_price: float):
    """Fire price-drop notifications to anyone who wishlisted this listing."""
    try:
        from app.routers.wishlist import notify_price_drop
        notify_price_drop(db, listing, old_price)
    except Exception:
        pass


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/active")
def get_active_flash_sales(
    limit: int = Query(6, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get currently active flash sales (public)."""
    now = datetime.utcnow()
    sales = (
        db.query(FlashSale)
        .filter(
            FlashSale.is_active == True,
            FlashSale.start_time <= now,
            FlashSale.end_time > now,
        )
        .order_by(FlashSale.discount_pct.desc())
        .limit(limit)
        .all()
    )
    return {"success": True, "data": [_sale_dict(s) for s in sales]}


# ── Seller endpoints ──────────────────────────────────────────────────────────

@router.get("/mine")
def get_my_flash_sales(
    include_expired: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all flash sales created by the authenticated seller."""
    q = db.query(FlashSale).filter(FlashSale.seller_id == current_user.id)
    if not include_expired:
        now = datetime.utcnow()
        q = q.filter(FlashSale.end_time > now)
    sales = q.order_by(FlashSale.created_at.desc()).all()
    return {"success": True, "data": [_sale_dict(s) for s in sales]}


@router.post("", status_code=201)
def create_flash_sale(
    body: FlashSaleCreateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a flash sale on an approved, active listing you own."""
    listing = db.query(Price).filter(
        Price.id == body.listing_id,
        Price.submitted_by == current_user.id,
        Price.status == "approved",
        Price.listing_status == "active",
    ).first()
    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found, not approved/active, or doesn't belong to you",
        )

    if body.end_time <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="end_time must be in the future")

    if body.discount_pct is None and body.discount_price is None:
        raise HTTPException(status_code=400, detail="Provide discount_pct or discount_price")

    if body.discount_pct is not None:
        sale_price = round(listing.price * (1 - body.discount_pct / 100), 2)
        discount_pct = body.discount_pct
    else:
        if body.discount_price >= listing.price:
            raise HTTPException(
                status_code=400, detail="discount_price must be less than the listing price"
            )
        sale_price = round(body.discount_price, 2)
        discount_pct = round((listing.price - sale_price) / listing.price * 100, 2)

    # Prevent duplicate active sale on the same listing
    existing = db.query(FlashSale).filter(
        FlashSale.price_id == listing.id,
        FlashSale.is_active == True,
        FlashSale.end_time > datetime.utcnow(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This listing already has an active flash sale. Cancel it first.",
        )

    sale = FlashSale(
        price_id=listing.id,
        seller_id=current_user.id,
        title=body.title,
        original_price=listing.price,
        sale_price=sale_price,
        discount_pct=discount_pct,
        end_time=body.end_time,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)

    # Notify wishlisters about the effective price drop
    _notify_wishlisters(db, listing, listing.price)
    db.commit()

    return {"success": True, "data": _sale_dict(sale)}


@router.patch("/{sale_id}")
def update_flash_sale(
    sale_id: int,
    body: FlashSaleUpdateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update title, end_time, or discount_pct on a flash sale you own."""
    sale = db.query(FlashSale).filter(
        FlashSale.id == sale_id,
        FlashSale.seller_id == current_user.id,
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")

    if body.title is not None:
        sale.title = body.title
    if body.end_time is not None:
        if body.end_time <= datetime.utcnow():
            raise HTTPException(status_code=400, detail="end_time must be in the future")
        sale.end_time = body.end_time
    if body.discount_pct is not None:
        listing = sale.price_item
        if listing:
            sale.discount_pct = body.discount_pct
            sale.sale_price = round(listing.price * (1 - body.discount_pct / 100), 2)

    db.commit()
    db.refresh(sale)
    return {"success": True, "data": _sale_dict(sale)}


@router.patch("/{sale_id}/toggle")
def toggle_flash_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle active/inactive on a flash sale you own."""
    sale = db.query(FlashSale).filter(
        FlashSale.id == sale_id,
        FlashSale.seller_id == current_user.id,
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")

    sale.is_active = not sale.is_active
    db.commit()
    return {"success": True, "is_active": sale.is_active}


@router.delete("/{sale_id}")
def cancel_flash_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel (soft-deactivate) a flash sale you own."""
    sale = db.query(FlashSale).filter(
        FlashSale.id == sale_id,
        FlashSale.seller_id == current_user.id,
    ).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    sale.is_active = False
    db.commit()
    return {"success": True, "message": "Flash sale cancelled"}


# ── Admin override endpoints ──────────────────────────────────────────────────

@router.patch("/{sale_id}/deactivate")
def admin_deactivate_flash_sale(
    sale_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin: force-deactivate any flash sale."""
    sale = db.query(FlashSale).filter(FlashSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    sale.is_active = False
    db.commit()
    return {"success": True, "message": "Flash sale deactivated"}


@router.delete("/{sale_id}/force")
def admin_force_delete_flash_sale(
    sale_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin: permanently delete a flash sale."""
    sale = db.query(FlashSale).filter(FlashSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Flash sale not found")
    db.delete(sale)
    db.commit()
    return {"success": True, "message": "Flash sale deleted"}
