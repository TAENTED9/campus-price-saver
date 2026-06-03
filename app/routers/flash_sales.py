"""
Flash Sales router — seller self-service + public endpoints.
Seller write endpoints require JWT authentication via get_current_user.
Admin override endpoints require get_current_admin.
"""
import json as _json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session


def _to_naive_utc(v: datetime) -> datetime:
    """Coerce an aware datetime (e.g. from the frontend's ISO string with
    a `Z` or `+HH:MM` suffix) into naive UTC so it can be compared with
    `datetime.utcnow()` and stored in the naive DATETIME columns without
    triggering 'offset-naive vs offset-aware' TypeErrors."""
    if v.tzinfo is not None:
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
    return v

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

    @field_validator("end_time")
    @classmethod
    def _strip_tz(cls, v: datetime) -> datetime:
        return _to_naive_utc(v)


class FlashSaleUpdateBody(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    end_time: Optional[datetime] = None
    discount_pct: Optional[float] = Field(None, gt=0, le=100)

    @field_validator("end_time")
    @classmethod
    def _strip_tz(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _to_naive_utc(v) if v is not None else v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _cloudinary_video_thumb(video_url: str) -> str | None:
    """
    Cloudinary auto-generates a JPG thumbnail of the first frame when you
    swap the extension. Works for any video uploaded with resource_type='video'.

    e.g.  .../video/upload/v123/listings/videos/abc.mp4
       →  .../video/upload/v123/listings/videos/abc.jpg
    """
    if not video_url or "/video/upload/" not in video_url:
        return None
    for ext in (".mp4", ".mov", ".webm", ".m4v"):
        if video_url.lower().endswith(ext):
            return video_url[: -len(ext)] + ".jpg"
    return None


def _sale_dict(sale: FlashSale) -> dict:
    """Serialize a FlashSale to a response dict including joined listing fields."""
    item = sale.price_item
    photos: list[str] = []
    videos: list[str] = []
    if item and item.photos:
        try:
            parsed = _json.loads(item.photos)
            if isinstance(parsed, list):
                photos = [p for p in parsed if isinstance(p, str)]
        except Exception:
            pass
    if item and item.videos:
        try:
            parsed = _json.loads(item.videos)
            if isinstance(parsed, list):
                videos = [v for v in parsed if isinstance(v, str)]
        except Exception:
            pass

    # cover_media: prefer the first photo; fall back to a Cloudinary-generated
    # JPG thumbnail of the first video; finally null (the card will render a
    # branded placeholder).
    first_photo = photos[0] if photos else None
    cover_media = first_photo
    cover_media_kind: str | None = "photo" if first_photo else None
    if cover_media is None and videos:
        thumb = _cloudinary_video_thumb(videos[0])
        if thumb:
            cover_media = thumb
            cover_media_kind = "video_thumb"

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
        # Legacy fields kept so old clients don't break:
        "item_photo": first_photo,
        # New Block 5/6A fields:
        "item_photos": photos,
        "item_videos": videos,
        "cover_media": cover_media,
        "cover_media_kind": cover_media_kind,  # "photo" | "video_thumb" | None
    }


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
    # Check ownership first, then status, so the error tells the seller exactly
    # what's wrong instead of a misleading "doesn't belong to you" when the real
    # issue is that their listing is still pending approval.
    listing = db.query(Price).filter(
        Price.id == body.listing_id,
        Price.submitted_by == current_user.id,
    ).first()
    if not listing:
        raise HTTPException(
            status_code=404,
            detail="Listing not found, or it doesn't belong to you.",
        )

    if listing.status != "approved":
        status_label = {
            "pending":  "still pending approval",
            "rejected": "was rejected",
        }.get(listing.status, f"not approved (status: {listing.status})")
        raise HTTPException(
            status_code=400,
            detail=(
                f"You can't run a flash sale yet — this listing is {status_label}. "
                "Flash sales become available once your listing is approved."
            ),
        )

    if listing.listing_status != "active":
        raise HTTPException(
            status_code=400,
            detail=(
                "This listing isn't active right now, so it can't go on flash sale. "
                "Make sure it's published and live, then try again."
            ),
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

    # Block 3 — fan out price-drop notifications off the request path.
    # The old _notify_wishlisters(listing, listing.price) call passed the same
    # value for both old and new price, which produced nonsense "dropped from
    # ₦X to ₦X" notifications. The Celery task uses the real sale_price.
    try:
        from app.tasks.notification_tasks import notify_price_drop_for_listing
        notify_price_drop_for_listing.delay(
            listing_id=listing.id,
            listing_title=listing.name,
            original_price=float(listing.price),
            sale_price=float(sale_price),
        )
    except Exception as e:
        # Broker down — log and continue; the sale itself is already saved.
        import logging
        logging.getLogger(__name__).warning(
            f"flash sale price-drop enqueue failed: {e}"
        )

    # Block 6B — platform-wide email blast to opted-in users. Runs entirely
    # off the request path: this enqueue returns instantly, and dispatch_flash_sale_blast
    # does the recipient query + batching inside the emails queue.
    try:
        from app.tasks.email_tasks import dispatch_flash_sale_blast
        dispatch_flash_sale_blast.delay(sale_id=sale.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            f"flash sale email blast enqueue failed: {e}"
        )

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
