import hashlib
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Path, Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, text as sa_text
from sqlalchemy.orm import Session
from starlette.requests import Request
from typing import List, Optional

from app.database import get_db
from app.limiter import limiter
from app.models import Price, Category, Store, Item, User, PointsTransaction
from app.routers.auth import decode_access_token, get_current_admin, get_current_user
from app.schemas import PriceCreate, PriceOut, CategoryCreate, CategoryOut
from app.services.cache import (
    cache_get, cache_set, cache_delete_pattern, TTL,
)
from app.services.search_service import (
    search_listings,
    get_search_suggestions,
    get_related_listings,
    resolve_category,
)
from app.services.search_analytics import (
    hash_ip,
    log_click_event,
    log_search_event,
)
from sqlalchemy import func


def _get_optional_user_id(request: Request) -> Optional[int]:
    """Extract user_id from the bearer token if present. Returns None for
    anonymous callers — never raises. Used by analytics on public endpoints."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = decode_access_token(auth[7:])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except Exception:
        return None


def _client_ip(request: Request) -> Optional[str]:
    """Best-effort client IP, honouring the X-Forwarded-For chain when set
    by an upstream proxy (Vercel sets it). Returns None when unknown."""
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None

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
    location: Optional[str] = Query(None, max_length=200, description="Free-text fallback — matches `location` or `retailer` substring. Kept for backwards compat."),
    locations: Optional[str] = Query(None, max_length=2000, description="Comma-separated canonical location names. A listing matches if ANY of its picked locations is in this set."),
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
        if locations:
            wanted = [s.strip() for s in locations.split(",") if s.strip()]
            if wanted:
                # locations is a JSON string like '["A","B"]' — each canonical
                # name is unambiguous (no embedded quotes), so a LIKE on the
                # quoted name is a safe, portable contains-check.
                filters.append(or_(*[Price.locations.ilike(f'%"{w}"%') for w in wanted]))
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
    if locations:
        # Canonical zone filter — was only applied on the FTS path, so the
        # filter-only (no query term) browse used by "Find Nearby Sellers"
        # ignored the picked zone entirely. Match if ANY wanted location is in
        # the listing's JSON locations array.
        wanted = [s.strip() for s in locations.split(",") if s.strip()]
        if wanted:
            filters.append(or_(*[Price.locations.ilike(f'%"{w}"%') for w in wanted]))
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
async def boost_listing(
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
    # Featured listings get a rank boost in FTS — bust caches so the new
    # placement shows up immediately rather than waiting 60s.
    await invalidate_search_cache(price.category_id)
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
async def approve_price(
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
    # Newly-approved listing becomes visible in search — bust caches.
    await invalidate_search_cache(price.category_id)
    return {"status": "approved", "id": price_id}


@router.put("/prices/{price_id}/reject")
@limiter.limit("30/minute")
async def reject_price(
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
    # Listing might already have been visible; ensure it disappears.
    await invalidate_search_cache(price.category_id)
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


# ═══════════════════════════════════════════════════════
# BLOCK 5 — Production search (FTS-backed)
# Uses app/services/search_service.py — same contract on
# PostgreSQL (tsvector) and SQLite (FTS5). New endpoints
# coexist with the legacy /prices/search endpoint above;
# the older one is kept to avoid breaking existing callers.
# ═══════════════════════════════════════════════════════

_SEARCH_SORT_VALUES = [
    "newest", "oldest",
    "price_asc", "price_desc",
    "trending", "most_viewed", "relevance",
]


@router.get("/search")
@limiter.limit("120/minute")
async def search(
    request: Request,
    background_tasks: BackgroundTasks,
    q:          Optional[str]   = Query(None, description="Search query"),
    category:   Optional[str]   = Query(None, description="Category name or id"),
    condition:  Optional[str]   = Query(None),
    min_price:  Optional[float] = Query(None, ge=0),
    max_price:  Optional[float] = Query(None, ge=0),
    location:   Optional[str]   = Query(None, max_length=200, description="Free-text fallback"),
    locations:  Optional[str]   = Query(None, max_length=2000, description="Comma-separated canonical location names — matches if ANY appears in listing.locations"),
    sort:       str             = Query("newest"),
    page:       int             = Query(1, ge=1),
    limit:      int             = Query(20, ge=1, le=100),
    featured_only: bool         = Query(False),
    db:         Session         = Depends(get_db),
):
    """
    Unified browse + full-text search. Returns:
      { items[], total, skip, limit, has_more, query, engine }

    When `q` is provided, results are FTS-ranked (PG ts_rank_cd or SQLite
    BM25). When omitted, this acts as a filtered browse with the normal
    sort order. Cached in Redis keyed on every filter param.

    Search-analytics events are logged via BackgroundTasks AFTER the
    response is sent, so logging never adds to user-facing latency. We
    log on every search (including cache hits) — volume is what matters
    for "top searches" and "zero-result" insight.
    """
    if sort not in _SEARCH_SORT_VALUES:
        sort = "newest"

    skip = (page - 1) * limit

    # Resolve the category once so:
    #   (a) the cache key namespace matches what invalidate_search_cache uses
    #   (b) two requests for the same category via different inputs
    #       ("4" vs "Tech & Gadgets") hit the same cached entry.
    resolved_cat_id = resolve_category(db, category)

    # Hash the full filter set so different filter combos don't collide.
    cache_params = {
        "q": q, "cat_id": resolved_cat_id, "cond": condition,
        "min": min_price, "max": max_price,
        "loc": location, "locs": locations, "sort": sort,
        "page": page, "limit": limit,
        "featured": featured_only,
    }
    raw_key = json.dumps(cache_params, sort_keys=True, default=str)
    # Category-namespaced cache key — lets invalidate_search_cache bust
    # only the affected bucket (plus the no-filter bucket) instead of
    # wiping every cached search on every listing edit.
    ns = str(resolved_cat_id) if resolved_cat_id is not None else "any"
    cache_key = f"search:cat:{ns}:" + hashlib.md5(raw_key.encode()).hexdigest()[:12]

    cached = await cache_get(cache_key)
    if cached is not None:
        result = cached
    else:
        result = search_listings(
            db=db,
            query=q,
            category=category,
            condition=condition,
            min_price=min_price,
            max_price=max_price,
            location=location,
            locations=locations,
            sort=sort,
            skip=skip,
            limit=limit,
            featured_only=featured_only,
        )
        # Short TTL for empty results so freshly-listed items show up quickly.
        ttl = TTL["listings_browse"] if result.get("total", 0) > 0 else 30
        await cache_set(cache_key, result, ttl)

    # Fire-and-forget analytics — only for first-page text searches.
    # Paginated requests by the same user re-issue the same query; logging
    # only page=1 keeps the analytics counts aligned with user intent.
    if q and len(q.strip()) >= 2 and page == 1:
        background_tasks.add_task(
            log_search_event,
            query=q,
            result_count=int(result.get("total", 0)),
            engine=str(result.get("engine") or ""),
            user_id=_get_optional_user_id(request),
            ip_hash_value=hash_ip(_client_ip(request)),
        )

    return result


class SearchClickIn(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    clicked_uuid: Optional[str] = Field(None, max_length=64)
    position: Optional[int] = Field(None, ge=1, le=1000)


@router.post("/search/click", status_code=204)
@limiter.limit("240/minute")
async def search_click(
    request: Request,
    background_tasks: BackgroundTasks,
    body: SearchClickIn,
):
    """
    Record that a user clicked a result from the search/autocomplete UI.
    Fire-and-forget — returns 204 immediately, logs in the background.
    The frontend should call this with `keepalive: true` so the request
    survives navigation away from the page.
    """
    background_tasks.add_task(
        log_click_event,
        query=body.query,
        clicked_uuid=body.clicked_uuid,
        clicked_position=body.position,
        user_id=_get_optional_user_id(request),
        ip_hash_value=hash_ip(_client_ip(request)),
    )
    return Response(status_code=204)


@router.get("/search/suggest")
@limiter.limit("60/minute")
async def search_suggest(
    request: Request,
    q:       str = Query(..., min_length=2, max_length=100),
    limit:   int = Query(8, ge=1, le=20),
    db:      Session = Depends(get_db),
):
    """Fast autocomplete — returns matching listing titles as the user types."""
    cache_key = f"suggest:{q.lower().strip()}:{limit}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    suggestions = get_search_suggestions(db, q, limit=limit)
    await cache_set(cache_key, suggestions, ttl=120)
    return suggestions


@router.get("/listings/{listing_id}/related")
@limiter.limit("60/minute")
async def related_listings(
    request: Request,
    listing_id: int = Path(..., gt=0),
    limit:      int = Query(6, ge=1, le=12),
    db:         Session = Depends(get_db),
):
    """Listings similar to the one being viewed (PG: tsvector; SQLite: same-category)."""
    cache_key = f"related:{listing_id}:{limit}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    result = get_related_listings(db, listing_id, limit=limit)
    await cache_set(cache_key, result, ttl=300)
    return result


@router.get("/trending")
@limiter.limit("60/minute")
async def trending_listings(
    request: Request,
    category: Optional[str] = Query(None, description="Category name or id"),
    limit:    int = Query(12, ge=1, le=50),
    db:       Session = Depends(get_db),
):
    """
    Most-viewed active listings from the past 7 days. Optional category filter.
    Cached for 2 minutes.
    """
    cache_key = f"trending:{(category or 'all').lower()}:{limit}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    from datetime import timedelta as _td
    since = datetime.utcnow() - _td(days=7)

    qry = db.query(Price).filter(
        Price.listing_status == "active",
        Price.status == "approved",
        Price.submitted_at >= since,
    )
    if category and category.lower() != "all":
        if category.isdigit():
            qry = qry.filter(Price.category_id == int(category))
        else:
            cat = (
                db.query(Category.id)
                .filter(Category.name.ilike(category))
                .first()
            )
            if cat:
                qry = qry.filter(Price.category_id == cat[0])

    rows = (
        qry.order_by(Price.is_featured.desc(), Price.view_count.desc())
           .limit(limit)
           .all()
    )

    result = []
    for p in rows:
        photos = p.photos
        if isinstance(photos, str):
            try:
                photos = json.loads(photos)
            except Exception:
                photos = []
        photos = photos or []
        result.append({
            "uuid":         str(p.uuid) if p.uuid else str(p.id),
            "id":           p.id,
            "title":        p.name,
            "price":        float(p.price or 0),
            "category":     p.category.name if p.category else None,
            "category_id":  p.category_id,
            "condition":    p.condition,
            "location":     p.location,
            "cover_photo":  photos[0] if photos else None,
            "views_count":  p.view_count or 0,
            "is_featured":  bool(p.is_featured),
            "created_at":   p.submitted_at.isoformat() if p.submitted_at else None,
        })

    await cache_set(cache_key, result, ttl=120)
    return result


async def invalidate_search_cache(category_id: Optional[int] = None) -> None:
    """
    Bust search caches after a listing is created, updated, or deleted.

    Behavior:
      • category_id is None  → wholesale flush of every cached search
                               (back-compat default for bulk operations
                               like vacation toggle that touch many
                               categories at once).
      • category_id provided → surgical: clear only the cached searches
                               that could possibly include items in this
                               category — i.e. queries filtered to that
                               category (search:cat:{id}:*) plus the
                               no-filter bucket (search:cat:any:*).

    Trending + autocomplete caches span all categories, so they're
    always busted regardless.
    """
    if category_id is None:
        await cache_delete_pattern("search:")
    else:
        await cache_delete_pattern(f"search:cat:{category_id}:")
        await cache_delete_pattern("search:cat:any:")
    await cache_delete_pattern("trending:")
    await cache_delete_pattern("suggest:")
