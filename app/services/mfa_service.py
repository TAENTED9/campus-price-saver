"""
app/services/mfa_service.py — TOTP / MFA helpers (Block 10).

All TOTP operations live here so the auth router stays clean.
"""
import io
import base64

import pyotp
import qrcode

APP_NAME = "Campify"


def generate_totp_secret() -> str:
    """Generate a cryptographically-random Base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Return the otpauth:// URI for provisioning any TOTP authenticator app."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=APP_NAME)


def generate_qr_code_base64(uri: str) -> str:
    """
    Render the provisioning URI as a QR code and return a base64-encoded PNG.
    Safe to embed directly in an <img src="data:image/png;base64,..." />.
    """
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against *secret*.
    valid_window=1 tolerates ±30 seconds of clock drift between
    the server and the user's authenticator app.
    """
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code.strip(), valid_window=1)
