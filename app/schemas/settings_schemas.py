"""
app/schemas/settings_schemas.py — Pydantic request/response schemas for
the Persistent Settings System.

All fields are optional (None = "not provided / don't change this field").
Validators enforce the allowed enum values for string fields.
"""

from typing import Any
from pydantic import BaseModel, field_validator


# ── Notification sub-schemas ──────────────────────────────────────────────────

class NotifEmailPrefs(BaseModel):
    messages:       bool | None = None
    price_drop:     bool | None = None
    new_listing:    bool | None = None
    order_update:   bool | None = None
    review:         bool | None = None
    weekly_digest:  bool | None = None
    announcements:  bool | None = None
    verification:   bool | None = None
    login_alert:    bool | None = None
    inquiry:        bool | None = None
    follower:       bool | None = None
    expiry:         bool | None = None
    competitor:     bool | None = None
    karma:          bool | None = None


class NotifPushPrefs(BaseModel):
    messages:       bool | None = None
    price_drop:     bool | None = None
    new_listing:    bool | None = None
    order_update:   bool | None = None
    review:         bool | None = None
    announcements:  bool | None = None
    inquiry:        bool | None = None
    follower:       bool | None = None


class NotificationPrefs(BaseModel):
    email: NotifEmailPrefs | None = None
    push:  NotifPushPrefs  | None = None


# ── Main update request ───────────────────────────────────────────────────────

class SettingsUpdateRequest(BaseModel):
    # Appearance
    theme:    str | None = None
    language: str | None = None

    # Privacy
    profile_visibility:  str  | None = None
    show_dept:           bool | None = None
    read_receipts:       bool | None = None
    show_online_status:  bool | None = None
    show_last_seen:      bool | None = None
    allow_follow:        bool | None = None
    show_wishlist_count: bool | None = None
    show_review_history: bool | None = None

    # Security
    login_alerts: bool | None = None

    # Notifications (nested — flattened by service layer)
    notifications: NotificationPrefs | None = None

    # Seller-specific
    store_status:             str  | None = None
    vacation_mode:            bool | None = None
    vacation_resume_date:     str  | None = None
    auto_renew_listings:      bool | None = None
    default_negotiable:       bool | None = None
    default_listing_duration: int  | None = None
    default_pickup_location:  str  | None = None

    # Flexible JSONB preferences (minor UI prefs)
    preferences: dict[str, Any] | None = None

    # Optimistic concurrency token — client sends its current version
    client_version: int | None = None

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str | None) -> str | None:
        if v is not None and v not in ("light", "dark", "system"):
            raise ValueError("theme must be 'light', 'dark', or 'system'")
        return v

    @field_validator("profile_visibility")
    @classmethod
    def validate_visibility(cls, v: str | None) -> str | None:
        if v is not None and v not in ("public", "unilag", "private"):
            raise ValueError("profile_visibility must be 'public', 'unilag', or 'private'")
        return v

    @field_validator("store_status")
    @classmethod
    def validate_store_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ("open", "limited", "closed"):
            raise ValueError("store_status must be 'open', 'limited', or 'closed'")
        return v

    @field_validator("default_listing_duration")
    @classmethod
    def validate_duration(cls, v: int | None) -> int | None:
        if v is not None and v not in (7, 14, 30):
            raise ValueError("default_listing_duration must be 7, 14, or 30")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("language must be a valid ISO 639-1 code (max 10 chars)")
        return v
