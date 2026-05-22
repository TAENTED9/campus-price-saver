"""
Admin + user notification pipeline.

Block 4 migration:
  - Every email is dispatched via Celery (see app.tasks.email_tasks.send_email).
  - Admin event audit rows are still written synchronously to the request
    DB session (cheap, transactional, and the request already has the row).
  - The OLD `send_user_email_bg` helper is kept as a thin async wrapper that
    enqueues the Celery task, so existing callers keep working without
    edits. New code can call `app.tasks.email_tasks.send_email.delay(...)`
    directly.

Why Celery rather than asyncio.create_task / asyncio.to_thread:
  - Survives worker restarts (Vercel/Render SIGTERM, container redeploys).
  - Built-in retries with backoff on Resend outages.
  - Replaces a real bug: the prior implementation called the async
    `_send(...)` coroutine inside `asyncio.to_thread`, which produced an
    unawaited coroutine and silently dropped many emails.
"""

import json
import os
from datetime import datetime

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
APP_URL = os.getenv("APP_URL", "https://campify.ng")


async def notify_admin(
    db,
    event_type: str,
    user_id: int | None,
    user_email: str,
    user_role: str,
    payload: dict,
    requires_action: bool = False,
):
    """
    1. Write AdminEvent record to DB (always, on the request session).
    2. Enqueue an admin-notification email via Celery (non-blocking).
    Returns the saved AdminEvent.
    """
    from app.models import AdminEvent

    event = AdminEvent(
        event_type=event_type,
        user_id=user_id,
        user_email=user_email,
        user_role=user_role,
        payload=json.dumps(payload),
        requires_action=requires_action,
        is_read=False,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    if ADMIN_EMAIL:
        subject = _subject(event_type, user_email)
        body = _body(event_type, user_email, user_role, payload)
        try:
            from app.tasks.email_tasks import send_email
            send_email.delay(to=ADMIN_EMAIL, subject=subject, body=body)
        except Exception as e:
            # Celery broker unavailable — log but never break the request
            import logging as _lg
            _lg.getLogger("campify").error(
                f"[admin_notifications] enqueue admin email failed: {type(e).__name__}"
            )

    return event


async def send_user_email_bg(to: str, subject: str, body: str):
    """
    Legacy compatibility wrapper. New code should call
    `app.tasks.email_tasks.send_email.delay(...)` directly.

    Async signature is preserved so callers using `await
    send_user_email_bg(...)` keep working without edits — but the function
    no longer blocks on I/O. The Celery enqueue is in-process and ~ms.
    """
    if not to:
        return
    try:
        from app.tasks.email_tasks import send_email
        send_email.delay(to=to, subject=subject, body=body)
    except Exception as e:
        # Broker down — log, don't crash the caller.
        import logging as _lg
        from app.services.email import _mask_email as _m
        _lg.getLogger("campify").error(
            f"[admin_notifications] enqueue user email failed to={_m(to)} err={type(e).__name__}"
        )


# ── Internal helpers ────────────────────────────────────────────────────


def _subject(event_type: str, email: str) -> str:
    subjects = {
        "new_user":                    f"[Campify] New user registered: {email}",
        "new_seller_application":      f"[Campify] New seller application: {email}",
        "verification_docs_uploaded":  f"[Campify] Docs need review: {email}",
        "new_listing":                 f"[Campify] New listing posted: {email}",
        "account_pause_request":       f"[Campify] Account pause requested: {email}",
        "account_delete_request":      f"[Campify] Delete request: {email}",
        "account_paused":              f"[Campify] Account paused: {email}",
        "account_deleted":             f"[Campify] Account deleted: {email}",
        "account_reactivated":         f"[Campify] Account reactivated: {email}",
        "reactivation_requested":      f"[Campify] Reactivation requested: {email}",
        "verification_approved":       f"[Campify] Verification approved: {email}",
        "verification_rejected":       f"[Campify] Verification rejected: {email}",
    }
    return subjects.get(event_type, f"[Campify] Event: {event_type}")


def _body(event_type: str, email: str, role: str, payload: dict) -> str:
    lines = [
        f"Event: {event_type}",
        f"User: {email} ({role})",
        f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        "",
    ]
    for k, v in payload.items():
        lines.append(f"{k}: {v}")
    if "id_card_url" in payload:
        lines.append(f"\nView ID Card: {payload['id_card_url']}")
    if "portal_url" in payload:
        lines.append(f"View Portal Screenshot: {payload['portal_url']}")
    lines.append(f"\n---\nLog in to review: {APP_URL}/admin")
    return "\n".join(lines)
