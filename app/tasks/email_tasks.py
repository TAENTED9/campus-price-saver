"""
Celery email tasks — replaces every asyncio.create_task / BackgroundTasks
email send in the codebase. Each task survives worker restarts and retries
on failure.

The underlying app/services/email.py `_send(to, subject, html)` takes a
single HTML payload, so `send_email` accepts (body, html) and prefers html
when supplied (falling back to a minimal wrapper around the plain body).
"""

from app.celery_app import celery
from app.services.email import _send
import asyncio
import logging

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _plain_to_html(body: str) -> str:
    """Wrap a plain-text body in a minimal HTML envelope when no html supplied."""
    safe = (
        body.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br>")
    )
    return f"<div style='font-family:sans-serif;line-height:1.5'>{safe}</div>"


# ── Generic email task ────────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="emails",
)
def send_email(
    self,
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
):
    try:
        payload = html if html else _plain_to_html(body)
        _run_async(_send(to, subject, payload))
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as exc:
        logger.error(f"Email failed to {to}: {exc}")
        raise self.retry(exc=exc)


# ── Verification email ────────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_verification_email",
    queue="emails",
)
def send_verification_email(to: str, name: str, link: str):
    from app.services.email_templates import EMAIL_VERIFY_TEMPLATE
    send_email.delay(
        to=to,
        subject="Verify your Campify email",
        body=EMAIL_VERIFY_TEMPLATE(name, link),
    )


# ── Welcome email ─────────────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_welcome_email",
    queue="emails",
)
def send_welcome_email(to: str, name: str):
    from app.services.email_templates import WELCOME_EMAIL
    send_email.delay(
        to=to,
        subject="Welcome to Campify",
        body=WELCOME_EMAIL(name),
    )


# ── OTP email (uses branded HTML template) ────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_otp_email_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="emails",
)
def send_otp_email_task(self, to: str, name: str, otp: str):
    from app.services.email import send_otp_email
    try:
        _run_async(send_otp_email(to, name, otp))
        logger.info(f"OTP email sent to {to}")
    except Exception as exc:
        logger.error(f"OTP email failed to {to}: {exc}")
        raise self.retry(exc=exc)


# ── Seller approved / rejected ────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_approval_email",
    queue="emails",
)
def send_approval_email(to: str, name: str):
    from app.services.email import send_seller_approved_email
    _run_async(send_seller_approved_email(to, name))


@celery.task(
    name="app.tasks.email_tasks.send_rejection_email",
    queue="emails",
)
def send_rejection_email(to: str, name: str, reason: str):
    from app.services.email import send_seller_rejected_email
    _run_async(send_seller_rejected_email(to, name, reason))


# ── Login alert ───────────────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_login_alert_email",
    queue="emails",
)
def send_login_alert_email(
    to: str,
    name: str,
    device: str,
    ip: str,
    when: str,
):
    try:
        from app.services.email_templates import NEW_LOGIN_EMAIL
        body = NEW_LOGIN_EMAIL(name, device, ip, when)
    except Exception:
        body = (
            f"Hi {name},\n\nA new sign-in to your Campify account "
            f"was detected from {device} ({ip}) at {when}.\n"
            "If this wasn't you, please change your password."
        )
    send_email.delay(
        to=to,
        subject="New login to your Campify account",
        body=body,
    )


# ── Pause / delete account lifecycle ──────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_pause_email",
    queue="emails",
)
def send_pause_email(to: str, name: str, reason: str = ""):
    from app.services.email_templates import ACCOUNT_PAUSED_EMAIL
    send_email.delay(
        to=to,
        subject="Your Campify account has been paused",
        body=ACCOUNT_PAUSED_EMAIL(name, reason),
    )


@celery.task(
    name="app.tasks.email_tasks.send_delete_email",
    queue="emails",
)
def send_delete_email(to: str, name: str):
    from app.services.email_templates import ACCOUNT_DELETED_EMAIL
    send_email.delay(
        to=to,
        subject="Your Campify account has been deleted",
        body=ACCOUNT_DELETED_EMAIL(name),
    )


@celery.task(
    name="app.tasks.email_tasks.send_reactivated_email",
    queue="emails",
)
def send_reactivated_email(to: str, name: str):
    from app.services.email_templates import ACCOUNT_REACTIVATED_EMAIL
    send_email.delay(
        to=to,
        subject="Your Campify account has been reactivated",
        body=ACCOUNT_REACTIVATED_EMAIL(name),
    )


# ── Buyer ↔ seller interest notification (branded HTML) ───────────────────
@celery.task(
    name="app.tasks.email_tasks.send_interest_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="emails",
)
def send_interest_email(
    self,
    to: str,
    seller_name: str,
    buyer_username: str,
    buyer_display_name: str,
    listing_title: str,
    listing_price: str | float,
    auto_message: str = "",
):
    from app.services.email import send_interest_notification_email
    # Coerce price to float (display function expects numeric for formatting)
    try:
        price_val = float(listing_price)
    except Exception:
        price_val = 0.0
    try:
        _run_async(send_interest_notification_email(
            seller_email=to,
            seller_name=seller_name,
            buyer_name=buyer_display_name or buyer_username,
            listing_name=listing_title,
            listing_price=price_val,
        ))
        logger.info(f"Interest email sent to {to}")
    except Exception as exc:
        logger.error(f"Interest email failed to {to}: {exc}")
        raise self.retry(exc=exc)


# ── Price drop / restock / new listing alerts ─────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_price_drop_email",
    queue="emails",
)
def send_price_drop_email(
    to: str,
    buyer_name: str,
    listing_name: str,
    old_price: float,
    new_price: float,
    listing_id: int,
):
    from app.services.email import send_price_drop_alert
    _run_async(send_price_drop_alert(
        to, buyer_name, listing_name, old_price, new_price, listing_id
    ))


@celery.task(
    name="app.tasks.email_tasks.send_restock_email",
    queue="emails",
)
def send_restock_email(
    to: str, buyer_name: str, listing_name: str,
    price: float, listing_id: int,
):
    from app.services.email import send_restock_alert
    _run_async(send_restock_alert(
        to, buyer_name, listing_name, price, listing_id
    ))


@celery.task(
    name="app.tasks.email_tasks.send_new_listing_email",
    queue="emails",
)
def send_new_listing_email(
    to: str, buyer_name: str, seller_name: str,
    listing_name: str, price: float, listing_id: int,
):
    from app.services.email import send_new_listing_alert
    _run_async(send_new_listing_alert(
        to, buyer_name, seller_name, listing_name, price, listing_id
    ))


# ── Admin notifications ───────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_admin_verification_email",
    queue="emails",
)
def send_admin_verification_email(
    seller_name: str, matric_no: str, business_name: str,
):
    from app.services.email import send_admin_new_verification_email
    _run_async(send_admin_new_verification_email(
        seller_name, matric_no, business_name
    ))


@celery.task(
    name="app.tasks.email_tasks.send_seller_submission_email",
    queue="emails",
)
def send_seller_submission_email(to: str, name: str):
    from app.services.email import send_seller_submission_email as _send_sub
    _run_async(_send_sub(to, name))
