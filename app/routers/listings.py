import json
from fastapi import APIRouter, Body, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from app.database import get_db
from app.limiter import limiter
from app.models import Price, Lead, Report, User
from app.routers.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.get("/{listing_uuid}")
@limiter.limit("120/minute")
def get_listing(
    request: Request,
    listing_uuid: str = Path(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Return a single listing by its UUID (public-facing product page).

    Block 2: sold listings are hidden from buyers — the owner still sees their
    own sold listing (so they can land on it from the seller dashboard and
    Relist it), but everyone else gets a 410 Gone with a clear message.
    """
    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    is_owner = bool(current_user and current_user.id == listing.submitted_by)
    if listing.listing_status == "sold" and not is_owner:
        raise HTTPException(
            status_code=410,
            detail="This listing has been sold and is no longer available.",
        )

    from app.routers.storefront import _price_to_dict, _seller_info
    seller = db.query(User).filter(User.id == listing.submitted_by).first()
    data = _price_to_dict(listing)
    data["seller"] = _seller_info(seller, db) if seller else None
    return data


@router.post("/{listing_uuid}/views")
@limiter.limit("200/minute")
async def record_view(
    request: Request,
    response: Response,
    listing_uuid: str = Path(..., min_length=1),
    db: Session = Depends(get_db),
):
    """
    View counter with two-layer dedup: browser cookie (24h) + Redis IP (1h).
    Redis degrades to cookie-only when unavailable.
    """
    raw = request.cookies.get("viewed_listings", "[]")
    try:
        viewed: list = json.loads(raw)
        if not isinstance(viewed, list):
            viewed = []
    except Exception:
        viewed = []

    if listing_uuid in viewed:
        return {"counted": False, "reason": "cookie"}

    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    ip = (request.client.host if request.client else "") or "unknown"
    try:
        from app.services.cache import get_redis
        r = await get_redis()
        was_new = await r.set(f"view:listing:{listing_uuid}:{ip}", "1", ex=3600, nx=True)
        if not was_new:
            viewed.append(listing_uuid)
            response.set_cookie(
                key="viewed_listings",
                value=json.dumps(viewed),
                max_age=86400,
                httponly=False,
                samesite="lax",
            )
            return {"counted": False, "reason": "ip"}
    except Exception:
        pass

    listing.view_count = (listing.view_count or 0) + 1
    db.commit()

    viewed.append(listing_uuid)
    response.set_cookie(
        key="viewed_listings",
        value=json.dumps(viewed),
        max_age=86400,
        httponly=False,
        samesite="lax",
    )
    return {"counted": True, "view_count": listing.view_count}


@router.post("/{listing_uuid}/interested")
@limiter.limit("60/minute")
def log_lead(
    request: Request,
    listing_uuid: str = Path(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Log a buyer interest lead when they click 'Message Seller'."""
    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    lead = Lead(listing_id=listing.id)
    db.add(lead)
    db.commit()
    return {"ok": True}


@router.post("/{listing_uuid}/report")
@limiter.limit("20/minute")
def report_listing(
    request: Request,
    listing_uuid: str = Path(..., min_length=1),
    body: dict = Body(default={}),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /api/listings/{uuid}/report — authenticated users report a listing."""
    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if body is None:
        body = {}
    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason is required")

    report = Report(
        reporter_id=current_user.id,
        target_type="Listing",
        target_id=listing.id,
        target_name=listing.name,
        reason=reason,
    )
    db.add(report)
    db.commit()
    return {"ok": True, "message": "Report submitted. Our team will review it shortly."}
