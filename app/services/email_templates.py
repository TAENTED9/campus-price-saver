"""
Block 7 — Plain-text email templates for user lifecycle events.
All templates are short — students read these on mobile.
"""

def _app_url() -> str:
    """Lazy getter — reads FRONTEND_URL from env at call time, not at import time."""
    from app.config import settings
    return settings.FRONTEND_URL


def _support_email() -> str:
    """Support address from env. Falls back to ADMIN_EMAIL, then empty string."""
    import os
    return (os.getenv("SUPPORT_EMAIL") or os.getenv("ADMIN_EMAIL") or "").strip()


def _app_domain() -> str:
    """Bare host portion of the public app URL — for footer text like 'campify.ng'."""
    return _app_url().replace("https://", "").replace("http://", "").rstrip("/")


def ACCOUNT_PAUSED_EMAIL(name: str, reason: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Your account has been paused",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your Campify account has been paused by our team, so your listings "
            "are now hidden from buyers."
            f'<br><br><strong>Reason:</strong> {_esc(reason) or "Not specified"}'
        ),
        cta_label="Contact support",
        cta_href=f"{url}/support",
        footer_note="To appeal or request reactivation, reply to this email or visit the support page.",
    )


def ACCOUNT_DELETED_EMAIL(name: str) -> str:
    support = _support_email()
    contact = (
        f"If this was a mistake, contact <a href='mailto:{_esc(support)}' style='color:#2563eb;'>{_esc(support)}</a> "
        "within 7 days — we may be able to restore your data."
        if support
        else "If this was a mistake, reply to this email within 7 days — we may be able to restore your data."
    )
    return branded_email(
        heading="Your account has been deleted",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your Campify account has been permanently deleted as requested. "
            "All your data has been removed."
        ),
        footer_note=contact,
    )


def ACCOUNT_SUSPENDED_EMAIL(name: str, reason: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Your account has been suspended",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your Campify account has been suspended by our team."
            f'<br><br><strong>Reason:</strong> {_esc(reason) or "Policy violation"}'
            "<br><br>While suspended, your listings are hidden from buyers and "
            "you can't log in, message, or transact. The suspension stays in "
            "place until an admin lifts it."
        ),
        cta_label="Contact support",
        cta_href=f"{url}/support",
        footer_note="To appeal, reply to this email or visit the support page.",
    )


def ACCOUNT_BANNED_EMAIL(name: str, reason: str) -> str:
    return branded_email(
        heading="Your account has been banned",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your Campify account has been permanently banned."
            f'<br><br><strong>Reason:</strong> {_esc(reason) or "Severe policy violation"}'
            "<br><br>This decision is final. Your email address has been added "
            "to our blocked list and cannot be used to register again on Campify."
        ),
        footer_note="If you believe this is a mistake, reply to this email within 14 days to request a review.",
    )


def LISTING_FLAGGED_EMAIL(name: str, listing_name: str, reason: str) -> str:
    url = _app_url()
    return branded_email(
        heading="A listing was flagged for review",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "One of your listings has been flagged and is temporarily hidden "
            "from buyers while our team reviews it against our seller guidelines."
            f'<br><br><strong>Listing:</strong> {_esc(listing_name)}'
            f'<br><strong>Reason:</strong> {_esc(reason) or "Reported by a user — awaiting moderation review"}'
            "<br><br>You'll get another email once the review is complete."
        ),
        cta_label="Review my listings",
        cta_href=f"{url}/seller/listings",
        footer_note=f"Read our seller guidelines: {url}/help/seller-policy",
    )


def LISTING_REMOVED_EMAIL(name: str, listing_name: str, reason: str) -> str:
    url = _app_url()
    return branded_email(
        heading="A listing was removed",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "We've taken down one of your listings on Campify."
            f'<br><br><strong>Listing:</strong> {_esc(listing_name)}'
            f'<br><strong>Reason:</strong> {_esc(reason) or "Reported by users and confirmed by our moderation team"}'
            "<br><br>Repeated takedowns can lead to account suspension or a "
            "permanent ban."
        ),
        cta_label="Seller guidelines",
        cta_href=f"{url}/help/seller-policy",
        footer_note="If you believe this was a mistake, reply to this email and our team will review.",
    )


def ANNOUNCEMENT_EMAIL(name: str, title: str, message: str, cta_label: str | None = None, cta_href: str | None = None) -> str:
    url = _app_url()
    full_href = None
    if cta_label and cta_href:
        full_href = cta_href if cta_href.startswith("http") else f"{url}{cta_href}"
    return branded_email(
        heading=_esc(title),
        greeting=f"Hi {_esc(name)},",
        body_html=_esc(message).replace("\n", "<br>"),
        cta_label=cta_label if full_href else None,
        cta_href=full_href,
        footer_note=f"You're receiving this as a Campify member. Manage notifications: {url}/dashboard/settings",
    )


def ACCOUNT_REACTIVATED_EMAIL(name: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Your account has been reactivated",
        greeting=f"Hi {_esc(name)},",
        body_html="Great news — your Campify account is active again and your listings are live.",
        cta_label="Go to Campify",
        cta_href=url,
    )


def SELLER_SELF_PAUSED_EMAIL(name: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Your seller account is paused",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your seller account is now paused and all your listings have been "
            "hidden from buyers. You can reactivate any time from "
            "Settings &rsaquo; Account &rsaquo; Request Reactivation."
        ),
        cta_label="Open settings",
        cta_href=f"{url}/seller/settings",
    )


def SELLER_DOWNGRADE_EMAIL(name: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Downgraded to a buyer account",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Your seller account has been downgraded to a buyer account at your "
            "request. Your active listings are paused and no longer visible to "
            "buyers. You can still browse, message sellers, and order as a "
            "regular buyer."
        ),
        cta_label="Re-apply as a seller",
        cta_href=f"{url}/seller/verify",
    )


def REACTIVATION_REQUEST_EMAIL(name: str) -> str:
    return branded_email(
        heading="Reactivation request received",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "We've received your reactivation request. Our team will review and "
            "reactivate your account within 24 hours, and you'll get a "
            "confirmation email once it's done."
        ),
    )


def DELETION_REQUEST_EMAIL(name: str) -> str:
    return branded_email(
        heading="Deletion request received",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "We've received your account deletion request and will process it "
            "within 48 hours. You'll receive a final confirmation once your "
            "account and data have been removed."
        ),
        footer_note="Changed your mind? Reply to this email before the deletion is processed.",
    )


def VERIFICATION_APPROVED_EMAIL(name: str) -> str:
    url = _app_url()
    return branded_email(
        heading="You're a verified seller!",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Congratulations! Your seller account has been verified and your "
            "<strong>Verified UNILAG Seller</strong> badge is now live on your "
            "storefront."
        ),
        cta_label="Create your first listing",
        cta_href=f"{url}/seller/listings/new",
    )


def VERIFICATION_REJECTED_EMAIL(name: str, reason: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Verification unsuccessful",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "We were unable to verify your seller account this time."
            f'<br><br><strong>Reason:</strong> {_esc(reason) or "Documents could not be verified"}'
            "<br><br>You can resubmit your documents from your settings."
        ),
        cta_label="Resubmit documents",
        cta_href=f"{url}/seller/settings",
        footer_note="If you think this is an error, reply to this email.",
    )


# ── Block 6 — New email templates ─────────────────────────────────────────


def PASSWORD_RESET_EMAIL(name: str, link: str) -> str:
    return branded_email(
        heading="Reset your password",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "We received a request to reset your Campify password. Tap the button "
            "below to set a new one."
        ),
        cta_label="Reset my password",
        cta_href=link,
        footer_note=(
            "This link expires in 1 hour. If you didn't request a reset, you can "
            "safely ignore this email — your account is still secure."
        ),
    )


def EMAIL_VERIFY_TEMPLATE(name: str, link: str) -> str:
    return f"""Hi {name},

Welcome to Campify! One last step — verify your email.

Click the link below to activate your account:
{link}

This link expires in 24 hours.

If you didn't create a Campify account, ignore this email.

— The Campify Team"""


def EMAIL_VERIFIED_WELCOME(name: str) -> str:
    url = _app_url()
    return branded_email(
        heading="Your email is verified",
        greeting=f"Hi {_esc(name)},",
        body_html="You're all set! You can now log in and start buying from verified UNILAG sellers.",
        cta_label="Log in",
        cta_href=f"{url}/signin",
    )


def WELCOME_EMAIL(name: str) -> str:
    """Simple branded welcome — used by the send_welcome_email task."""
    url = _app_url()
    return branded_email(
        heading="Welcome to Campify",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Welcome to Campify — UNILAG's campus marketplace. Browse listings, "
            "set price alerts, follow your favourite sellers, and earn karma "
            "rewards as you go."
        ),
        cta_label="Start browsing",
        cta_href=url,
        footer_note=f"Questions? Reply to this email or visit {url}/support.",
    )


def WELCOME_WITH_STATS(
    name: str,
    total_listings: int = 0,
    total_sellers: int = 0,
    total_categories: int = 0,
) -> str:
    url = _app_url()
    stats = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:10px 0;background:#f8fafc;border-radius:12px;padding:6px 16px;">'
        f'{_info_row("Listings", f"{total_listings:,} across {total_categories} categories")}'
        f'{_info_row("Sellers", f"{total_sellers:,} verified on campus")}'
        f'{_info_row("Perks", "Price alerts, wishlists & karma rewards")}'
        '</table>'
    )
    return branded_email(
        heading="Welcome to Campify",
        greeting=f"Hi {_esc(name)},",
        body_html=(
            "Welcome to UNILAG's campus marketplace! Here's what's waiting for you:"
            + stats +
            "Set up price alerts, follow sellers, and browse the latest listings."
        ),
        cta_label="Browse the marketplace",
        cta_href=url,
        footer_note=f"Have something to sell? Apply as a verified seller: {url}/seller/register",
    )


def NEW_LOGIN_EMAIL(name: str, device: str, ip: str, time: str) -> str:
    url = _app_url()
    return f"""Hi {name},

A new login to your Campify account was detected.

Device: {device}
IP Address: {ip}
Time: {time}

If this was you — no action needed.

If this wasn't you, secure your account immediately:
{url}/dashboard/settings?tab=security

— The Campify Team"""


def INTEREST_EMAIL_TEMPLATE(
    seller_name: str,
    buyer_name: str,
    listing_name: str,
    listing_price: float,
    app_url: str,
) -> str:
    details = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:10px 0;background:#f8fafc;border-radius:12px;padding:6px 16px;">'
        f'{_info_row("Buyer", _esc(buyer_name))}'
        f'{_info_row("Listing", _esc(listing_name))}'
        f'{_info_row("Asking price", f"&#8358;{listing_price:,.0f}")}'
        '</table>'
    )
    return branded_email(
        heading="A buyer is interested!",
        greeting=f"Hi {_esc(seller_name)},",
        body_html=(
            "Great news — a buyer just messaged you about your listing." + details +
            "Reply now to close the deal."
        ),
        cta_label="Open messages",
        cta_href=f"{app_url}/messages",
        footer_note="Sellers who respond within 1 hour are 3x more likely to complete a sale.",
    )


# ── Branded HTML wrapper (shared) ─────────────────────────────────────────
# Email-client-safe: table layout + inline styles only (no <style>, no flexbox,
# no external CSS). Brand: blue #2563eb → cyan #06b6d4 gradient, Outfit-ish.

def _btn(label: str, href: str) -> str:
    return (
        f'<a href="{href}" target="_blank" '
        'style="display:inline-block;background:#2563eb;color:#ffffff;'
        'text-decoration:none;font-weight:700;font-size:15px;'
        'padding:14px 28px;border-radius:12px;">'
        f'{label}</a>'
    )


def _info_row(label: str, value: str) -> str:
    return (
        '<tr>'
        '<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;'
        'font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;width:120px;">'
        f'{label}</td>'
        '<td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;'
        f'color:#0f172a;font-weight:600;">{value}</td>'
        '</tr>'
    )


def branded_email(
    heading: str,
    greeting: str,
    body_html: str,
    cta_label: str | None = None,
    cta_href: str | None = None,
    footer_note: str | None = None,
) -> str:
    """Wrap content in the Campify branded HTML shell. Returns a full HTML doc."""
    domain = _app_domain()
    cta = (
        f'<tr><td style="padding:8px 0 4px;">{_btn(cta_label, cta_href)}</td></tr>'
        if cta_label and cta_href else ""
    )
    note = (
        f'<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">{footer_note}</p>'
        if footer_note else ""
    )
    return f"""\
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2563eb,#06b6d4);padding:26px 32px;">
          <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Campify</div>
          <div style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.92);margin-top:6px;">{heading}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 14px;font-size:15px;color:#0f172a;font-weight:600;">{greeting}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:14px;line-height:1.7;color:#334155;">{body_html}</td></tr>
            {cta}
          </table>
          {note}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:18px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            &copy; Campify &middot; {domain}<br>
            UNILAG's student marketplace
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def EMAIL_VERIFY_HTML(name: str, link: str) -> str:
    return branded_email(
        heading="Verify your email address",
        greeting=f"Hi {name},",
        body_html=(
            "Welcome to Campify! You're one click away from your account. "
            "Tap the button below to verify your email and start buying from "
            "verified UNILAG sellers."
        ),
        cta_label="Verify my email",
        cta_href=link,
        footer_note=(
            "This link expires in 24 hours. If you didn't create a Campify "
            "account, you can safely ignore this email."
        ),
    )


def NEW_LOGIN_HTML(name: str, device: str, ip: str, time: str) -> str:
    url = _app_url()
    info = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:8px 0 4px;background:#f8fafc;border-radius:12px;padding:6px 16px;">'
        f'{_info_row("Device", _esc(device))}'
        f'{_info_row("IP address", _esc(ip))}'
        f'{_info_row("Time", _esc(time))}'
        '</table>'
    )
    return branded_email(
        heading="New sign-in to your account",
        greeting=f"Hi {name},",
        body_html=(
            "We noticed a new sign-in to your Campify account. If this was you, "
            "no action is needed." + info
        ),
        cta_label="Secure my account",
        cta_href=f"{url}/dashboard/settings?tab=security",
        footer_note=(
            "If this wasn't you, tap the button above to review your security "
            "settings and change your password right away."
        ),
    )


# ── Seller verification → Admin notification ─────────────────────────────
import html as _html_lib


def _esc(value) -> str:
    """HTML-escape a value for safe injection into the verification email."""
    if value is None:
        return ""
    return _html_lib.escape(str(value), quote=True)


def SELLER_VERIFICATION_ADMIN_EMAIL(
    seller_name:     str,
    seller_email:    str,
    seller_username: str,
    matric_number:   str | None,
    id_card_url:     str,
    portal_url:      str,
    submitted_at:    str,
    admin_url:       str,
    verif_id:        int,
) -> str:
    """
    Branded HTML notification sent to the admin inbox each time a seller
    submits verification documents. Includes clickable document links and
    a CTA into the admin dashboard. All user-supplied values are HTML-escaped.
    """
    sn = _esc(seller_name)
    se = _esc(seller_email)
    su = _esc(seller_username)
    mn = _esc(matric_number) if matric_number else "Not provided"
    ic = _esc(id_card_url)
    pu = _esc(portal_url)
    au = _esc(admin_url.rstrip("/"))
    vid = _esc(verif_id)
    sa = _esc(submitted_at)

    return f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">

      <div style="background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 16px; padding: 20px 24px; margin-bottom: 24px;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 900;">
          New Seller Verification Request
        </h1>
        <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">
          Submitted {sa}
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; width: 140px;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Name
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-weight: 600;">
            {sn}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Email
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <a href="mailto:{se}" style="color: #2563eb;">{se}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Username
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            @{su}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Matric No.
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-weight: 700; font-family: monospace; font-size: 15px;">
            {mn}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase;">
              Request ID
            </span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-family: monospace; color: #6b7280;">
            #{vid}
          </td>
        </tr>
      </table>

      <h2 style="font-size: 14px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px;">
        Submitted Documents
      </h2>

      <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <a href="{ic}" target="_blank" style="flex: 1; min-width: 200px; display: block; padding: 16px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px; text-decoration: none; text-align: center;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #111827; font-size: 14px;">
            Student ID Card
          </p>
          <p style="margin: 0; color: #2563eb; font-size: 12px;">
            Click to view document &rarr;
          </p>
        </a>

        <a href="{pu}" target="_blank" style="flex: 1; min-width: 200px; display: block; padding: 16px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 12px; text-decoration: none; text-align: center;">
          <p style="margin: 0 0 4px; font-weight: 700; color: #111827; font-size: 14px;">
            Student Portal Screenshot
          </p>
          <p style="margin: 0; color: #2563eb; font-size: 12px;">
            Click to view document &rarr;
          </p>
        </a>
      </div>

      <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">
        Review this application in the admin dashboard:
      </p>

      <a href="{au}/verifications"
         style="display: block; background: linear-gradient(135deg, #7c3aed, #2563eb); color: white; text-align: center; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none; margin-bottom: 24px;">
        Review in Admin Dashboard &rarr;
      </a>

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Campify Admin &middot; {_app_domain()}/admin
      </p>
    </div>
    """


def SELLER_VERIFICATION_SUBMITTED_EMAIL(seller_name: str) -> str:
    """Branded HTML confirmation sent to the seller after they submit docs."""
    sn = _esc(seller_name)
    return f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #7c3aed, #2563eb); border-radius: 16px; padding: 20px 24px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900;">
          Verification Submitted
        </h1>
      </div>
      <p style="color: #374151;">Hi {sn},</p>
      <p style="color: #374151; line-height: 1.7;">
        We received your verification documents and will review them within
        <strong>24&ndash;48 hours</strong>. We'll send you an email once a decision
        has been made.
      </p>
      <p style="color: #374151; line-height: 1.7;">
        In the meantime, you can save listings as drafts from your
        <a href="{_app_url()}/seller/listings" style="color: #2563eb;">seller dashboard</a>.
      </p>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
        &copy; Campify &middot; {_app_domain()}
      </p>
    </div>
    """
