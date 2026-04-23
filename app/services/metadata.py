"""
app/services/metadata.py — Block 4

JSONB (PostgreSQL) / JSON (SQLite) read-write helpers for Profile.metadata_.
These functions are the ONLY place that should directly mutate metadata_ to
ensure correct JSONB mutation detection in SQLAlchemy (JSONB columns require
a new dict assignment — in-place mutation is not tracked by the ORM).
"""
from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.models import Profile


# ── Read ──────────────────────────────────────────────────────────────────────

def get_metadata(profile: "Profile | None", key: str, default: Any = None) -> Any:
    """Return a single key from profile.metadata_, or *default* if missing."""
    if not profile or not profile.metadata_:
        return default
    return profile.metadata_.get(key, default)


def get_all_metadata(profile: "Profile | None") -> dict:
    """Return the full metadata dict (never None — returns {} if unset)."""
    if not profile or not profile.metadata_:
        return {}
    return dict(profile.metadata_)


# ── Write ─────────────────────────────────────────────────────────────────────

def set_metadata(db: "Session", profile: "Profile", key: str, value: Any) -> None:
    """Set a single key and commit. Replaces the dict to trigger ORM change detection."""
    data = dict(profile.metadata_ or {})
    data[key] = value
    profile.metadata_ = data
    db.add(profile)
    db.commit()


def patch_metadata(db: "Session", profile: "Profile", updates: dict) -> dict:
    """
    Shallow-merge *updates* into profile.metadata_ and commit.
    Returns the updated metadata dict.
    """
    data = dict(profile.metadata_ or {})
    data.update(updates)
    profile.metadata_ = data
    db.add(profile)
    db.commit()
    return data


def delete_metadata_key(db: "Session", profile: "Profile", key: str) -> None:
    """Remove *key* from profile.metadata_ if it exists, then commit."""
    data = dict(profile.metadata_ or {})
    if key not in data:
        return
    data.pop(key)
    profile.metadata_ = data
    db.add(profile)
    db.commit()


# ── Settings & notification-prefs shorthands ─────────────────────────────────

def get_ui_settings(profile: "Profile | None") -> dict:
    """Return the 'settings' sub-dict from profile.metadata_ (never None)."""
    return get_metadata(profile, "settings", {})


def get_notif_prefs(profile: "Profile | None") -> dict:
    """Return the 'notif_prefs' sub-dict from profile.metadata_ (never None)."""
    return get_metadata(profile, "notif_prefs", {})


def update_ui_settings(db: "Session", profile: "Profile", updates: dict) -> dict:
    """Shallow-merge *updates* into the 'settings' dict and persist."""
    existing = get_ui_settings(profile)
    existing.update(updates)
    patch_metadata(db, profile, {"settings": existing})
    return existing


def update_notif_prefs(db: "Session", profile: "Profile", updates: dict) -> dict:
    """Shallow-merge *updates* into the 'notif_prefs' dict and persist."""
    existing = get_notif_prefs(profile)
    existing.update(updates)
    patch_metadata(db, profile, {"notif_prefs": existing})
    return existing


# ── Profile bootstrap ─────────────────────────────────────────────────────────

def ensure_profile(db: "Session", user_id: int) -> "Profile":
    """
    Return the Profile for *user_id*, creating a blank one if it doesn't exist.
    Safe to call on every request — uses a single SELECT then conditional INSERT.
    """
    from app.models import Profile

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile is None:
        profile = Profile(user_id=user_id, metadata_={})
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile
