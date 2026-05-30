import uuid as uuid_lib
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, CheckConstraint, UniqueConstraint, JSON, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base, IS_POSTGRES

if IS_POSTGRES:
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP as PG_TIMESTAMP, JSONB as PG_JSONB, TSVECTOR as PG_TSVECTOR
    _JsonType = PG_JSONB
    _SearchVectorType = PG_TSVECTOR
else:
    PG_UUID = PG_TIMESTAMP = PG_TSVECTOR = None
    _JsonType = JSON
    _SearchVectorType = None


def uuid_column():
    """UUID column — native UUID type on PostgreSQL, VARCHAR(36) on SQLite."""
    if IS_POSTGRES:
        return Column(PG_UUID(as_uuid=True), default=uuid_lib.uuid4, unique=True, nullable=False, index=True)
    return Column(String(36), default=lambda: str(uuid_lib.uuid4()), unique=True, nullable=False, index=True)


def timestamp_col(*, nullable: bool = True, auto: bool = True, server_default: bool = False, index: bool = False, onupdate: bool = False):
    """
    TIMESTAMPTZ on PostgreSQL, DateTime on SQLite.
    auto=True  → default=datetime.utcnow (most columns).
    auto=False → no default; column must be set explicitly (e.g. expires_at).
    """
    from sqlalchemy import text as _sql_text
    col_type = PG_TIMESTAMP(timezone=True) if IS_POSTGRES else DateTime
    kwargs: dict = {"nullable": nullable}
    if auto:
        kwargs["default"] = datetime.utcnow
    if onupdate:
        kwargs["onupdate"] = datetime.utcnow
    if server_default:
        kwargs["server_default"] = _sql_text("NOW()") if IS_POSTGRES else _sql_text("(datetime('now'))")
    if index:
        kwargs["index"] = True
    return Column(col_type, **kwargs)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)  # For auth
    password_hash = Column(String, nullable=True)  # Hashed password
    email = Column(String, unique=True, index=True, nullable=True)  # Made nullable for backward compat
    email_verified = Column(Boolean, default=False)
    display_name = Column(String, nullable=True)
    role = Column(String, default="buyer", index=True)
    balance = Column(Float, default=0.0)
    seller_points = Column(Integer, default=0)          # Karma/boost points
    # Extended profile
    phone = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    department = Column(String, nullable=True)
    level = Column(String, nullable=True)               # e.g. "100L", "200L", "Postgrad"
    # Storefront profile
    bio = Column(Text, nullable=True)
    banner_url = Column(String, nullable=True)
    availability_status = Column(String, default="open")   # open / closed / limited
    vacation_mode = Column(Boolean, default=False)
    auto_reply_message = Column(Text, nullable=True)       # Away/auto-reply message
    quick_replies = Column(Text, nullable=True)            # JSON array of up to 5 preset replies
    # Seller scorecard (updated on inquiry events)
    response_rate = Column(Float, default=100.0)           # % of inquiries replied to
    avg_response_hours = Column(Float, default=0.0)        # Average hours to first reply
    completion_rate = Column(Float, default=100.0)         # % inquiries marked Completed
    no_show_count = Column(Integer, default=0)             # Times buyer marked no-show
    # Trust tier (derived from points + ratings + sales)
    trust_tier = Column(String, default="new_seller")      # new_seller/rising/trusted/top_seller
    is_suspended = Column(Boolean, default=False, index=True)
    is_banned = Column(Boolean, default=False, index=True)
    suspended_until = timestamp_col(auto=False)
    ban_reason = Column(Text, nullable=True)
    suspension_reason = Column(Text, nullable=True)
    # ── Block 4A: account lifecycle ──────────────────────────────────────────
    is_paused   = Column(Boolean, default=False, nullable=True, index=True)
    paused_at   = timestamp_col(auto=False)
    paused_by   = Column(String, nullable=True)    # "admin" | "self"
    pause_reason = Column(String, nullable=True)
    reactivation_requested_at = timestamp_col(auto=False)
    deletion_requested_at     = timestamp_col(auto=False)
    deletion_request_reason   = Column(String, nullable=True)
    is_deleted  = Column(Boolean, default=False, nullable=True, index=True)
    deleted_at  = timestamp_col(auto=False)
    created_at = timestamp_col(index=True)
    # Block 1A — link-based email verification
    email_verify_token     = Column(String, nullable=True)
    email_verify_token_exp = timestamp_col(auto=False)
    email_verified_at      = timestamp_col(auto=False)
    uuid = Column(String, unique=True, nullable=True,
                  default=lambda: str(uuid_lib.uuid4()))
    # ── Password reset ─────────────────────────────────────────────────────────
    password_reset_token     = Column(String, nullable=True)
    password_reset_token_exp = timestamp_col(auto=False)

    # ── Block 10: TOTP / MFA ──────────────────────────────────────────────────
    mfa_enabled      = Column(Boolean, default=False, nullable=False)
    mfa_secret       = Column(String, nullable=True)       # Base32 TOTP secret (store server-side only)
    mfa_backup_codes = Column(_JsonType, nullable=True)    # List of SHA-256-hashed one-time codes

    profile        = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    pending_prices = relationship("PendingPrice", back_populates="submitter")
    transactions   = relationship("Transaction", back_populates="user")
    settings       = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(Base):
    """
    Extended identity data separated from the core User table (Block 3).
    New code reads user.profile.*; existing code still reads user.display_name, etc.
    """
    __tablename__ = "profiles"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    display_name = Column(String(100), nullable=True)
    avatar_url   = Column(String, nullable=True)
    bio          = Column(Text, nullable=True)
    banner_url   = Column(String, nullable=True)
    phone        = Column(String(30), nullable=True)
    department   = Column(String(100), nullable=True)
    level        = Column(String(20), nullable=True)           # 100L … Postgrad
    faculty      = Column(String(100), nullable=True)
    karma_tier    = Column(String(20), default="Bronze")        # Bronze / Silver / Gold / Platinum
    slug          = Column(String(80), nullable=True, unique=True)
    business_name = Column(String(200), nullable=True)
    category      = Column(String(100), nullable=True)
    store_status  = Column(String(20), default="open")           # open / closed / busy
    whatsapp      = Column(String(30), nullable=True)
    show_whatsapp = Column(Boolean, default=False)
    instagram     = Column(String(80), nullable=True)
    pickup_policy  = Column(Text, nullable=True)
    return_policy  = Column(Text, nullable=True)
    payment_policy = Column(Text, nullable=True)
    metadata_     = Column("metadata", _JsonType, default=dict, nullable=True)
    created_at   = timestamp_col(nullable=False, server_default=True)
    updated_at   = timestamp_col(nullable=False, server_default=True, onupdate=True)

    user = relationship("User", back_populates="profile", uselist=False)


class RefreshToken(Base):
    """
    Hashed refresh-token records for secure Remember-Me (Block 3 / Block 9).
    Raw token bytes are never stored — only an Argon2 hash.
    """
    __tablename__ = "refresh_tokens"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash  = Column(String, nullable=False, unique=True)
    expires_at  = timestamp_col(auto=False, nullable=False)
    created_at  = timestamp_col()
    revoked     = Column(Boolean, default=False, nullable=False, index=True)
    revoked_at  = timestamp_col(auto=False)
    ip_address  = Column(String, nullable=True)
    user_agent  = Column(String, nullable=True)
    remember_me = Column(Boolean, default=False, nullable=False)  # FIND-27

    user = relationship("User", back_populates="refresh_tokens")


class EmailOTP(Base):
    """Short-lived OTP tokens for email verification."""
    __tablename__ = "email_otps"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    otp_hash = Column(String, nullable=False)           # Argon2 hash of the 6-digit code
    purpose = Column(String, default="verify_email")    # verify_email | password_reset
    used = Column(Boolean, default=False)
    expires_at = timestamp_col(auto=False, nullable=False)
    created_at = timestamp_col()


class Category(Base):
    """Simple category: EDIBLES, DRINKS, or NON-EDIBLES"""
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)  # EDIBLES, DRINKS, NON-EDIBLES
    icon = Column(String, nullable=True)  # emoji or icon
    description = Column(String, nullable=True)
    
    prices = relationship("Price", back_populates="category", cascade="all, delete-orphan")


class Store(Base):
    __tablename__ = "stores"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = timestamp_col()

    prices = relationship("Price", back_populates="store")


class Price(Base):
    """Price entry with brand, pack size, and normalized unit"""
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    
    # Item details (name required, others optional)
    name = Column(String, nullable=False, index=True)  # e.g., "Rice", "Peak Milk"
    brand = Column(String, nullable=True)  # e.g., "Peak Milk"
    pack_size = Column(String, nullable=True)  # e.g., "500"
    pack_unit = Column(String, nullable=True)  # e.g., "g", "kg", "ml", "L", "pcs", "pack"
    
    # Pricing (price required)
    price = Column(Float, nullable=False)  # ₦
    price_per_unit = Column(Float, nullable=True)  # ₦ per unit for comparison
    
    # Location & metadata
    retailer = Column(String, nullable=True)  # Store/shop name
    # Seller's primary / specific meetup spot — short free text (≤100 chars).
    # Required when publishing (enforced at the endpoint, NOT here, so drafts
    # can still be saved without it). Displayed prominently to buyers.
    location = Column(String, nullable=True)
    # Canonical multi-pickup list. Stored as a JSON array of strings; each entry
    # must appear in app.constants.locations.LOCATION_SET. Empty array = listing
    # is blocked from publish (sellers must pick at least one spot).
    locations = Column(Text, nullable=False, server_default="[]")
    # Set True by the startup migration for rows whose old location matched a
    # stale value (Angola, Freedom Park, Nithub, …). The seller dashboard
    # shows a "Locations needed" banner driven by this flag; clearing it
    # happens on the next successful listing save.
    needs_location_update = Column(Boolean, nullable=False, server_default="0", default=False)
    submitted_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    submitted_at = timestamp_col()
    
    # Marketplace listing fields
    description = Column(Text, nullable=True)
    condition = Column(String, default="New")              # New / Fairly Used / Used
    quantity = Column(Integer, default=1)
    is_negotiable = Column(Boolean, default=False)
    delivery_options = Column(String, nullable=True)       # comma-sep: "pickup,delivery"
    delivery_fee = Column(Float, nullable=True)            # Optional fee charged when delivery is selected (₦)
    duration_days = Column(Integer, nullable=True)         # 7 / 14 / 30
    expires_at = timestamp_col(auto=False)
    listing_status = Column(String, default="active", index=True)  # draft/active/paused/sold/expired
    paused_by_vacation = Column(Boolean, default=False, nullable=False)
    photos = Column(Text, nullable=True)                   # JSON array of Cloudinary URLs (up to 5)
    videos = Column(Text, nullable=True)                   # JSON array of Cloudinary video URLs (up to 3 per user, account-wide)
    subcategory = Column(String, nullable=True)

    # Status
    status = Column(String, default="pending", index=True)  # pending, approved, rejected

    # Discovery & engagement
    view_count = Column(Integer, default=0, index=True)

    # Featured/promoted (paid with seller points)
    is_featured = Column(Boolean, default=False, index=True)
    featured_until = timestamp_col(auto=False)
    uuid = Column(String, unique=True, nullable=True,
                  default=lambda: str(uuid_lib.uuid4()))

    # ── Block 1: Full-Text Search columns ────────────────────────────────────
    # PostgreSQL only: native tsvector populated by DB trigger
    # (see _run_postgres_migrations in app/database.py). SQLite uses the
    # prices_fts FTS5 virtual table instead — no ORM column needed there.
    if IS_POSTGRES:
        search_vector = Column(_SearchVectorType, nullable=True)

    # Search boost priority — A (highest) … D (lowest).
    # Featured listings should be promoted to A; default is C.
    # Used by the ranking expression in app/services/search_service.py.
    search_weight = Column(String(1), default="C", nullable=True)

    category = relationship("Category", back_populates="prices")
    store = relationship("Store", back_populates="prices")
    flash_sales = relationship("FlashSale", back_populates="price_item")
    inquiries = relationship("Inquiry", back_populates="listing")

    # Composite indexes — work on both SQLite and PostgreSQL.
    # Column names match the real Price schema (submitted_by/submitted_at,
    # category_id, listing_status) — NOT the speculative "listings" schema.
    __table_args__ = (
        # Browse page: category + status + price + recency
        Index(
            "idx_prices_browse",
            "category_id", "listing_status",
            "price", "submitted_at",
        ),
        # Seller dashboard: my listings, filtered by status, newest first
        Index(
            "idx_prices_seller",
            "submitted_by", "listing_status",
            "submitted_at",
        ),
        # Condition filter (New / Fairly Used / Used) on active listings
        Index(
            "idx_prices_condition",
            "condition", "listing_status",
        ),
    )


class FlashSale(Base):
    """Time-limited discount on an existing approved price listing."""
    __tablename__ = "flash_sales"
    id = Column(Integer, primary_key=True, index=True)
    price_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=True)              # e.g. "Lunch Special"
    original_price = Column(Float, nullable=False)     # Price at time of sale creation
    sale_price = Column(Float, nullable=False)         # Discounted price
    discount_pct = Column(Float, nullable=False)       # e.g. 20.0 = 20% off

    start_time = timestamp_col(nullable=False)
    end_time = timestamp_col(auto=False, nullable=False)        # When sale expires
    is_active = Column(Boolean, default=True, index=True)
    created_at = timestamp_col()

    price_item = relationship("Price", back_populates="flash_sales")
    seller = relationship("User")


class PointsTransaction(Base):
    """Audit log for seller_points earned or spent."""
    __tablename__ = "points_transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)           # Positive = earned, Negative = spent
    reason = Column(String, nullable=True)             # "purchase_confirmed", "listing_boost"
    related_price_id = Column(Integer, ForeignKey("prices.id"), nullable=True)
    created_at = timestamp_col()

    user = relationship("User")


class KarmaLedger(Base):
    """Detailed karma points ledger — Feature 4A."""
    __tablename__ = "karma_ledger"
    id           = Column(Integer, primary_key=True, index=True)
    seller_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    points       = Column(Integer, nullable=False)          # positive or negative
    reason       = Column(String(100), nullable=False)      # 'sale_completed', 'five_star_review', etc.
    reference_id = Column(String(200), nullable=True)       # e.g. order_id, review_id
    created_at   = timestamp_col()

    seller = relationship("User")

    __table_args__ = (
        UniqueConstraint("seller_id", "reason", "reference_id", name="uq_karma_ledger_dedup"),
    )


class PendingPrice(Base):
    __tablename__ = "pending_prices"
    id = Column(Integer, primary_key=True, index=True)
    item = Column(String, nullable=False)
    parsed_price = Column(Float, nullable=True)
    image_path = Column(String, nullable=True)    # path to uploaded image
    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location_text = Column(String, nullable=True)     # user-entered location/canteen name
    created_at = timestamp_col()
    status = Column(String, default="pending")  # e.g., pending, approved, rejected
    admin_notes = Column(Text, nullable=True)

    submitter = relationship("User", back_populates="pending_prices")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=True)
    created_at = timestamp_col()

    user = relationship("User", back_populates="transactions")


class Item(Base):
    """Legacy Item model - kept for backward compatibility"""
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String, nullable=True)
    description = Column(String, nullable=True)
    status = Column(String, default="pending", index=True)
    is_public = Column(Boolean, default=False)
    created_by = Column(String, nullable=True)
    created_at = timestamp_col()


class ItemSubmission(Base):
    """User submissions of items - awaiting admin approval"""
    __tablename__ = "item_submissions"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    item_number = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    location = Column(String, nullable=True)
    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submission_folder = Column(String, nullable=True)
    status = Column(String, default="pending")
    admin_notes = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    created_at = timestamp_col()
    approved_at = timestamp_col(auto=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    submitter = relationship("User", foreign_keys=[submitter_id])
    approver = relationship("User", foreign_keys=[approved_by])



"""
Add to app/models.py - User Preferences for personalized comparison
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from datetime import datetime
from app.database import Base

class UserPreference(Base):
    """
    Store user preferences for smart shopping comparison
    Enables personalized recommendations and learning
    """
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Transport preferences
    transport_mode = Column(String, default="walking")  # walking, driving, transit, bicycling
    per_km_cost = Column(Float, default=40.0)  # ₦/km
    base_trip_cost = Column(Float, default=0.0)  # ₦ (fixed cost per trip)
    
    # Time valuation
    value_of_time_per_min = Column(Float, default=10.0)  # ₦ per minute
    
    # Loyalty & behavior
    preferred_store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    loyalty_penalty = Column(Float, default=0.0)  # ₦ (psychological cost of switching)
    
    # Personalization (learned from behavior)
    willingness_to_travel_score = Column(Float, default=0.5)  # 0-1 scale
    avg_basket_size = Column(Float, default=5.0)  # Average number of items
    
    # Display preferences
    preferred_sort = Column(String, default="best_value")  # best_value, closest, cheapest
    show_low_confidence_stores = Column(Boolean, default=False)
    
    # Alert settings
    alert_threshold_high = Column(Float, default=300.0)  # ₦ for "worth switching"
    alert_threshold_low = Column(Float, default=100.0)   # ₦ for "maybe"
    enable_push_alerts = Column(Boolean, default=True)
    
    # Metadata
    created_at = timestamp_col()
    updated_at = timestamp_col(onupdate=True)
    
    def __repr__(self):
        return f"<UserPreference(user_id={self.user_id}, mode={self.transport_mode})>"


class SwitchingEvent(Base):
    """
    Track when users act on switching recommendations
    Used for personalization and metric tracking
    """
    __tablename__ = "switching_events"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Recommendation details
    from_store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    to_store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    
    # Net saving calculation
    net_saving_shown = Column(Float, nullable=False)  # What we told them
    distance_km = Column(Float, nullable=False)
    travel_time_min = Column(Float, nullable=False)
    
    # User action
    user_accepted = Column(Boolean, nullable=False)  # Did they follow recommendation?
    accepted_at = timestamp_col(auto=False)
    
    # Context
    basket_item_count = Column(Integer, nullable=False)
    basket_total_value = Column(Float, nullable=False)
    
    # Metadata
    created_at = timestamp_col()
    
    def __repr__(self):
        return f"<SwitchingEvent(user_id={self.user_id}, accepted={self.user_accepted})>"


class PriceAlert(Base):
    """
    User-configured price alerts with net saving triggers
    """
    __tablename__ = "price_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Alert criteria
    item_name = Column(String, nullable=False)  # Item to watch
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Trigger conditions
    target_price = Column(Float, nullable=True)  # Alert if price drops below this
    min_net_saving = Column(Float, nullable=True)  # Alert if net saving exceeds this
    max_distance_km = Column(Float, default=5.0)  # Only consider stores within radius
    
    # Status
    is_active = Column(Boolean, default=True)
    last_triggered_at = timestamp_col(auto=False)
    trigger_count = Column(Integer, default=0)
    
    # Metadata
    created_at = timestamp_col()
    updated_at = timestamp_col(onupdate=True)
    
    def __repr__(self):
        return f"<PriceAlert(user_id={self.user_id}, item={self.item_name})>"


# ==================== HELPER FUNCTIONS ====================

def get_or_create_user_preferences(user_id: int, db) -> UserPreference:
    """
    Get user preferences or create with defaults
    """
    prefs = db.query(UserPreference).filter(
        UserPreference.user_id == user_id
    ).first()
    
    if not prefs:
        prefs = UserPreference(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    return prefs


def update_willingness_to_travel(user_id: int, accepted: bool, net_saving: float, distance_km: float, db):
    """
    Update user's willingness to travel score based on behavior
    
    Learning algorithm:
    - If user accepts high net saving at long distance → increase score
    - If user rejects low net saving at short distance → decrease score
    - Score range: 0 (never travels) to 1 (always travels for savings)
    """
    prefs = get_or_create_user_preferences(user_id, db)
    
    # Current score
    current_score = prefs.willingness_to_travel_score
    
    # Calculate expected behavior (simple heuristic)
    value_per_km = net_saving / (distance_km + 0.1)  # Avoid division by zero
    
    if accepted:
        # User accepted - they're willing to travel for this value
        if value_per_km < 50:  # Low value per km
            # They're more willing than expected
            adjustment = 0.05
        else:
            # Expected behavior
            adjustment = 0.02
    else:
        # User rejected
        if value_per_km > 100:  # High value per km
            # They're less willing than expected
            adjustment = -0.05
        else:
            # Expected behavior
            adjustment = -0.02
    
    # Update score (with bounds)
    new_score = max(0.0, min(1.0, current_score + adjustment))
    prefs.willingness_to_travel_score = new_score
    
    # Also update average basket size
    db.commit()
    
    return new_score


def adjust_thresholds_for_user(base_threshold_high: float, base_threshold_low: float, prefs: UserPreference) -> tuple:
    """
    Personalize thresholds based on user's willingness to travel
    
    High willingness → lower thresholds (they'll travel for smaller savings)
    Low willingness → higher thresholds (need bigger savings to motivate)
    """
    willingness = prefs.willingness_to_travel_score
    
    # Scale thresholds inversely with willingness
    # willingness=0.5 (default) → no change
    # willingness=1.0 → thresholds * 0.5
    # willingness=0.0 → thresholds * 1.5
    scale_factor = 1.5 - willingness
    
    adjusted_high = base_threshold_high * scale_factor
    adjusted_low = base_threshold_low * scale_factor
    
    return adjusted_high, adjusted_low


class SellerVerification(Base):
    """Seller verification requests submitted during seller registration"""
    __tablename__ = "seller_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    seller_name = Column(String, nullable=False)
    matric_no = Column(String, nullable=False, index=True)
    faculty = Column(String, nullable=False)
    business_name = Column(String, nullable=False)
    business_description = Column(Text, nullable=True)
    business_category = Column(String, nullable=True)   # e.g. Food, Fashion, Electronics
    pickup_location = Column(String, nullable=True)     # Where buyers can collect orders
    email = Column(String, nullable=False)
    document_url = Column(String, nullable=True)        # Student ID card (Cloudinary URL)
    portal_screenshot_url = Column(String, nullable=True)  # Portal/SCIMS screenshot
    status = Column(String, default="Pending", index=True)  # Pending, Under Review, Approved, Rejected
    admin_notes = Column(Text, nullable=True)
    submitted_at = timestamp_col()
    reviewed_at = timestamp_col(auto=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    applicant = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class Announcement(Base):
    """Admin announcements/banners displayed to users."""
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="System")       # Promo, System, Maintenance
    audience = Column(String, default="All")       # All, Sellers, Buyers
    is_active = Column(Boolean, default=True, index=True)
    banner_url = Column(String, nullable=True)   # Cloudinary URL for homepage hero slide
    cta_label = Column(String, nullable=True)    # Button text, e.g. "Shop Now"
    cta_href = Column(String, nullable=True)     # Button URL, e.g. "/search?category=3"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = timestamp_col()
    updated_at = timestamp_col(onupdate=True)

    author = relationship("User")


class Report(Base):
    """User reports on listings or other users."""
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String, nullable=False)       # Listing, Seller, User
    target_id = Column(Integer, nullable=False)
    target_name = Column(String, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="Open", index=True)  # Open, Under Review, Resolved
    admin_notes = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = timestamp_col()
    resolved_at = timestamp_col(auto=False)

    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by])


class Dispute(Base):
    """Buyer vs seller complaints."""
    __tablename__ = "disputes"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    price_id = Column(Integer, ForeignKey("prices.id"), nullable=True)
    listing_name = Column(String, nullable=True)
    issue = Column(Text, nullable=False)
    status = Column(String, default="Open", index=True)  # Open, Under Review, Escalated, Resolved
    admin_notes = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = timestamp_col()
    resolved_at = timestamp_col(auto=False)

    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    resolver = relationship("User", foreign_keys=[resolved_by])


class AuditLog(Base):
    """Log of all admin actions for accountability."""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_name = Column(String, nullable=True)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=True)    # Verification, User, Listing, Announcement, Dispute, Report
    target_id = Column(Integer, nullable=True)
    target_desc = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)    # JSON blob for extra context
    created_at = timestamp_col(index=True)

    admin = relationship("User")


class Follow(Base):
    """Buyer follows a seller's storefront."""
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = timestamp_col()

    follower = relationship("User", foreign_keys=[follower_id])
    seller = relationship("User", foreign_keys=[seller_id])

    __table_args__ = (UniqueConstraint("follower_id", "seller_id", name="uq_follow"),)


class Inquiry(Base):
    """Message sent by a buyer to a seller via a listing."""
    __tablename__ = "inquiries"
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    seller_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    is_read = Column(Boolean, default=False)
    label = Column(String, nullable=True)              # Hot Lead / Pending / Completed / Spam
    created_at = timestamp_col()

    listing = relationship("Price", back_populates="inquiries")
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])


class Review(Base):
    """Star rating + review left after a completed interaction."""
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    seller_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating = Column(Integer, nullable=False)           # 1–5
    comment = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)          # Optional Cloudinary URL
    is_verified_interaction = Column(Boolean, default=False)  # Came from a completed inquiry
    seller_response = Column(Text, nullable=True)
    seller_response_at = timestamp_col(auto=False)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime, nullable=True)
    created_at = timestamp_col()
    uuid = Column(String, unique=True, nullable=True,
                  default=lambda: str(uuid_lib.uuid4()))

    reviewer = relationship("User", foreign_keys=[reviewer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    listing = relationship("Price")

    __table_args__ = (
        UniqueConstraint("reviewer_id", "listing_id", name="uq_review_per_listing"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating"),
    )


class Wishlist(Base):
    """Buyer saves a listing to their wishlist."""
    __tablename__ = "wishlists"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    listing_id  = Column(Integer, ForeignKey("prices.id", ondelete="CASCADE"), nullable=False)
    saved_price = Column(Float, nullable=True)  # BUG-008: price at time of saving
    created_at  = timestamp_col()

    user    = relationship("User")
    listing = relationship("Price")

    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_wishlist"),)


class Notification(Base):
    """In-app notifications for buyers and sellers."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)              # new_message, price_drop, restock, new_listing, review, sale
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    related_id = Column(Integer, nullable=True)        # listing_id / review_id / etc.
    related_type = Column(String, nullable=True)       # Listing, Review, Inquiry
    is_read = Column(Boolean, default=False)
    created_at = timestamp_col()
    action_url = Column(String, nullable=True)   # Block 3B — deep link on tap

    user = relationship("User")


# ── Block 2A: Login history ───────────────────────────────────────────────────

class LoginHistory(Base):
    """Records every successful login for security audit and session display."""
    __tablename__ = "login_history"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address   = Column(String, nullable=True)
    user_agent   = Column(String, nullable=True)
    device       = Column(String, nullable=True)   # e.g. "Chrome on Windows"
    location     = Column(String, nullable=True)   # best-effort city/country
    logged_in_at = timestamp_col()
    was_notified = Column(Boolean, default=False)

    user = relationship("User")


class BlockedUser(Base):
    """A user blocks another user (hides their messages & listings)."""
    __tablename__ = "blocked_users"
    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = timestamp_col()

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])

    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),)


class BannedEmail(Base):
    """Email addresses permanently blocked from registering on Campify.
    Populated when admin bans a user — preserved even if the user row is later deleted."""
    __tablename__ = "banned_emails"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    reason = Column(Text, nullable=True)
    banned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    original_user_id = Column(Integer, nullable=True)
    created_at = timestamp_col()


# ── Section 4: Orders & Leads ─────────────────────────────────────────────

class Order(Base):
    """
    Buyer places an order on a listing. Status flows:
    pending → met_up → completed → cancelled
    """
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    buyer_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status    = Column(String, default="pending", index=True)  # pending / met_up / completed / cancelled
    meetup_location = Column(String, nullable=True)
    created_at = timestamp_col()
    updated_at = timestamp_col(onupdate=True)
    uuid = Column(String, unique=True, nullable=True,
                  default=lambda: str(uuid_lib.uuid4()))

    listing = relationship("Price")
    buyer   = relationship("User", foreign_keys=[buyer_id])
    seller  = relationship("User", foreign_keys=[seller_id])


class Lead(Base):
    """
    Tracks 'interested' clicks — logged when a buyer clicks 'Message Seller'.
    ip_hash enables anonymous tracking without storing raw IPs.
    """
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_hash = Column(String, nullable=True)
    created_at = timestamp_col()

    listing = relationship("Price")
    buyer   = relationship("User")


# ── Block 1B: Cloudinary asset tracking ──────────────────────────────────────

class CloudinaryAsset(Base):
    """Tracks every file uploaded to Cloudinary for a user."""
    __tablename__ = "cloudinary_assets"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    public_id  = Column(String, nullable=False, unique=True)
    url        = Column(String, nullable=False)
    folder     = Column(String, nullable=False)
    asset_type = Column(String, nullable=False)
    # avatar | banner | id_card | portal_screenshot | listing_photo
    bytes      = Column(Integer, nullable=True)
    format     = Column(String, nullable=True)
    uploaded_at = timestamp_col()
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=True)

    owner   = relationship("User")
    listing = relationship("Price")


# ── Persistent Settings ────────────────────────────────────────────────────────

class UserSettings(Base):
    """
    Per-user persistent settings.
    Typed columns for frequently queried fields (theme, notif prefs, etc.).
    JSONB/JSON preferences column for minor UI prefs that need no indexing.
    One row per user — created on first /api/settings GET with role defaults.
    """
    __tablename__ = "user_settings"

    # ── Identity ──────────────────────────────────────────────────────────────
    id      = Column(Integer, primary_key=True, autoincrement=True)
    uuid    = uuid_column()
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)

    # ── Appearance ────────────────────────────────────────────────────────────
    theme    = Column(String(10),  default="light",  nullable=False)
    language = Column(String(10),  default="en",     nullable=False)

    # ── Buyer-specific typed columns ──────────────────────────────────────────
    profile_visibility = Column(String(20), default="unilag", nullable=False)
    show_dept          = Column(Boolean, default=True,  nullable=False)
    read_receipts      = Column(Boolean, default=True,  nullable=False)

    # ── Seller-specific typed columns ─────────────────────────────────────────
    store_status             = Column(String(20), default="open",  nullable=False)
    vacation_mode            = Column(Boolean, default=False, nullable=False)
    vacation_resume_date     = Column(String,  nullable=True)
    auto_renew_listings      = Column(Boolean, default=True,  nullable=False)
    default_negotiable       = Column(Boolean, default=False, nullable=False)
    default_listing_duration = Column(Integer, default=14,    nullable=False)
    default_pickup_location  = Column(String,  nullable=True)

    # ── Notification preferences ──────────────────────────────────────────────
    notif_email_messages      = Column(Boolean, default=True)
    notif_email_price_drop    = Column(Boolean, default=True)
    notif_email_new_listing   = Column(Boolean, default=False)
    notif_email_order_update  = Column(Boolean, default=True)
    notif_email_review        = Column(Boolean, default=True)
    notif_email_weekly_digest = Column(Boolean, default=True)
    notif_email_announcements = Column(Boolean, default=True)
    notif_email_verification  = Column(Boolean, default=True)
    notif_email_login_alert   = Column(Boolean, default=True)
    notif_email_inquiry       = Column(Boolean, default=True)
    notif_email_follower      = Column(Boolean, default=False)
    notif_email_expiry        = Column(Boolean, default=True)
    notif_email_competitor    = Column(Boolean, default=False)
    notif_email_karma         = Column(Boolean, default=False)
    notif_push_messages       = Column(Boolean, default=True)
    notif_push_price_drop     = Column(Boolean, default=False)
    notif_push_new_listing    = Column(Boolean, default=True)
    notif_push_order_update   = Column(Boolean, default=True)
    notif_push_review         = Column(Boolean, default=True)
    notif_push_announcements  = Column(Boolean, default=True)
    notif_push_inquiry        = Column(Boolean, default=True)
    notif_push_follower       = Column(Boolean, default=True)

    # ── Privacy ───────────────────────────────────────────────────────────────
    show_online_status  = Column(Boolean, default=True)
    show_last_seen      = Column(Boolean, default=True)
    allow_follow        = Column(Boolean, default=True)
    show_wishlist_count = Column(Boolean, default=False)
    show_review_history = Column(Boolean, default=True)

    # ── Security ──────────────────────────────────────────────────────────────
    two_factor_enabled = Column(Boolean, default=False)
    login_alerts       = Column(Boolean, default=True)

    # ── Flexible preferences (JSONB on Postgres, JSON on SQLite) ─────────────
    # Minor UI/UX prefs: compact_mode, listing_view, dashboard_layout, etc.
    # Do NOT store important typed booleans here — use dedicated columns above.
    preferences = Column(_JsonType, nullable=False, default=dict)

    # ── Sync tracking ─────────────────────────────────────────────────────────
    # Incremented on every PATCH — latest version wins on conflict
    version    = Column(Integer, default=1,  nullable=False)
    created_at = timestamp_col()
    updated_at = timestamp_col(index=True, onupdate=True)

    user = relationship("User", back_populates="settings", uselist=False)


# ── Block 2A: Admin event feed ────────────────────────────────────────────────

class SearchEvent(Base):
    """
    Block 8 — Search analytics event log.

    Two event types share one table:
      • "search" — a user issued a query. Captures result_count + engine.
      • "click"  — a user clicked a result. Captures clicked_uuid + position.

    Reasons for one denormalized table over two:
      • Identical context (query, user_id, ip_hash, created_at) for both.
      • Click-through-rate is a single GROUP BY query, not a JOIN.
      • Aggregations (top searches, zero-result queries, trending) are
        filtered by event_type with a covering index.

    Privacy: ip_hash is sha256(ip)[:32] — sufficient for distinct-user counts
    without storing raw IPs. user_id is FK with ON DELETE SET NULL so events
    survive account deletion for trend analysis.

    Retention is application-level — see search_analytics.purge_old_events.
    """
    __tablename__ = "search_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(10), nullable=False, index=True)  # "search" | "click"
    query = Column(String(200), nullable=False)
    result_count = Column(Integer, nullable=True)        # search only
    engine = Column(String(30), nullable=True)           # postgresql_fts | sqlite_fts5 | fallback_like
    clicked_uuid = Column(String, nullable=True)         # click only
    clicked_position = Column(Integer, nullable=True)    # click only — 1-indexed rank
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_hash = Column(String(64), nullable=True, index=True)
    created_at = timestamp_col(index=True)

    user = relationship("User")

    __table_args__ = (
        # Per-query trend queries: WHERE query = ? AND created_at >= ?
        Index("idx_search_events_query_time", "query", "created_at"),
        # Top/CTR/trending: WHERE event_type = ? AND created_at >= ? GROUP BY query
        Index("idx_search_events_type_time", "event_type", "created_at"),
        # Zero-result queries: filter on result_count IS NULL OR result_count = 0
        Index("idx_search_events_results", "result_count", "created_at"),
    )


class AdminEvent(Base):
    """
    Persistent log of platform events that require admin visibility.
    Drives the admin portal notification center.
    """
    __tablename__ = "admin_events"

    id          = Column(Integer, primary_key=True, index=True)
    event_type  = Column(String, nullable=False, index=True)
    # new_user | new_seller_application | verification_docs_uploaded |
    # new_listing | account_pause_request | account_delete_request |
    # account_paused | account_deleted | account_reactivated |
    # reactivation_requested | verification_approved | verification_rejected
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email  = Column(String, nullable=True)
    user_role   = Column(String, nullable=True)
    payload     = Column(Text, nullable=True)       # JSON string — doc URLs, listing details, etc.
    is_read     = Column(Boolean, default=False, index=True)
    requires_action = Column(Boolean, default=False, index=True)
    created_at  = timestamp_col(index=True)

    user = relationship("User")
