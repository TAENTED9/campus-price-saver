"""
Celery email tasks — replaces every asyncio.create_task / BackgroundTasks
email send in the codebase. Each task survives worker restarts and retries
on failure.

The underlying app/services/email.py `_send(to, subject, html)` takes a
single HTML payload, so `send_email` accepts (body, html) and prefers html
when supplied (falling back to a minimal wrapper around the plain body).
"""

from app.celery_app import celery
from app.services.email import _send, _mask_email
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


def _looks_like_html(body: str) -> bool:
    """True if the body is already a full HTML document/fragment, so we send it
    as-is instead of escaping it. Lets template functions return branded HTML
    via the normal `body=` path without every caller passing `html=`."""
    s = (body or "").lstrip().lower()
    return s.startswith(("<!doctype", "<html", "<div", "<table", "<body"))


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
        payload = html if html else (body if _looks_like_html(body) else _plain_to_html(body))
        ok = _run_async(_send(to, subject, payload))
        if not ok:
            # _send returns False on HTTP errors (e.g. Resend 403) instead of
            # raising. Without converting that into an exception the task
            # silently "succeeds" and the operator never finds out their
            # sends are being rejected. Raise so Celery retries and the
            # error surfaces in the worker logs.
            raise RuntimeError(
                f"send failed (see [email] log line just above for Resend status/body) to={_mask_email(to)}"
            )
        logger.info(f"Email sent to={_mask_email(to)} subject='{subject}'")
    except Exception as exc:
        logger.error(f"Email failed to={_mask_email(to)} err={type(exc).__name__}: {exc}")
        raise self.retry(exc=exc)


# ── Verification email ────────────────────────────────────────────────────
@celery.task(
    name="app.tasks.email_tasks.send_verification_email",
    queue="emails",
)
def send_verification_email(to: str, name: str, link: str):
    from app.services.email_templates import EMAIL_VERIFY_TEMPLATE, EMAIL_VERIFY_HTML
    send_email.delay(
        to=to,
        subject="Verify your Campify email",
        body=EMAIL_VERIFY_TEMPLATE(name, link),      # plain-text fallback
        html=EMAIL_VERIFY_HTML(name, link),          # branded HTML
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
        logger.info(f"OTP email sent to={_mask_email(to)}")
    except Exception as exc:
        logger.error(f"OTP email failed to={_mask_email(to)} err={type(exc).__name__}")
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
    html = None
    try:
        from app.services.email_templates import NEW_LOGIN_EMAIL, NEW_LOGIN_HTML
        body = NEW_LOGIN_EMAIL(name, device, ip, when)
        html = NEW_LOGIN_HTML(name, device, ip, when)
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
        html=html,
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
        logger.info(f"Interest email sent to={_mask_email(to)}")
    except Exception as exc:
        logger.error(f"Interest email failed to={_mask_email(to)} err={type(exc).__name__}")
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


# ── Block 6B — flash sale platform-wide email blast ───────────────────────
# Three tasks coordinate the blast so we never fire 1000 individual emails
# at the same instant:
#   1. dispatch_flash_sale_blast(sale_id) — runs once. Queries opted-in
#      recipients, breaks them into batches of 50, and enqueues one
#      send_flash_sale_batch per group with a staggered countdown.
#   2. send_flash_sale_batch(sale_id, recipients) — runs per batch.
#      Enqueues one send_flash_sale_single per recipient (single-task-per-email
#      pattern matches every other email type in this file).
#   3. send_flash_sale_single(...) — the actual send. Retries 3× on failure.

FLASH_SALE_BATCH_SIZE = 50
# Seconds between batches. Resend's default rate limit is 100/sec; 2s per
# 50-email batch leaves headroom for retries and other concurrent traffic.
FLASH_SALE_BATCH_DELAY_SEC = 2


@celery.task(
    name="app.tasks.email_tasks.send_flash_sale_single",
    bind=True,
    max_retries=3,
    default_retry_delay=120,
    queue="emails",
)
def send_flash_sale_single(
    self,
    to: str,
    recipient_name: str,
    listing_name: str,
    listing_uuid: str | None,
    listing_id: int,
    original_price: float,
    sale_price: float,
    discount_pct: float,
    cover_media_url: str | None,
    end_time_iso: str,
):
    from app.services.email import send_flash_sale_alert
    try:
        _run_async(send_flash_sale_alert(
            to=to,
            recipient_name=recipient_name,
            listing_name=listing_name,
            listing_uuid=listing_uuid,
            listing_id=listing_id,
            original_price=original_price,
            sale_price=sale_price,
            discount_pct=discount_pct,
            cover_media_url=cover_media_url,
            end_time_iso=end_time_iso,
        ))
        logger.info(f"Flash sale email sent to={_mask_email(to)} listing_id={listing_id}")
    except Exception as exc:
        logger.error(f"Flash sale email failed to={_mask_email(to)} err={type(exc).__name__}")
        raise self.retry(exc=exc)


@celery.task(
    name="app.tasks.email_tasks.send_flash_sale_batch",
    queue="emails",
)
def send_flash_sale_batch(
    sale_payload: dict,
    recipients: list[dict],
):
    """Fan out one batch of recipients as individual email tasks.

    `sale_payload` carries the flash-sale fields (listing meta, prices,
    cover_media_url, end_time_iso). `recipients` is the slice of opted-in
    users for this batch — each dict has at minimum `email` and `name`.
    """
    for rec in recipients:
        email = (rec.get("email") or "").strip()
        if not email:
            continue
        send_flash_sale_single.delay(
            to=email,
            recipient_name=rec.get("name") or "there",
            listing_name=sale_payload["listing_name"],
            listing_uuid=sale_payload.get("listing_uuid"),
            listing_id=sale_payload["listing_id"],
            original_price=sale_payload["original_price"],
            sale_price=sale_payload["sale_price"],
            discount_pct=sale_payload["discount_pct"],
            cover_media_url=sale_payload.get("cover_media_url"),
            end_time_iso=sale_payload["end_time_iso"],
        )


@celery.task(
    name="app.tasks.email_tasks.dispatch_flash_sale_blast",
    queue="emails",
)
def dispatch_flash_sale_blast(sale_id: int):
    """Entry point. Pulls the sale + listing, collects opted-in recipients,
    and enqueues batched sends.

    A user is opted in when they're active, verified, non-deleted, non-banned,
    AND have either `notif_email_price_drop` OR `notif_email_new_listing`
    enabled in their UserSettings row.
    """
    from app.database import SessionLocal
    from app.models import FlashSale, Price, User, UserSettings
    from app.routers.flash_sales import _cloudinary_video_thumb
    import json as _json

    db = SessionLocal()
    try:
        sale = db.query(FlashSale).filter(FlashSale.id == sale_id).first()
        if not sale or not sale.is_active:
            logger.info(f"[flash_sale_blast] sale_id={sale_id} not active — skipping")
            return
        listing = db.query(Price).filter(Price.id == sale.price_id).first()
        if not listing:
            logger.info(f"[flash_sale_blast] listing not found for sale_id={sale_id}")
            return

        # Resolve cover_media — first photo, else Cloudinary thumb of first video.
        photos: list[str] = []
        videos: list[str] = []
        try:
            if listing.photos:
                parsed = _json.loads(listing.photos)
                if isinstance(parsed, list):
                    photos = [p for p in parsed if isinstance(p, str)]
        except Exception:
            pass
        try:
            if listing.videos:
                parsed = _json.loads(listing.videos)
                if isinstance(parsed, list):
                    videos = [v for v in parsed if isinstance(v, str)]
        except Exception:
            pass
        cover_media_url: str | None = photos[0] if photos else None
        if cover_media_url is None and videos:
            cover_media_url = _cloudinary_video_thumb(videos[0])

        sale_payload = {
            "listing_id": listing.id,
            "listing_uuid": str(listing.uuid) if listing.uuid else None,
            "listing_name": listing.name,
            "original_price": float(sale.original_price),
            "sale_price": float(sale.sale_price),
            "discount_pct": float(sale.discount_pct),
            "cover_media_url": cover_media_url,
            "end_time_iso": sale.end_time.isoformat() if sale.end_time else "",
        }

        # Collect opted-in recipients. We pull every viable User joined to
        # their settings row in one query so the worker holds a flat list of
        # plain dicts (no ORM objects across task boundaries — Celery args
        # must be JSON-serialisable).
        rows = (
            db.query(User, UserSettings)
            .outerjoin(UserSettings, UserSettings.user_id == User.id)
            .filter(
                User.email.isnot(None),
                User.email != "",
                User.is_deleted.is_(False) | (User.is_deleted.is_(None)),
                User.is_banned.is_(False) | (User.is_banned.is_(None)),
                User.is_suspended.is_(False) | (User.is_suspended.is_(None)),
                # email_verified defaults True for legacy rows; require explicit
                # opt-in via verification only if the column exists & is False.
            )
            .all()
        )

        recipients: list[dict] = []
        for user, settings in rows:
            # Skip the seller who created the sale — slightly odd to email
            # someone about their own discount.
            if user.id == sale.seller_id:
                continue
            # If no settings row exists yet, fall back to the defaults defined
            # on the model: notif_email_price_drop=True, notif_email_new_listing=False.
            # That's an opt-in for price drops by default, which qualifies.
            if settings is None:
                opted_in = True  # default for price-drop is True
            else:
                opted_in = bool(
                    getattr(settings, "notif_email_price_drop", False)
                    or getattr(settings, "notif_email_new_listing", False)
                )
            if not opted_in:
                continue
            # Email verification gate — only send to users who proved their address.
            email_verified = getattr(user, "email_verified", True)
            if email_verified is False:
                continue

            recipients.append({
                "email": user.email,
                "name": (user.display_name or user.username or "there"),
            })

        if not recipients:
            logger.info(f"[flash_sale_blast] sale_id={sale_id} — no opted-in recipients")
            return

        # Batch + stagger. Each batch task fires its 50 sends as soon as it
        # runs; the stagger sits between batches, so the first 50 emails go
        # out immediately and subsequent groups arrive at +2s, +4s, … and so on.
        total = len(recipients)
        batches = 0
        for i in range(0, total, FLASH_SALE_BATCH_SIZE):
            batch = recipients[i:i + FLASH_SALE_BATCH_SIZE]
            countdown = (i // FLASH_SALE_BATCH_SIZE) * FLASH_SALE_BATCH_DELAY_SEC
            send_flash_sale_batch.apply_async(
                args=[sale_payload, batch],
                countdown=countdown,
            )
            batches += 1

        logger.info(
            f"[flash_sale_blast] sale_id={sale_id} dispatched batches={batches} "
            f"recipients={total} listing='{listing.name}'"
        )
    finally:
        db.close()


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
