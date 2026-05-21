import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Response
from sqlalchemy import or_, text as sa_text
from sqlalchemy.orm import Session
from starlette.requests import Request
from typing import List, Optional

from app.database import get_db
from app.limiter import limiter
from app.models import Price, Category, Store, Item, User, PointsTransaction
from app.routers.auth import get_current_admin, get_current_user
from app.schemas import PriceCreate, PriceOut, CategoryCreate, CategoryOut
from sqlalchemy import func

router = APIRouter(prefix="/items", tags=["Items"])

BOOST_COST_7_DAYS = 50
BOOST_COST_30_DAYS = 150
POINTS_PER_CONFIRMED_PURCHASE = 10


# ═══════════════════════════════════════════════════════
# PLATFORM ITEM STATS
# ═══════════════════════════════════════════════════════

@router.get("/stats")
@limiter.limit("60/minute")
def get_item_stats(request: Request, db: Session = Depends(get_db)):
    """Quick item-level stats for the homepage and dashboards."""
    total_items = db.query(Price).filter(Price.status == "approved").count()
    total_categories = db.query(Category).count()
    avg_price = db.query(func.avg(Price.price)).filter(Price.status == "approved").scalar()
    total_views = db.query(func.sum(Price.view_count)).filter(Price.status == "approved").scalar()
    return {
        "total_items": total_items,
        "total_categories": total_categories,
        "avg_price": round(float(avg_price), 2) if avg_price else 0,
        "total_views": total_views or 0,
    }


# ═══════════════════════════════════════════════════════
# CATEGORIES
# ═══════════════════════════════════════════════════════

@router.get("/categories/all", response_model=List[CategoryOut])
@limiter.limit("100/minute")
def get_categories(request: Request, db: Session = Depends(get_db)):
    return db.query(Category).all()


@router.post("/categories/", response_model=CategoryOut)
@limiter.limit("10/minute")
def create_category(
    request: Request,
    category: CategoryCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    new_cat = Category(**category.dict())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


# ═══════════════════════════════════════════════════════
# PRICES — Discovery endpoints
# ═══════════════════════════════════════════════════════

@router.get("/prices/all", response_model=List[PriceOut])
@limiter.limit("100/minute")
def get_all_prices(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return db.query(Price).filter(Price.status == "approved").offset(skip).limit(limit).all()


@router.get("/prices/new", response_model=List[PriceOut])
@limiter.limit("60/minute")
def get_new_arrivals(
    request: Request,
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return (
        db.query(Price)
        .filter(Price.status == "approved", Price.listing_status == "active")
        .order_by(Price.submitted_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/prices/trending", response_model=List[PriceOut])
@limiter.limit("60/minute")
def get_trending_prices(
    request: Request,
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return (
        db.query(Price)
        .filter(Price.status == "approved", Price.listing_status == "active")
        .order_by(Price.view_count.desc())
        .limit(limit)
        .all()
    )


@router.get("/prices/featured", response_model=List[PriceOut])
@limiter.limit("60/minute")
def get_featured_prices(
    request: Request,
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    return (
        db.query(Price)
        .filter(
            Price.status == "approved",
            Price.listing_status == "active",
            Price.is_featured == True,
            or_(Price.featured_until == None, Price.featured_until > now),
        )
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════
# SITEMAP — minimal listing data for /sitemap.xml
# ═══════════════════════════════════════════════════════

@router.get("/listings/sitemap")
@limiter.limit("30/minute")
def get_listings_sitemap(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Block 4 — minimal active-listing data for the Next.js sitemap route.
    Capped at 5000 to keep the XML under Google's 50MB / 50k URL limit.
    """
    rows = (
        db.query(Price.uuid, Price.submitted_at)
        .filter(
            Price.listing_status == "active",
            Price.status == "approved",
            Price.uuid.isnot(None),
        )
        .order_by(Price.submitted_at.desc())
        .limit(5000)
        .all()
    )
    return [
        {
            "uuid":       r[0],
            "updated_at": r[1].isoformat() if r[1] else None,
        }
        for r in rows
    ]


@router.get("/prices/search", response_model=List[PriceOut])
@limiter.limit("60/minute")
def search_prices(
    request: Request,
    q: str = Query("", description="Search query"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    category_id: Optional[int] = Query(None, gt=0),
    location: Optional[str] = Query(None, max_length=200),
    condition: Optional[str] = Query(None),
    listing_status: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search approved prices. Uses SQLite FTS5 when a query term is provided."""
    term = q.strip()

    # ── FTS5 path ─────────────────────────────────────────────────────────
    if term:
        # Get ranked matching IDs from the FTS5 virtual table
        fts_rows = db.execute(
            sa_text("SELECT rowid FROM prices_fts WHERE prices_fts MATCH :q ORDER BY rank LIMIT 200"),
            {"q": term},
        ).fetchall()
        matched_ids = [r[0] for r in fts_rows]
        if not matched_ids:
            return []

        filters = [
            Price.id.in_(matched_ids),
            Price.status == "approved",
        ]
        if listing_status:
            filters.append(Price.listing_status == listing_status)
        else:
            filters.append(Price.listing_status == "active")
        if min_price is not None:
            filters.append(Price.price >= min_price)
        if max_price is not None:
            filters.append(Price.price <= max_price)
        if category_id is not None:
            filters.append(Price.category_id == category_id)
        if location:
            loc_pattern = f"%{location.strip()}%"
            filters.append(or_(Price.location.ilike(loc_pattern), Price.retailer.ilike(loc_pattern)))
        if condition:
            filters.append(Price.condition == condition)

        # Preserve FTS5 rank order by sorting matched_ids position
        from sqlalchemy import case
        ordering = case(
            {id_: idx for idx, id_ in enumerate(matched_ids)},
            value=Price.id,
        )
        return (
            db.query(Price)
            .filter(*filters)
            .order_by(ordering)
            .offset(skip)
            .limit(limit)
            .all()
        )

    # ── Non-FTS path (no search term, filter-only) ────────────────────────
    filters = [Price.status == "approved"]
    if listing_status:
        filters.append(Price.listing_status == listing_status)
    else:
        filters.append(Price.listing_status == "active")
    if min_price is not None:
        filters.append(Price.price >= min_price)
    if max_price is not None:
        filters.append(Price.price <= max_price)
    if category_id is not None:
        filters.append(Price.category_id == category_id)
    if location:
        loc_pattern = f"%{location.strip()}%"
        filters.append(or_(Price.location.ilike(loc_pattern), Price.retailer.ilike(loc_pattern)))
    if condition:
        filters.append(Price.condition == condition)

    query = db.query(Price).filter(*filters)
    if sort == "price_asc":
        query = query.order_by(Price.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Price.price.desc())
    elif sort == "most_viewed":
        query = query.order_by(Price.view_count.desc())
    else:
        query = query.order_by(Price.submitted_at.desc())

    return query.offset(skip).limit(limit).all()


@router.get("/prices/pending/", response_model=List[PriceOut])
@limiter.limit("30/minute")
def get_pending_prices(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    return db.query(Price).filter(Price.status == "pending").offset(skip).limit(limit).all()


@router.get("/prices/category/{category_id}", response_model=List[PriceOut])
@limiter.limit("100/minute")
def get_prices_for_category(
    request: Request,
    category_id: int = Path(..., gt=0),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return (
        db.query(Price)
        .filter(Price.category_id == category_id, Price.status == "approved")
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════
# PRICES — Mutating endpoints
# ═══════════════════════════════════════════════════════

@router.post("/prices/", response_model=PriceOut)
@limiter.limit("30/minute")
def submit_price(
    request: Request,
    price: PriceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Category).filter(Category.id == price.category_id).first():
        raise HTTPException(status_code=404, detail="Category not found")
    if price.store_id and not db.query(Store).filter(Store.id == price.store_id).first():
        raise HTTPException(status_code=404, detail="Store not found")
    new_price = Price(**price.dict())
    new_price.submitted_by = current_user.id  # force identity from JWT
    new_price.status = "pending"
    db.add(new_price)
    db.commit()
    db.refresh(new_price)
    # Award karma for price submission
    try:
        pts = 5
        current_user.seller_points = max(0, (current_user.seller_points or 0) + pts)
        db.add(PointsTransaction(user_id=current_user.id, amount=pts, reason="price_submission", related_price_id=new_price.id))
        db.commit()
    except Exception:
        pass
    return new_price


@router.post("/prices/{price_id}/view")
@limiter.limit("200/minute")
async def increment_view(
    request: Request,
    response: Response,
    price_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
):
    """
    Deduplicated view counter.

    Two layers:
      1. Browser cookie  — primary dedup per browser for 24h.
      2. Redis IP dedup  — secondary guard so clearing cookies (or incognito
         tabs from the same IP) can't inflate within 1 hour.

    If Redis is unavailable the cookie layer still applies, so we degrade
    to "cookie-only" rather than "always count".
    """
    raw = request.cookies.get("viewed_listings", "[]")
    try:
        viewed: list = json.loads(raw)
        if not isinstance(viewed, list):
            viewed = []
    except Exception:
        viewed = []

    if price_id in viewed:
        return {"counted": False, "reason": "cookie"}

    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")

    ip = (request.client.host if request.client else "") or "unknown"
    try:
        from app.services.cache import get_redis
        r = await get_redis()
        was_new = await r.set(f"view:price:{price_id}:{ip}", "1", ex=3600, nx=True)
        if not was_new:
            # Still update cookie so subsequent requests short-circuit.
            viewed.append(price_id)
            response.set_cookie(
                key="viewed_listings",
                value=json.dumps(viewed),
                max_age=86400,
                httponly=False,
                samesite="lax",
            )
            return {"counted": False, "reason": "ip"}
    except Exception:
        # Redis miss — fall through to cookie-only behavior.
        pass

    price.view_count = (price.view_count or 0) + 1
    db.commit()

    viewed.append(price_id)
    response.set_cookie(
        key="viewed_listings",
        value=json.dumps(viewed),
        max_age=86400,
        httponly=False,
        samesite="lax",
    )
    return {"counted": True, "view_count": price.view_count}


@router.post("/prices/{price_id}/boost")
@limiter.limit("10/minute")
def boost_listing(
    request: Request,
    price_id: int = Path(..., gt=0),
    days: int = Query(7, ge=7, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    seller = db.query(User).filter(
        User.id == current_user.id,
        User.role == "seller",
    ).first()
    if not seller:
        raise HTTPException(status_code=403, detail="Only verified sellers can boost listings")
    price = db.query(Price).filter(Price.id == price_id, Price.status == "approved").first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found or not approved")
    cost = BOOST_COST_30_DAYS if days >= 30 else BOOST_COST_7_DAYS
    if (seller.seller_points or 0) < cost:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Need {cost}, have {seller.seller_points or 0}.")
    seller.seller_points -= cost
    price.is_featured = True
    price.featured_until = datetime.utcnow() + timedelta(days=days)
    db.add(PointsTransaction(user_id=current_user.id, amount=-cost, reason="listing_boost", related_price_id=price_id))
    db.commit()
    return {"ok": True, "points_spent": cost, "points_remaining": seller.seller_points, "featured_until": price.featured_until}


@router.post("/prices/{price_id}/confirm_purchase")
@limiter.limit("30/minute")
def confirm_purchase(
    request: Request,
    price_id: int = Path(..., gt=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    current_user.seller_points = (current_user.seller_points or 0) + POINTS_PER_CONFIRMED_PURCHASE
    db.add(PointsTransaction(user_id=current_user.id, amount=POINTS_PER_CONFIRMED_PURCHASE, reason="purchase_confirmed", related_price_id=price_id))
    db.commit()
    return {"ok": True, "points_awarded": POINTS_PER_CONFIRMED_PURCHASE, "total_points": current_user.seller_points}


@router.put("/prices/{price_id}/approve")
@limiter.limit("30/minute")
def approve_price(
    request: Request,
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "approved"
    if not price.listing_status or price.listing_status == "draft":
        price.listing_status = "active"
    db.commit()
    return {"status": "approved", "id": price_id}


@router.put("/prices/{price_id}/reject")
@limiter.limit("30/minute")
def reject_price(
    request: Request,
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "rejected"
    db.commit()
    return {"status": "rejected", "id": price_id}


@router.delete("/{item_id}")
@limiter.limit("30/minute")
def delete_item(
    request: Request,
    item_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}
