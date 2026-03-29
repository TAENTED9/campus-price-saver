"""
Block 2B — Admin notification pipeline.
Every platform event writes to admin_events table AND fires an email to ADMIN_EMAIL.
Uses asyncio.to_thread() so the sync email sender doesn't block the event loop.
"""

import asyncio
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
    1. Write AdminEvent record to DB (always).
    2. Fire email to ADMIN_EMAIL in background (non-blocking).
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
        body    = _body(event_type, user_email, user_role, payload)
        asyncio.create_task(_send_admin_email_bg(subject, body))

    return event


async def send_user_email_bg(to: str, subject: str, body: str):
    """
    Fire-and-forget wrapper that sends a plain-text email to a user.
    Runs the sync email sender in a thread so it doesn't block.
    """
    await asyncio.to_thread(_send_plain, to, subject, body)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _send_admin_email_bg(subject: str, body: str):
    await asyncio.to_thread(_send_plain, ADMIN_EMAIL, subject, body)


def _send_plain(to: str, subject: str, body: str) -> None:
    """Reuses the existing sync email._send() infrastructure."""
    try:
        from app.services.email import _send
        _send(to, subject, f"<pre style='font-family:sans-serif'>{body}</pre>")
    except Exception as e:
        print(f"[admin_notifications] Email failed to {to}: {e}")


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
