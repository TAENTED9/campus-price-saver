"""
Admin-only search analytics endpoints.

All endpoints require admin role (via get_current_admin) and are rate
limited. Read-only — there's no write endpoint here; events are written
exclusively from the search service via BackgroundTasks.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.database import get_db
from app.limiter import limiter
from app.models import User
from app.routers.auth import get_current_admin
from app.services.search_analytics import (
    query_drilldown,
    search_summary,
    top_searches,
    trending_queries,
    zero_result_queries,
)

router = APIRouter(
    prefix="/admin/search-analytics",
    tags=["Admin · Search Analytics"],
)


@router.get("/summary")
@limiter.limit("60/minute")
async def get_search_summary(
    request: Request,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Headline metrics: total searches, CTR, zero-rate, unique users/queries."""
    return search_summary(db, days)


@router.get("/top")
@limiter.limit("60/minute")
async def get_top_searches(
    request: Request,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Most-searched queries in the window, with avg result count."""
    return top_searches(db, days=days, limit=limit)


@router.get("/zero-results")
@limiter.limit("60/minute")
async def get_zero_results(
    request: Request,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
    min_count: int = Query(1, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Queries that returned no results. Gold for inventory decisions —
    these are buyers who searched and walked away. `min_count` filters
    out one-off typos.
    """
    return zero_result_queries(db, days=days, limit=limit, min_count=min_count)


@router.get("/trending")
@limiter.limit("60/minute")
async def get_trending(
    request: Request,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(20, ge=1, le=100),
    min_current: int = Query(3, ge=1, le=50),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Queries with the biggest period-over-period volume increase
    (current `days` window vs the equal-length window before).
    """
    return trending_queries(db, days=days, limit=limit, min_current=min_current)


@router.get("/query")
@limiter.limit("60/minute")
async def get_query_drilldown(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200, description="Exact query text to drill into"),
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Drill into one specific query: searches, clicks, CTR, top clicked listings."""
    return query_drilldown(db, query=q, days=days)
