"""
Search service for Campify listings (stored in the `prices` table).

Two backends, identical contract:
  PostgreSQL → stored tsvector + ts_rank_cd + pg_trgm fuzzy fallback
  SQLite     → prices_fts FTS5 virtual table + BM25 ranking

Callers don't need to know which DB is underneath — same dict shape comes
back either way. Output keys are mapped to frontend-friendly names
(`title` ← name, `created_at` ← submitted_at, `views_count` ← view_count,
`seller_id` ← submitted_by).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import IS_POSTGRES
from app.models import Price, Category

logger = logging.getLogger(__name__)


# ── Sort order mapping ────────────────────────────────────────────────────────
# Values are real column names on the `prices` table. None = relevance
# (handled per-backend, since SQLite uses FTS5 `rank` and PG uses ts_rank_cd).
_SORT_MAP: dict[str, str | None] = {
    "newest":      "submitted_at DESC",
    "oldest":      "submitted_at ASC",
    "price_asc":   "price ASC",
    "price_desc":  "price DESC",
    "trending":    "view_count DESC",
    "most_viewed": "view_count DESC",
    "relevance":   None,
}


# ── Query sanitisation ────────────────────────────────────────────────────────
# Keep alphanumerics, spaces, hyphens, apostrophes (for "men's"). Strip the
# rest so user input never feeds raw operators into to_tsquery or FTS5 MATCH.
_SAFE_QUERY_RE = re.compile(r"[^\w\s\-']", re.UNICODE)


def _clean_query(q: str) -> str:
    q = _SAFE_QUERY_RE.sub(" ", q or "")
    return " ".join(q.split()).strip()


def resolve_category(db: Session, category: str | None) -> int | None:
    """
    Accept either a numeric id or a category name (case-insensitive) and
    return the matching `categories.id`, or None if unresolved/missing.

    Public — also used by the items router to build category-namespaced
    cache keys so invalidation can be surgical instead of wholesale.
    """
    if not category or category.lower() == "all":
        return None
    if category.isdigit():
        return int(category)
    row = (
        db.query(Category.id)
        .filter(Category.name.ilike(category))
        .first()
    )
    return row[0] if row else None


def _parse_photos(photos: Any) -> list[str]:
    if not photos:
        return []
    if isinstance(photos, list):
        return photos
    if isinstance(photos, str):
        try:
            parsed = json.loads(photos)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def _parse_locations_param(raw: str | None) -> list[str]:
    """Comma-separated canonical names → cleaned list (dedupe, strip empties)."""
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for piece in raw.split(","):
        name = piece.strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def search_listings(
    db: Session,
    query: str | None = None,
    category: str | None = None,
    condition: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    location: str | None = None,
    locations: str | None = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 20,
    seller_id: int | None = None,
    featured_only: bool = False,
) -> dict[str, Any]:
    """
    Unified search. Routes to the appropriate backend based on IS_POSTGRES.

    `location` is the legacy free-text filter (matches `Price.location` /
    `Price.retailer` substring). `locations` is the new canonical multi-filter
    (comma-separated canonical names; matches if listing's locations array
    contains ANY of the requested values).
    """
    category_id = resolve_category(db, category)
    clean_q = _clean_query(query or "")
    location_list = _parse_locations_param(locations)

    if IS_POSTGRES:
        return _search_postgres(
            db, clean_q, category_id, condition,
            min_price, max_price, location, location_list,
            sort, skip, limit, seller_id, featured_only,
        )
    return _search_sqlite(
        db, clean_q, category_id, condition,
        min_price, max_price, location, location_list,
        sort, skip, limit, seller_id, featured_only,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POSTGRESQL — stored tsvector + ts_rank_cd + trigram fuzzy fallback
# ─────────────────────────────────────────────────────────────────────────────
def _search_postgres(
    db: Session,
    query: str,
    category_id: int | None,
    condition: str | None,
    min_price: float | None,
    max_price: float | None,
    location: str | None,
    location_list: list[str],
    sort: str,
    skip: int,
    limit: int,
    seller_id: int | None,
    featured_only: bool,
) -> dict[str, Any]:
    params: dict[str, Any] = {"skip": skip, "limit": limit}

    # Always-applied filters: listing visible, seller in good standing
    where_parts: list[str] = [
        "p.listing_status = 'active'",
        "p.status = 'approved'",
        "u.is_deleted = FALSE",
        "u.is_banned = FALSE",
        "u.is_suspended = FALSE",
    ]

    has_fts = len(query) >= 2
    rank_expr = "1.0"
    ts_query_expr = "NULL"

    if has_fts:
        if " " in query:
            ts_query_expr = "plainto_tsquery('english', :ts_query)"
            params["ts_query"] = query
        else:
            # Single-word: prefix match so "iphon" → "iphone"
            ts_query_expr = "to_tsquery('english', :ts_query)"
            params["ts_query"] = query + ":*"

        params["fuzzy_query"] = query
        where_parts.append(f"""(
            p.search_vector @@ {ts_query_expr}
            OR p.name % :fuzzy_query
            OR similarity(p.name, :fuzzy_query) > 0.3
        )""")
        rank_expr = f"""
            ts_rank_cd(p.search_vector, {ts_query_expr}, 32)
            + (similarity(p.name, :fuzzy_query) * 0.2)
            + (CASE WHEN p.is_featured THEN 0.5 ELSE 0 END)
        """

    if category_id is not None:
        where_parts.append("p.category_id = :category_id")
        params["category_id"] = category_id
    if condition:
        where_parts.append("p.condition = :condition")
        params["condition"] = condition
    if min_price is not None:
        where_parts.append("p.price >= :min_price")
        params["min_price"] = min_price
    if max_price is not None:
        where_parts.append("p.price <= :max_price")
        params["max_price"] = max_price
    if location:
        where_parts.append("p.location ILIKE :location")
        params["location"] = f"%{location}%"
    if location_list:
        # locations is stored as a JSON string '["A","B"]'. Each canonical name
        # is unambiguous (no embedded quotes), so a LIKE on the quoted name is a
        # safe portable contains-check. ANY-match across the requested set.
        loc_clauses = []
        for i, name in enumerate(location_list):
            key = f"loc_match_{i}"
            loc_clauses.append(f"p.locations LIKE :{key}")
            params[key] = f'%"{name}"%'
        where_parts.append("(" + " OR ".join(loc_clauses) + ")")
    if seller_id:
        where_parts.append("p.submitted_by = :seller_id")
        params["seller_id"] = seller_id
    if featured_only:
        where_parts.append("p.is_featured = TRUE")

    where_sql = " AND ".join(where_parts)

    # Sort order
    if sort == "relevance" and has_fts:
        order_sql = "rank DESC, p.view_count DESC"
    elif sort in _SORT_MAP and _SORT_MAP[sort]:
        order_sql = f"p.{_SORT_MAP[sort]}"
    else:
        order_sql = "p.is_featured DESC, p.submitted_at DESC"

    count_sql = f"""
        SELECT COUNT(*)
        FROM prices p
        JOIN users u ON u.id = p.submitted_by
        WHERE {where_sql}
    """

    data_sql = f"""
        SELECT
            p.id, p.uuid, p.name, p.description, p.price,
            p.condition, p.category_id, p.subcategory, p.location,
            p.listing_status, p.view_count, p.quantity,
            p.is_negotiable, p.photos, p.submitted_at,
            p.submitted_by, p.is_featured,
            c.name AS category_name,
            pr.display_name  AS seller_display_name,
            pr.avatar_url    AS seller_avatar_url,
            pr.slug          AS seller_slug,
            pr.karma_tier    AS seller_karma_tier,
            u.uuid           AS seller_uuid,
            u.username       AS seller_username,
            EXISTS(
                SELECT 1 FROM seller_verifications sv
                WHERE sv.user_id = p.submitted_by
                  AND sv.status = 'Approved'
            ) AS is_verified,
            fs.id            AS flash_id,
            fs.original_price AS flash_original_price,
            fs.sale_price     AS flash_sale_price,
            fs.discount_pct   AS flash_discount_pct,
            fs.end_time       AS flash_end_time,
            ({rank_expr}) AS rank
        FROM prices p
        JOIN users u       ON u.id = p.submitted_by
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN profiles pr  ON pr.user_id = p.submitted_by
        LEFT JOIN flash_sales fs
            ON fs.price_id = p.id
            AND fs.is_active = TRUE
            AND fs.end_time > NOW()
        WHERE {where_sql}
        ORDER BY {order_sql}
        OFFSET :skip
        LIMIT  :limit
    """

    try:
        total = db.execute(text(count_sql), params).scalar() or 0
        rows = db.execute(text(data_sql), params).fetchall()
        items = [_row_to_dict_pg(r) for r in rows]
        return {
            "items":    items,
            "total":    int(total),
            "skip":     skip,
            "limit":    limit,
            "has_more": (skip + limit) < int(total),
            "query":    query or None,
            "engine":   "postgresql_fts",
        }
    except Exception as e:
        logger.error("PostgreSQL FTS error: %s", e, exc_info=True)
        return _search_fallback(
            db, query, category_id, condition,
            min_price, max_price, location, location_list,
            sort, skip, limit, seller_id, featured_only,
        )


def _row_to_dict_pg(r: Any) -> dict[str, Any]:
    photos = _parse_photos(r.photos)
    on_sale = r.flash_id is not None
    return {
        "uuid":           str(r.uuid) if r.uuid else str(r.id),
        "id":             r.id,
        "title":          r.name,
        "description":    (r.description or "")[:200],
        "price":          float(r.price or 0),
        "sale_price":     float(r.flash_sale_price) if on_sale and r.flash_sale_price else None,
        "original_price": float(r.flash_original_price) if on_sale and r.flash_original_price else None,
        "on_sale":        on_sale,
        "discount_pct":   float(r.flash_discount_pct) if on_sale and r.flash_discount_pct else None,
        "flash_sale_ends_at": r.flash_end_time.isoformat() if on_sale and r.flash_end_time else None,
        "condition":      r.condition,
        "category":       r.category_name,
        "category_id":    r.category_id,
        "subcategory":    r.subcategory,
        "location":       r.location,
        "status":         r.listing_status,
        "views_count":    r.view_count or 0,
        "quantity":       r.quantity or 0,
        "is_negotiable":  bool(r.is_negotiable),
        "is_featured":    bool(r.is_featured),
        "photos":         photos,
        "cover_photo":    photos[0] if photos else None,
        "created_at":     r.submitted_at.isoformat() if r.submitted_at else None,
        "relevance_score": float(r.rank or 0),
        "seller_id":      r.submitted_by,
        "seller": {
            "uuid":         str(r.seller_uuid) if r.seller_uuid else None,
            "username":     r.seller_username,
            "display_name": r.seller_display_name,
            "avatar_url":   r.seller_avatar_url,
            "slug":         r.seller_slug,
            "is_verified":  bool(r.is_verified),
            "karma_tier":   r.seller_karma_tier or "Bronze",
        } if r.submitted_by else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SQLITE — prices_fts FTS5 + BM25 ranking
# ─────────────────────────────────────────────────────────────────────────────
def _search_sqlite(
    db: Session,
    query: str,
    category_id: int | None,
    condition: str | None,
    min_price: float | None,
    max_price: float | None,
    location: str | None,
    location_list: list[str],
    sort: str,
    skip: int,
    limit: int,
    seller_id: int | None,
    featured_only: bool,
) -> dict[str, Any]:
    params: dict[str, Any] = {"skip": skip, "limit": limit}

    where_parts: list[str] = [
        "p.listing_status = 'active'",
        "p.status = 'approved'",
        "(u.is_deleted = 0 OR u.is_deleted IS NULL)",
        "(u.is_banned = 0 OR u.is_banned IS NULL)",
        "(u.is_suspended = 0 OR u.is_suspended IS NULL)",
    ]

    has_fts = len(query) >= 2
    join_fts = ""
    order_sql = "p.is_featured DESC, p.submitted_at DESC"

    if has_fts:
        # FTS5 query syntax: quoted phrase for multi-word, prefix for single.
        if " " in query:
            params["fts_query"] = f'"{query}"'
        else:
            params["fts_query"] = f"{query}*"
        # FTS5 MATCH requires the real table name, not an alias.
        join_fts = "JOIN prices_fts ON prices_fts.rowid = p.id"
        where_parts.append("prices_fts MATCH :fts_query")
        # BM25 column weights match the FTS5 col order:
        # name(10), description(1), brand(5), subcategory(5),
        # condition(3), retailer(0.5), location(0.5)
        if sort == "relevance":
            order_sql = "bm25(prices_fts, 10.0, 1.0, 5.0, 5.0, 3.0, 0.5, 0.5)"

    if category_id is not None:
        where_parts.append("p.category_id = :category_id")
        params["category_id"] = category_id
    if condition:
        where_parts.append("p.condition = :condition")
        params["condition"] = condition
    if min_price is not None:
        where_parts.append("p.price >= :min_price")
        params["min_price"] = min_price
    if max_price is not None:
        where_parts.append("p.price <= :max_price")
        params["max_price"] = max_price
    if location:
        where_parts.append("p.location LIKE :location")
        params["location"] = f"%{location}%"
    if location_list:
        loc_clauses = []
        for i, name in enumerate(location_list):
            key = f"loc_match_{i}"
            loc_clauses.append(f"p.locations LIKE :{key}")
            params[key] = f'%"{name}"%'
        where_parts.append("(" + " OR ".join(loc_clauses) + ")")
    if seller_id:
        where_parts.append("p.submitted_by = :seller_id")
        params["seller_id"] = seller_id
    if featured_only:
        where_parts.append("p.is_featured = 1")

    if sort != "relevance" and _SORT_MAP.get(sort):
        order_sql = f"p.{_SORT_MAP[sort]}"

    where_sql = " AND ".join(where_parts)

    count_sql = f"""
        SELECT COUNT(*)
        FROM prices p
        JOIN users u ON u.id = p.submitted_by
        {join_fts}
        WHERE {where_sql}
    """

    rank_select = "bm25(prices_fts, 10.0, 1.0, 5.0, 5.0, 3.0, 0.5, 0.5) AS rank" if has_fts else "0.0 AS rank"

    data_sql = f"""
        SELECT
            p.id, p.uuid, p.name, p.description, p.price,
            p.condition, p.category_id, p.subcategory, p.location,
            p.listing_status, p.view_count, p.quantity,
            p.is_negotiable, p.photos, p.submitted_at,
            p.submitted_by, p.is_featured,
            c.name           AS category_name,
            pr.display_name  AS seller_display_name,
            pr.avatar_url    AS seller_avatar_url,
            pr.slug          AS seller_slug,
            pr.karma_tier    AS seller_karma_tier,
            u.uuid           AS seller_uuid,
            u.username       AS seller_username,
            CASE WHEN EXISTS(
                SELECT 1 FROM seller_verifications sv
                WHERE sv.user_id = p.submitted_by
                  AND sv.status = 'Approved'
            ) THEN 1 ELSE 0 END AS is_verified,
            fs.id             AS flash_id,
            fs.original_price AS flash_original_price,
            fs.sale_price     AS flash_sale_price,
            fs.discount_pct   AS flash_discount_pct,
            fs.end_time       AS flash_end_time,
            {rank_select}
        FROM prices p
        JOIN users u           ON u.id = p.submitted_by
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN profiles pr  ON pr.user_id = p.submitted_by
        LEFT JOIN flash_sales fs
            ON fs.price_id = p.id
            AND fs.is_active = 1
            AND fs.end_time > datetime('now')
        {join_fts}
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT :limit OFFSET :skip
    """

    try:
        total = db.execute(text(count_sql), params).scalar() or 0
        rows = db.execute(text(data_sql), params).fetchall()
        items = [_row_to_dict_sqlite(r) for r in rows]
        return {
            "items":    items,
            "total":    int(total),
            "skip":     skip,
            "limit":    limit,
            "has_more": (skip + limit) < int(total),
            "query":    query or None,
            "engine":   "sqlite_fts5",
        }
    except Exception as e:
        logger.error("SQLite FTS5 error: %s", e, exc_info=True)
        return _search_fallback(
            db, query, category_id, condition,
            min_price, max_price, location, location_list,
            sort, skip, limit, seller_id, featured_only,
        )


def _row_to_dict_sqlite(r: Any) -> dict[str, Any]:
    photos = _parse_photos(r.photos)
    on_sale = r.flash_id is not None
    # SQLite returns BM25 as a negative number — lower is better.
    # Flip the sign so frontend can sort "higher = better" consistently.
    rank_val = float(r.rank or 0)
    relevance = -rank_val if rank_val != 0 else 0.0
    return {
        "uuid":           str(r.uuid) if r.uuid else str(r.id),
        "id":             r.id,
        "title":          r.name,
        "description":    (r.description or "")[:200],
        "price":          float(r.price or 0),
        "sale_price":     float(r.flash_sale_price) if on_sale and r.flash_sale_price else None,
        "original_price": float(r.flash_original_price) if on_sale and r.flash_original_price else None,
        "on_sale":        on_sale,
        "discount_pct":   float(r.flash_discount_pct) if on_sale and r.flash_discount_pct else None,
        "flash_sale_ends_at": str(r.flash_end_time) if on_sale and r.flash_end_time else None,
        "condition":      r.condition,
        "category":       r.category_name,
        "category_id":    r.category_id,
        "subcategory":    r.subcategory,
        "location":       r.location,
        "status":         r.listing_status,
        "views_count":    r.view_count or 0,
        "quantity":       r.quantity or 0,
        "is_negotiable":  bool(r.is_negotiable),
        "is_featured":    bool(r.is_featured),
        "photos":         photos,
        "cover_photo":    photos[0] if photos else None,
        "created_at":     str(r.submitted_at) if r.submitted_at else None,
        "relevance_score": relevance,
        "seller_id":      r.submitted_by,
        "seller": {
            "uuid":         str(r.seller_uuid) if r.seller_uuid else None,
            "username":     r.seller_username,
            "display_name": r.seller_display_name,
            "avatar_url":   r.seller_avatar_url,
            "slug":         r.seller_slug,
            "is_verified":  bool(r.is_verified),
            "karma_tier":   r.seller_karma_tier or "Bronze",
        } if r.submitted_by else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FALLBACK — plain LIKE (used only if FTS path raises)
# ─────────────────────────────────────────────────────────────────────────────
def _search_fallback(
    db: Session,
    query: str,
    category_id: int | None,
    condition: str | None,
    min_price: float | None,
    max_price: float | None,
    location: str | None,
    location_list: list[str],
    sort: str,
    skip: int,
    limit: int,
    seller_id: int | None,
    featured_only: bool,
) -> dict[str, Any]:
    from sqlalchemy import or_ as sa_or

    q = db.query(Price).filter(
        Price.listing_status == "active",
        Price.status == "approved",
    )
    if query:
        like = f"%{query}%"
        q = q.filter(sa_or(
            Price.name.ilike(like),
            Price.description.ilike(like),
        ))
    if category_id is not None:
        q = q.filter(Price.category_id == category_id)
    if condition:
        q = q.filter(Price.condition == condition)
    if min_price is not None:
        q = q.filter(Price.price >= min_price)
    if max_price is not None:
        q = q.filter(Price.price <= max_price)
    if location:
        q = q.filter(Price.location.ilike(f"%{location}%"))
    if location_list:
        q = q.filter(sa_or(*[
            Price.locations.ilike(f'%"{name}"%') for name in location_list
        ]))
    if seller_id:
        q = q.filter(Price.submitted_by == seller_id)
    if featured_only:
        q = q.filter(Price.is_featured == True)  # noqa: E712

    total = q.count()
    if sort == "price_asc":
        q = q.order_by(Price.price.asc())
    elif sort == "price_desc":
        q = q.order_by(Price.price.desc())
    elif sort in ("trending", "most_viewed"):
        q = q.order_by(Price.view_count.desc())
    elif sort == "oldest":
        q = q.order_by(Price.submitted_at.asc())
    else:
        q = q.order_by(Price.is_featured.desc(), Price.submitted_at.desc())

    rows = q.offset(skip).limit(limit).all()
    items = [_orm_to_dict(p) for p in rows]
    return {
        "items":    items,
        "total":    int(total),
        "skip":     skip,
        "limit":    limit,
        "has_more": (skip + limit) < int(total),
        "query":    query or None,
        "engine":   "fallback_like",
    }


def _orm_to_dict(p: Price) -> dict[str, Any]:
    photos = _parse_photos(p.photos)
    try:
        import json as _json
        loc_list = _json.loads(p.locations) if p.locations else []
        if not isinstance(loc_list, list):
            loc_list = []
    except Exception:
        loc_list = []
    return {
        "uuid":           str(p.uuid) if p.uuid else str(p.id),
        "id":             p.id,
        "title":          p.name,
        "description":    (p.description or "")[:200],
        "price":          float(p.price or 0),
        "sale_price":     None,
        "original_price": None,
        "on_sale":        False,
        "discount_pct":   None,
        "flash_sale_ends_at": None,
        "condition":      p.condition,
        "category":       p.category.name if p.category else None,
        "category_id":    p.category_id,
        "subcategory":    p.subcategory,
        "location":       p.location,  # deprecated
        "locations":      loc_list,
        "status":         p.listing_status,
        "views_count":    p.view_count or 0,
        "quantity":       p.quantity or 0,
        "is_negotiable":  bool(p.is_negotiable),
        "is_featured":    bool(p.is_featured),
        "photos":         photos,
        "cover_photo":    photos[0] if photos else None,
        "created_at":     p.submitted_at.isoformat() if p.submitted_at else None,
        "relevance_score": 0.0,
        "seller_id":      p.submitted_by,
        "seller":         None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# AUTOCOMPLETE
# ─────────────────────────────────────────────────────────────────────────────
def get_search_suggestions(
    db: Session,
    query: str,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """
    Fast title-only autocomplete.
    PG: trigram similarity + prefix + tsquery prefix.
    SQLite: LIKE prefix ordered by view_count.
    """
    q = _clean_query(query or "")
    if len(q) < 2:
        return []

    if IS_POSTGRES:
        try:
            rows = db.execute(text("""
                SELECT DISTINCT
                    p.uuid, p.name, p.price, p.view_count,
                    c.name AS category_name,
                    similarity(p.name, :q) AS sim
                FROM prices p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE
                    p.listing_status = 'active'
                    AND p.status = 'approved'
                    AND (
                        p.name ILIKE :prefix
                        OR similarity(p.name, :q) > 0.2
                    )
                ORDER BY sim DESC, p.view_count DESC NULLS LAST
                LIMIT :limit
            """), {
                "q":      q,
                "prefix": f"{q}%",
                "limit":  limit,
            }).fetchall()
        except Exception as e:
            logger.warning("PG suggest fallback: %s", e)
            return _suggest_fallback(db, q, limit)
    else:
        try:
            rows = db.execute(text("""
                SELECT DISTINCT
                    p.uuid, p.name, p.price, p.view_count,
                    c.name AS category_name
                FROM prices p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE
                    p.listing_status = 'active'
                    AND p.status = 'approved'
                    AND p.name LIKE :prefix
                ORDER BY p.view_count DESC
                LIMIT :limit
            """), {"prefix": f"{q}%", "limit": limit}).fetchall()
        except Exception as e:
            logger.warning("SQLite suggest fallback: %s", e)
            return _suggest_fallback(db, q, limit)

    return [
        {
            "uuid":     str(r.uuid) if r.uuid else None,
            "title":    r.name,
            "category": r.category_name,
            "price":    float(r.price or 0),
        }
        for r in rows
    ]


def _suggest_fallback(db: Session, q: str, limit: int) -> list[dict[str, Any]]:
    rows = (
        db.query(Price.uuid, Price.name, Price.price)
        .filter(
            Price.listing_status == "active",
            Price.status == "approved",
            Price.name.ilike(f"{q}%"),
        )
        .order_by(Price.view_count.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "uuid":     str(r[0]) if r[0] else None,
            "title":    r[1],
            "category": None,
            "price":    float(r[2] or 0),
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# RELATED LISTINGS
# ─────────────────────────────────────────────────────────────────────────────
def get_related_listings(
    db: Session,
    listing_id: int,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """
    Find listings similar to the given one.
      PG: tsvector ranked against the source's name+category as a tsquery.
      SQLite: same category, ordered by views.
    """
    source = (
        db.query(Price.id, Price.name, Price.category_id, Price.subcategory)
        .filter(Price.id == listing_id)
        .first()
    )
    if not source:
        return []

    if IS_POSTGRES:
        cat_name = (
            db.query(Category.name)
            .filter(Category.id == source.category_id)
            .scalar()
            or ""
        )
        terms = _clean_query(f"{source.name} {cat_name} {source.subcategory or ''}")
        if not terms:
            terms = source.name or ""
        try:
            rows = db.execute(text("""
                SELECT
                    p.id, p.uuid, p.name, p.price, p.photos,
                    p.category_id, p.condition, p.location, p.view_count,
                    c.name AS category_name,
                    ts_rank_cd(
                        p.search_vector,
                        plainto_tsquery('english', :terms)
                    ) AS rank
                FROM prices p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.listing_status = 'active'
                  AND p.status = 'approved'
                  AND p.id != :lid
                  AND p.search_vector @@ plainto_tsquery('english', :terms)
                ORDER BY rank DESC, p.view_count DESC
                LIMIT :limit
            """), {"terms": terms, "lid": listing_id, "limit": limit}).fetchall()
        except Exception as e:
            logger.warning("PG related fallback: %s", e)
            rows = []
    else:
        rows = db.execute(text("""
            SELECT
                p.id, p.uuid, p.name, p.price, p.photos,
                p.category_id, p.condition, p.location, p.view_count,
                c.name AS category_name
            FROM prices p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.listing_status = 'active'
              AND p.status = 'approved'
              AND p.id != :lid
              AND p.category_id = :cat
            ORDER BY p.view_count DESC, p.submitted_at DESC
            LIMIT :limit
        """), {
            "lid": listing_id,
            "cat": source.category_id,
            "limit": limit,
        }).fetchall()

    results = []
    for r in rows:
        photos = _parse_photos(r.photos)
        results.append({
            "uuid":         str(r.uuid) if r.uuid else str(r.id),
            "id":           r.id,
            "title":        r.name,
            "price":        float(r.price or 0),
            "category":     r.category_name,
            "category_id":  r.category_id,
            "condition":    r.condition,
            "location":     r.location,
            "cover_photo":  photos[0] if photos else None,
            "views_count":  r.view_count or 0,
        })
    return results
