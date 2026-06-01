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
# No production URL as default — empty string forces the deployer to set APP_URL
# explicitly and prevents stale domains from leaking into emails on misconfig.
APP_URL = os.getenv("APP_URL", "").rstrip("/")


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
        text_body, html_body = _body(event_type, user_email, user_role, payload)
        try:
            from app.tasks.email_tasks import send_email
            # Pass both the plain-text fallback (body) and branded HTML (html) so
            # the admin inbox renders the same branded shell as user-facing mail
            # instead of a naked text dump.
            send_email.delay(to=ADMIN_EMAIL, subject=subject, body=text_body, html=html_body)
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
        from app.tasks.email_tasks import send_email, _looks_like_html
        # Templates now return branded HTML. Pass it as `html=` explicitly (not
        # just `body=`) so delivery is correct even if the Celery worker is
        # running older code without HTML auto-detection.
        if _looks_like_html(body):
            send_email.delay(to=to, subject=subject, body=body, html=body)
        else:
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


# Friendly headings per event so the branded email reads like a real
# notification, not a raw event dump.
_HEADINGS = {
    "new_user":                   "New user registered",
    "new_seller_application":      "New seller application",
    "verification_docs_uploaded":  "Seller verification — docs need review",
    "new_listing":                 "New listing posted",
    "account_pause_request":       "Account pause requested",
    "account_delete_request":      "Account deletion requested",
    "account_paused":              "Account paused",
    "account_deleted":             "Account deleted",
    "account_reactivated":         "Account reactivated",
    "reactivation_requested":      "Reactivation requested",
    "verification_approved":       "Verification approved",
    "verification_rejected":       "Verification rejected",
}

# Payload keys that are document/image links → rendered as buttons, not rows.
_DOC_KEYS = ("id_card_url", "portal_url")
_DOC_LABELS = {"id_card_url": "View ID Card", "portal_url": "View Portal Screenshot"}


def _detail_row(label: str, value: str) -> str:
    return (
        '<tr>'
        f'<td style="padding:6px 0;color:#94a3b8;font-size:13px;width:140px;'
        f'vertical-align:top;">{label}</td>'
        f'<td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">{value}</td>'
        '</tr>'
    )


def _body(event_type: str, email: str, role: str, payload: dict):
    """
    Returns (text_body, html_body).
    text_body is a plain-text fallback; html_body is the branded Campify shell.
    """
    when = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    # Route to the page that actually exists. Seller verification review lives on
    # the consolidated /admin/seller page (Pending/Approved/Rejected tabs);
    # everything else lands on the dashboard. The old /admin/verification path
    # 404s on the frontend.
    if event_type in ("verification_docs_uploaded", "new_seller_application"):
        review_path = "/admin/seller"
    else:
        review_path = "/admin"
    review_url = f"{APP_URL}{review_path}" if APP_URL else review_path

    # ── Plain-text fallback ──────────────────────────────────────────────
    lines = [
        f"Event: {event_type}",
        f"User: {email} ({role})",
        f"Time: {when}",
        "",
    ]
    for k, v in payload.items():
        lines.append(f"{k}: {v}")
    for dk in _DOC_KEYS:
        if payload.get(dk):
            lines.append(f"\n{_DOC_LABELS[dk]}: {payload[dk]}")
    lines.append(f"\n---\nLog in to review: {review_url}")
    text_body = "\n".join(lines)

    # ── Branded HTML ─────────────────────────────────────────────────────
    from app.services.email_templates import branded_email

    rows = [
        _detail_row("User", f"{email}"),
        _detail_row("Role", role),
        _detail_row("Time", when),
    ]
    for k, v in payload.items():
        if k in _DOC_KEYS:
            continue
        label = k.replace("_", " ").title()
        rows.append(_detail_row(label, str(v)))

    doc_links = []
    for dk in _DOC_KEYS:
        if payload.get(dk):
            doc_links.append(
                f'<a href="{payload[dk]}" '
                'style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;'
                'background:#eff6ff;color:#2563eb;border-radius:8px;'
                'font-size:13px;font-weight:600;text-decoration:none;">'
                f'{_DOC_LABELS[dk]} &rarr;</a>'
            )
    docs_html = (
        f'<div style="margin-top:18px;">{"".join(doc_links)}</div>' if doc_links else ""
    )

    body_html = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="border-collapse:collapse;">'
        + "".join(rows)
        + "</table>"
        + docs_html
    )

    heading = _HEADINGS.get(event_type, f"Admin event: {event_type}")
    cta_label = (
        "Review Verification"
        if review_path == "/admin/seller"
        else "Open Admin Dashboard"
    )
    html_body = branded_email(
        heading=heading,
        greeting="Hi Admin,",
        body_html=body_html,
        cta_label=cta_label,
        cta_href=review_url,
        footer_note="You're receiving this because you're the Campify admin contact.",
    )
    return text_body, html_body
