"""
app/services/settings_service.py — Persistent Settings System.

Provides CRUD helpers for UserSettings:
  - get_or_create_settings : fetch or auto-provision with role defaults
  - serialize_settings     : model → clean typed dict for API responses
  - apply_settings_update  : partial upsert with conflict detection
  - reset_to_defaults      : wipe and re-seed from role defaults

Design:
  - Typed columns  → fast indexed queries, type safety (notifs, privacy, etc.)
  - preferences    → JSONB/JSON blob for minor UI prefs (no migrations needed)
  - version field  → optimistic concurrency — last write wins across devices
"""

import copy
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import UserSettings, User
from app.database import IS_POSTGRES
from app.schemas.utils import serialize_dt


# ── Typed column names (everything that is NOT stored in preferences) ─────────
# Used to route update keys correctly in apply_settings_update.

TYPED_COLUMNS: frozenset[str] = frozenset({
    "theme", "language",
    "profile_visibility", "show_dept", "read_receipts",
    "store_status", "vacation_mode", "vacation_resume_date",
    "auto_renew_listings", "default_negotiable",
    "default_listing_duration", "default_pickup_location",
    "notif_email_messages",      "notif_email_price_drop",
    "notif_email_new_listing",   "notif_email_order_update",
    "notif_email_review",        "notif_email_weekly_digest",
    "notif_email_announcements", "notif_email_verification",
    "notif_email_login_alert",   "notif_email_inquiry",
    "notif_email_follower",      "notif_email_expiry",
    "notif_email_competitor",    "notif_email_karma",
    "notif_push_messages",       "notif_push_price_drop",
    "notif_push_new_listing",    "notif_push_order_update",
    "notif_push_review",         "notif_push_announcements",
    "notif_push_inquiry",        "notif_push_follower",
    "show_online_status", "show_last_seen", "allow_follow",
    "show_wishlist_count", "show_review_history",
    "two_factor_enabled", "login_alerts",
})


# ── Role-specific defaults ────────────────────────────────────────────────────

_BUYER_DEFAULTS: dict = {
    "theme":              "light",
    "language":           "en",
    "profile_visibility": "unilag",
    "show_dept":          True,
    "read_receipts":      True,
    "show_online_status": True,
    "show_last_seen":     True,
    "allow_follow":       True,
    "show_wishlist_count": False,
    "show_review_history": True,
    "two_factor_enabled": False,
    "login_alerts":       True,
    # email
    "notif_email_messages":       True,
    "notif_email_price_drop":     True,
    "notif_email_new_listing":    False,
    "notif_email_order_update":   True,
    "notif_email_review":         True,
    "notif_email_weekly_digest":  True,
    "notif_email_announcements":  True,
    "notif_email_login_alert":    True,
    # push
    "notif_push_messages":        True,
    "notif_push_price_drop":      False,
    "notif_push_new_listing":     True,
    "notif_push_order_update":    True,
    "notif_push_review":          True,
    "notif_push_announcements":   True,
    "preferences": {
        "compact_mode":                   False,
        "listing_view":                   "grid",
        "dashboard_layout":               "default",
        "font_size":                      14,
        "dismissed_banners":              [],
        "onboarding_steps_completed":     [],
    },
}

_SELLER_EXTRAS: dict = {
    "store_status":               "open",
    "vacation_mode":              False,
    "vacation_resume_date":       None,
    "auto_renew_listings":        True,
    "default_negotiable":         False,
    "default_listing_duration":   14,
    "default_pickup_location":    None,
    "notif_email_inquiry":        True,
    "notif_email_follower":       False,
    "notif_email_expiry":         True,
    "notif_email_competitor":     False,
    "notif_email_karma":          False,
    "notif_email_verification":   True,
    "notif_push_inquiry":         True,
    "notif_push_follower":        True,
    "preferences": {
        "seller_dashboard_layout":  "overview",
        "show_price_benchmark":     True,
        "show_competitor_alerts":   False,
    },
}


def get_defaults(role: str) -> dict:
    """Return a deep-copied defaults dict for the given role. Always returns a fresh copy."""
    base = copy.deepcopy(_BUYER_DEFAULTS)
    if role == "seller":
        extras = copy.deepcopy(_SELLER_EXTRAS)
        seller_prefs = extras.pop("preferences", {})
        base["preferences"] = {**base["preferences"], **seller_prefs}
        base.update(extras)
    return base


# ── Core CRUD ─────────────────────────────────────────────────────────────────

def get_or_create_settings(user: User, db: Session) -> UserSettings:
    """
    Return existing UserSettings or create with role-appropriate defaults.
    Should be called on every /api/settings GET and on first login.
    Idempotent — safe to call on every request.
    """
    if user.settings:
        return user.settings

    defaults = get_defaults(user.role)
    prefs = defaults.pop("preferences", {})

    typed_kwargs = {
        k: v for k, v in defaults.items()
        if k in TYPED_COLUMNS and v is not None
    }

    settings = UserSettings(
        user_id     = user.id,
        preferences = prefs,
        **typed_kwargs,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def serialize_settings(s: UserSettings) -> dict:
    """
    Convert a UserSettings ORM row to a fully typed dict.
    Safe to call for both SQLite (JSON as str) and PostgreSQL (JSONB as dict).
    """
    prefs = s.preferences or {}
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs)
        except (json.JSONDecodeError, TypeError):
            prefs = {}

    return {
        # Appearance
        "theme":    s.theme,
        "language": s.language,

        # Privacy
        "profile_visibility":  s.profile_visibility,
        "show_dept":           s.show_dept,
        "read_receipts":       s.read_receipts,
        "show_online_status":  s.show_online_status,
        "show_last_seen":      s.show_last_seen,
        "allow_follow":        s.allow_follow,
        "show_wishlist_count": s.show_wishlist_count,
        "show_review_history": s.show_review_history,

        # Security
        "two_factor_enabled": s.two_factor_enabled,
        "login_alerts":       s.login_alerts,

        # Notifications — nested by channel
        "notifications": {
            "email": {
                "messages":       s.notif_email_messages,
                "price_drop":     s.notif_email_price_drop,
                "new_listing":    s.notif_email_new_listing,
                "order_update":   s.notif_email_order_update,
                "review":         s.notif_email_review,
                "weekly_digest":  s.notif_email_weekly_digest,
                "announcements":  s.notif_email_announcements,
                "verification":   s.notif_email_verification,
                "login_alert":    s.notif_email_login_alert,
                "inquiry":        s.notif_email_inquiry,
                "follower":       s.notif_email_follower,
                "expiry":         s.notif_email_expiry,
                "competitor":     s.notif_email_competitor,
                "karma":          s.notif_email_karma,
            },
            "push": {
                "messages":       s.notif_push_messages,
                "price_drop":     s.notif_push_price_drop,
                "new_listing":    s.notif_push_new_listing,
                "order_update":   s.notif_push_order_update,
                "review":         s.notif_push_review,
                "announcements":  s.notif_push_announcements,
                "inquiry":        s.notif_push_inquiry,
                "follower":       s.notif_push_follower,
            },
        },

        # Seller-specific
        "store_status":             s.store_status,
        "vacation_mode":            s.vacation_mode,
        "vacation_resume_date":     s.vacation_resume_date,
        "auto_renew_listings":      s.auto_renew_listings,
        "default_negotiable":       s.default_negotiable,
        "default_listing_duration": s.default_listing_duration,
        "default_pickup_location":  s.default_pickup_location,

        # Flexible JSONB preferences
        "preferences": prefs,

        # Sync metadata
        "version":    s.version,
        "updated_at": serialize_dt(s.updated_at),
    }


def apply_settings_update(
    settings: UserSettings,
    updates: dict,
    db: Session,
    client_version: int | None = None,
) -> dict:
    """
    Partial upsert — only fields present in `updates` are changed.
    Handles both typed columns and JSONB preferences.

    Conflict resolution (optimistic concurrency):
      - If client_version < server version → conflict; return current state.
      - Frontend should re-sync and re-apply its local delta on top.

    Returns the full serialized settings dict, or a conflict sentinel:
      {"conflict": True, "current": <settings dict>}
    """
    # ── Stale-write guard ─────────────────────────────────────────────────────
    if client_version is not None and client_version < settings.version:
        return {"conflict": True, "current": serialize_settings(settings)}

    typed_updates: dict = {}
    pref_updates:  dict = {}

    for key, value in updates.items():
        if key == "preferences" and isinstance(value, dict):
            pref_updates.update(value)
        elif key == "notifications" and isinstance(value, dict):
            # Flatten  {"email": {"messages": True}, "push": {...}}
            # → notif_email_messages, notif_push_*, etc.
            for channel, channel_prefs in value.items():
                if isinstance(channel_prefs, dict):
                    for pref_key, pref_val in channel_prefs.items():
                        col = f"notif_{channel}_{pref_key}"
                        if col in TYPED_COLUMNS:
                            typed_updates[col] = pref_val
        elif key in TYPED_COLUMNS:
            typed_updates[key] = value
        else:
            # Unknown top-level key → goes into flexible preferences blob
            pref_updates[key] = value

    # ── Apply typed column updates via ORM ────────────────────────────────────
    for col, val in typed_updates.items():
        setattr(settings, col, val)

    # ── Apply preferences deep-merge ──────────────────────────────────────────
    if pref_updates:
        if IS_POSTGRES:
            # Use Postgres JSONB || operator for atomic server-side merge
            db.execute(
                text("""
                    UPDATE user_settings
                       SET preferences = preferences || :prefs::jsonb
                     WHERE user_id = :uid
                """),
                {"prefs": json.dumps(pref_updates), "uid": settings.user_id},
            )
            # Flush so db.refresh picks up the merged preferences
            db.flush()
        else:
            current_prefs = settings.preferences or {}
            if isinstance(current_prefs, str):
                try:
                    current_prefs = json.loads(current_prefs)
                except (json.JSONDecodeError, TypeError):
                    current_prefs = {}
            settings.preferences = {**current_prefs, **pref_updates}

    # ── Bump version + updated_at ─────────────────────────────────────────────
    settings.version    += 1
    settings.updated_at  = datetime.utcnow()

    db.commit()
    db.refresh(settings)
    return serialize_settings(settings)


def reset_to_defaults(user: User, db: Session) -> dict:
    """
    Wipe all settings back to role-appropriate defaults.
    Version is bumped so any stale in-flight device updates become conflicts.
    """
    settings = get_or_create_settings(user, db)
    defaults = get_defaults(user.role)
    prefs = defaults.pop("preferences", {})

    for col, val in defaults.items():
        if col in TYPED_COLUMNS and val is not None:
            setattr(settings, col, val)

    settings.preferences = prefs
    settings.version    += 1
    settings.updated_at  = datetime.utcnow()

    db.commit()
    db.refresh(settings)
    return serialize_settings(settings)
