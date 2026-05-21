"""
Authentication Router — JWT + Argon2
Handles register, login, admin login, profile, OTP email verification.
"""

import asyncio
import os
import json
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import User
from app.limiter import limiter

from dotenv import load_dotenv

# Argon2 for password hashing
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError, InvalidHash
    ARGON2_AVAILABLE = True
except ImportError:
    ARGON2_AVAILABLE = False

# PyJWT
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

load_dotenv()

logger = logging.getLogger("campify")

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer()

# ── Configuration ────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
ADMIN_USERNAMES_STR = os.getenv("ADMIN_USERNAMES", '["admin"]')
# FRONTEND_URL is read via settings.FRONTEND_URL (lazy) so local / preview domains work
from app.config import settings as _cfg

try:
    ADMIN_USERNAMES = json.loads(ADMIN_USERNAMES_STR)
except (json.JSONDecodeError, TypeError) as e:
    logger.warning(f"ADMIN_USERNAMES env var malformed: {e}. Defaulting to ['admin']")
    ADMIN_USERNAMES = ["admin"]

# ── Argon2 hasher ─────────────────────────────────────────────────────────────

if ARGON2_AVAILABLE:
    ph = PasswordHasher(
        time_cost=2,
        memory_cost=65536,
        parallelism=1,
        hash_len=32,
        salt_len=16,
    )

# ── DB helper ─────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    if not ARGON2_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password hashing not available. Install argon2-cffi",
        )
    if not password:
        raise ValueError("Password cannot be empty")
    try:
        return ph.hash(password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to hash password: {str(e)}",
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not ARGON2_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password verification not available. Install argon2-cffi",
        )
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError:
        return False
    except InvalidHash:
        return False
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False


def needs_rehash(hashed_password: str) -> bool:
    if not ARGON2_AVAILABLE:
        return False
    try:
        return ph.check_needs_rehash(hashed_password)
    except Exception as e:
        logger.debug(f"needs_rehash check failed: {e}")
        return False

# ── JWT tokens ────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    if not JWT_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT not available. Install pyjwt",
        )
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    try:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create token: {str(e)}",
        )


def decode_access_token(token: str) -> dict:
    if not JWT_AVAILABLE:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT not available")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ── Auth dependencies ─────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("uid")                         # Block 9 new token format
    if user_id is None:
        raw = payload.get("sub")
        try:
            user_id = int(raw)                            # old token format fallback
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Block 4B — lifecycle guards
    if getattr(user, "is_deleted", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="This account no longer exists.")
    if getattr(user, "is_paused", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCOUNT_PAUSED",
                "message": (
                    "Your account is currently inactive. "
                    "To reactivate, contact support at hello@campify.ng "
                    "or submit a reactivation request."
                ),
                "paused_by": getattr(user, "paused_by", None),
                "paused_at": user.paused_at.isoformat() if getattr(user, "paused_at", None) else None,
            },
        )

    if getattr(user, "is_banned", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been permanently banned.")
    if getattr(user, "is_suspended", False):
        until = getattr(user, "suspended_until", None)
        if until and until > datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Your account is suspended until {until.isoformat()}.")
        else:
            user.is_suspended = False
            user.suspended_until = None
            user.suspension_reason = None
            db.commit()
    return user


async def get_user_allow_paused(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Block 5D — Same as get_current_user but skips the is_paused guard.
    Used only on reactivation-request and deletion-request endpoints so
    paused users can still submit those actions.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("uid")                         # Block 9 new token format
    if user_id is None:
        raw = payload.get("sub")
        try:
            user_id = int(raw)                            # old token format fallback
        except (ValueError, TypeError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if getattr(user, "is_deleted", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="This account no longer exists.")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

# ── Request / response schemas ────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    role: Optional[str] = "user"

    @field_validator("username")
    @classmethod
    def username_validator(cls, v: str) -> str:
        if not v or len(v.strip()) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 50:
            raise ValueError("Username too long (max 50 characters)")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_validator(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        return v

    @field_validator("role")
    @classmethod
    def role_validator(cls, v: Optional[str]) -> str:
        allowed = {"user", "seller"}
        if v not in allowed:
            raise ValueError(f"role must be one of: {', '.join(allowed)}")
        return v


class UserLoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()


class AdminLoginRequest(BaseModel):
    username: str
    admin_key: str


class LoginResponse(BaseModel):
    success: bool
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    user_role: Optional[str] = None
    access_token: Optional[str] = None      # None when mfa_required=True
    token_type: str = "bearer"
    message: str
    # Block 10 — MFA two-step login
    mfa_required: bool = False
    temp_token: Optional[str] = None        # Short-lived JWT returned when mfa_required
    # Block 4A — settings rehydration on login
    settings: Optional[dict] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        return v


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    level: Optional[str] = None
    bio: Optional[str] = None
    banner_url: Optional[str] = None
    availability_status: Optional[str] = None
    avatar_url: Optional[str] = None


class PriceAlertCreate(BaseModel):
    item_name: str
    target_price: float
    category_id: Optional[int] = None
    max_distance_km: Optional[float] = None


class OTPRequest(BaseModel):
    email: str


class OTPVerifyRequest(BaseModel):
    email: str
    otp: str


class ResendVerifyRequest(BaseModel):
    email: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    email: str
    password: str = Field(..., min_length=8, max_length=128)


class SettingsUpdateRequest(BaseModel):
    dark_mode: Optional[bool] = None
    profile_visibility: Optional[str] = None
    show_dept: Optional[bool] = None
    read_receipts: Optional[bool] = None


class NotifPrefsUpdateRequest(BaseModel):
    msg_email: Optional[bool] = None
    msg_push: Optional[bool] = None
    price_email: Optional[bool] = None
    price_push: Optional[bool] = None
    announce_email: Optional[bool] = None
    announce_push: Optional[bool] = None


# ── Block 10: MFA request schemas ───────────────────────────────────────────

class MFAConfirmRequest(BaseModel):
    code: str


class MFAVerifyRequest(BaseModel):
    code: str
    temp_token: str


class MFADisableRequest(BaseModel):
    code: str


class MFASetupPasswordRequest(BaseModel):
    password: str


# ── Login notification helpers ────────────────────────────────────────────────

def _parse_device(ua: str) -> str:
    ua = ua.lower()
    browser = (
        "Chrome"  if "chrome"   in ua else
        "Firefox" if "firefox"  in ua else
        "Safari"  if "safari"   in ua else
        "Browser"
    )
    os_ = (
        "iPhone"  if "iphone"  in ua else
        "Android" if "android" in ua else
        "Windows" if "windows" in ua else
        "Mac"     if "mac"     in ua else
        "Linux"   if "linux"   in ua else
        "Unknown device"
    )
    return f"{browser} on {os_}"


async def _post_login_tasks(
    user_id: int,
    email: str,
    name: str,
    ip: str,
    user_agent: str,
) -> None:
    """Runs in background after a successful login: records history + emails user."""
    from app.database import SessionLocal
    from app.models import LoginHistory
    from app.services.admin_notifications import send_user_email_bg
    from app.services.email_templates import NEW_LOGIN_EMAIL

    db = SessionLocal()
    try:
        device = _parse_device(user_agent)
        record = LoginHistory(
            user_id=user_id,
            ip_address=ip,
            user_agent=user_agent,
            device=device,
            logged_in_at=datetime.utcnow(),
            was_notified=True,
        )
        db.add(record)
        db.commit()

        if email:
            await send_user_email_bg(
                email,
                "New login to your Campify account",
                NEW_LOGIN_EMAIL(
                    name=name,
                    device=device,
                    ip=ip,
                    time=datetime.utcnow().strftime("%d %b %Y at %H:%M UTC"),
                ),
            )
    except Exception as e:
        logger.warning(f"[post_login_tasks] failed for user {user_id}: {e}")
    finally:
        db.close()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register")
@limiter.limit("3/15minutes")
async def register_user(
    request: Request,
    body: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register new user. Returns a pending-verification response — NO JWT.
    A verification link is emailed; user must click it before they can log in.
    """
    existing_user = db.query(User).filter(User.username == body.username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    if body.email:
        existing_email = db.query(User).filter(User.email == body.email).first()
        if existing_email:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        password_hash = hash_password(body.password)

        # If no email supplied, mark immediately verified (settings-page OTP can verify later)
        no_email = not body.email
        initial_role = body.role or "user"
        new_user = User(
            username=body.username,
            password_hash=password_hash,
            email=body.email,
            display_name=body.username,
            role=initial_role,
            email_verified=no_email,          # verified=True only when no email
            created_at=datetime.utcnow(),
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Block 4B — create per-user isolated tables and seed defaults
        try:
            from app.services.user_db import create_user_tables, upsert_user_data, log_user_activity
            from app.database import engine as _engine
            create_user_tables(new_user.id, _engine)
            upsert_user_data(new_user.id, "profile", {
                "username":   new_user.username,
                "email":      new_user.email or "",
                "role":       initial_role,
                "created_at": new_user.created_at.isoformat(),
            }, _engine)
            upsert_user_data(new_user.id, "settings", {
                "dark_mode":          "false",
                "profile_visibility": "unilag",
                "show_dept":          "true",
                "read_receipts":      "true",
            }, _engine)
            upsert_user_data(new_user.id, "notif_prefs", {
                "msg_email":      "true",
                "msg_push":       "true",
                "price_email":    "true",
                "price_push":     "false",
                "announce_email": "true",
                "announce_push":  "true",
            }, _engine)
            log_user_activity(new_user.id, "account_created",
                              {"email": new_user.email}, None, _engine)
        except Exception as ue:
            logger.warning(f"[register] per-user table setup failed for {new_user.id}: {ue}")

        # Block 1B — generate verification token and send email
        if body.email:
            verify_token = secrets.token_urlsafe(32)
            new_user.email_verify_token = verify_token
            new_user.email_verify_token_exp = datetime.utcnow() + timedelta(hours=24)
            db.commit()

            link = f"{_cfg.FRONTEND_URL}/verify-email?token={verify_token}&email={body.email}"
            # Block 7: enqueue verification email via Celery so registration
            # is non-blocking and survives Resend outages (retries with backoff).
            try:
                from app.tasks.email_tasks import send_verification_email
                send_verification_email.delay(
                    to=body.email,
                    name=body.username,
                    link=link,
                )
            except Exception as ee:
                logger.warning(f"[register] verification email enqueue failed: {ee}")

        # Block 2D — notify admin (fire-and-forget)
        try:
            from app.services.admin_notifications import notify_admin
            await notify_admin(
                db, "new_user", new_user.id,
                new_user.email or "", "user",
                {"username": new_user.username,
                 "registered_at": new_user.created_at.isoformat()},
            )
        except Exception:
            pass

        if no_email:
            # No email — issue JWT immediately (verified by default)
            access_token = create_access_token(
                data={"sub": str(new_user.id), "username": new_user.username, "role": initial_role}
            )
            return LoginResponse(
                success=True,
                user_id=new_user.id,
                user_name=new_user.username,
                user_role=initial_role,
                access_token=access_token,
                token_type="bearer",
                message=f"Welcome to Campify, {body.username}!",
            )

        return {
            "success": True,
            "verified": False,
            "email": body.email,
            "message": (
                "Account created. Check your email to verify "
                "your account before logging in."
            ),
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}",
        )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/15minutes")
async def login_user(
    request: Request,
    response: Response,
    body: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """Login with username and password. Returns JWT valid for 24 hours."""
    if not body.username or not body.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Username and password are required")

    from sqlalchemy import or_ as _or
    user = db.query(User).filter(
        _or(User.username == body.username, User.email == body.username)
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid username or password")

    try:
        # FIND-26: admin-only accounts have no password_hash
        if not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account uses admin-only authentication",
            )
        if not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid username or password")

        # Lifecycle checks before issuing any token
        if getattr(user, "is_deleted", False):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Account no longer exists")
        if getattr(user, "is_paused", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCOUNT_PAUSED",
                    "message": "Your account is currently paused.",
                    "pause_reason": getattr(user, "pause_reason", None),
                },
            )
        if not getattr(user, "is_active", True):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Account is not active")

        # Block 1E — block login until email is verified
        if not getattr(user, "email_verified", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "EMAIL_NOT_VERIFIED",
                    "message": (
                        "Please verify your email before logging in. "
                        "Check your inbox for the verification link."
                    ),
                    "email": user.email,
                },
            )

        if needs_rehash(user.password_hash):
            try:
                user.password_hash = hash_password(body.password)
                db.add(user)
                db.commit()
            except Exception as e:
                logger.warning(f"Password rehash failed for user {user.id}: {e}")

        # Block 10D — gate login when MFA is enabled
        if getattr(user, "mfa_enabled", False):
            from app.services.token_service import create_mfa_temp_token
            temp_token = create_mfa_temp_token(user.id)
            return LoginResponse(
                success=True,
                mfa_required=True,
                temp_token=temp_token,
                message="MFA verification required.",
            )

        # Block 9 — short-lived JWT + HttpOnly refresh-token cookie
        from app.services.token_service import (
            create_access_token as ts_create_token,
            create_refresh_token, set_refresh_cookie,
        )
        from app.config import settings as _settings

        client_ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        access_token = ts_create_token(user.id, user.role, str(user.uuid or user.id))
        raw_refresh = create_refresh_token(
            user=user, db=db,
            remember_me=body.remember_me,
            ip_address=client_ip, user_agent=ua,
        )
        set_refresh_cookie(response, raw_refresh, remember_me=body.remember_me, is_production=_settings.IS_PRODUCTION)

        # Block 2B — record login history and send security email (fire-and-forget)
        if user.role != "admin":
            asyncio.create_task(_post_login_tasks(
                user.id,
                user.email or "",
                user.display_name or user.username or "",
                client_ip or "Unknown",
                ua or "Unknown",
            ))

        from app.services.settings_service import (
            get_or_create_settings as _gocs,
            serialize_settings as _ss,
        )
        _settings_data = _ss(_gocs(user, db))

        return LoginResponse(
            success=True,
            user_id=user.id,
            user_name=user.username,
            user_role=user.role,
            access_token=access_token,
            token_type="bearer",
            message=f"Welcome back, {user.username}!",
            settings=_settings_data,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}",
        )


# ── Block 10: MFA endpoints ──────────────────────────────────────────────────

@router.post("/mfa/setup")
@limiter.limit("5/15minutes")
async def mfa_setup(
    request: Request,
    body: MFASetupPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 1 of MFA enrollment: verify current password, generate TOTP secret,
    store it as pending in profile metadata, return QR code + manual entry key.
    """
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password")

    if getattr(current_user, "mfa_enabled", False):
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    from app.services.mfa_service import generate_totp_secret, get_totp_uri, generate_qr_code_base64
    from app.services.metadata import ensure_profile, patch_metadata

    secret = generate_totp_secret()
    uri    = get_totp_uri(secret, current_user.email or current_user.username or "")
    qr     = generate_qr_code_base64(uri)

    profile = ensure_profile(db, current_user.id)
    patch_metadata(db, profile, {"mfa_pending_secret": secret})

    return {
        "qr_code": qr,
        "secret": secret,
        "manual_entry": secret,
    }


@router.post("/mfa/confirm")
@limiter.limit("10/15minutes")
async def mfa_confirm(
    request: Request,
    body: MFAConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Step 2 of MFA enrollment: user scans QR code and submits first TOTP code.
    On success, MFA is enabled and 8 one-time backup codes are returned.
    Backup code hashes are stored in user.mfa_backup_codes.
    """
    from app.services.mfa_service import verify_totp
    from app.services.metadata import ensure_profile, get_metadata, patch_metadata
    from app.services.token_service import hash_token
    import secrets as _sec

    profile = ensure_profile(db, current_user.id)
    pending = get_metadata(profile, "mfa_pending_secret")

    if not pending:
        raise HTTPException(status_code=400, detail="No pending MFA setup. Call /mfa/setup first.")

    if not verify_totp(pending, body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    backup_codes   = [_sec.token_hex(5).upper() for _ in range(8)]
    backup_hashes  = [hash_token(c) for c in backup_codes]

    current_user.mfa_secret       = pending
    current_user.mfa_enabled      = True
    current_user.mfa_backup_codes = backup_hashes
    patch_metadata(db, profile, {"mfa_pending_secret": None})
    db.add(current_user)
    db.commit()

    return {
        "backup_codes": backup_codes,
        "message": "MFA enabled. Save these backup codes in a safe place — they cannot be shown again.",
    }


@router.post("/mfa/verify")
@limiter.limit("10/15minutes")
async def mfa_verify(
    request: Request,
    response: Response,
    body: MFAVerifyRequest,
    db: Session = Depends(get_db),
):
    """
    Step 2 of the two-step login flow for MFA users.
    Validates temp_token (mfa_pending JWT) + TOTP or backup code,
    then issues a full access token + refresh cookie.
    """
    from app.services.mfa_service import verify_totp
    from app.services.token_service import (
        decode_mfa_temp_token,
        create_access_token as ts_create_token,
        create_refresh_token, set_refresh_cookie,
        hash_token,
    )
    from app.config import settings as _settings

    user_id = decode_mfa_temp_token(body.temp_token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA session. Please log in again.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not getattr(user, "mfa_enabled", False):
        raise HTTPException(status_code=401, detail="Invalid MFA session")
    # FIND-18: lifecycle guards for MFA verify
    if getattr(user, "is_deleted", False):
        raise HTTPException(status_code=401, detail="Account no longer exists")
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Account is not active")
    if getattr(user, "is_paused", False):
        raise HTTPException(
            status_code=403,
            detail={"code": "ACCOUNT_PAUSED", "message": "Account is paused"},
        )

    code = body.code.strip().upper()

    # Try TOTP first
    totp_valid = verify_totp(user.mfa_secret, body.code)

    # Try backup codes if TOTP failed
    backup_used = False
    if not totp_valid:
        stored = list(user.mfa_backup_codes or [])
        code_hash = hash_token(code)
        if code_hash in stored:
            stored.remove(code_hash)
            user.mfa_backup_codes = stored
            db.add(user)
            db.commit()
            backup_used = True
        else:
            raise HTTPException(status_code=400, detail="Invalid authentication code")

    access_token = ts_create_token(user.id, user.role, str(user.uuid or user.id))
    client_ip    = request.client.host if request.client else None
    ua           = request.headers.get("user-agent")
    raw_refresh  = create_refresh_token(
        user=user, db=db,
        remember_me=False,
        ip_address=client_ip, user_agent=ua,
    )
    set_refresh_cookie(response, raw_refresh, remember_me=False, is_production=_settings.IS_PRODUCTION)

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "backup_used": backup_used,
        "remaining_backup_codes": len(user.mfa_backup_codes or []),
    }


@router.post("/mfa/disable")
@limiter.limit("5/15minutes")
async def mfa_disable(
    request: Request,
    body: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disable MFA. Requires a valid TOTP code from the authenticator app
    (or a valid backup code) to confirm intent.
    """
    from app.services.mfa_service import verify_totp
    from app.services.token_service import hash_token

    if not getattr(current_user, "mfa_enabled", False):
        raise HTTPException(status_code=400, detail="MFA is not enabled")

    code = body.code.strip().upper()
    totp_valid = verify_totp(current_user.mfa_secret, body.code)

    if not totp_valid:
        stored = list(current_user.mfa_backup_codes or [])
        if hash_token(code) not in stored:
            raise HTTPException(status_code=400, detail="Invalid authentication code")

    current_user.mfa_enabled      = False
    current_user.mfa_secret       = None
    current_user.mfa_backup_codes = None
    db.add(current_user)
    db.commit()

    return {"success": True, "message": "MFA has been disabled"}


# ── Password Reset (Block 15) ──────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Always returns 200 to avoid leaking whether an email is registered.
    Generates a 1-hour reset token and emails a link.
    """
    _silent = {"message": "If that email is registered, a reset link has been sent."}
    user = db.query(User).filter(
        User.email == body.email.strip().lower()
    ).first()
    if not user or not getattr(user, "email_verified", False):
        return _silent

    reset_token = secrets.token_urlsafe(32)
    user.password_reset_token     = reset_token
    user.password_reset_token_exp = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    link = (
        f"{_cfg.FRONTEND_URL}/reset-password"
        f"?token={reset_token}&email={user.email}"
    )
    try:
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import PASSWORD_RESET_EMAIL
        await send_user_email_bg(
            user.email,
            "Reset your Campify password",
            PASSWORD_RESET_EMAIL(user.display_name or user.username or "there", link),
        )
    except Exception:
        pass

    return _silent


@router.post("/reset-password")
@limiter.limit("5/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Validate the reset token and email, then set the new password.
    All existing refresh tokens for the user are revoked immediately.
    """
    user = db.query(User).filter(
        User.password_reset_token == body.token
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if user.password_reset_token_exp and user.password_reset_token_exp < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="This reset link has expired. Request a new one.",
        )

    if user.email and user.email.lower() != body.email.strip().lower():
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    user.password_hash           = hash_password(body.password)
    user.password_reset_token     = None
    user.password_reset_token_exp = None
    db.commit()

    from app.services.token_service import revoke_all_user_tokens
    revoke_all_user_tokens(user.id, db)

    return {"success": True, "message": "Password reset successfully. You can now log in."}


@router.post("/admin", response_model=LoginResponse)
@limiter.limit("3/15minutes")
async def login_admin(
    request: Request,
    response: Response,
    data: AdminLoginRequest,
    db: Session = Depends(get_db),
):
    """Admin login — verified against ADMIN_USERNAMES + ADMIN_API_KEY env vars."""
    if not data.username or not data.admin_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Username and admin key are required")

    if data.username not in ADMIN_USERNAMES:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid admin credentials")

    if not ADMIN_API_KEY or data.admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid admin credentials")

    admin_user = db.query(User).filter(User.username == data.username).first()
    if not admin_user:
        admin_user = User(
            username=data.username,
            display_name=data.username.replace("_", " ").title(),
            role="admin",
            password_hash=None,  # FIND-26: admin accounts have no password
            created_at=datetime.utcnow(),
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    if admin_user.role != "admin":
        admin_user.role = "admin"
        db.commit()

    # FIND-11: use token_service for short-lived token + refresh cookie
    from app.services.token_service import (
        create_access_token as ts_create_token,
        create_refresh_token, set_refresh_cookie,
    )
    from app.config import settings as _settings_admin

    client_ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    access_token = ts_create_token(admin_user.id, "admin", str(admin_user.uuid or admin_user.id))
    raw_refresh = create_refresh_token(
        user=admin_user, db=db,
        remember_me=False,
        ip_address=client_ip, user_agent=ua,
    )
    set_refresh_cookie(response, raw_refresh, remember_me=False, is_production=_settings_admin.IS_PRODUCTION)
    admin_name = data.username.replace("_", " ").title()
    return LoginResponse(
        success=True,
        admin_id=admin_user.id,
        admin_name=admin_name,
        user_role="admin",
        access_token=access_token,
        token_type="bearer",
        message=f"Welcome back, Administrator {admin_name}!",
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block 9 — revoke all refresh tokens for this user and clear the HttpOnly cookie."""
    from app.services.token_service import revoke_all_user_tokens, clear_refresh_cookie
    revoke_all_user_tokens(current_user.id, db)
    clear_refresh_cookie(response)
    return {"success": True, "message": "Logged out successfully"}


# Block 1C — verify email via link token
@router.get("/verify-email")
async def verify_email(token: str, db: Session = Depends(get_db)):
    """Called when user clicks the verification link in their email."""
    user = db.query(User).filter(User.email_verify_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

    if user.email_verify_token_exp and user.email_verify_token_exp < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Verification link has expired. Request a new one.",
        )

    if getattr(user, "email_verified", False):
        return {
            "message": "Already verified. Please log in.",
            "redirect": "/signin",
        }

    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    user.email_verify_token = None
    user.email_verify_token_exp = None

    # Award karma for email verification
    from app.models import PointsTransaction
    _email_pts = 20
    user.seller_points = max(0, (user.seller_points or 0) + _email_pts)
    db.add(PointsTransaction(user_id=user.id, amount=_email_pts, reason="email_verified"))
    db.commit()

    # Send welcome email with platform stats
    try:
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import WELCOME_WITH_STATS
        from app.models import Price, Category

        total_listings = db.query(Price).filter(Price.status == "approved").count()
        total_sellers = db.query(User).filter(User.role == "seller", User.is_deleted == False).count()
        total_categories = db.query(Category).count()

        await send_user_email_bg(
            user.email or "",
            "Welcome to Campify!",
            WELCOME_WITH_STATS(
                name=user.display_name or user.username or "there",
                total_listings=total_listings,
                total_sellers=total_sellers,
                total_categories=total_categories,
            ),
        )
    except Exception as e:
        logger.warning(f"[verify-email] welcome email failed: {e}")

    return {
        "message": "Email verified successfully. You can now log in.",
        "redirect": f"/signin?verified=true&username={user.username or ''}",
        "email": user.email or "",
        "username": user.username or "",
    }


# Block 1D — resend verification link
@router.post("/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    body: ResendVerifyRequest,
    db: Session = Depends(get_db),
):
    """Rate-limited: 3 requests per hour. Never reveals whether the email exists."""
    _silent = {"message": "If that email exists, a new link was sent."}

    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user:
        return _silent
    if getattr(user, "email_verified", False):
        return {"message": "Email is already verified. Please log in."}

    verify_token = secrets.token_urlsafe(32)
    user.email_verify_token = verify_token
    user.email_verify_token_exp = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    link = f"{_cfg.FRONTEND_URL}/verify-email?token={verify_token}&email={user.email}"
    try:
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import EMAIL_VERIFY_TEMPLATE
        await send_user_email_bg(
            user.email,
            "New verification link - Campify",
            EMAIL_VERIFY_TEMPLATE(user.display_name or user.username or "there", link),
        )
    except Exception:
        pass

    return _silent


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.metadata import ensure_profile, get_all_metadata, get_ui_settings, get_notif_prefs
    from app.services.settings_service import get_or_create_settings as _gocs, serialize_settings as _ss
    from app.schemas.utils import serialize_dt
    from app.models import SellerVerification

    profile = ensure_profile(db, current_user.id)
    meta    = get_all_metadata(profile)
    ui      = get_ui_settings(profile)
    notif   = get_notif_prefs(profile)

    # Seller verification status
    verification_status = None
    if current_user.role == "seller":
        sv = (
            db.query(SellerVerification)
            .filter(SellerVerification.user_id == current_user.id)
            .order_by(SellerVerification.submitted_at.desc())
            .first()
        )
        if sv:
            verification_status = sv.status

    # FIX #1: `id` is the integer (used for internal/auth comparisons).
    # `uuid` is the public string identifier (used in URLs).
    # `numeric_id` is preserved as an alias for old callers.
    resp = {
        "id":             current_user.id,
        "uuid":           str(current_user.uuid) if current_user.uuid else None,
        "numeric_id":     current_user.id,
        "username":       current_user.username,
        "email":          current_user.email,
        "email_verified": getattr(current_user, "email_verified", False),
        "is_paused":      getattr(current_user, "is_paused", False),
        "display_name":   profile.display_name or current_user.display_name,
        "role":           current_user.role,
        "balance":        current_user.balance,
        "seller_points":  getattr(current_user, "seller_points", 0),
        "phone":          profile.phone or getattr(current_user, "phone", None),
        "avatar_url":     profile.avatar_url or getattr(current_user, "avatar_url", None),
        "department":     profile.department or getattr(current_user, "department", None),
        "level":          profile.level or getattr(current_user, "level", None),
        "bio":            profile.bio or getattr(current_user, "bio", None),
        "banner_url":     profile.banner_url or getattr(current_user, "banner_url", None),
        "faculty":        profile.faculty,
        "karma_tier":     profile.karma_tier or meta.get("karma_tier", "Bronze"),
        "availability_status": getattr(current_user, "availability_status", "open"),
        "trust_tier":     getattr(current_user, "trust_tier", "new_seller"),
        "response_rate":  getattr(current_user, "response_rate", 100.0),
        "avg_response_hours": getattr(current_user, "avg_response_hours", 0.0),
        "completion_rate": getattr(current_user, "completion_rate", 100.0),
        "vacation_mode":  getattr(current_user, "vacation_mode", False),
        "verification_status":  verification_status,
        "onboarding_completed": meta.get("onboarding_completed", False),
        "created_at":     serialize_dt(current_user.created_at),
        "settings":       _ss(_gocs(current_user, db)),
        "notif_prefs":    notif,
        "mfa_enabled":    getattr(current_user, "mfa_enabled", False),
    }
    if current_user.role == "seller":
        resp.update({
            "slug":          profile.slug,
            "business_name": profile.business_name,
            "category":      profile.category,
            "store_status":  profile.store_status,
            "whatsapp":      profile.whatsapp if profile.show_whatsapp else None,
            "instagram":     profile.instagram,
        })
    return resp


@router.put("/me")
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.display_name is not None:
        current_user.display_name = data.display_name.strip() or current_user.display_name
    if data.phone is not None:
        current_user.phone = data.phone.strip() or None
    if data.department is not None:
        current_user.department = data.department.strip() or None
    if data.level is not None:
        current_user.level = data.level.strip() or None
    if data.bio is not None:
        current_user.bio = data.bio.strip() or None
    if data.banner_url is not None:
        current_user.banner_url = data.banner_url.strip() or None
    if data.availability_status is not None and data.availability_status in ("open", "closed", "limited"):
        current_user.availability_status = data.availability_status
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url.strip() or None
    db.commit()
    db.refresh(current_user)

    # Block 4C — sync to per-user profile table
    try:
        from app.services.user_db import upsert_user_data, log_user_activity
        from app.database import engine as _engine
        upsert_user_data(current_user.id, "profile", {
            k: v for k, v in {
                "display_name": data.display_name,
                "phone":        data.phone,
                "department":   data.department,
                "level":        str(data.level) if data.level else None,
                "updated_at":   datetime.utcnow().isoformat(),
            }.items() if v is not None
        }, _engine)
        log_user_activity(current_user.id, "profile_updated",
                          data.model_dump(exclude_none=True), None, _engine)
    except Exception as pe:
        logger.warning(f"[update_profile] per-user sync failed: {pe}")

    return {
        "success": True,
        "message": "Profile updated",
        "display_name": current_user.display_name,
        "phone": current_user.phone,
        "department": current_user.department,
        "level": current_user.level,
        "bio": current_user.bio,
        "banner_url": current_user.banner_url,
        "avatar_url": current_user.avatar_url,
        "availability_status": current_user.availability_status,
    }


# Block 4C — settings and notification-preferences sync endpoints

@router.patch("/settings")
async def update_settings(
    request: Request,
    body: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block 8C — persist user settings via settings_service."""
    from app.services.settings_service import apply_settings_update, get_or_create_settings
    settings = get_or_create_settings(current_user, db)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items() if k != "client_version"}
    apply_settings_update(
        settings=settings,
        updates=updates,
        db=db,
        client_version=getattr(body, "client_version", None),
    )
    return {"message": "Settings saved"}


@router.patch("/notification-preferences")
async def update_notification_preferences(
    body: NotifPrefsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block 8D — persist notification preferences to profile.metadata_."""
    from app.services.metadata import ensure_profile, update_notif_prefs
    profile = ensure_profile(db, current_user.id)
    update_notif_prefs(db, profile, body.model_dump(exclude_none=True))
    return {"message": "Notification preferences saved"}


@router.post("/change-password")
@limiter.limit("5/15minutes")
async def change_password(
    request: Request,
    response: Response,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password. Requires the existing password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    from app.services.token_service import revoke_all_user_tokens, clear_refresh_cookie
    revoke_all_user_tokens(current_user.id, db)
    clear_refresh_cookie(response)
    return {"message": "Password updated successfully. All sessions have been revoked."}


@router.get("/sessions")
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block 2C — Returns real login history from login_history table."""
    from app.models import LoginHistory
    records = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id)
        .order_by(LoginHistory.logged_in_at.desc())
        .limit(10)
        .all()
    )
    return {
        "sessions": [
            {
                "id": str(r.id),
                "device": r.device or "Unknown device",
                "ip_address": r.ip_address,
                "logged_in_at": r.logged_in_at.isoformat() if r.logged_in_at else None,
                "current": i == 0,
            }
            for i, r in enumerate(records)
        ]
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revoke a single logged-in session by LoginHistory id.

    Block 2 — narrows refresh-token matching from IP-only to
    (IP + user_agent + ±60s timestamp window of the login) and refuses
    to revoke the caller's own active session (same IP + UA), which
    previously could happen when an admin reviewed sessions from the
    same network as another device.
    """
    from app.models import LoginHistory, RefreshToken as _RT
    if session_id == "current":
        raise HTTPException(status_code=400, detail="Cannot revoke current session here — use logout")
    try:
        session_id_int = int(session_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session ID")

    history = db.query(LoginHistory).filter(
        LoginHistory.id == session_id_int,
        LoginHistory.user_id == current_user.id,
    ).first()
    if not history:
        raise HTTPException(status_code=404, detail="Session not found")

    current_ip = request.client.host if request.client else None
    current_ua = request.headers.get("user-agent", "")
    if (
        current_ip
        and history.ip_address == current_ip
        and (history.user_agent or "") == current_ua
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot revoke your current session. Use logout instead.",
        )

    now = datetime.now(timezone.utc)
    window_start = history.logged_in_at - timedelta(seconds=60) if history.logged_in_at else None
    window_end   = history.logged_in_at + timedelta(seconds=60) if history.logged_in_at else None

    token_query = db.query(_RT).filter(
        _RT.user_id == current_user.id,
        _RT.revoked == False,
        _RT.ip_address == history.ip_address,
    )
    if window_start and window_end:
        token_query = token_query.filter(
            _RT.created_at >= window_start,
            _RT.created_at <= window_end,
        )
    tokens = token_query.all()
    for token in tokens:
        token.revoked = True
        token.revoked_at = now
    db.delete(history)
    db.commit()
    return {"message": "Session revoked successfully", "revoked": len(tokens)}


@router.post("/validate-token")
async def validate_token(current_user: User = Depends(get_current_user)):
    return {"valid": True, "user_id": current_user.id, "username": current_user.username, "role": current_user.role}


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    campify_refresh: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """Block 9 — rotate refresh token from HttpOnly cookie; return new short-lived JWT."""
    from app.services.token_service import (
        rotate_refresh_token,
        create_access_token as ts_create_token,
        set_refresh_cookie, clear_refresh_cookie,
    )
    from app.config import settings as _settings

    if not campify_refresh:
        raise HTTPException(status_code=401, detail="No refresh token")

    result = rotate_refresh_token(
        raw_token=campify_refresh,
        db=db,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if not result:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")

    new_raw_token, user, remember_me = result  # FIND-27: unpack persisted remember_me preference
    access_token = ts_create_token(user.id, user.role, str(user.uuid or user.id))
    set_refresh_cookie(response, new_raw_token, remember_me=remember_me, is_production=_settings.IS_PRODUCTION)
    from app.services.settings_service import (
        get_or_create_settings as _gocs,
        serialize_settings as _ss,
    )
    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "expires_in":   15 * 60,
        "settings":     _ss(_gocs(user, db)),
    }


@router.get("/health")
async def auth_health():
    return {"status": "healthy", "argon2_available": ARGON2_AVAILABLE, "jwt_available": JWT_AVAILABLE}


# ── User dashboard extras ─────────────────────────────────────────────────────

@router.get("/me/submissions")
async def get_my_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import Price
    rows = (
        db.query(Price)
        .filter(Price.submitted_by == current_user.id)
        .order_by(Price.submitted_at.desc())
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "price": p.price,
                "location": p.location,
                "status": p.status,
                "submitted_at": p.submitted_at.isoformat(),
                "category_id": p.category_id,
                "view_count": p.view_count,
            }
            for p in rows
        ],
    }


@router.get("/me/points")
async def get_my_points(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import PointsTransaction
    txns = (
        db.query(PointsTransaction)
        .filter(PointsTransaction.user_id == current_user.id)
        .order_by(PointsTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "success": True,
        "balance": current_user.seller_points,
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "reason": t.reason,
                "related_price_id": t.related_price_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in txns
        ],
    }


@router.get("/me/alerts")
async def get_my_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import PriceAlert
    alerts = (
        db.query(PriceAlert)
        .filter(PriceAlert.user_id == current_user.id, PriceAlert.is_active == True)
        .order_by(PriceAlert.created_at.desc())
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": a.id,
                "item_name": a.item_name,
                "target_price": a.target_price,
                "category_id": a.category_id,
                "max_distance_km": a.max_distance_km,
                "trigger_count": a.trigger_count,
                "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@router.post("/me/alerts", status_code=201)
async def create_alert(
    data: PriceAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import PriceAlert
    alert = PriceAlert(
        user_id=current_user.id,
        item_name=data.item_name,
        target_price=data.target_price,
        category_id=data.category_id,
        max_distance_km=data.max_distance_km,
        is_active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"success": True, "id": alert.id,
            "message": f"Alert set for {data.item_name} below ₦{data.target_price:,.0f}"}


@router.delete("/me/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import PriceAlert
    alert = (
        db.query(PriceAlert)
        .filter(PriceAlert.id == alert_id, PriceAlert.user_id == current_user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    db.commit()
    return {"success": True, "message": "Alert removed"}


# ── Dashboard stats (Block 4C) ───────────────────────────────────────────────

import time as _time
_stats_cache: dict[int, tuple[float, dict]] = {}

@router.get("/me/dashboard-stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All buyer stat card values in one call. Cached 30s per user."""
    uid = current_user.id
    now = _time.time()
    cached = _stats_cache.get(uid)
    if cached and (now - cached[0]) < 30:
        return cached[1]

    from app.models import Price, PriceAlert, Wishlist
    # Block 5: karma uses `seller_points` (the column _award_points writes
    # to). `balance` is a separate, currently-unused float column kept for
    # potential future wallet features. Reading from seller_points here
    # keeps buyer and seller dashboards in sync.
    karma_points = current_user.seller_points or 0
    submissions = db.query(Price).filter(Price.submitted_by == uid).count()
    price_alerts = db.query(PriceAlert).filter(
        PriceAlert.user_id == uid, PriceAlert.is_active == True
    ).count()
    wishlist_count = db.query(Wishlist).filter(Wishlist.user_id == uid).count()

    tier = "Gold" if karma_points >= 2000 else ("Silver" if karma_points >= 500 else "Bronze")

    result = {
        "karma_points": karma_points,
        "karma_tier": tier,
        "submissions": submissions,
        "price_alerts": price_alerts,
        "wishlist_count": wishlist_count,
    }
    _stats_cache[uid] = (now, result)
    return result


# ── Email OTP verification ────────────────────────────────────────────────────

def _generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


@router.post("/send-otp")
async def send_otp(
    data: OTPRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import EmailOTP
    from app.services.email import send_otp_email

    email = data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    db.query(EmailOTP).filter(
        EmailOTP.email == email,
        EmailOTP.used == False,
        EmailOTP.purpose == "verify_email",
    ).update({"used": True})

    otp_plain = _generate_otp()
    otp_hash = hash_password(otp_plain)

    otp_record = EmailOTP(
        email=email,
        otp_hash=otp_hash,
        purpose="verify_email",
        used=False,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    )
    db.add(otp_record)
    db.commit()

    name = current_user.display_name or current_user.username or "there"
    send_otp_email(email, name, otp_plain)
    return {"success": True, "message": f"Verification code sent to {email}"}


@router.post("/verify-otp")
async def verify_otp(
    data: OTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import EmailOTP

    email = data.email.strip().lower()
    now = datetime.utcnow()

    otp_record = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.email == email,
            EmailOTP.used == False,
            EmailOTP.purpose == "verify_email",
            EmailOTP.expires_at > now,
        )
        .order_by(EmailOTP.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
    if not verify_password(data.otp, otp_record.otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    otp_record.used = True
    current_user.email_verified = True
    if current_user.email != email:
        current_user.email = email
    db.commit()
    return {"success": True, "message": "Email verified successfully!"}


# ── Recently viewed listings ─────────────────────────────────────────────────

@router.get("/recently-viewed")
async def get_recently_viewed(
    limit: int = 12,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns listings the user recently viewed, pulled from the per-user
    activity log (action = 'listing_viewed'). Falls back to empty list if
    the activity table doesn't exist or has no view records.
    """
    from app.services.user_db import get_user_data
    from app.database import engine as _engine
    from sqlalchemy import text
    import json as _json

    try:
        with _engine.connect() as conn:
            rows = conn.execute(text(f"""
                SELECT details FROM user_{current_user.id}_activity
                WHERE action = 'listing_viewed'
                ORDER BY created_at DESC
                LIMIT :lim
            """), {"lim": limit * 2}).fetchall()  # fetch extra to dedup
    except Exception:
        return []

    # Extract unique listing IDs from activity details
    seen_ids: list[int] = []
    seen_set: set[int] = set()
    for row in rows:
        try:
            detail = _json.loads(row[0]) if row[0] else {}
            lid = int(detail.get("listing_id", 0))
            if lid and lid not in seen_set:
                seen_ids.append(lid)
                seen_set.add(lid)
        except (ValueError, TypeError, KeyError):
            continue
        if len(seen_ids) >= limit:
            break

    if not seen_ids:
        return []

    # Fetch the actual listings
    listings = (
        db.query(Price)
        .filter(Price.id.in_(seen_ids), Price.status == "approved")
        .all()
    )

    # Preserve the recently-viewed order
    listing_map = {p.id: p for p in listings}
    result = []
    for lid in seen_ids:
        p = listing_map.get(lid)
        if p:
            result.append({
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "price": p.price,
                "location": p.location,
                "category_id": p.category_id,
                "photos": _json.loads(p.photos) if p.photos else [],
                "view_count": p.view_count,
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
            })
    return result
