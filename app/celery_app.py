from celery import Celery
from celery.schedules import crontab
import os

BROKER_URL = os.getenv(
    "CELERY_BROKER_URL", "redis://localhost:6379/1"
)
RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/2"
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
    ],
)

celery.conf.update(
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
    },
)
