"""
Send EVERY transactional email to the admin account for visual QA.

Usage:
    python scripts/send_test_emails.py            # sends to ADMIN_EMAIL from .env
    python scripts/send_test_emails.py you@x.com  # override recipient

Covers both email systems:
  • app/services/email.py        — async senders that build HTML via _wrap()
  • app/services/email_templates.py — branded_email() HTML templates

Notes:
  • Resend's sandbox sender (onboarding@resend.dev) only delivers to YOUR
    Resend-account email. Make sure the recipient is that address, or verify a
    domain and set RESEND_FROM / EMAIL_FROM first.
  • Each send is wrapped so one failure never aborts the run. A short delay
    keeps us under Resend's rate limit.
"""
import asyncio
import os
import sys

# Make the project importable when run as a plain script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from app.services import email as E
from app.services import email_templates as T
from app.services.email import _send  # low-level Resend call

NAME = "Campify Admin"
NOW_ISO = "2026-05-31T16:30:00Z"


def _recipient() -> str:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    addr = (os.getenv("ADMIN_EMAIL") or os.getenv("RESEND_FROM") or "").strip()
    if not addr:
        print("No recipient: pass an email arg or set ADMIN_EMAIL in .env")
        sys.exit(1)
    return addr


async def _run():
    to = _recipient()
    print(f"Sending all test emails to: {to}\n")

    # (label, coroutine-factory). email.py senders deliver to `to` themselves;
    # email_templates.py ones are rendered then handed to _send directly.
    jobs = [
        # ── email.py (_wrap based) ────────────────────────────────────────
        ("OTP code",                 lambda: E.send_otp_email(to, NAME, "284917")),
        ("Seller submission ack",    lambda: E.send_seller_submission_email(to, NAME)),
        ("Admin: new verification",  lambda: _send(to, "[TEST] New seller verification",
                                                   T.SELLER_VERIFICATION_ADMIN_EMAIL(
                                                       NAME, to, "campify", "190101001",
                                                       "https://x/id.jpg", "https://x/portal.jpg",
                                                       NOW_ISO, os.getenv("FRONTEND_URL", ""), 42))),
        ("Seller approved",          lambda: E.send_seller_approved_email(to, NAME)),
        ("Seller rejected",          lambda: E.send_seller_rejected_email(to, NAME, "ID photo was too blurry to read.")),
        ("Price drop alert",         lambda: E.send_price_drop_alert(to, NAME, "iPhone 15 Pro", 520000, 465000, 1)),
        ("Restock alert",            lambda: E.send_restock_alert(to, NAME, "AirPods Pro 2", 165000, 1)),
        ("New listing alert",        lambda: E.send_new_listing_alert(to, NAME, "DEV Store", "MacBook Air M3", 1250000, 1)),
        ("Flash sale alert",         lambda: E.send_flash_sale_alert(to, NAME, "PS5 Slim", "uuid-123", 1,
                                                                     650000, 520000, 20, None, NOW_ISO)),
        ("Weekly seller report",     lambda: E.send_weekly_report(to, NAME, {
                                            "views": 1240, "messages": 36, "sales": 8, "revenue": 415000})),
        ("Interest notification",    lambda: E.send_interest_notification_email(to, NAME, "Jane Buyer", "Nike Air Force 1", 38000)),

        # ── email_templates.py (branded_email) — rendered then _send ──────
        ("Verify email",             lambda: _send(to, "[TEST] Verify your Campify email",
                                                   T.EMAIL_VERIFY_HTML(NAME, os.getenv("FRONTEND_URL", "") + "/verify-email?token=demo"))),
        ("New login alert",          lambda: _send(to, "[TEST] New login", T.NEW_LOGIN_HTML(NAME, "Chrome on Windows", "102.89.43.10", "31 May 2026, 4:30 PM"))),
        ("Password reset",           lambda: _send(to, "[TEST] Reset your password", T.PASSWORD_RESET_EMAIL(NAME, os.getenv("FRONTEND_URL", "") + "/reset?token=demo"))),
        ("Welcome",                  lambda: _send(to, "[TEST] Welcome", T.WELCOME_EMAIL(NAME))),
        ("Welcome with stats",       lambda: _send(to, "[TEST] Welcome (stats)", T.WELCOME_WITH_STATS(NAME, 1280, 96, 7))),
        ("Email verified welcome",   lambda: _send(to, "[TEST] Email verified", T.EMAIL_VERIFIED_WELCOME(NAME))),
        ("Account paused",           lambda: _send(to, "[TEST] Account paused", T.ACCOUNT_PAUSED_EMAIL(NAME, "Multiple buyer reports."))),
        ("Account suspended",        lambda: _send(to, "[TEST] Account suspended", T.ACCOUNT_SUSPENDED_EMAIL(NAME, "Policy violation."))),
        ("Account banned",          lambda: _send(to, "[TEST] Account banned", T.ACCOUNT_BANNED_EMAIL(NAME, "Fraudulent activity."))),
        ("Account deleted",          lambda: _send(to, "[TEST] Account deleted", T.ACCOUNT_DELETED_EMAIL(NAME))),
        ("Account reactivated",      lambda: _send(to, "[TEST] Account reactivated", T.ACCOUNT_REACTIVATED_EMAIL(NAME))),
        ("Seller self-paused",       lambda: _send(to, "[TEST] Seller paused", T.SELLER_SELF_PAUSED_EMAIL(NAME))),
        ("Seller downgrade",         lambda: _send(to, "[TEST] Downgraded", T.SELLER_DOWNGRADE_EMAIL(NAME))),
        ("Reactivation request",     lambda: _send(to, "[TEST] Reactivation request", T.REACTIVATION_REQUEST_EMAIL(NAME))),
        ("Deletion request",         lambda: _send(to, "[TEST] Deletion request", T.DELETION_REQUEST_EMAIL(NAME))),
        ("Verification approved",    lambda: _send(to, "[TEST] Verified seller", T.VERIFICATION_APPROVED_EMAIL(NAME))),
        ("Verification rejected",    lambda: _send(to, "[TEST] Verification failed", T.VERIFICATION_REJECTED_EMAIL(NAME, "Documents could not be verified."))),
        ("Listing flagged",          lambda: _send(to, "[TEST] Listing flagged", T.LISTING_FLAGGED_EMAIL(NAME, "iPhone 15 Pro", "Reported by a user."))),
        ("Listing removed",          lambda: _send(to, "[TEST] Listing removed", T.LISTING_REMOVED_EMAIL(NAME, "iPhone 15 Pro", "Confirmed policy breach."))),
        ("Announcement",             lambda: _send(to, "[TEST] Announcement", T.ANNOUNCEMENT_EMAIL(NAME, "We just shipped Flash Sales!", "Sellers can now run time-limited discounts.\nCheck it out today.", "Open Campify", "/deals"))),
        ("Seller verification ack",  lambda: _send(to, "[TEST] Verification submitted", T.SELLER_VERIFICATION_SUBMITTED_EMAIL(NAME))),
    ]

    ok = 0
    for label, factory in jobs:
        try:
            result = await factory()
            sent = result is None or result is True
            print(f"  [{'OK ' if sent else 'FAIL'}]  {label}")
            ok += 1 if sent else 0
        except Exception as e:
            print(f"  [FAIL]  {label}  -- {type(e).__name__}: {e}")
        await asyncio.sleep(0.6)  # stay under Resend's rate limit

    print(f"\nDone — {ok}/{len(jobs)} sent. Check {to}.")


if __name__ == "__main__":
    asyncio.run(_run())
