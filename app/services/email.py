"""
Email service using Resend (https://resend.com).
All sends are fire-and-forget — failures are logged but never crash the API.
Set RESEND_API_KEY in .env to enable. Without it, emails are skipped silently.
"""

import logging
import os
import httpx as _httpx

logger = logging.getLogger("campify")


def _mask_email(addr: str) -> str:
    """Reduce an email address to 'a***@d***.tld' for safe logging."""
    if not addr or "@" not in addr:
        return "***"
    local, _, domain = addr.partition("@")
    local_m = (local[:1] + "***") if local else "***"
    dom_parts = domain.split(".")
    if not dom_parts or not dom_parts[0]:
        return f"{local_m}@***"
    dom_m = dom_parts[0][:1] + "***"
    if len(dom_parts) > 1:
        dom_m = dom_m + "." + ".".join(dom_parts[1:])
    return f"{local_m}@{dom_m}"

BRAND_NAME = "Campify"
BRAND_TAGLINE = "Campus Marketplace"
BRAND_PRIMARY = "#2563eb"
BRAND_ACCENT = "#06b6d4"


# Read everything env-driven through getters so updates to .env are picked up
# without restarting workers, and so test runs can monkeypatch os.environ.
def _admin_email() -> str:
    return os.getenv("ADMIN_EMAIL", "").strip()


def _app_url() -> str:
    return os.getenv("APP_URL", "http://localhost:3000").strip()


def _brand_support() -> str:
    # No hardcoded fallback — if SUPPORT_EMAIL is unset we omit the address
    # entirely. A wrong default is worse than no default (it leaks the old
    # address into every email when someone forgets to set the var).
    return os.getenv("SUPPORT_EMAIL", "").strip()


# Module-level aliases kept for callers that imported the constants directly.
# They evaluate at import time; for live updates use the getters above.
ADMIN_EMAIL = _admin_email()
APP_URL = _app_url()
BRAND_SUPPORT = _brand_support()

# ─────────────────────────────────────────────────────────────────────────────


def _get_config():
    """Read email config fresh from env each call so dotenv order doesn't matter."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    # No hardcoded default — let Resend reject a missing From rather than
    # silently sending from a stale address baked into the source.
    resend_from = os.getenv("RESEND_FROM", "").strip()
    from_addr = os.getenv("EMAIL_FROM", resend_from).strip()
    return api_key, from_addr


async def _send(to: str, subject: str, html: str) -> bool:
    """Low-level Resend API call. Returns True on success."""
    api_key, from_addr = _get_config()
    masked_to = _mask_email(to)
    if not api_key:
        logger.info(f"[email] No RESEND_API_KEY — skipped subject='{subject}' to={masked_to}")
        return False
    logger.info(f"[email] Sending subject='{subject}' to={masked_to}")
    try:
        async with _httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"from": from_addr, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code in (200, 201):
            # Resend returns {"id": "..."} — log the id only, not full body.
            msg_id = None
            try:
                msg_id = resp.json().get("id")
            except Exception:
                pass
            logger.info(f"[email] Sent OK to={masked_to} resend_id={msg_id}")
            return True
        # Surface Resend's error body — the status code alone is useless
        # because 403 can mean "unverified domain", "invalid API key",
        # "sandbox/test key", or "rate limited", all of which need different
        # operator action. Logging the body once per failure makes the cause
        # obvious without needing to attach a debugger.
        body_excerpt = ""
        try:
            body_excerpt = resp.text[:300].replace("\n", " ")
        except Exception:
            pass
        logger.error(
            f"[email] Resend error status={resp.status_code} from={from_addr!r} "
            f"to={masked_to} body={body_excerpt!r}"
        )
        return False
    except Exception as e:
        logger.error(f"[email] Send failed to={masked_to} err={type(e).__name__}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Branded layout wrapper — shared across every template
# ─────────────────────────────────────────────────────────────────────────────


def _button(label: str, url: str) -> str:
    return (
        f'<a href="{url}" '
        f'style="display:inline-block;background:linear-gradient(135deg,{BRAND_PRIMARY} 0%,{BRAND_ACCENT} 100%);'
        f'color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:99px;'
        f'font-weight:700;font-size:14px;letter-spacing:0.2px;'
        f'box-shadow:0 4px 14px rgba(37,99,235,0.25)">{label}</a>'
    )


def _wrap(
    preheader: str,
    heading: str,
    body_html: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    heading_color: str | None = None,
) -> str:
    """
    Wrap body content in Campify's branded shell.
    - Shows preheader (hidden preview text)
    - Header with gradient brand bar + logo lockup
    - Content area with the heading + body HTML
    - Optional CTA button
    - Footer with support + unsubscribe links
    """
    heading_color = heading_color or BRAND_PRIMARY
    cta_block = (
        f'<tr><td style="padding:8px 32px 24px">{_button(cta_label, cta_url)}</td></tr>'
        if cta_label and cta_url
        else ""
    )
    support_addr = _brand_support()
    app_url = _app_url()
    support_line = (
        f'<p style="margin:0 0 6px;font-size:12px;color:#6b7280">'
        f'Need help? Reach out to '
        f'<a href="mailto:{support_addr}" style="color:{BRAND_PRIMARY};text-decoration:none">{support_addr}</a>.'
        f'</p>'
        if support_addr else ""
    )
    domain_label = app_url.replace('https://', '').replace('http://', '')
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:#111827">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">{preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
          <!-- Brand bar -->
          <tr>
            <td style="background:linear-gradient(135deg,{BRAND_PRIMARY} 0%,{BRAND_ACCENT} 100%);padding:4px 0"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 8px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle">
                    <span style="display:inline-block;background:{BRAND_PRIMARY};color:#ffffff;width:36px;height:36px;border-radius:10px;text-align:center;line-height:36px;font-weight:900;font-size:18px;vertical-align:middle">C</span>
                    <span style="display:inline-block;margin-left:10px;vertical-align:middle">
                      <span style="display:block;font-size:16px;font-weight:800;color:#111827;line-height:1">{BRAND_NAME}</span>
                      <span style="display:block;font-size:10px;font-weight:700;color:{BRAND_PRIMARY};letter-spacing:2px;text-transform:uppercase;margin-top:2px">{BRAND_TAGLINE}</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Heading -->
          <tr>
            <td style="padding:16px 32px 4px">
              <h1 style="margin:0;font-size:22px;font-weight:800;color:{heading_color};line-height:1.3">{heading}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 32px 24px;font-size:15px;line-height:1.6;color:#374151">
              {body_html}
            </td>
          </tr>
          {cta_block}
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background:#f9fafb">
              {support_line}
              <p style="margin:0;font-size:11px;color:#9ca3af">
                &copy; {BRAND_NAME} &middot; Lagos, Nigeria &middot;
                <a href="{app_url}" style="color:#9ca3af;text-decoration:none">{domain_label}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af">You are receiving this because you have an account on {BRAND_NAME}.</p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _p(text: str) -> str:
    return f'<p style="margin:0 0 12px">{text}</p>'


def _info_box(inner_html: str, tone: str = "brand") -> str:
    palettes = {
        "brand":   ("#eff6ff", "#bfdbfe"),
        "success": ("#f0fdf4", "#86efac"),
        "warning": ("#fffbeb", "#fcd34d"),
        "danger":  ("#fef2f2", "#fecaca"),
    }
    bg, border = palettes.get(tone, palettes["brand"])
    return (
        f'<div style="background:{bg};border:1px solid {border};border-radius:12px;'
        f'padding:16px 20px;margin:8px 0 16px">{inner_html}</div>'
    )


# ─────────────────────────────────────────────────────────────────────────────
# Email templates
# ─────────────────────────────────────────────────────────────────────────────


async def send_otp_email(to: str, name: str, otp: str) -> bool:
    body = (
        _p(f"Hi <strong>{name}</strong>,")
        + _p(f"Use the code below to verify your email address for {BRAND_NAME}:")
        + _info_box(
            f'<p style="margin:0;text-align:center;font-size:36px;font-weight:900;letter-spacing:10px;color:{BRAND_PRIMARY}">{otp}</p>'
        )
        + _p('This code expires in <strong>10 minutes</strong>. If you did not create an account, please ignore this email.')
    )
    html = _wrap(
        preheader="Your Campify verification code",
        heading="Verify your email",
        body_html=body,
    )
    return await _send(to, f"Your verification code — {BRAND_NAME}", html)


async def send_seller_submission_email(to: str, seller_name: str) -> bool:
    body = (
        _p(f"Hi <strong>{seller_name}</strong>,")
        + _p(f"We've received your seller verification request on {BRAND_NAME}.")
        + _p("Our team will review your documents and respond within <strong>24 hours</strong>. You'll get an email as soon as a decision is made.")
        + _p("In the meantime, you can browse the marketplace and set up your profile.")
    )
    html = _wrap(
        preheader="We've received your seller verification",
        heading="Verification received",
        body_html=body,
        cta_label="Go to Seller Dashboard",
        cta_url=f"{APP_URL}/seller",
    )
    return await _send(to, f"We've received your seller verification — {BRAND_NAME}", html)


async def send_admin_new_verification_email(seller_name: str, matric_no: str, business_name: str) -> bool:
    if not ADMIN_EMAIL:
        return False
    rows = [
        ("Seller Name", seller_name),
        ("Matric No", matric_no),
        ("Business", business_name),
    ]
    table_rows = "".join(
        f'<tr style="{"background:#f9fafb" if i % 2 else ""}">'
        f'<td style="padding:10px 12px;color:#6b7280;font-size:13px;width:35%">{k}</td>'
        f'<td style="padding:10px 12px;font-weight:600;color:#111827">{v}</td></tr>'
        for i, (k, v) in enumerate(rows)
    )
    body = (
        _p("A new seller has submitted documents for review.")
        + f'<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:8px 0 16px">{table_rows}</table>'
        + _p("Please review and take action.")
    )
    html = _wrap(
        preheader=f"New verification from {seller_name}",
        heading="New seller verification pending",
        body_html=body,
        cta_label="Review in Admin Panel",
        cta_url=f"{APP_URL}/admin/seller",
    )
    return await _send(ADMIN_EMAIL, f"New seller verification: {seller_name} — {BRAND_NAME}", html)


async def send_seller_approved_email(to: str, seller_name: str) -> bool:
    body = (
        _p(f"Hi <strong>{seller_name}</strong>,")
        + _p(f"Congratulations! Your seller account on {BRAND_NAME} has been <strong>approved</strong>.")
        + _info_box(
            '<p style="margin:0 0 4px;font-weight:700;color:#065f46">🎉 You earned 100 karma points!</p>'
            '<p style="margin:0;font-size:13px;color:#047857">Keep them growing with great reviews and confirmed sales.</p>',
            tone="success",
        )
        + _p("You can now create listings, run flash sales, and start selling to thousands of UNILAG students.")
    )
    html = _wrap(
        preheader="You're verified — start selling on Campify",
        heading="You're verified!",
        body_html=body,
        cta_label="Create Your First Listing",
        cta_url=f"{APP_URL}/seller/listings/new",
        heading_color="#16a34a",
    )
    return await _send(to, f"Your seller account is approved! — {BRAND_NAME}", html)


async def send_seller_rejected_email(to: str, seller_name: str, reason: str) -> bool:
    reason_block = _info_box(
        f'<p style="margin:0;font-weight:700;color:#991b1b;font-size:13px;text-transform:uppercase;letter-spacing:1px">Reason</p>'
        f'<p style="margin:6px 0 0;color:#7f1d1d">{reason}</p>',
        tone="danger",
    ) if reason else ""
    body = (
        _p(f"Hi <strong>{seller_name}</strong>,")
        + _p(f"Unfortunately, we were unable to approve your seller verification on {BRAND_NAME}.")
        + reason_block
        + _p("You can update your details and resubmit from your seller dashboard. We're happy to approve you once the issue is addressed.")
    )
    html = _wrap(
        preheader="Action needed on your Campify verification",
        heading="Verification not approved",
        body_html=body,
        cta_label="Resubmit Verification",
        cta_url=f"{APP_URL}/seller/verification",
        heading_color="#dc2626",
    )
    return await _send(to, f"Your seller verification was not approved — {BRAND_NAME}", html)


async def send_price_drop_alert(to: str, buyer_name: str, listing_name: str,
                                old_price: float, new_price: float, listing_id: int) -> bool:
    pct = round((old_price - new_price) / old_price * 100)
    body = (
        _p(f"Hi <strong>{buyer_name}</strong>,")
        + _p("An item on your wishlist just got cheaper:")
        + _info_box(
            f'<p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>'
            f'<p style="margin:10px 0 0">'
            f'<span style="text-decoration:line-through;color:#9ca3af">&#8358;{int(round(old_price)):,}</span>'
            f'&nbsp;&rarr;&nbsp;<span style="font-size:22px;font-weight:900;color:#16a34a">&#8358;{int(round(new_price)):,}</span>'
            f'&nbsp;<span style="background:#dcfce7;color:#16a34a;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px">{pct}% off</span></p>',
            tone="success",
        )
    )
    html = _wrap(
        preheader=f"{listing_name} just dropped in price",
        heading="Price dropped!",
        body_html=body,
        cta_label="View Listing",
        cta_url=f"{APP_URL}/listing/{listing_id}",
        heading_color="#16a34a",
    )
    return await _send(to, f"Price dropped on '{listing_name}' — {BRAND_NAME}", html)


async def send_restock_alert(to: str, buyer_name: str, listing_name: str,
                             price: float, listing_id: int) -> bool:
    body = (
        _p(f"Hi <strong>{buyer_name}</strong>,")
        + _p("A listing you saved is available again:")
        + _info_box(
            f'<p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>'
            f'<p style="margin:10px 0 0;font-size:22px;font-weight:900;color:{BRAND_PRIMARY}">&#8358;{int(round(price)):,}</p>',
        )
    )
    html = _wrap(
        preheader=f"{listing_name} is available again",
        heading="It's back!",
        body_html=body,
        cta_label="View Listing",
        cta_url=f"{APP_URL}/listing/{listing_id}",
    )
    return await _send(to, f"'{listing_name}' is back in stock — {BRAND_NAME}", html)


async def send_new_listing_alert(to: str, buyer_name: str, seller_name: str,
                                 listing_name: str, price: float, listing_id: int) -> bool:
    body = (
        _p(f"Hi <strong>{buyer_name}</strong>,")
        + _p(f"<strong>{seller_name}</strong> just posted something new on {BRAND_NAME}:")
        + _info_box(
            f'<p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>'
            f'<p style="margin:10px 0 0;font-size:22px;font-weight:900;color:{BRAND_PRIMARY}">&#8358;{int(round(price)):,}</p>',
        )
    )
    html = _wrap(
        preheader=f"New listing from {seller_name}",
        heading=f"New listing from {seller_name}",
        body_html=body,
        cta_label="View Listing",
        cta_url=f"{APP_URL}/listing/{listing_id}",
    )
    return await _send(to, f"New listing from {seller_name}: {listing_name} — {BRAND_NAME}", html)


async def send_flash_sale_alert(
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
) -> bool:
    """
    Block 6B — flash sale platform-wide email.

    `cover_media_url` is the listing's cover (photo or Cloudinary video thumbnail —
    the caller resolves which). `end_time_iso` should be the sale's `end_time`
    in ISO-8601 format; we render a "Ends in X hours/minutes" countdown copy.
    """
    from datetime import datetime, timezone

    pct = max(0, int(round(discount_pct)))
    listing_href = f"{APP_URL}/listing/{listing_uuid or listing_id}"
    settings_href = f"{APP_URL}/dashboard/settings?tab=notifications"

    # Countdown copy — best-effort. If the parse fails the email still ships
    # without the line; we never block a blast on a malformed end_time.
    countdown_line = ""
    try:
        end_dt = datetime.fromisoformat(end_time_iso.replace("Z", "+00:00"))
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        delta = end_dt - datetime.now(timezone.utc)
        secs = int(delta.total_seconds())
        if secs > 0:
            if secs >= 3600:
                hours = secs // 3600
                countdown_line = f"Ends in {hours} hour{'s' if hours != 1 else ''}"
            elif secs >= 60:
                mins = secs // 60
                countdown_line = f"Ends in {mins} minute{'s' if mins != 1 else ''}"
            else:
                countdown_line = "Ends in less than a minute"
    except Exception:
        countdown_line = ""

    # Cover image — inline at the top of the info box. We accept any HTTPS URL
    # the caller passes; Cloudinary photo URLs and `.jpg` video-frame URLs both
    # work because they're regular images to the email client.
    cover_html = ""
    if cover_media_url:
        cover_html = (
            f'<img src="{cover_media_url}" alt="{listing_name}" '
            'style="width:100%;max-height:240px;object-fit:cover;'
            'border-radius:8px;display:block;margin-bottom:14px" />'
        )

    countdown_html = (
        f'<p style="margin:8px 0 0;color:#6b7280;font-size:13px">{countdown_line}</p>'
        if countdown_line else ""
    )

    body = (
        _p(f"Hi <strong>{recipient_name}</strong>,")
        + _p("A campus seller just kicked off a flash sale:")
        + _info_box(
            cover_html
            + f'<p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>'
            + f'<p style="margin:10px 0 0">'
            + f'<span style="text-decoration:line-through;color:#9ca3af">&#8358;{int(round(original_price)):,}</span>'
            + f'&nbsp;&rarr;&nbsp;<span style="font-size:22px;font-weight:900;color:#dc2626">&#8358;{int(round(sale_price)):,}</span>'
            + f'&nbsp;<span style="background:#fee2e2;color:#dc2626;font-size:12px;font-weight:700;padding:2px 10px;border-radius:99px">{pct}% off</span></p>'
            + countdown_html,
            tone="brand",
        )
        + (
            '<p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:22px 0 0">'
            f'You receive flash sale alerts because price-drop or new-listing emails are enabled on your account. '
            f'<a href="{settings_href}" style="color:#6b7280;text-decoration:underline">Manage notification preferences</a>.'
            '</p>'
        )
    )

    html = _wrap(
        preheader=f"{listing_name} — {pct}% off on Campify",
        heading="Flash Sale on Campify!",
        body_html=body,
        cta_label="Shop Now",
        cta_url=listing_href,
        heading_color="#dc2626",
    )
    return await _send(to, f"Flash Sale: {listing_name} ({pct}% off) — {BRAND_NAME}", html)


async def send_weekly_report(to: str, seller_name: str, stats: dict) -> bool:
    """
    Weekly digest email sent every Monday at 08:00 WAT.
    stats keys: views (int), inquiries (int)
    """
    views = stats.get("views", 0)
    inquiries = stats.get("inquiries", 0)
    body = (
        _p(f"Hi <strong>{seller_name}</strong>,")
        + _p(f"Here's how your {BRAND_NAME} store performed this week.")
        + '<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:8px 0 16px">'
        '<tr>'
        f'<td style="background:#eff6ff;border-radius:12px;padding:18px 20px;text-align:center;width:50%">'
        f'<p style="margin:0;font-size:32px;font-weight:900;color:{BRAND_PRIMARY}">{views:,}</p>'
        '<p style="margin:4px 0 0;color:#6b7280;font-size:13px">Listing views</p></td>'
        '<td style="background:#f0fdf4;border-radius:12px;padding:18px 20px;text-align:center;width:50%">'
        f'<p style="margin:0;font-size:32px;font-weight:900;color:#16a34a">{inquiries:,}</p>'
        '<p style="margin:4px 0 0;color:#6b7280;font-size:13px">Buyer inquiries</p></td>'
        '</tr></table>'
        + _p("Want to grow these numbers? Add fresh photos, run a flash sale, or respond faster to inquiries.")
    )
    html = _wrap(
        preheader="Your weekly Campify performance summary",
        heading="Your weekly summary",
        body_html=body,
        cta_label="View Full Analytics",
        cta_url=f"{APP_URL}/seller/analytics",
    )
    return await _send(to, f"Your {BRAND_NAME} weekly summary", html)


async def send_interest_notification_email(
    seller_email: str,
    seller_name: str,
    buyer_name: str,
    listing_name: str,
    listing_price: float,
) -> bool:
    """Notify a seller that a buyer has expressed interest in their listing."""
    from app.services.email_templates import INTEREST_EMAIL_TEMPLATE
    body_html = (
        _p(f"<strong>{buyer_name}</strong> is interested in your listing and has sent you an opening message.")
        + f'<table style="border-collapse:separate;border-spacing:8px;width:100%"><tr>'
        + f'<td style="background:#eff6ff;border-radius:12px;padding:16px 18px">'
        + f'<p style="margin:0;font-size:13px;color:#6b7280">Listing</p>'
        + f'<p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b">{listing_name}</p></td>'
        + f'<td style="background:#f0fdf4;border-radius:12px;padding:16px 18px">'
        + f'<p style="margin:0;font-size:13px;color:#6b7280">Price</p>'
        + f'<p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#16a34a">\u20a6{listing_price:,.0f}</p></td>'
        + '</tr></table>'
        + _p("Sellers who reply within 1 hour are 3\u00d7 more likely to close a deal.")
    )
    html = _wrap(
        preheader=f"{buyer_name} is interested in {listing_name}",
        heading="Someone wants to buy from you!",
        body_html=body_html,
        cta_label="Reply Now",
        cta_url=f"{APP_URL}/messages",
    )
    return await _send(seller_email, f"{BRAND_NAME}: {buyer_name} is interested in '{listing_name}'", html)
