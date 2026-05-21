"""
Celery beat-scheduled tasks. Replaces APScheduler.

Schema notes for Campify (vs the spec's idealised names):
  - The "listing" table is `Price` (FK seller column is `submitted_by`).
  - Vacation / auto-renew / default-duration settings live on `UserSettings`,
    not on `Profile`.
  - `FlashSale` uses `end_time` (not `ends_at`).
  - `Price.paused_by_vacation` (added in alembic 006) lets us un-pause only
    the listings vacation auto-paused, leaving manually-paused listings alone.
"""

from app.celery_app import celery
from app.database import SessionLocal
from app.models import (
    User, Price as Listing, UserSettings, FlashSale, Inquiry,
)
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)


# ── FIX #4: Vacation auto-resume ────────────────────────────────────────
@celery.task(
    name="app.tasks.scheduled_tasks.check_vacation_resume",
    queue="default",
)
def check_vacation_resume():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()

        # Sellers with vacation mode on (settings table is source of truth)
        rows = (
            db.query(User, UserSettings)
            .join(UserSettings, UserSettings.user_id == User.id)
            .filter(
                User.role == "seller",
                UserSettings.vacation_mode.is_(True),
                UserSettings.vacation_resume_date.isnot(None),
            )
            .all()
        )

        for seller, settings in rows:
            resume_date = settings.vacation_resume_date
            if not resume_date:
                continue
            # vacation_resume_date is stored as ISO string
            if resume_date <= now_str:
                settings.vacation_mode = False
                settings.vacation_resume_date = None
                # Restore ONLY listings auto-paused by vacation,
                # leaving listings the seller manually paused alone.
                db.query(Listing).filter(
                    Listing.submitted_by == seller.id,
                    Listing.listing_status == "paused",
                    Listing.paused_by_vacation.is_(True),
                ).update({
                    "listing_status": "active",
                    "paused_by_vacation": False,
                })
                db.commit()
                logger.info(
                    f"Vacation auto-resumed for seller {seller.id}"
                )

    except Exception as e:
        logger.error(f"vacation_resume error: {e}")
        db.rollback()
    finally:
        db.close()


# ── FIX #4: Auto-renew listings ─────────────────────────────────────────
@celery.task(
    name="app.tasks.scheduled_tasks.auto_renew_listings",
    queue="default",
)
def auto_renew_listings():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=3)

        # Sellers whose UserSettings has auto_renew_listings on
        auto_renew_seller_ids = {
            row[0] for row in
            db.query(UserSettings.user_id)
            .filter(UserSettings.auto_renew_listings.is_(True))
            .all()
        }

        if not auto_renew_seller_ids:
            return

        expiring = (
            db.query(Listing)
            .filter(
                Listing.listing_status == "active",
                Listing.submitted_by.in_(auto_renew_seller_ids),
                Listing.expires_at.isnot(None),
            )
            .all()
        )

        renewed = 0
        for listing in expiring:
            exp = listing.expires_at
            if exp is None:
                continue
            if hasattr(exp, "tzinfo") and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp <= cutoff:
                seller_settings = (
                    db.query(UserSettings)
                    .filter(UserSettings.user_id == listing.submitted_by)
                    .first()
                )
                duration = (
                    seller_settings.default_listing_duration
                    if seller_settings else 14
                ) or 14
                listing.expires_at = exp + timedelta(days=duration)
                renewed += 1

        if renewed:
            db.commit()
            logger.info(f"Auto-renewed {renewed} listing(s)")
    except Exception as e:
        logger.error(f"auto_renew_listings error: {e}")
        db.rollback()
    finally:
        db.close()


# ── Expire flash sales ──────────────────────────────────────────────────
@celery.task(
    name="app.tasks.scheduled_tasks.expire_flash_sales",
    queue="default",
)
def expire_flash_sales():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired = (
            db.query(FlashSale)
            .filter(
                FlashSale.is_active.is_(True),
                FlashSale.end_time <= now,
            )
            .all()
        )
        for fs in expired:
            fs.is_active = False
        if expired:
            db.commit()
            logger.info(f"Expired {len(expired)} flash sales")
    except Exception as e:
        logger.error(f"expire_flash_sales error: {e}")
        db.rollback()
    finally:
        db.close()


# ── Weekly seller digest ────────────────────────────────────────────────
@celery.task(
    name="app.tasks.scheduled_tasks.send_weekly_digests",
    queue="default",
)
def send_weekly_digests():
    db = SessionLocal()
    try:
        sellers = (
            db.query(User)
            .filter(
                User.role == "seller",
                User.is_deleted.isnot(True),
                User.email_verified.is_(True),
            )
            .all()
        )

        week_ago = datetime.now(timezone.utc) - timedelta(days=7)

        for seller in sellers:
            if not seller.email:
                continue

            # Respect notif prefs from UserSettings (typed column)
            settings = (
                db.query(UserSettings)
                .filter(UserSettings.user_id == seller.id)
                .first()
            )
            if settings is not None and settings.notif_email_weekly_digest is False:
                continue

            views = (
                db.query(func.sum(Listing.view_count))
                .filter(Listing.submitted_by == seller.id)
                .scalar() or 0
            )

            inquiries = (
                db.query(func.count(Inquiry.id))
                .filter(
                    Inquiry.seller_id == seller.id,
                    Inquiry.created_at >= week_ago,
                )
                .scalar() or 0
            )

            display = (
                (seller.profile.display_name if seller.profile else None)
                or seller.display_name
                or seller.username
                or "Seller"
            )

            # Use branded HTML weekly template directly via the email service
            from app.services.email import send_weekly_report
            from app.tasks.email_tasks import _run_async
            try:
                _run_async(send_weekly_report(
                    seller.email,
                    display,
                    {"views": int(views), "inquiries": int(inquiries)},
                ))
            except Exception as e:
                logger.error(
                    f"weekly_digest send failed for {seller.email}: {e}"
                )

    except Exception as e:
        logger.error(f"weekly_digests error: {e}")
    finally:
        db.close()
