from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy import or_
from sqlalchemy.orm import Session
from starlette.requests import Request
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import SessionLocal
from app.models import Price, Category, Store, Item, User, PointsTransaction
from app.schemas import (
    PriceCreate, PriceOut,
    CategoryCreate, CategoryOut,
)

router = APIRouter(prefix="/items", tags=["Items"])
limiter = Limiter(key_func=get_remote_address)

BOOST_COST_7_DAYS = 50
BOOST_COST_30_DAYS = 150
POINTS_PER_CONFIRMED_PURCHASE = 10


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ═══════════════════════════════════════════════════════
# CATEGORIES
# ═══════════════════════════════════════════════════════

@router.get("/categories/all", response_model=List[CategoryOut])
@limiter.limit("100/minute")
def get_categories(request: Request, db: Session = Depends(get_db)):
    """Get all categories (public)"""
    return db.query(Category).all()


@router.post("/categories/", response_model=CategoryOut)
@limiter.limit("10/minute")
def create_category(request: Request, category: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category"""
    new_cat = Category(**category.dict())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


# ═══════════════════════════════════════════════════════
# PRICES — Discovery endpoints (must come before /{price_id} routes)
# ═══════════════════════════════════════════════════════

@router.get("/prices/all", response_model=List[PriceOut])
@limiter.limit("100/minute")
def get_all_prices(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Get all approved prices with pagination (public)"""
    return db.query(Price).filter(Price.status == "approved").offset(skip).limit(limit).all()


@router.get("/prices/new", response_model=List[PriceOut])
@limiter.limit("60/minute")
def get_new_arrivals(
    request: Request,
    limit: int = Query(8, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """New Arrivals — most recently approved listings (public)"""
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
    """Trending on Campus — highest view-count listings (public)"""
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
    """Featured/Promoted listings — boosted by sellers using points (public)"""
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
    condition: Optional[str] = Query(None),          # New / Fairly Used / Used
    listing_status: Optional[str] = Query(None),     # active / paused / draft / sold / expired
    sort: Optional[str] = Query(None),               # newest / price_asc / price_desc / most_viewed
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search approved prices with optional filters (public)"""
    filters = [Price.status == "approved"]

    # Default to active listings only (skip drafts, paused, etc.)
    if listing_status:
        filters.append(Price.listing_status == listing_status)
    else:
        filters.append(Price.listing_status == "active")

    term = q.strip()
    if term:
        pattern = f"%{term}%"
        filters.append(
            or_(
                Price.name.ilike(pattern),
                Price.brand.ilike(pattern),
                Price.retailer.ilike(pattern),
                Price.description.ilike(pattern),
            )
        )

    if min_price is not None:
        filters.append(Price.price >= min_price)
    if max_price is not None:
        filters.append(Price.price <= max_price)
    if category_id is not None:
        filters.append(Price.category_id == category_id)
    if location:
        loc_pattern = f"%{location.strip()}%"
        filters.append(
            or_(Price.location.ilike(loc_pattern), Price.retailer.ilike(loc_pattern))
        )
    if condition:
        filters.append(Price.condition == condition)

    query = db.query(Price).filter(*filters)

    # Sorting
    if sort == "price_asc":
        query = query.order_by(Price.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Price.price.desc())
    elif sort == "most_viewed":
        query = query.order_by(Price.view_count.desc())
    else:  # newest (default)
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
    """Get all pending price submissions (admin)"""
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
    """Get approved prices for a specific category (public)"""
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
    """Submit a new price (pending until admin approval)"""
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
def increment_view(request: Request, price_id: int = Path(..., gt=0), db: Session = Depends(get_db)):
    """Increment view count for a price listing (called by frontend on product page load)"""
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.view_count = (price.view_count or 0) + 1
    db.commit()
    return {"ok": True, "view_count": price.view_count}


@router.post("/prices/{price_id}/boost")
@limiter.limit("10/minute")
def boost_listing(
    request: Request,
    price_id: int = Path(..., gt=0),
    days: int = Query(7, ge=7, le=30, description="7 or 30 days"),
    seller_id: int = Query(..., gt=0, description="Seller user ID"),
    db: Session = Depends(get_db),
):
    """Spend seller points to feature a listing (50 pts = 7 days, 150 pts = 30 days)"""
    price = db.query(Price).filter(Price.id == price_id, Price.status == "approved").first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found or not approved")

    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    cost = BOOST_COST_30_DAYS if days >= 30 else BOOST_COST_7_DAYS
    if (seller.seller_points or 0) < cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient points. Need {cost}, have {seller.seller_points or 0}.",
        )

    seller.seller_points -= cost
    price.is_featured = True
    price.featured_until = datetime(
        datetime.utcnow().year,
        datetime.utcnow().month,
        datetime.utcnow().day,
    )
    from datetime import timedelta
    price.featured_until = datetime.utcnow() + timedelta(days=days)

    pt = PointsTransaction(
        user_id=seller_id,
        amount=-cost,
        reason="listing_boost",
        related_price_id=price_id,
    )
    db.add(pt)
    db.commit()
    return {"ok": True, "points_spent": cost, "points_remaining": seller.seller_points, "featured_until": price.featured_until}


@router.post("/prices/{price_id}/confirm_purchase")
@limiter.limit("30/minute")
def confirm_purchase(
    request: Request,
    price_id: int = Path(..., gt=0),
    seller_id: int = Query(..., gt=0, description="Seller user ID to award points to"),
    db: Session = Depends(get_db),
):
    """Buyer confirms receipt → seller earns 10 points"""
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")

    seller = db.query(User).filter(User.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    seller.seller_points = (seller.seller_points or 0) + POINTS_PER_CONFIRMED_PURCHASE
    pt = PointsTransaction(
        user_id=seller_id,
        amount=POINTS_PER_CONFIRMED_PURCHASE,
        reason="purchase_confirmed",
        related_price_id=price_id,
    )
    db.add(pt)
    db.commit()
    return {"ok": True, "points_awarded": POINTS_PER_CONFIRMED_PURCHASE, "total_points": seller.seller_points}


@router.put("/prices/{price_id}/approve")
@limiter.limit("30/minute")
def approve_price(request: Request, price_id: int, db: Session = Depends(get_db)):
    """Admin: Approve a pending price"""
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "approved"
    db.commit()
    return {"status": "approved", "id": price_id}


@router.put("/prices/{price_id}/reject")
@limiter.limit("30/minute")
def reject_price(request: Request, price_id: int, db: Session = Depends(get_db)):
    """Admin: Reject a pending price"""
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")
    price.status = "rejected"
    db.commit()
    return {"status": "rejected", "id": price_id}


@router.delete("/{item_id}")
@limiter.limit("30/minute")
def delete_item(request: Request, item_id: int, db: Session = Depends(get_db)):
    """Delete an item"""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}
