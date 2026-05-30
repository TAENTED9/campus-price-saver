"""
Periodic tasks for the search analytics pipeline.

Retention only, for now. The actual events are written from the request
path via FastAPI BackgroundTasks (see `search_analytics.log_search_event`
/ `log_click_event`) — no Celery is involved in the write path because
the work is small and fire-and-forget.

If the events table ever grows large enough that the weekly purge
becomes slow, switch it to a partitioned table (monthly partitions) and
have this task DROP old partitions instead of issuing a DELETE.
"""

from __future__ import annotations

import logging

from app.celery_app import celery
from app.database import SessionLocal
from app.services.search_analytics import purge_old_events

logger = logging.getLogger(__name__)

# Keep ~3 months of analytics. Enough for quarter-over-quarter trends,
# bounded enough that the table stays under a few million rows even at
# 100k searches/day.
DEFAULT_RETENTION_DAYS = 90


@celery.task(
    name="app.tasks.analytics_tasks.purge_search_events",
    queue="default",
)
def purge_search_events(keep_days: int = DEFAULT_RETENTION_DAYS) -> int:
    """Delete search/click events older than `keep_days`. Returns count."""
    db = SessionLocal()
    try:
        deleted = purge_old_events(db, keep_days=keep_days)
        if deleted:
            logger.info(
                "search-analytics: purged %d events older than %d days",
                deleted, keep_days,
            )
        return deleted
    except Exception as e:
        logger.error("search-analytics purge failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
        return 0
    finally:
        db.close()
