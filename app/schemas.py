from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List

_XSS_PATTERNS = ("<script", "javascript:")


def _reject_xss(value: str) -> str:
    """Strip whitespace and block obvious XSS payloads in any text field."""
    v = value.strip()
    lower = v.lower()
    for pattern in _XSS_PATTERNS:
        if pattern in lower:
            raise ValueError(f"Invalid content detected in field")
    return v

# ============ Category System (Simplified - 3 Categories Only) ============

class CategoryBase(BaseModel):
    name: str  # EDIBLES, DRINKS, or NON-EDIBLES
    icon: Optional[str] = None
    description: Optional[str] = None
    
    @validator('name')
    def validate_category_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Category name cannot be empty')
        if len(v) > 100:
            raise ValueError('Category name cannot exceed 100 characters')
        return _reject_xss(v)

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int

    class Config:
        from_attributes = True

# ============ Price (Enhanced with Item Details & Validation) ============

class PriceBase(BaseModel):
    category_id: int = Field(gt=0, description="Valid category ID")
    store_id: Optional[int] = Field(None, gt=0, description="Valid store ID if provided")
    name: str = Field(..., min_length=1, max_length=255, description="Item name")
    brand: Optional[str] = Field(None, max_length=100, description="Brand name")
    pack_size: Optional[str] = Field(None, max_length=50, description="Pack size (e.g., '500ml')")
    pack_unit: Optional[str] = Field(None, max_length=20, description="Pack unit (e.g., 'ml', 'kg')")
    price: float = Field(..., gt=0, le=10000000, description="Price in ₦ (must be positive)")
    price_per_unit: Optional[float] = Field(None, gt=0, description="Price per unit if applicable")
    retailer: Optional[str] = Field(None, max_length=100, description="Retailer name")
    location: Optional[str] = Field(None, max_length=200, description="Store location")
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Item name cannot be empty')
        return _reject_xss(v)
    
    @validator('price')
    def validate_price(cls, v):
        """Validate price is positive and reasonable"""
        if v <= 0:
            raise ValueError('Price must be greater than 0')
        if v > 10000000:
            raise ValueError('Price cannot exceed ₦10,000,000')
        return v
    
    @validator('price_per_unit')
    def validate_price_per_unit(cls, v):
        """Validate price per unit if provided"""
        if v is not None and v <= 0:
            raise ValueError('Price per unit must be greater than 0')
        return v
    
    @validator('pack_size')
    def validate_pack_size(cls, v):
        """Validate pack size format"""
        if v is not None and len(v.strip()) == 0:
            return None
        return v

class PriceCreate(PriceBase):
    pass

class PriceOut(PriceBase):
    id: int
    submitted_by: Optional[int] = None
    submitted_at: datetime
    status: str
    view_count: int = 0
    is_featured: bool = False
    featured_until: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Flash Sales ============

class FlashSaleCreate(BaseModel):
    price_id: int = Field(gt=0)
    title: Optional[str] = Field(None, max_length=100)
    discount_pct: float = Field(..., gt=0, le=100)
    end_time: datetime

class FlashSaleOut(BaseModel):
    id: int
    price_id: int
    seller_id: int
    title: Optional[str]
    original_price: float
    sale_price: float
    discount_pct: float
    start_time: datetime
    end_time: datetime
    is_active: bool
    created_at: datetime
    # Joined price details
    item_name: Optional[str] = None
    item_brand: Optional[str] = None
    item_location: Optional[str] = None
    item_retailer: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Points ============

class PointsTransactionOut(BaseModel):
    id: int
    user_id: int
    amount: int
    reason: Optional[str]
    related_price_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True

# ============ Legacy (for backward compatibility) ============

class ItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    
    @validator('name')
    def validate_item_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Item name cannot be empty')
        return _reject_xss(v)

class ItemCreate(ItemBase):
    pass

class ItemOut(ItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ItemSubmissionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    price: float = Field(..., gt=0, le=10000000)
    location: str = Field(..., min_length=1, max_length=255)
    submitter_email: Optional[str] = Field(None, max_length=255)
    
    @validator('price')
    def validate_submission_price(cls, v):
        if v <= 0 or v > 10000000:
            raise ValueError('Price must be between 0 and ₦10,000,000')
        return v

class ItemSubmissionOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    price: float
    location: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class PendingPriceCreate(BaseModel):
    item: str
    parsed_price: Optional[float] = None
    location_text: Optional[str] = None
    submitter_email: Optional[str] = None

class PendingPriceOut(BaseModel):
    id: int
    item: str
    parsed_price: Optional[float]
    location_text: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class HeatmapLocation(BaseModel):
    key: str
    name: str
    store_id: Optional[int]
    lat: Optional[float]
    lng: Optional[float]
    count: int
    avg_price: float
    min_price: float
    max_price: float
    intensity: float


class HeatmapResponse(BaseModel):
    item: str
    days: int
    generated_at: datetime
    heatmap: List[HeatmapLocation]

    class Config:
        from_attributes = True

class CheapestLocation(BaseModel):
    price: float
    store: Optional[dict]
    submitted_at: datetime

class SearchResponse(BaseModel):
    item: str
    cheapest: Optional[CheapestLocation]
    top5: List[CheapestLocation]
    heatmap_path: Optional[str]

# Alias for backwards compatibility
PendingPriceResponse = PendingPriceOut


# ============ Admin User Management ============

class UserOut(BaseModel):
    id: int
    username: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str
    balance: float = 0.0
    seller_points: int = 0
    is_suspended: bool = False
    is_banned: bool = False
    suspended_until: Optional[datetime] = None
    ban_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserSuspendRequest(BaseModel):
    reason: Optional[str] = None
    hours: Optional[int] = 24

class UserBanRequest(BaseModel):
    reason: str


# ============ Announcements ============

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    type: str = Field(default="System")
    audience: str = Field(default="All")
    is_active: bool = True

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    audience: Optional[str] = None
    is_active: Optional[bool] = None

class AnnouncementOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    audience: str
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Reports ============

class ReportOut(BaseModel):
    id: int
    reporter_id: int
    reporter_name: Optional[str] = None
    target_type: str
    target_id: int
    target_name: Optional[str] = None
    reason: str
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ReportResolveRequest(BaseModel):
    admin_notes: Optional[str] = None


# ============ Disputes ============

class DisputeOut(BaseModel):
    id: int
    buyer_id: int
    buyer_name: Optional[str] = None
    seller_id: Optional[int] = None
    seller_name: Optional[str] = None
    price_id: Optional[int] = None
    listing_name: Optional[str] = None
    issue: str
    status: str
    admin_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DisputeUpdateRequest(BaseModel):
    status: str
    admin_notes: Optional[str] = None


# ============ Audit Log ============

class AuditLogOut(BaseModel):
    id: int
    admin_id: int
    admin_name: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    target_desc: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Category Admin ============

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
