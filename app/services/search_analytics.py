"""
Search analytics — logging + aggregation queries.

Two public concerns:

  1. Fire-and-forget event logging from request handlers via FastAPI
     BackgroundTasks. `log_search_event` and `log_click_event` open their
     own SQLAlchemy session and swallow every exception, so analytics
     never affects user-facing latency or correctness.

  2. Aggregation queries for the admin dashboard: top searches,
     zero-result queries, trending (period-over-period growth), and a
     headline summary (totals, CTR, zero-rate).

All queries are bounded by a `days` window and target the composite
indexes declared on SearchEvent — top searches over 30 days on 10M rows
runs in tens of milliseconds.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import SearchEvent

logger = logging.getLogger(__name__)

# Hard cap on query length stored. Anything longer gets truncated — keeps
# the index small and avoids pathological GROUP BY keys.
_MAX_QUERY_LEN = 200
# Below this length we skip logging entirely (matches the suggest cutoff).
_MIN_QUERY_LEN = 2


# ─────────────────────────────────────────────────────────────────────────────
# IP hashing — anonymous distinct-user counts without storing raw IPs
# ─────────────────────────────────────────────────────────────────────────────

def hash_ip(ip: str | None) -> str | None:
    """sha256(ip)[:32] — sufficient for distinct counts; not reversible."""
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:32]


def _normalise_query(q: str | None) -> str:
    return (q or "").strip().lower()[:_MAX_QUERY_LEN]


# ─────────────────────────────────────────────────────────────────────────────
# Fire-and-forget logging — opens its own session, swallows errors
# ─────────────────────────────────────────────────────────────────────────────

def log_search_event(
    query: str | None,
    result_count: int,
    engine: str | None,
    user_id: int | None,
    ip_hash_value: str | None,
) -> None:
    """
    Persist a search event. Called from a BackgroundTask AFTER the response
    has been sent, so failure here is invisible to the user.
    """
    q = _normalise_query(query)
    if len(q) < _MIN_QUERY_LEN:
        return
    db = SessionLocal()
    try:
        db.add(SearchEvent(
            event_type="search",
            query=q,
            result_count=result_count,
            engine=engine,
            user_id=user_id,
            ip_hash=ip_hash_value,
        ))
        db.commit()
    except Exception as e:
        logger.warning("search-analytics: log_search failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def log_click_event(
    query: str | None,
    clicked_uuid: str | None,
    clicked_position: int | None,
    user_id: int | None,
    ip_hash_value: str | None,
) -> None:
    """Persist a click event tied to a prior search."""
    q = _normalise_query(query)
    if not q:
        return
    db = SessionLocal()
    try:
        db.add(SearchEvent(
            event_type="click",
            query=q,
            clicked_uuid=clicked_uuid,
            clicked_position=clicked_position,
            user_id=user_id,
            ip_hash=ip_hash_value,
        ))
        db.commit()
    except Exception as e:
        logger.warning("search-analytics: log_click failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Aggregations — drive the admin dashboard
# ─────────────────────────────────────────────────────────────────────────────

def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def top_searches(db: Session, days: int = 7, limit: int = 20) -> list[dict[str, Any]]:
    """Most-issued queries in the window. avg_results helps spot weak ones."""
    rows = (
        db.query(
            SearchEvent.query.label("q"),
            func.count(SearchEvent.id).label("count"),
            func.avg(SearchEvent.result_count).label("avg_results"),
            func.max(SearchEvent.created_at).label("last_seen"),
        )
        .filter(
            SearchEvent.event_type == "search",
            SearchEvent.created_at >= _since(days),
        )
        .group_by(SearchEvent.query)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )
    return [
        {
            "query":       r.q,
            "searches":    int(r.count or 0),
            "avg_results": round(float(r.avg_results or 0), 1),
            "last_seen":   r.last_seen.isoformat() if r.last_seen else None,
        }
        for r in rows
    ]


def zero_result_queries(
    db: Session, days: int = 7, limit: int = 20, min_count: int = 1,
) -> list[dict[str, Any]]:
    """
    Queries that returned no results. These are gold for inventory decisions —
    every entry is a buyer who searched and walked away. `min_count` filters
    out one-off typos when desired.
    """
    rows = (
        db.query(
            SearchEvent.query.label("q"),
            func.count(SearchEvent.id).label("count"),
            func.max(SearchEvent.created_at).label("last_seen"),
        )
        .filter(
            SearchEvent.event_type == "search",
            SearchEvent.created_at >= _since(days),
            SearchEvent.result_count == 0,
        )
        .group_by(SearchEvent.query)
        .having(func.count(SearchEvent.id) >= min_count)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )
    return [
        {
            "query":     r.q,
            "searches":  int(r.count or 0),
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
        }
        for r in rows
    ]


def trending_queries(
    db: Session, days: int = 7, limit: int = 20, min_current: int = 3,
) -> list[dict[str, Any]]:
    """
    Period-over-period growth: counts in (now - days, now) vs the equal-length
    window immediately before. Filters out queries with fewer than min_current
    hits in the current window so single-shot typos don't dominate.
    """
    now = datetime.utcnow()
    cur_since = now - timedelta(days=days)
    prev_since = now - timedelta(days=days * 2)

    current_rows = (
        db.query(SearchEvent.query, func.count(SearchEvent.id))
        .filter(
            SearchEvent.event_type == "search",
            SearchEvent.created_at >= cur_since,
        )
        .group_by(SearchEvent.query)
        .all()
    )
    current_map = {q: int(c) for q, c in current_rows}

    previous_rows = (
        db.query(SearchEvent.query, func.count(SearchEvent.id))
        .filter(
            SearchEvent.event_type == "search",
            SearchEvent.created_at >= prev_since,
            SearchEvent.created_at < cur_since,
        )
        .group_by(SearchEvent.query)
        .all()
    )
    previous_map = {q: int(c) for q, c in previous_rows}

    results: list[dict[str, Any]] = []
    for q, cur in current_map.items():
        if cur < min_current:
            continue
        prev = previous_map.get(q, 0)
        # Growth ratio; prev=0 → growth = cur (any movement is "new")
        growth = (cur - prev) / max(prev, 1)
        results.append({
            "query":    q,
            "current":  cur,
            "previous": prev,
            "growth":   round(growth, 2),
            "delta":    cur - prev,
        })
    results.sort(key=lambda r: (r["growth"], r["current"]), reverse=True)
    return results[:limit]


def search_summary(db: Session, days: int = 7) -> dict[str, Any]:
    """Headline metrics: totals, CTR, zero-rate, unique users / queries."""
    since = _since(days)

    total_searches = db.query(func.count(SearchEvent.id)).filter(
        SearchEvent.event_type == "search",
        SearchEvent.created_at >= since,
    ).scalar() or 0

    total_clicks = db.query(func.count(SearchEvent.id)).filter(
        SearchEvent.event_type == "click",
        SearchEvent.created_at >= since,
    ).scalar() or 0

    zero_results = db.query(func.count(SearchEvent.id)).filter(
        SearchEvent.event_type == "search",
        SearchEvent.result_count == 0,
        SearchEvent.created_at >= since,
    ).scalar() or 0

    unique_users = db.query(func.count(func.distinct(SearchEvent.user_id))).filter(
        SearchEvent.event_type == "search",
        SearchEvent.user_id.isnot(None),
        SearchEvent.created_at >= since,
    ).scalar() or 0

    unique_queries = db.query(func.count(func.distinct(SearchEvent.query))).filter(
        SearchEvent.event_type == "search",
        SearchEvent.created_at >= since,
    ).scalar() or 0

    ts = int(total_searches)
    return {
        "days":                days,
        "total_searches":      ts,
        "total_clicks":        int(total_clicks),
        "click_through_rate":  round(int(total_clicks) / ts, 4) if ts else 0.0,
        "zero_result_count":   int(zero_results),
        "zero_result_rate":    round(int(zero_results) / ts, 4) if ts else 0.0,
        "unique_users":        int(unique_users),
        "unique_queries":      int(unique_queries),
    }


def query_drilldown(db: Session, query: str, days: int = 30) -> dict[str, Any]:
    """
    Detail view for one specific query: total searches, clicks, CTR,
    average result count, top clicked listings.
    """
    q = _normalise_query(query)
    if len(q) < _MIN_QUERY_LEN:
        return {"query": q, "error": "query too short"}

    since = _since(days)
    base = db.query(SearchEvent).filter(
        SearchEvent.query == q,
        SearchEvent.created_at >= since,
    )

    searches = base.filter(SearchEvent.event_type == "search").count()
    clicks   = base.filter(SearchEvent.event_type == "click").count()
    avg_results = db.query(func.avg(SearchEvent.result_count)).filter(
        SearchEvent.query == q,
        SearchEvent.event_type == "search",
        SearchEvent.created_at >= since,
    ).scalar() or 0

    top_clicked = (
        db.query(
            SearchEvent.clicked_uuid,
            func.count(SearchEvent.id).label("clicks"),
            func.avg(SearchEvent.clicked_position).label("avg_position"),
        )
        .filter(
            SearchEvent.query == q,
            SearchEvent.event_type == "click",
            SearchEvent.created_at >= since,
            SearchEvent.clicked_uuid.isnot(None),
        )
        .group_by(SearchEvent.clicked_uuid)
        .order_by(desc("clicks"))
        .limit(10)
        .all()
    )

    return {
        "query":              q,
        "days":               days,
        "searches":           int(searches),
        "clicks":             int(clicks),
        "click_through_rate": round(int(clicks) / int(searches), 4) if searches else 0.0,
        "avg_results":        round(float(avg_results), 1),
        "top_clicked": [
            {
                "uuid":         r.clicked_uuid,
                "clicks":       int(r.clicks or 0),
                "avg_position": round(float(r.avg_position or 0), 1),
            }
            for r in top_clicked
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Retention — call from a periodic job (Celery beat, cron, etc.)
# ─────────────────────────────────────────────────────────────────────────────

def purge_old_events(db: Session, keep_days: int = 90) -> int:
    """Delete events older than keep_days. Returns the row count deleted."""
    cutoff = datetime.utcnow() - timedelta(days=keep_days)
    deleted = (
        db.query(SearchEvent)
        .filter(SearchEvent.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted)
