"""
Email service using Resend (https://resend.com).
All sends are fire-and-forget — failures are logged but never crash the API.
Set RESEND_API_KEY in .env to enable. Without it, emails are skipped silently.
"""

import os
import requests as _requests

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "Campify <noreply@campify.app>")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# ─────────────────────────────────────────────────────────────────────────────


def _send(to: str, subject: str, html: str) -> bool:
    """Low-level Resend API call. Returns True on success."""
    if not RESEND_API_KEY:
        print(f"[email] No RESEND_API_KEY — skipped: {subject} → {to}")
        return False
    try:
        resp = _requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            return True
        print(f"[email] Resend error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        print(f"[email] Failed to send to {to}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Email templates
# ─────────────────────────────────────────────────────────────────────────────


def send_otp_email(to: str, name: str, otp: str) -> bool:
    """Send email OTP verification code."""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:8px">Verify your email</h2>
      <p style="color:#374151">Hi <strong>{name}</strong>,</p>
      <p style="color:#374151">Use the code below to verify your email address for Campify:</p>
      <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px 24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#2563eb">{otp}</span>
      </div>
      <p style="color:#6b7280;font-size:13px">This code expires in <strong>10 minutes</strong>. If you did not create an account, please ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify · Lagos, Nigeria</p>
    </div>
    """
    return _send(to, "Your verification code — Campify", html)


def send_seller_submission_email(to: str, seller_name: str) -> bool:
    """Sent to seller after they submit a verification request."""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:8px">Verification received ✅</h2>
      <p style="color:#374151">Hi <strong>{seller_name}</strong>,</p>
      <p style="color:#374151">We've received your seller verification request on Campify.</p>
      <p style="color:#374151">Our team will review your documents and respond within <strong>24 hours</strong>. You'll get an email as soon as a decision is made.</p>
      <p style="color:#374151">In the meantime, you can browse the marketplace and set up your profile at:</p>
      <p style="margin:16px 0"><a href="{APP_URL}/seller" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">Go to Seller Dashboard →</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify · Lagos, Nigeria</p>
    </div>
    """
    return _send(to, "We've received your seller verification — Campify", html)


def send_admin_new_verification_email(seller_name: str, matric_no: str, business_name: str) -> bool:
    """Alert the admin when a new seller verification arrives."""
    if not ADMIN_EMAIL:
        return False
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:8px">New seller verification pending</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#6b7280;font-size:13px">Seller Name</td><td style="padding:8px;font-weight:600;color:#111827">{seller_name}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:13px">Matric No</td><td style="padding:8px;font-weight:600;color:#111827">{matric_no}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;font-size:13px">Business</td><td style="padding:8px;font-weight:600;color:#111827">{business_name}</td></tr>
      </table>
      <p style="margin:16px 0"><a href="{APP_URL}/admin/verification" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">Review in Admin Panel →</a></p>
    </div>
    """
    return _send(ADMIN_EMAIL, f"New seller verification: {seller_name} — Campify", html)


def send_seller_approved_email(to: str, seller_name: str) -> bool:
    """Sent to seller when their verification is approved."""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#16a34a;margin-bottom:8px">You're verified! 🎉</h2>
      <p style="color:#374151">Hi <strong>{seller_name}</strong>,</p>
      <p style="color:#374151">Congratulations! Your seller account on Campify has been <strong>approved</strong>.</p>
      <p style="color:#374151">You can now create listings, run flash sales, and start selling to thousands of UNILAG students.</p>
      <p style="margin:16px 0"><a href="{APP_URL}/seller/listings/new" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">Create Your First Listing →</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify · Lagos, Nigeria</p>
    </div>
    """
    return _send(to, "Your seller account is approved! — Campify", html)


def send_price_drop_alert(to: str, buyer_name: str, listing_name: str,
                          old_price: float, new_price: float, listing_id: int) -> bool:
    """Notify a buyer that a wishlisted item's price dropped."""
    pct = round((old_price - new_price) / old_price * 100)
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#16a34a;margin-bottom:8px">Price dropped! 🎉</h2>
      <p style="color:#374151">Hi <strong>{buyer_name}</strong>,</p>
      <p style="color:#374151">An item on your wishlist just got cheaper:</p>
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>
        <p style="margin:8px 0 0"><span style="text-decoration:line-through;color:#9ca3af">&#8358;{old_price:,.0f}</span>
          &nbsp;&rarr;&nbsp;<span style="font-size:20px;font-weight:900;color:#16a34a">&#8358;{new_price:,.0f}</span>
          &nbsp;<span style="background:#dcfce7;color:#16a34a;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px">{pct}% off</span>
        </p>
      </div>
      <p style="margin:16px 0"><a href="{APP_URL}/listing/{listing_id}" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">View Listing &rarr;</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify &middot; Lagos, Nigeria</p>
    </div>
    """
    return _send(to, f"Price dropped on '{listing_name}' — Campify", html)


def send_restock_alert(to: str, buyer_name: str, listing_name: str,
                       price: float, listing_id: int) -> bool:
    """Notify a buyer that a wishlisted out-of-stock item is available again."""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:8px">It&#39;s back! 🔔</h2>
      <p style="color:#374151">Hi <strong>{buyer_name}</strong>,</p>
      <p style="color:#374151">A listing you saved is available again:</p>
      <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:900;color:#2563eb">&#8358;{price:,.0f}</p>
      </div>
      <p style="margin:16px 0"><a href="{APP_URL}/listing/{listing_id}" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">View Listing &rarr;</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify &middot; Lagos, Nigeria</p>
    </div>
    """
    return _send(to, f"'{listing_name}' is back in stock — Campify", html)


def send_new_listing_alert(to: str, buyer_name: str, seller_name: str,
                            listing_name: str, price: float, listing_id: int) -> bool:
    """Notify a follower when a seller they follow posts a new listing."""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:8px">New listing from {seller_name} 🆕</h2>
      <p style="color:#374151">Hi <strong>{buyer_name}</strong>,</p>
      <p style="color:#374151"><strong>{seller_name}</strong> just posted something new on Campify:</p>
      <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="margin:0;font-weight:700;font-size:16px;color:#111827">{listing_name}</p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:900;color:#2563eb">&#8358;{price:,.0f}</p>
      </div>
      <p style="margin:16px 0"><a href="{APP_URL}/listing/{listing_id}" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">View Listing &rarr;</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify &middot; Lagos, Nigeria</p>
    </div>
    """
    return _send(to, f"New listing from {seller_name}: {listing_name} — Campify", html)


def send_weekly_report(to: str, seller_name: str, stats: dict) -> bool:
    """
    Weekly digest email sent every Monday at 08:00 WAT.
    stats keys: views (int), inquiries (int)
    """
    views = stats.get("views", 0)
    inquiries = stats.get("inquiries", 0)
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;margin-bottom:4px">Your weekly summary 📊</h2>
      <p style="color:#6b7280;margin-top:0">Here's how your Campify store performed this week.</p>
      <p style="color:#374151">Hi <strong>{seller_name}</strong>,</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr>
          <td style="background:#eff6ff;border-radius:12px;padding:16px 20px;text-align:center;width:50%">
            <p style="margin:0;font-size:32px;font-weight:900;color:#2563eb">{views:,}</p>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px">Listing views</p>
          </td>
          <td style="width:16px"></td>
          <td style="background:#f0fdf4;border-radius:12px;padding:16px 20px;text-align:center;width:50%">
            <p style="margin:0;font-size:32px;font-weight:900;color:#16a34a">{inquiries:,}</p>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px">Buyer inquiries</p>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0">
        <a href="{APP_URL}/seller/analytics"
           style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">
          View Full Analytics &rarr;
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify &middot; Lagos, Nigeria &middot;
        <a href="{APP_URL}/seller/settings" style="color:#9ca3af">Unsubscribe</a>
      </p>
    </div>
    """
    return _send(to, "Your Campify weekly summary", html)


def send_seller_rejected_email(to: str, seller_name: str, reason: str) -> bool:
    """Sent to seller when their verification is rejected."""
    reason_html = f"<p style=\"color:#374151\"><strong>Reason:</strong> {reason}</p>" if reason else ""
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626;margin-bottom:8px">Verification not approved</h2>
      <p style="color:#374151">Hi <strong>{seller_name}</strong>,</p>
      <p style="color:#374151">Unfortunately, we were unable to approve your seller verification on Campify.</p>
      {reason_html}
      <p style="color:#374151">You can update your details and resubmit from your seller dashboard:</p>
      <p style="margin:16px 0"><a href="{APP_URL}/seller/verification" style="background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:99px;font-weight:700;font-size:14px">Resubmit Verification →</a></p>
      <p style="color:#6b7280;font-size:13px">If you have any questions, reply to this email or contact support.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Campify · Lagos, Nigeria</p>
    </div>
    """
    return _send(to, "Your seller verification was not approved — Campify", html)
