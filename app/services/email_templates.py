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
    return f"""Hi {name},

Your Campify account has been paused by our team.

Reason: {reason}

Your listings are now hidden from buyers.
To appeal or request reactivation, reply to this email
or visit {url}/support.

— The Campify Team"""


def ACCOUNT_DELETED_EMAIL(name: str) -> str:
    support = _support_email()
    contact_line = (
        f"If this was a mistake, contact {support}\n"
        "within 7 days — we may be able to restore your data.\n"
        if support
        else "If this was a mistake, reply to this email within 7 days\n"
             "— we may be able to restore your data.\n"
    )
    return f"""Hi {name},

Your Campify account has been permanently deleted
as requested. All your data has been removed.

{contact_line}
— The Campify Team"""


def ACCOUNT_SUSPENDED_EMAIL(name: str, reason: str) -> str:
    url = _app_url()
    return f"""Hi {name},

Your Campify account has been suspended by our team.

Reason: {reason or "Policy violation"}

While suspended:
- Your listings are hidden from buyers.
- You can't log in, message, or transact.

The suspension stays in place until an admin lifts it.
To appeal, reply to this email or visit {url}/support.

— The Campify Team"""


def ACCOUNT_BANNED_EMAIL(name: str, reason: str) -> str:
    return f"""Hi {name},

Your Campify account has been permanently banned.

Reason: {reason or "Severe policy violation"}

This decision is final. Your email address has been
added to our blocked list and cannot be used to
register again on Campify.

If you believe this is a mistake, reply to this email
within 14 days to request a review.

— The Campify Team"""


def LISTING_FLAGGED_EMAIL(name: str, listing_name: str, reason: str) -> str:
    url = _app_url()
    return f"""Hi {name},

One of your listings on Campify has been flagged for review:

Listing: {listing_name}
Reason: {reason or "Reported by a user — awaiting moderation review"}

What happens next:
- The listing is temporarily hidden from buyers while we review it.
- Our team will assess whether it meets our seller guidelines.
- You'll get another email once the review is complete.

If you believe this is a mistake or want to update the listing
to address the issue, visit {url}/seller/listings.

Review our seller guidelines: {url}/help/seller-policy

— The Campify Team"""


def LISTING_REMOVED_EMAIL(name: str, listing_name: str, reason: str) -> str:
    url = _app_url()
    return f"""Hi {name},

We've taken down one of your listings on Campify:

Listing: {listing_name}
Reason: {reason or "Reported by users and confirmed by our moderation team"}

Repeated takedowns can lead to account suspension or
permanent ban. Please review our seller guidelines:
{url}/help/seller-policy

If you believe this was a mistake, reply to this email
and our team will review.

— The Campify Team"""


def ANNOUNCEMENT_EMAIL(name: str, title: str, message: str, cta_label: str | None = None, cta_href: str | None = None) -> str:
    url = _app_url()
    cta_line = ""
    if cta_label and cta_href:
        full_href = cta_href if cta_href.startswith("http") else f"{url}{cta_href}"
        cta_line = f"\n{cta_label}: {full_href}\n"
    return f"""Hi {name},

{title}

{message}
{cta_line}
— The Campify Team

You're receiving this because you're a member of Campify.
Manage notification settings: {url}/dashboard/settings"""


def ACCOUNT_REACTIVATED_EMAIL(name: str) -> str:
    url = _app_url()
    return f"""Hi {name},

Great news — your Campify account has been reactivated!

You can now log in and your listings are live again.
Visit: {url}

— The Campify Team"""


def SELLER_SELF_PAUSED_EMAIL(name: str) -> str:
    return f"""Hi {name},

Your seller account is now paused.
All your listings have been hidden from buyers.

To reactivate, go to:
Settings > Account > Request Reactivation

— The Campify Team"""


def SELLER_DOWNGRADE_EMAIL(name: str) -> str:
    url = _app_url()
    return f"""Hi {name},

Your seller account has been downgraded to a buyer
account at your request. All your active listings
have been paused and are no longer visible to buyers.

You can still browse, message sellers, and order
on Campify as a regular buyer. If you change your
mind, you can re-apply to become a seller at:
{url}/seller/verify

— The Campify Team"""


def REACTIVATION_REQUEST_EMAIL(name: str) -> str:
    return f"""Hi {name},

We've received your reactivation request.
Our team will review and reactivate your account
within 24 hours.

You'll get a confirmation email once it's done.

— The Campify Team"""


def DELETION_REQUEST_EMAIL(name: str) -> str:
    return f"""Hi {name},

We've received your account deletion request.
Our team will process it within 48 hours.

You'll receive a final confirmation once your
account and data have been removed.

Changed your mind? Reply to this email before
the deletion is processed.

— The Campify Team"""


def VERIFICATION_APPROVED_EMAIL(name: str) -> str:
    url = _app_url()
    return f"""Hi {name},

Congratulations! Your seller account has been verified.

Your "Verified UNILAG Seller" badge is now live.
Start listing at: {url}/seller/listings/new

— The Campify Team"""


def VERIFICATION_REJECTED_EMAIL(name: str, reason: str) -> str:
    url = _app_url()
    return f"""Hi {name},

We were unable to verify your seller account.

Reason: {reason}

You can resubmit your documents at:
{url}/seller/settings > Verification

If you think this is an error, reply to this email.

— The Campify Team"""


# ── Block 6 — New email templates ─────────────────────────────────────────


def PASSWORD_RESET_EMAIL(name: str, link: str) -> str:
    return f"""Hi {name},

We received a request to reset your Campify password.

Click the link below to set a new password:
{link}

This link expires in 1 hour.

If you didn't request a password reset, you can safely
ignore this email — your account is still secure.

— The Campify Team"""


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
    return f"""Hi {name},

Your email is verified!

You can now log in and start buying from verified
UNILAG sellers.

Log in at: {url}/signin

— The Campify Team"""


def WELCOME_WITH_STATS(
    name: str,
    total_listings: int = 0,
    total_sellers: int = 0,
    total_categories: int = 0,
) -> str:
    url = _app_url()
    return f"""Hi {name},

Welcome to Campify — UNILAG's campus marketplace!

Here's what's waiting for you:

- {total_listings:,} listings across {total_categories} categories
- {total_sellers:,} verified sellers on campus
- Price alerts, wishlists, and karma rewards

Your next steps:
1. Browse the marketplace: {url}
2. Set up price alerts for items you need
3. Follow your favourite sellers

Have something to sell? Apply as a verified seller:
{url}/seller/register

Questions? Reply to this email or visit {url}/support.

— The Campify Team"""


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
    return f"""Hi {seller_name},

Great news! A buyer is interested in your listing.

Buyer: {buyer_name}
Listing: {listing_name}
Asking Price: \u20a6{listing_price:,.0f}

They've sent you an opening message via Campify.
Reply now to close the deal:
{app_url}/messages

Tip: Sellers who respond within 1 hour are 3x more likely to complete a sale.

— The Campify Team"""


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
