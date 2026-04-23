"""
Email service using Resend (https://resend.com).
All sends are fire-and-forget — failures are logged but never crash the API.
Set RESEND_API_KEY in .env to enable. Without it, emails are skipped silently.
"""

import os
import requests as _requests

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

BRAND_NAME = "Campify"
BRAND_TAGLINE = "Campus Marketplace"
BRAND_PRIMARY = "#2563eb"
BRAND_ACCENT = "#06b6d4"
BRAND_SUPPORT = os.getenv("SUPPORT_EMAIL", "support@campify.app")

# ─────────────────────────────────────────────────────────────────────────────


def _get_config():
    """Read email config fresh from env each call so dotenv order doesn't matter."""
    api_key = os.getenv("RESEND_API_KEY", "")
    resend_from = os.getenv("RESEND_FROM", "Campify <noreply@campify.app>")
    from_addr = os.getenv("EMAIL_FROM", resend_from)
    return api_key, from_addr


def _send(to: str, subject: str, html: str) -> bool:
    """Low-level Resend API call. Returns True on success."""
    api_key, from_addr = _get_config()
    if not api_key:
        print(f"[email] No RESEND_API_KEY -- skipped: {subject} -> {to}")
        return False
    print(f"[email] Sending '{subject}' to {to} from {from_addr}")
    try:
        resp = _requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"from": from_addr, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            print(f"[email] Sent OK: {resp.json()}")
            return True
        print(f"[email] Resend error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        print(f"[email] Failed to send to {to}: {e}")
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
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280">
                Need help? Reach out to <a href="mailto:{BRAND_SUPPORT}" style="color:{BRAND_PRIMARY};text-decoration:none">{BRAND_SUPPORT}</a>.
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af">
                &copy; {BRAND_NAME} &middot; Lagos, Nigeria &middot;
                <a href="{APP_URL}" style="color:#9ca3af;text-decoration:none">{APP_URL.replace('https://', '').replace('http://', '')}</a>
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


def send_otp_email(to: str, name: str, otp: str) -> bool:
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
    return _send(to, f"Your verification code — {BRAND_NAME}", html)


def send_seller_submission_email(to: str, seller_name: str) -> bool:
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
    return _send(to, f"We've received your seller verification — {BRAND_NAME}", html)


def send_admin_new_verification_email(seller_name: str, matric_no: str, business_name: str) -> bool:
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
    return _send(ADMIN_EMAIL, f"New seller verification: {seller_name} — {BRAND_NAME}", html)


def send_seller_approved_email(to: str, seller_name: str) -> bool:
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
    return _send(to, f"Your seller account is approved! — {BRAND_NAME}", html)


def send_seller_rejected_email(to: str, seller_name: str, reason: str) -> bool:
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
    return _send(to, f"Your seller verification was not approved — {BRAND_NAME}", html)


def send_price_drop_alert(to: str, buyer_name: str, listing_name: str,
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
    return _send(to, f"Price dropped on '{listing_name}' — {BRAND_NAME}", html)


def send_restock_alert(to: str, buyer_name: str, listing_name: str,
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
    return _send(to, f"'{listing_name}' is back in stock — {BRAND_NAME}", html)


def send_new_listing_alert(to: str, buyer_name: str, seller_name: str,
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
    return _send(to, f"New listing from {seller_name}: {listing_name} — {BRAND_NAME}", html)


def send_weekly_report(to: str, seller_name: str, stats: dict) -> bool:
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
    return _send(to, f"Your {BRAND_NAME} weekly summary", html)
