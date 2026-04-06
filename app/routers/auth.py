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
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
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
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://campify.ng")

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
    user_id = payload.get("sub")
    if user_id is None:
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
    user_id = payload.get("sub")
    if user_id is None:
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


class UserLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginRequest(BaseModel):
    username: str
    admin_key: str


class LoginResponse(BaseModel):
    success: bool
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    user_role: str
    access_token: str
    token_type: str = "bearer"
    message: str


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
        new_user = User(
            username=body.username,
            password_hash=password_hash,
            email=body.email,
            display_name=body.username,
            role="user",
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
                "role":       new_user.role,
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

            link = f"{FRONTEND_URL}/verify-email?token={verify_token}"
            try:
                from app.services.admin_notifications import send_user_email_bg
                from app.services.email_templates import EMAIL_VERIFY_TEMPLATE
                await send_user_email_bg(
                    body.email,
                    "Verify your Campify email to get started",
                    EMAIL_VERIFY_TEMPLATE(body.username, link),
                )
            except Exception as ee:
                logger.warning(f"[register] verification email failed: {ee}")

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
                data={"sub": str(new_user.id), "username": new_user.username, "role": "user"}
            )
            return LoginResponse(
                success=True,
                user_id=new_user.id,
                user_name=new_user.username,
                user_role="user",
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
    body: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """Login with username and password. Returns JWT valid for 24 hours."""
    if not body.username or not body.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Username and password are required")

    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid username or password")

    try:
        if not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid username or password")

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

        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role}
        )

        # Block 2B — record login history and send security email (fire-and-forget)
        if user.role != "admin":
            client_ip = request.client.host if request.client else "Unknown"
            ua = request.headers.get("user-agent", "Unknown")
            asyncio.create_task(_post_login_tasks(
                user.id,
                user.email or "",
                user.display_name or user.username or "",
                client_ip,
                ua,
            ))

        return LoginResponse(
            success=True,
            user_id=user.id,
            user_name=user.username,
            user_role=user.role,
            access_token=access_token,
            token_type="bearer",
            message=f"Welcome back, {user.username}!",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}",
        )


@router.post("/admin", response_model=LoginResponse)
@limiter.limit("3/15minutes")
async def login_admin(
    request: Request,
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
            created_at=datetime.utcnow(),
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    if admin_user.role != "admin":
        admin_user.role = "admin"
        db.commit()

    access_token = create_access_token(
        data={"sub": str(admin_user.id), "username": admin_user.username, "role": "admin"}
    )
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
async def logout():
    """JWT is stateless — client deletes token. No server-side action needed."""
    return {"success": True, "message": "Logged out successfully. Please delete your token."}


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
        "redirect": f"/signin?verified=true&email={user.email or ''}",
        "email": user.email or "",
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

    link = f"{FRONTEND_URL}/verify-email?token={verify_token}"
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
    from app.services.user_db import get_user_data
    from app.database import engine as _engine
    from app.models import SellerVerification

    profile_data  = get_user_data(current_user.id, "profile",      _engine)
    settings_data = get_user_data(current_user.id, "settings",     _engine)
    notif_data    = get_user_data(current_user.id, "notif_prefs",  _engine)

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
            verification_status = sv.status  # Pending / Under Review / Approved / Rejected

    return {
        "id":           current_user.id,
        "username":     current_user.username,
        "email":        current_user.email,
        "email_verified": getattr(current_user, "email_verified", False),
        "display_name": current_user.display_name,
        "role":         current_user.role,
        "balance":      current_user.balance,
        "seller_points": getattr(current_user, "seller_points", 0),
        "phone":        getattr(current_user, "phone", None),
        "avatar_url":   getattr(current_user, "avatar_url", None),
        "department":   getattr(current_user, "department", None),
        "level":        getattr(current_user, "level", None),
        "bio":          getattr(current_user, "bio", None),
        "banner_url":   getattr(current_user, "banner_url", None),
        "availability_status": getattr(current_user, "availability_status", "open"),
        "trust_tier":   getattr(current_user, "trust_tier", "new_seller"),
        "response_rate": getattr(current_user, "response_rate", 100.0),
        "avg_response_hours": getattr(current_user, "avg_response_hours", 0.0),
        "completion_rate": getattr(current_user, "completion_rate", 100.0),
        "vacation_mode": getattr(current_user, "vacation_mode", False),
        "verification_status": verification_status,
        "created_at":   current_user.created_at,
        # Per-user persisted preferences
        "profile":      profile_data,
        "settings":     settings_data,
        "notif_prefs":  notif_data,
    }


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
):
    """Persist user settings to per-user table."""
    from app.services.user_db import upsert_user_data, log_user_activity
    from app.database import engine as _engine
    data = {k: str(v) for k, v in body.model_dump(exclude_none=True).items()}
    upsert_user_data(current_user.id, "settings", data, _engine)
    log_user_activity(current_user.id, "settings_updated", data, None, _engine)
    return {"message": "Settings saved"}


@router.patch("/notification-preferences")
async def update_notification_preferences(
    body: NotifPrefsUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Persist notification preferences to per-user table."""
    from app.services.user_db import upsert_user_data
    from app.database import engine as _engine
    data = {k: str(v) for k, v in body.model_dump(exclude_none=True).items()}
    upsert_user_data(current_user.id, "notif_prefs", data, _engine)
    return {"message": "Notification preferences saved"}


@router.post("/change-password")
@limiter.limit("5/15minutes")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password. Requires the existing password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


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
    current_user: User = Depends(get_current_user),
):
    if session_id == "current":
        raise HTTPException(status_code=400, detail="Cannot revoke current session here — use logout")
    return {"message": "Session revoked"}


@router.post("/validate-token")
async def validate_token(current_user: User = Depends(get_current_user)):
    return {"valid": True, "user_id": current_user.id, "username": current_user.username, "role": current_user.role}


@router.post("/refresh")
async def refresh_token(current_user: User = Depends(get_current_user)):
    new_token = create_access_token(
        data={"sub": str(current_user.id), "username": current_user.username, "role": current_user.role}
    )
    return {"access_token": new_token, "token_type": "bearer", "message": "Token refreshed"}


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
    karma_points = current_user.balance or 0
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
