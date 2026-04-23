"""
Block 15B — Response schemas.
Every list endpoint returns a PaginatedResponse wrapper.
Never return raw SQLAlchemy objects.
"""
from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar

import json as _json

from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")


# ── Pagination wrapper ────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    skip: int
    limit: int
    has_more: bool


# ── Generic success ───────────────────────────────────────────────────────────

class OkResponse(BaseModel):
    ok: bool = True
    message: str | None = None


class ErrorResponse(BaseModel):
    detail: str


# ── User ─────────────────────────────────────────────────────────────────────

class UserMiniOut(BaseModel):
    id: int
    uuid: str | None
    username: str | None
    display_name: str | None
    avatar_url: str | None
    role: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    uuid: str | None
    username: str | None
    email: str | None
    email_verified: bool
    display_name: str | None
    role: str
    balance: float
    seller_points: int
    phone: str | None
    avatar_url: str | None
    banner_url: str | None
    bio: str | None
    department: str | None
    level: str | None
    faculty: str | None
    is_suspended: bool
    is_banned: bool
    is_paused: bool | None
    is_deleted: bool | None
    trust_tier: str | None
    karma_tier: str | None
    availability_status: str | None
    vacation_mode: bool
    response_rate: float | None
    avg_response_hours: float | None
    completion_rate: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Price / Category (legacy items router) ────────────────────────────────────

class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str | None
    description: str | None

    model_config = {"from_attributes": True}


class PriceOut(BaseModel):
    id: int
    uuid: str | None
    category_id: int
    store_id: int | None
    name: str
    brand: str | None
    pack_size: str | None
    pack_unit: str | None
    price: float
    price_per_unit: float | None
    retailer: str | None
    location: str | None
    submitted_by: int | None
    submitted_at: datetime
    description: str | None
    condition: str
    quantity: int
    is_negotiable: bool
    delivery_options: str | None
    duration_days: int | None
    expires_at: datetime | None
    listing_status: str
    photos: list[str]
    subcategory: str | None
    status: str
    view_count: int
    is_featured: bool
    featured_until: datetime | None

    model_config = {"from_attributes": True}

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except Exception:
                return []
        return v or []


class ItemOut(BaseModel):
    id: int
    name: str
    category: str | None
    description: str | None
    status: str
    is_public: bool
    created_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ItemSubmissionOut(BaseModel):
    id: int
    item_id: int | None
    item_number: str
    name: str
    category: str | None
    price: float
    location: str | None
    submitter_id: int
    submission_folder: str | None
    status: str
    admin_notes: str | None
    image_path: str | None
    created_at: datetime
    approved_at: datetime | None
    approved_by: int | None

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    admin_id: int
    admin_name: str | None
    action: str
    target_type: str | None
    target_id: int | None
    target_desc: str | None
    metadata_json: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PendingPriceOut(BaseModel):
    id: int
    item: str
    parsed_price: float | None
    image_path: str | None
    submitter_id: int | None
    location_text: str | None
    created_at: datetime
    status: str
    admin_notes: str | None

    model_config = {"from_attributes": True}


# ── Listing ───────────────────────────────────────────────────────────────────

class ListingOut(BaseModel):
    id: int
    uuid: str | None
    name: str
    brand: str | None
    price: float
    location: str | None
    category_id: int
    subcategory: str | None
    description: str | None
    condition: str
    quantity: int
    is_negotiable: bool
    delivery_options: str | None
    photos: list[str]
    status: str
    listing_status: str
    view_count: int
    is_featured: bool
    submitted_at: datetime
    expires_at: datetime | None
    pack_size: str | None
    pack_unit: str | None
    submitted_by: int | None

    model_config = {"from_attributes": True}

    @field_validator("photos", mode="before")
    @classmethod
    def parse_photos(cls, v):
        if isinstance(v, str):
            try:
                return _json.loads(v)
            except Exception:
                return []
        return v or []


# ── Order ─────────────────────────────────────────────────────────────────────

class OrderOut(BaseModel):
    id: int
    uuid: str | None
    listing_id: int
    buyer_id: int
    seller_id: int
    status: str
    meetup_location: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str
    related_id: int | None
    related_type: str | None
    is_read: bool
    action_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountOut(BaseModel):
    count: int


# ── Conversation / Message ────────────────────────────────────────────────────

class ConversationOut(BaseModel):
    id: int
    user_a_id: int
    user_b_id: int
    last_message_at: datetime | None
    last_message_preview: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewOut(BaseModel):
    id: int
    uuid: str | None
    listing_id: int
    reviewer_id: int
    seller_id: int
    rating: int
    comment: str | None
    photo_url: str | None
    is_verified_interaction: bool
    seller_response: str | None
    seller_response_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Wishlist ──────────────────────────────────────────────────────────────────

class WishlistStatusOut(BaseModel):
    saved: bool


# ── Follow ────────────────────────────────────────────────────────────────────

class FollowStatusOut(BaseModel):
    following: bool
    follower_count: int


# ── Announcement ─────────────────────────────────────────────────────────────

class AnnouncementOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    audience: str
    is_active: bool
    banner_url: str | None
    cta_label: str | None
    cta_href: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Report ────────────────────────────────────────────────────────────────────

class ReportOut(BaseModel):
    id: int
    reporter_id: int
    target_type: str
    target_id: int
    target_name: str | None
    reason: str
    status: str
    admin_notes: str | None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


# ── Flash Sale ────────────────────────────────────────────────────────────────

class FlashSaleOut(BaseModel):
    id: int
    price_id: int
    seller_id: int
    title: str | None
    original_price: float
    sale_price: float
    discount_pct: float
    start_time: datetime
    end_time: datetime
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Platform stats (public) ───────────────────────────────────────────────────

class PlatformStatsOut(BaseModel):
    total_users: int
    active_listings: int
    total_categories: int


# ── Login session ─────────────────────────────────────────────────────────────

class SessionOut(BaseModel):
    id: int
    device: str | None
    location: str | None
    ip_address: str | None
    logged_in_at: datetime
    current: bool = False

    model_config = {"from_attributes": True}


# ── Seller stats / scorecard ──────────────────────────────────────────────────

class SellerScorecard(BaseModel):
    response_rate: float
    avg_response_hours: float
    completion_rate: float
    no_show_count: int
    trust_tier: str
    seller_points: int
    avg_rating: float | None
    review_count: int


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadOut(BaseModel):
    url: str
    public_id: str | None = None
