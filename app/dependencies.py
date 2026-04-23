"""
Block 15C — Centralized dependency injection for Campify API.

All auth dependencies live here. Routers import from this module only.
Import the auth-specific functions from auth.py so we don't duplicate logic.
"""
from typing import Generator

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User


# ── Database session ──────────────────────────────────────────────────────────

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Re-export auth dependencies from auth router (single source of truth) ─────
# Lazy import to avoid circular imports at module load time.

def _auth_module():
    from app.routers import auth as _auth
    return _auth


def get_current_user(
    credentials=Depends(lambda: _auth_module().security),
    db: Session = Depends(get_db),
) -> User:
    """Authenticated user — raises 401/403 on invalid/paused/banned accounts."""
    from app.routers.auth import get_current_user as _gcu
    # Delegate to the canonical implementation in auth.py
    return _gcu  # type: ignore[return-value]


# Preferred pattern: just import directly from auth.py at the usage site.
# These wrappers keep the interface consistent without code duplication.

def _make_deps():
    """
    Returns the four canonical dependency callables.
    Called once per process — results are module-level singletons.
    """
    from app.routers.auth import (
        get_current_user as _gcu,
        get_current_admin as _gca,
        get_user_allow_paused as _guap,
    )

    async def get_current_seller(
        current_user: User = Depends(_gcu),
    ) -> User:
        """Requires role == 'seller' (or admin)."""
        if current_user.role not in ("seller", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seller account required",
            )
        return current_user

    return _gcu, _gca, _guap, get_current_seller


(
    get_current_user,       # type: ignore[assignment]
    get_current_admin,
    get_user_allow_paused,
    get_current_seller,
) = _make_deps()
