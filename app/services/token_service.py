"""
app/services/token_service.py — Secure refresh-token management (Block 9).

Design:
  - Access tokens: short-lived JWT (15 min), returned in JSON body.
  - Refresh tokens: long-lived opaque token, stored as SHA-256 hash in DB,
    delivered via HttpOnly cookie. Raw token is NEVER stored.
  - Token rotation: every /refresh call revokes the incoming token and
    issues a new one. Using an already-revoked token triggers full revocation
    of all user tokens (theft detection).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from fastapi import Response

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.models import User

# ── Expiry constants ──────────────────────────────────────────────────────────

ACCESS_TOKEN_EXPIRE_MINUTES  = 15
REFRESH_TOKEN_REMEMBER_DAYS  = 30
REFRESH_TOKEN_SESSION_HOURS  = 24

# ── Cookie constants ──────────────────────────────────────────────────────────

COOKIE_NAME          = "campify_refresh"
COOKIE_MAX_AGE_FULL  = REFRESH_TOKEN_REMEMBER_DAYS * 24 * 60 * 60   # 30 days in seconds
COOKIE_MAX_AGE_SESSION: int | None = None                            # None = browser session cookie (no Max-Age header)


# ── Token generation ──────────────────────────────────────────────────────────

def generate_refresh_token() -> str:
    """Return a 64-byte URL-safe random token."""
    return secrets.token_urlsafe(64)


def hash_token(raw_token: str) -> str:
    """SHA-256 of raw_token. This is all that is persisted."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_access_token(user_id: int, role: str, uuid: str) -> str:
    """
    Short-lived JWT (15 min).
    Payload: sub=uuid, uid=user_id, role, type=access, iat, exp.
    """
    import jwt as pyjwt
    from app.config import settings

    now = datetime.now(timezone.utc)
    payload = {
        "sub":  uuid,
        "uid":  user_id,
        "role": role,
        "type": "access",
        "iat":  now,
        "exp":  now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ── MFA temp-token (Block 10D) ────────────────────────────────────────────────

MFA_TEMP_TOKEN_EXPIRE_MINUTES = 5


def create_mfa_temp_token(user_id: int) -> str:
    """
    Issue a short-lived JWT (5 min) with type='mfa_pending'.
    Returned instead of a full access token when the user has MFA enabled.
    The frontend exchanges this + a valid TOTP code for a real access token.
    """
    import jwt as pyjwt
    from app.config import settings

    now = datetime.now(timezone.utc)
    payload = {
        "uid":  user_id,
        "type": "mfa_pending",
        "iat":  now,
        "exp":  now + timedelta(minutes=MFA_TEMP_TOKEN_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_mfa_temp_token(token: str) -> int | None:
    """
    Validate a mfa_pending JWT and return the user_id, or None if invalid/expired.
    """
    import jwt as pyjwt
    from app.config import settings

    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "mfa_pending":
            return None
        return int(payload["uid"])
    except Exception:
        return None


# ── Refresh-token CRUD ────────────────────────────────────────────────────────

def create_refresh_token(
    user: "User",
    db: "Session",
    *,
    remember_me: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> str:
    """
    Persist a hashed refresh token and return the raw token to set in cookie.
    This is the ONLY time the raw token is visible — it is returned once and
    never stored.
    """
    from app.models import RefreshToken

    raw_token  = generate_refresh_token()
    token_hash = hash_token(raw_token)

    expire_days = (
        REFRESH_TOKEN_REMEMBER_DAYS
        if remember_me
        else REFRESH_TOKEN_SESSION_HOURS / 24
    )
    expires_at = datetime.now(timezone.utc) + timedelta(days=expire_days)

    record = RefreshToken(
        user_id     = user.id,
        token_hash  = token_hash,
        expires_at  = expires_at,
        ip_address  = ip_address,
        user_agent  = user_agent,
        remember_me = remember_me,  # FIND-27
    )
    db.add(record)
    db.commit()
    return raw_token


def rotate_refresh_token(
    raw_token: str,
    db: "Session",
    *,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, "User"] | None:
    """
    Validate → revoke → issue new token.
    Returns (new_raw_token, user) or None if the token is invalid/expired.

    If the supplied token is already revoked, ALL tokens for that user are
    revoked immediately (token-theft detection).
    """
    from app.models import RefreshToken, User

    token_hash = hash_token(raw_token)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()

    if not record:
        return None

    now = datetime.now(timezone.utc)

    if record.revoked:
        db.query(RefreshToken).filter(
            RefreshToken.user_id == record.user_id,
            RefreshToken.revoked == False,
        ).update({
            "revoked":    True,
            "revoked_at": now,
        })
        db.commit()
        return None

    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        return None

    record.revoked    = True
    record.revoked_at = now
    db.commit()

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user or getattr(user, "is_deleted", False) or getattr(user, "is_paused", False):
        return None

    prev_remember_me = getattr(record, "remember_me", False)  # FIND-27: preserve preference
    new_raw  = generate_refresh_token()
    new_hash = hash_token(new_raw)
    new_expire_days = (
        REFRESH_TOKEN_REMEMBER_DAYS
        if prev_remember_me
        else REFRESH_TOKEN_SESSION_HOURS / 24
    )
    new_record = RefreshToken(
        user_id     = user.id,
        token_hash  = new_hash,
        expires_at  = now + timedelta(days=new_expire_days),
        ip_address  = ip_address,
        user_agent  = user_agent,
        remember_me = prev_remember_me,  # FIND-27
    )
    db.add(new_record)
    db.commit()
    return new_raw, user, prev_remember_me


def revoke_all_user_tokens(user_id: int, db: "Session") -> None:
    """Revoke every active refresh token for a user (logout / password change)."""
    from app.models import RefreshToken

    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False,
    ).update({
        "revoked":    True,
        "revoked_at": now,
    })
    db.commit()


# ── Cookie helpers ────────────────────────────────────────────────────────────

def set_refresh_cookie(
    response: Response,
    raw_token: str,
    *,
    remember_me: bool,
    is_production: bool,
) -> None:
    """
    Attach the refresh token as an HttpOnly cookie.
    Uses SameSite=None; Secure in production (supports cross-subdomain deploys).
    Falls back to SameSite=Lax in development (HTTP-safe).
    Restricted to /api/auth so it is never sent on non-auth requests.
    """
    response.set_cookie(
        key      = COOKIE_NAME,
        value    = raw_token,
        httponly = True,
        secure   = is_production,
        samesite = "none" if is_production else "lax",
        max_age  = COOKIE_MAX_AGE_FULL if remember_me else None,  # None = proper session cookie, not max_age=0 which deletes it
        path     = "/",
    )


def clear_refresh_cookie(response: Response) -> None:
    """Delete the refresh cookie (logout / forced sign-out)."""
    from app.config import settings as _cfg
    _prod = getattr(_cfg, "IS_PRODUCTION", True)
    response.delete_cookie(
        key      = COOKIE_NAME,
        httponly = True,
        secure   = _prod,
        samesite = "none" if _prod else "lax",
        path     = "/",
    )
