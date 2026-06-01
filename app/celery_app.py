import logging
import os

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_init

logger = logging.getLogger("campify.celery")

BROKER_URL = os.getenv(
    "CELERY_BROKER_URL", "redis://localhost:6379/1"
)
RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/2"
)

# Is a real Celery worker deployed to consume the queue?
#
# With Redis running but NO worker, `.delay()` would happily push jobs into
# the broker where nothing ever pulls them out — they sit there forever and
# the email/notification silently never sends. To avoid that trap when running
# worker-less (e.g. Render free tier), set CELERY_WORKER_ENABLED=false: Celery
# flips into eager mode and runs every task INLINE & synchronously in the web
# process — it never touches the broker, so nothing can be orphaned.
#
# Redis is untouched either way; this only governs task *dispatch*. Caching,
# rate-limit storage, etc. keep using Redis as normal.
#
# Upgrade path (no code change): deploy a worker, then set
# CELERY_WORKER_ENABLED=true — `.delay()` goes back to queuing into Redis and
# the worker consumes it.
_WORKER_ENABLED = os.getenv("CELERY_WORKER_ENABLED", "true").lower() in (
    "1", "true", "yes", "on",
)

celery = Celery(
    "campify",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.notification_tasks",
        "app.tasks.media_tasks",
        "app.tasks.scheduled_tasks",
        "app.tasks.analytics_tasks",
    ],
)

celery.conf.update(
    # No worker deployed → run tasks inline instead of queuing into a broker
    # that nothing reads. eager_propagates stays False so a failed email task
    # never bubbles up and breaks the HTTP request — callers already wrap
    # .delay() in try/except.
    task_always_eager=not _WORKER_ENABLED,
    task_eager_propagates=False,

    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="Africa/Lagos",
    enable_utc=True,

    # Queues — route tasks to specific workers
    task_routes={
        "app.tasks.email_tasks.*":        {"queue": "emails"},
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.tasks.media_tasks.*":        {"queue": "media"},
        "app.tasks.scheduled_tasks.*":    {"queue": "default"},
        "app.tasks.analytics_tasks.*":    {"queue": "default"},
    },

    # Retry policy
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,

    # Result expiry
    result_expires=3600,

    # Beat schedule (replaces APScheduler)
    beat_schedule={
        # Weekly seller digest — Monday 8am WAT
        "weekly-seller-digest": {
            "task": "app.tasks.scheduled_tasks.send_weekly_digests",
            "schedule": crontab(
                hour=8, minute=0, day_of_week="monday"
            ),
        },
        # Check vacation auto-resume — every hour
        "vacation-auto-resume": {
            "task": "app.tasks.scheduled_tasks.check_vacation_resume",
            "schedule": crontab(minute=0),
        },
        # Auto-renew expiring listings — daily at 2am
        "auto-renew-listings": {
            "task": "app.tasks.scheduled_tasks.auto_renew_listings",
            "schedule": crontab(hour=2, minute=0),
        },
        # Expire flash sales — every 5 minutes
        "expire-flash-sales": {
            "task": "app.tasks.scheduled_tasks.expire_flash_sales",
            "schedule": crontab(minute="*/5"),
        },
        # Purge search analytics older than 90 days — Sunday 3am WAT
        # (off-peak, lets us measure full-week trends before trimming).
        "purge-search-events": {
            "task": "app.tasks.analytics_tasks.purge_search_events",
            "schedule": crontab(hour=3, minute=0, day_of_week="sunday"),
        },
    },
)


@worker_init.connect
def _run_migrations_on_worker_boot(**_):
    """
    Run the full migration pass before this worker accepts any task.

    Celery beat fires due tasks the moment its scheduler comes up — which
    on a cold ``docker compose up`` happens *before* the FastAPI lifespan
    has finished migrating the schema. That race is what surfaces as
    ``OperationalError: no such column: prices.<x>``. Running the same
    idempotent pass here guarantees the worker observes a fully-migrated
    schema regardless of which process won the boot race.
    """
    try:
        from app.migrations.runner import run_all_migrations
        run_all_migrations()
    except Exception as exc:  # noqa: BLE001 — never block worker startup
        logger.exception("Celery worker startup migrations failed: %s", exc)
