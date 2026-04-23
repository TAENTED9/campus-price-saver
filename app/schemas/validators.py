"""
app/schemas/validators.py — Shared Pydantic validators (Block 11A).

Use reject_xss / sanitize_text as standalone functions, or inherit
SafeTextMixin to auto-strip XSS from every str field on a schema.
"""
from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, field_validator

# ── XSS / injection patterns ──────────────────────────────────────────────────

XSS_PATTERNS: list[str] = [
    r"<script",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe",
    r"<object",
    r"<embed",
    r"data:",
    r"vbscript:",
    r"expression\s*\(",
]

_XSS_RE = re.compile(
    "|".join(XSS_PATTERNS),
    re.IGNORECASE,
)


# ── Core helpers ──────────────────────────────────────────────────────────────

def reject_xss(value: str | None) -> str | None:
    """
    Raise ValueError if *value* contains any known XSS / injection pattern.
    Returns the stripped string on success, None if value is None.
    """
    if value is None:
        return None
    if _XSS_RE.search(value):
        raise ValueError("Input contains disallowed content")
    return value.strip()


def sanitize_text(value: str | None, max_len: int = 1000) -> str | None:
    """
    Full sanitization pass: XSS check + length cap.
    Use this for free-text fields (bio, description, messages).
    """
    if value is None:
        return None
    value = reject_xss(value)        # type: ignore[arg-type]
    if value and len(value) > max_len:
        raise ValueError(f"Must be {max_len} characters or fewer")
    return value


# ── Field-level helpers ───────────────────────────────────────────────────────

def validate_price(v: float) -> float:
    if v <= 0:
        raise ValueError("Price must be greater than 0")
    if v >= 10_000_000:
        raise ValueError("Price must be less than ₦10,000,000")
    return v


def validate_quantity(v: int) -> int:
    if v < 0:
        raise ValueError("Quantity cannot be negative")
    if v > 10_000:
        raise ValueError("Quantity cannot exceed 10,000")
    return v


_SLUG_RE   = re.compile(r"^[a-z0-9-]{3,50}$")
_MATRIC_RE = re.compile(r"^\d{9}(/[A-Z]{2,4})?$")
_PHONE_RE  = re.compile(r"^\+?[\d\s\-]{7,20}$")


def validate_slug(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip().lower()
    if not _SLUG_RE.match(v):
        raise ValueError("Slug must be 3–50 lowercase letters, digits or hyphens")
    return v


def validate_matric_number(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip().upper()
    if not _MATRIC_RE.match(v):
        raise ValueError("Matric number must be 9 digits, optionally with '/XX' suffix (e.g. 190101001 or 190101001/ED)")
    return v


def validate_phone(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if not _PHONE_RE.match(v):
        raise ValueError("Invalid phone number format")
    return v


# ── Mixin ──────────────────────────────────────────────────────────────────────

class SafeTextMixin(BaseModel):
    """
    Inherit this mixin to automatically run reject_xss on every str field
    before any other validators fire.

    class MyRequest(SafeTextMixin):
        title: str
        bio: str | None = None
    """

    @field_validator("*", mode="before")
    @classmethod
    def strip_xss_from_strings(cls, v: Any) -> Any:
        if isinstance(v, str):
            return reject_xss(v)
        return v
