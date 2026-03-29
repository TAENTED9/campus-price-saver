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
from app.schemas import PriceCreate, PriceOut, CategoryCreate, CategoryOut

router = APIRouter(prefix="/items", tags=["Items"])

BOOST_COST_7_DAYS = 50
BOOST_COST_30_DAYS = 150
POINTS_PER_CONFIRMED_PURCHASE = 10


# ═══════════════════════════════════════════════════════
# CATEGORIES
# ═══════════════════════════════════════════════════════

@router.get("/categories/all", response_model=List[CategoryOut])
@limiter.limit("100/minute")
def get_categories(request: Request, db: Session = Depends(get_db)):
    return db.query(Category).all()


@router.post("/categories/", response_model=CategoryOut)
@limiter.limit("10/minute")
def create_category(request: Request, category: CategoryCreate, db: Session = Depends(get_db)):
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
        .filter(Price.status == "approved")
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
        .filter(Price.status == "approved")
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
            Price.is_featured == True,
            or_(Price.featured_until == None, Price.featured_until > now),
        )
        .limit(limit)
        .all()
    )


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
def submit_price(request: Request, price: PriceCreate, db: Session = Depends(get_db)):
    if not db.query(Category).filter(Category.id == price.category_id).first():
        raise HTTPException(status_code=404, detail="Category not found")
    if price.store_id and not db.query(Store).filter(Store.id == price.store_id).first():
        raise HTTPException(status_code=404, detail="Store not found")
    new_price = Price(**price.dict())
    new_price.status = new_price.status or "pending"
    db.add(new_price)
    db.commit()
    db.refresh(new_price)
    return new_price


@router.post("/prices/{price_id}/view")
@limiter.limit("200/minute")
def increment_view(
    request: Request,
    response: Response,
    price_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
):
    """
    Deduplicated view counter using a browser cookie.
    Cookie "viewed_listings" holds a JSON array of already-counted IDs.
    Returns {"counted": false} when the same browser visits again within 24 h.
    """
    # Read existing cookie
    raw = request.cookies.get("viewed_listings", "[]")
    try:
        viewed: list = json.loads(raw)
        if not isinstance(viewed, list):
            viewed = []
    except Exception:
        viewed = []

    if price_id in viewed:
        return {"counted": False}

    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")

    price.view_count = (price.view_count or 0) + 1
    db.commit()

    viewed.append(price_id)
    response.set_cookie(
        key="viewed_listings",
        value=json.dumps(viewed),
        max_age=86400,
        httponly=False,   # frontend must be able to read it
        samesite="lax",
    )
    return {"counted": True, "view_count": price.view_count}


@router.post("/prices/{price_id}/boost")
@limiter.limit("10/minute")
def boost_listing(
    request: Request,
    price_id: int = Path(..., gt=0),
    days: int = Query(7, ge=7, le=30),
    seller_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    price = db.query(Price).filter(Price.id == price_id, Price.status == "approved").first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found or not approved")
    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    cost = BOOST_COST_30_DAYS if days >= 30 else BOOST_COST_7_DAYS
    if (seller.seller_points or 0) < cost:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Need {cost}, have {seller.seller_points or 0}.")
    seller.seller_points -= cost
    price.is_featured = True
    price.featured_until = datetime.utcnow() + timedelta(days=days)
    db.add(PointsTransaction(user_id=seller_id, amount=-cost, reason="listing_boost", related_price_id=price_id))
    db.commit()
    return {"ok": True, "points_spent": cost, "points_remaining": seller.seller_points, "featured_until": price.featured_until}


@router.post("/prices/{price_id}/confirm_purchase")
@limiter.limit("30/minute")
def confirm_purchase(
    request: Request,
    price_id: int = Path(..., gt=0),
    seller_id: int = Query(..., gt=0),
    db: Session = Depends(get_db),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    seller.seller_points = (seller.seller_points or 0) + POINTS_PER_CONFIRMED_PURCHASE
    db.add(PointsTransaction(user_id=seller_id, amount=POINTS_PER_CONFIRMED_PURCHASE, reason="purchase_confirmed", related_price_id=price_id))
    db.commit()
    return {"ok": True, "points_awarded": POINTS_PER_CONFIRMED_PURCHASE, "total_points": seller.seller_points}


@router.put("/prices/{price_id}/approve")
@limiter.limit("30/minute")
def approve_price(request: Request, price_id: int, db: Session = Depends(get_db)):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "approved"
    db.commit()
    return {"status": "approved", "id": price_id}


@router.put("/prices/{price_id}/reject")
@limiter.limit("30/minute")
def reject_price(request: Request, price_id: int, db: Session = Depends(get_db)):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "rejected"
    db.commit()
    return {"status": "rejected", "id": price_id}


@router.delete("/{item_id}")
@limiter.limit("30/minute")
def delete_item(request: Request, item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}
