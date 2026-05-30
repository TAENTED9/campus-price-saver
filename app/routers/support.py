"""
Public support / contact endpoint.

Anyone (logged in or anonymous) can POST a support message. Rate-limited to
3 per hour per IP. Sends two emails via Celery:
  1. Notification to the support / admin inbox.
  2. Auto-reply confirmation to the sender.
"""
from datetime import datetime
import html as _html

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator

from app.database import get_db
from app.limiter import limiter

router = APIRouter()


ISSUE_CATEGORIES = [
    "account_issue",
    "payment_issue",
    "seller_verification",
    "listing_issue",
    "order_dispute",
    "bug_report",
    "feature_request",
    "other",
]

CATEGORY_LABELS = {
    "account_issue":       "Account Issue",
    "payment_issue":       "Payment Issue",
    "seller_verification": "Seller Verification",
    "listing_issue":       "Listing Issue",
    "order_dispute":       "Order Dispute",
    "bug_report":          "Bug Report",
    "feature_request":     "Feature Request",
    "other":               "Other",
}


class SupportMessageRequest(BaseModel):
    name:     str
    email:    EmailStr
    category: str
    subject:  str
    message:  str
    page_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name too short")
        if len(v) > 100:
            raise ValueError("Name too long")
        return v

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Subject too short")
        if len(v) > 200:
            raise ValueError("Subject too long")
        return v

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 20:
            raise ValueError("Message too short (min 20 characters)")
        if len(v) > 3000:
            raise ValueError("Message too long (max 3000 characters)")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in ISSUE_CATEGORIES:
            raise ValueError("Invalid category")
        return v

    @field_validator("page_url")
    @classmethod
    def validate_page_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > 500:
            return v[:500]
        return v


def _esc(value: str) -> str:
    """HTML-escape user input before injecting into email templates."""
    return _html.escape(value, quote=True)


@router.post("/contact")
@limiter.limit("3/hour")
async def send_support_message(
    request: Request,
    body:    SupportMessageRequest,
    db:      Session = Depends(get_db),
):
    """
    Anyone (logged in or not) can send a support message.
    Rate limited to 3 per hour per IP.
    Sends email to admin AND auto-reply to sender.
    """
    from app.config import settings
    from app.tasks.email_tasks import send_email

    category_label = CATEGORY_LABELS.get(body.category, body.category)
    timestamp = datetime.utcnow().strftime("%d %b %Y at %H:%M UTC")

    safe_name     = _esc(body.name)
    safe_email    = _esc(body.email)
    safe_subject  = _esc(body.subject)
    safe_message  = _esc(body.message)
    safe_page_url = _esc(body.page_url) if body.page_url else ""
    support_addr  = settings.SUPPORT_EMAIL or settings.ADMIN_EMAIL or ""
    safe_support  = _esc(support_addr) if support_addr else ""

    # Public site URL (e.g. https://campify.digital) — drives every link/domain
    # mention in the email body so a domain change only needs an env update.
    app_url      = (settings.FRONTEND_URL or settings.APP_URL or "").rstrip("/")
    app_domain   = app_url.replace("https://", "").replace("http://", "")
    safe_app_url = _esc(app_url)    if app_url    else ""
    safe_domain  = _esc(app_domain) if app_domain else ""

    # ── Page row (only rendered when supplied) ────────────────────────
    page_row_html = ""
    if body.page_url:
        page_row_html = f"""
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
              <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
                Page
              </span>
            </td>
            <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
              <a href="{safe_page_url}" style="color: #2563eb; font-size: 13px;">
                {safe_page_url}
              </a>
            </td>
          </tr>
        """

    # ── Email to admin ────────────────────────────────────────────────
    admin_html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">

      <div style="background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 16px; padding: 20px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 900;">
          New Support Message
        </h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">
          {timestamp}
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; width: 120px;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
              From
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #111827;">{safe_name}</span>
            <span style="color: #6b7280; margin-left: 8px;">&lt;{safe_email}&gt;</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Category
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="background: #eff6ff; color: #2563eb; padding: 3px 10px; border-radius: 999px; font-size: 13px; font-weight: 600;">
              {category_label}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Subject
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-weight: 600;">
            {safe_subject}
          </td>
        </tr>
        {page_row_html}
      </table>

      <div style="background: #f9fafb; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 10px;">
          Message
        </p>
        <p style="margin: 0; color: #374151; line-height: 1.7; font-size: 15px; white-space: pre-wrap;">
          {safe_message}
        </p>
      </div>

      <a href="mailto:{safe_email}?subject=Re: {safe_subject}"
         style="display: block; background: linear-gradient(135deg, #2563eb, #06b6d4); color: white; text-align: center; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none;">
        Reply to {safe_name} →
      </a>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
        Campify Support{f" · {safe_domain}" if safe_domain else ""}
      </p>
    </div>
    """

    if support_addr:
        send_email.delay(
            to=support_addr,
            subject=f"[Support] [{category_label}] {body.subject}",
            body=(
                f"From: {body.name} <{body.email}>\n"
                f"Category: {category_label}\n"
                f"Subject: {body.subject}\n"
                + (f"Page: {body.page_url}\n" if body.page_url else "")
                + f"\n{body.message}"
            ),
            html=admin_html,
        )

    # ── Auto-reply to sender ──────────────────────────────────────────
    reply_html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">

      <div style="background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 16px; padding: 20px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 900;">
          We received your message
        </h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">
          We'll get back to you within 24 hours
        </p>
      </div>

      <p style="color: #374151; font-size: 15px;">Hi {safe_name},</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.7;">
        Thanks for reaching out to Campify support. We've received your message and will respond to <strong>{safe_email}</strong> within 24 hours.
      </p>

      <div style="background: #f9fafb; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
          Your message
        </p>
        <p style="margin: 0; font-weight: 600; color: #111827;">{safe_subject}</p>
        <p style="margin: 6px 0 0; color: #6b7280; font-size: 13px;">Category: {category_label}</p>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        While you wait, you can browse our
        <a href="{safe_app_url or '#'}" style="color: #2563eb;">marketplace</a>
        or check your
        <a href="{safe_app_url}/dashboard" style="color: #2563eb;">dashboard</a>.
      </p>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
        © Campify{f" · {safe_domain}" if safe_domain else ""}
        {f' · <a href="mailto:{safe_support}" style="color: #9ca3af;">{safe_support}</a>' if safe_support else ''}
      </p>
    </div>
    """

    send_email.delay(
        to=body.email,
        subject="We received your message — Campify Support",
        body=(
            f"Hi {body.name},\n\n"
            f"We received your message about: {body.subject}\n\n"
            f"We'll respond within 24 hours to {body.email}.\n\n"
            f"— Campify Support"
        ),
        html=reply_html,
    )

    return {
        "message": "Message sent successfully. We'll respond within 24 hours.",
        "email":   body.email,
    }
