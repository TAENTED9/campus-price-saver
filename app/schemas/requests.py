"""
Block 11B — Request schemas with full input validation.
Uses SafeTextMixin from app.schemas.validators to auto-strip XSS on all str fields.
Additional field-level validators enforce business rules (price, slug, phone, etc.).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.validators import (
    SafeTextMixin,
    sanitize_text,
    validate_matric_number,
    validate_phone,
    validate_price,
    validate_quantity,
    validate_slug,
)


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(SafeTextMixin):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    email: EmailStr | None = None

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(SafeTextMixin):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class DeleteAccountRequest(BaseModel):
    confirm: str = Field(..., pattern="^DELETE$")


class UpdateProfileRequest(SafeTextMixin):
    display_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    department: str | None = Field(None, max_length=100)
    level: str | None = Field(None, max_length=20)
    avatar_url: str | None = None
    bio: str | None = Field(None, max_length=1000)
    faculty: str | None = Field(None, max_length=100)

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        return validate_phone(v)

    @field_validator("bio")
    @classmethod
    def check_bio(cls, v: str | None) -> str | None:
        return sanitize_text(v, max_len=1000)


class UpdateSettingsRequest(BaseModel):
    availability_status: str | None = None
    auto_reply_message: str | None = None
    vacation_mode: bool | None = None


class UpdateNotifPrefsRequest(BaseModel):
    new_message: bool | None = None
    order_update: bool | None = None
    review: bool | None = None
    promotion: bool | None = None
    system: bool | None = None


# ── Pending Price ────────────────────────────────────────────────────────────────

class PendingPriceCreate(BaseModel):
    item: str
    parsed_price: float | None = None
    image_path: str | None = None
    submitter_id: int | None = None
    location_text: str | None = None


# ── Flash Sale (direct create) ────────────────────────────────────────────────

class FlashSaleCreate(BaseModel):
    price_id: int = Field(..., gt=0)
    discount_pct: float = Field(..., gt=0, le=100)
    end_time: datetime
    title: str | None = Field(None, max_length=100)


# ── Item / Submission ─────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str | None = None
    description: str | None = None


class ItemSubmissionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str | None = None
    price: float = Field(..., gt=0)
    location: str = Field(..., min_length=1)
    submitter_id: int | None = None
    image_path: str | None = None


# ── Price / Category (legacy items router) ────────────────────────────────────

class PriceCreate(SafeTextMixin):
    category_id: int
    store_id: int | None = None
    name: str = Field(..., min_length=2, max_length=80)
    brand: str | None = Field(None, max_length=100)
    pack_size: str | None = None
    pack_unit: str | None = None
    price: float = Field(..., gt=0)
    price_per_unit: float | None = None
    retailer: str | None = None
    location: str | None = None
    description: str | None = Field(None, max_length=1000)
    condition: str = "New"
    quantity: int = Field(1, ge=0, le=10_000)
    is_negotiable: bool = False
    delivery_options: str | None = None
    duration_days: int | None = None
    photos: list[str] = Field(default_factory=list)
    subcategory: str | None = None
    status: str | None = None
    submitted_by: int | None = None

    @field_validator("price")
    @classmethod
    def check_price(cls, v: float) -> float:
        return validate_price(v)

    @field_validator("quantity")
    @classmethod
    def check_quantity(cls, v: int) -> int:
        return validate_quantity(v)


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: str | None = None
    description: str | None = None


# ── Listing ───────────────────────────────────────────────────────────────────

class CreateListingRequest(SafeTextMixin):
    category_id: int = Field(..., gt=0)
    name: str = Field(..., min_length=2, max_length=80)
    brand: str | None = Field(None, max_length=100)
    price: float = Field(..., gt=0, le=10_000_000)
    location: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=1000)
    condition: str = Field("new", pattern="^(new|fairly_used|used)$")
    quantity: int = Field(1, ge=0, le=10_000)
    is_negotiable: bool = False
    delivery_options: str | None = None
    duration_days: int | None = None
    photos: list[str] = Field(default_factory=list)
    subcategory: str | None = None
    pack_size: str | None = None
    pack_unit: str | None = None

    @field_validator("price")
    @classmethod
    def check_price(cls, v: float) -> float:
        return validate_price(v)

    @field_validator("quantity")
    @classmethod
    def check_quantity(cls, v: int) -> int:
        return validate_quantity(v)

    @field_validator("description")
    @classmethod
    def check_desc(cls, v: str | None) -> str | None:
        return sanitize_text(v, max_len=1000)


class UpdateListingRequest(SafeTextMixin):
    name: str | None = Field(None, min_length=2, max_length=80)
    price: float | None = Field(None, gt=0, le=10_000_000)
    description: str | None = Field(None, max_length=1000)
    condition: str | None = None
    quantity: int | None = Field(None, ge=0, le=10_000)
    is_negotiable: bool | None = None
    photos: list[str] | None = None
    location: str | None = None
    delivery_options: str | None = None

    @field_validator("price")
    @classmethod
    def check_price(cls, v: float | None) -> float | None:
        return validate_price(v) if v is not None else None

    @field_validator("quantity")
    @classmethod
    def check_quantity(cls, v: int | None) -> int | None:
        return validate_quantity(v) if v is not None else None


class ListingStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(active|paused|draft)$")


class ReportListingRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
    description: str | None = Field(None, max_length=2000)


# ── Order ─────────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    listing_uuid: str | None = None
    listing_id: int | None = None
    meetup_location: str | None = Field(None, max_length=300)


class UpdateOrderStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(met_up|completed|cancelled)$")


# ── Message ───────────────────────────────────────────────────────────────────

class SendMessageRequest(SafeTextMixin):
    receiver_id: int = Field(..., gt=0)
    content: str = Field(..., min_length=1, max_length=4000)
    listing_uuid: str | None = None


# ── Review ────────────────────────────────────────────────────────────────────

class CreateReviewRequest(SafeTextMixin):
    listing_id: int = Field(..., gt=0)
    seller_id: int = Field(..., gt=0)
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=1000)
    photo_url: str | None = None

    @field_validator("comment")
    @classmethod
    def check_comment(cls, v: str | None) -> str | None:
        return sanitize_text(v, max_len=1000)


class ReviewResponseRequest(BaseModel):
    response: str = Field(..., min_length=1, max_length=1000)


# ── Flash Sale ────────────────────────────────────────────────────────────────

class CreateFlashSaleRequest(BaseModel):
    listing_uuid: str | None = None
    price_id: int | None = None
    discount_price: float | None = Field(None, gt=0)
    discount_pct: float | None = Field(None, gt=0, le=100)
    ends_at: datetime | None = None
    end_time: datetime | None = None
    title: str | None = Field(None, max_length=100)


# ── Seller ────────────────────────────────────────────────────────────────────

class SellerApplyRequest(SafeTextMixin):
    business_name: str = Field(..., min_length=2, max_length=200)
    category: str = Field(..., min_length=1)
    pickup_location: str = Field(..., min_length=3, max_length=300)
    bio: str | None = Field(None, max_length=1000)

    @field_validator("bio")
    @classmethod
    def check_bio(cls, v: str | None) -> str | None:
        return sanitize_text(v, max_len=1000)


class VacationModeRequest(BaseModel):
    enabled: bool


class PauseAccountRequest(BaseModel):
    reason: str | None = Field(None, max_length=500)


# ── Admin user actions ───────────────────────────────────────────────────────

class UserSuspendRequest(BaseModel):
    hours: int | None = None
    reason: str | None = None


class UserBanRequest(BaseModel):
    reason: str


class AnnouncementCreate(SafeTextMixin):
    title: str = Field(..., min_length=2, max_length=80)
    message: str = Field(..., min_length=1, max_length=1000)
    type: str = "System"
    audience: str = "All"
    is_active: bool = True
    banner_url: str | None = None
    cta_label: str | None = Field(None, max_length=60)
    cta_href: str | None = Field(None, max_length=500)


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    message: str | None = None
    type: str | None = None
    audience: str | None = None
    is_active: bool | None = None
    banner_url: str | None = None
    cta_label: str | None = Field(None, max_length=60)
    cta_href: str | None = Field(None, max_length=500)


class ReportResolveRequest(BaseModel):
    admin_notes: str | None = None


class DisputeUpdateRequest(BaseModel):
    status: str
    admin_notes: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    description: str | None = None


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminPauseUserRequest(BaseModel):
    reason: str | None = Field(None, max_length=500)


class AdminRejectVerificationRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class ResolveReportRequest(BaseModel):
    note: str | None = Field(None, max_length=500)


class CreateAnnouncementRequest(SafeTextMixin):
    title: str = Field(..., min_length=2, max_length=80)
    message: str = Field(..., min_length=1, max_length=1000)
    type: str = "System"
    audience: str = "All"
    is_active: bool = True


class UpdateAnnouncementRequest(BaseModel):
    title: str | None = None
    message: str | None = None
    type: str | None = None
    audience: str | None = None
    is_active: bool | None = None
