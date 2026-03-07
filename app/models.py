from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)  # For auth
    password_hash = Column(String, nullable=True)  # Hashed password
    email = Column(String, unique=True, index=True, nullable=True)  # Made nullable for backward compat
    email_verified = Column(Boolean, default=False)
    display_name = Column(String, nullable=True)
    role = Column(String, default="student")
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
    is_suspended = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    suspended_until = Column(DateTime, nullable=True)
    ban_reason = Column(Text, nullable=True)
    suspension_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pending_prices = relationship("PendingPrice", back_populates="submitter")
    transactions = relationship("Transaction", back_populates="user")


class EmailOTP(Base):
    """Short-lived OTP tokens for email verification."""
    __tablename__ = "email_otps"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    otp_hash = Column(String, nullable=False)           # Argon2 hash of the 6-digit code
    purpose = Column(String, default="verify_email")    # verify_email | password_reset
    used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    created_at = Column(DateTime, default=datetime.utcnow)

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
    location = Column(String, nullable=True)  # Location/area
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    
    # Marketplace listing fields
    description = Column(Text, nullable=True)
    condition = Column(String, default="New")              # New / Fairly Used / Used
    quantity = Column(Integer, default=1)
    is_negotiable = Column(Boolean, default=False)
    delivery_options = Column(String, nullable=True)       # comma-sep: "pickup,delivery"
    duration_days = Column(Integer, nullable=True)         # 7 / 14 / 30
    expires_at = Column(DateTime, nullable=True)
    listing_status = Column(String, default="active", index=True)  # draft/active/paused/sold/expired
    photos = Column(Text, nullable=True)                   # JSON array of Cloudinary URLs (up to 5)
    subcategory = Column(String, nullable=True)

    # Status
    status = Column(String, default="pending", index=True)  # pending, approved, rejected

    # Discovery & engagement
    view_count = Column(Integer, default=0, index=True)

    # Featured/promoted (paid with seller points)
    is_featured = Column(Boolean, default=False, index=True)
    featured_until = Column(DateTime, nullable=True)

    category = relationship("Category", back_populates="prices")
    store = relationship("Store", back_populates="prices")
    flash_sales = relationship("FlashSale", back_populates="price_item")
    inquiries = relationship("Inquiry", back_populates="listing")


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

    start_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=False)        # When sale expires
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class PendingPrice(Base):
    __tablename__ = "pending_prices"
    id = Column(Integer, primary_key=True, index=True)
    item = Column(String, nullable=False)
    parsed_price = Column(Float, nullable=True)
    image_path = Column(String, nullable=True)    # path to uploaded image
    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location_text = Column(String, nullable=True)     # user-entered location/canteen name
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # e.g., pending, approved, rejected
    admin_notes = Column(Text, nullable=True)

    submitter = relationship("User", back_populates="pending_prices")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)


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
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    accepted_at = Column(DateTime, nullable=True)
    
    # Context
    basket_item_count = Column(Integer, nullable=False)
    basket_total_value = Column(Float, nullable=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<SwitchingEvent(user_id={self.user_id}, accepted={self.user_accepted})>"


class PriceAlert(Base):
    """
    User-configured price alerts with net saving triggers
    """
    __tablename__ = "price_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Alert criteria
    item_name = Column(String, nullable=False)  # Item to watch
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Trigger conditions
    target_price = Column(Float, nullable=True)  # Alert if price drops below this
    min_net_saving = Column(Float, nullable=True)  # Alert if net saving exceeds this
    max_distance_km = Column(Float, default=5.0)  # Only consider stores within radius
    
    # Status
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    trigger_count = Column(Integer, default=0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
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
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
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
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User")


class Report(Base):
    """User reports on listings or other users."""
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_type = Column(String, nullable=False)       # Listing, Seller, User
    target_id = Column(Integer, nullable=False)
    target_name = Column(String, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String, default="Open", index=True)  # Open, Under Review, Resolved
    admin_notes = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

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
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

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
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    admin = relationship("User")


class Follow(Base):
    """Buyer follows a seller's storefront."""
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    is_read = Column(Boolean, default=False)
    label = Column(String, nullable=True)              # Pending / Completed / Spam
    created_at = Column(DateTime, default=datetime.utcnow)

    listing = relationship("Price", back_populates="inquiries")
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])


class Review(Base):
    """Star rating + review left after a completed interaction."""
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)           # 1–5
    comment = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)          # Optional Cloudinary URL
    is_verified_interaction = Column(Boolean, default=False)  # Came from a completed inquiry
    seller_response = Column(Text, nullable=True)
    seller_response_at = Column(DateTime, nullable=True)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("prices.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    listing = relationship("Price")

    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_wishlist"),)


class Notification(Base):
    """In-app notifications for buyers and sellers."""
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)              # new_message, price_drop, restock, new_listing, review, sale
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    related_id = Column(Integer, nullable=True)        # listing_id / review_id / etc.
    related_type = Column(String, nullable=True)       # Listing, Review, Inquiry
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class BlockedUser(Base):
    """A user blocks another user (hides their messages & listings)."""
    __tablename__ = "blocked_users"
    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])

    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),)
