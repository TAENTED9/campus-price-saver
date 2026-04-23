import json
from fastapi import APIRouter, Body, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from app.database import get_db
from app.limiter import limiter
from app.models import Price, Lead, Report, User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/listings", tags=["Listings"])


@router.get("/{listing_uuid}")
@limiter.limit("120/minute")
def get_listing(
    request: Request,
    listing_uuid: str = Path(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Return a single listing by its UUID (public-facing product page, no auth required)."""
    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    from app.routers.storefront import _price_to_dict, _seller_info
    seller = db.query(User).filter(User.id == listing.submitted_by).first()
    data = _price_to_dict(listing)
    data["seller"] = _seller_info(seller, db) if seller else None
    return data


@router.post("/{listing_uuid}/views")
@limiter.limit("200/minute")
def record_view(
    request: Request,
    response: Response,
    listing_uuid: str = Path(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Cookie-deduplicated view counter for a listing identified by UUID."""
    raw = request.cookies.get("viewed_listings", "[]")
    try:
        viewed: list = json.loads(raw)
        if not isinstance(viewed, list):
            viewed = []
    except Exception:
        viewed = []

    if listing_uuid in viewed:
        return {"counted": False}

    listing = db.query(Price).filter(Price.uuid == listing_uuid).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

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
