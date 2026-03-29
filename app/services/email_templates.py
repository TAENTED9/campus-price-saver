"""
Block 7 — Plain-text email templates for user lifecycle events.
All templates are short — students read these on mobile.
"""

APP_URL = "https://campify.ng"


def ACCOUNT_PAUSED_EMAIL(name: str, reason: str) -> str:
    return f"""Hi {name},

Your Campify account has been paused by our team.

Reason: {reason}

Your listings are now hidden from buyers.
To appeal or request reactivation, reply to this email
or visit {APP_URL}/support.

— The Campify Team"""


def ACCOUNT_DELETED_EMAIL(name: str) -> str:
    return f"""Hi {name},

Your Campify account has been permanently deleted
as requested. All your data has been removed.

If this was a mistake, contact hello@campify.ng
within 7 days — we may be able to restore your data.

— The Campify Team"""


def ACCOUNT_REACTIVATED_EMAIL(name: str) -> str:
    return f"""Hi {name},

Great news — your Campify account has been reactivated!

You can now log in and your listings are live again.
Visit: {APP_URL}

— The Campify Team"""


def SELLER_SELF_PAUSED_EMAIL(name: str) -> str:
    return f"""Hi {name},

Your seller account is now paused.
All your listings have been hidden from buyers.

To reactivate, go to:
Settings > Account > Request Reactivation

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
    return f"""Hi {name},

Congratulations! Your seller account has been verified.

Your "Verified UNILAG Seller" badge is now live.
Start listing at: {APP_URL}/seller/listings/new

— The Campify Team"""


def VERIFICATION_REJECTED_EMAIL(name: str, reason: str) -> str:
    return f"""Hi {name},

We were unable to verify your seller account.

Reason: {reason}

You can resubmit your documents at:
{APP_URL}/seller/settings > Verification

If you think this is an error, reply to this email.

— The Campify Team"""
