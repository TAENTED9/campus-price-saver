"""
Extended Admin Router — User Management, Announcements, Reports, Disputes, AuditLog, Categories.
All endpoints require a valid admin JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import json

from app.dependencies import get_db
from app.models import (
    User, Price, Category, FlashSale,
    Announcement, Report, Dispute, AuditLog, Notification,
)
from app.routers.auth import get_current_admin
from app.schemas import (
    UserSuspendRequest, UserBanRequest,
    AnnouncementCreate, AnnouncementUpdate, AnnouncementOut,
    ReportResolveRequest,
    DisputeUpdateRequest,
    AuditLogOut,
    CategoryCreate, CategoryUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin-extended"])


# ─── Audit Log Helper ──────────────────────────────────────────────────────────

def log_action(
    db: Session,
    admin: User,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    target_desc: Optional[str] = None,
    extra: Optional[dict] = None,
):
    """Write one row to audit_logs. Call before db.commit() in mutating endpoints."""
    entry = AuditLog(
        admin_id=admin.id,
        admin_name=admin.display_name or admin.username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_desc=target_desc,
        metadata_json=json.dumps(extra) if extra else None,
    )
    db.add(entry)


# ════════════════════════════════════════════════════════════════════════
#  USER MANAGEMENT
# ════════════════════════════════════════════════════════════════════════

@router.get("/users")
async def list_users(
    role: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "total": total,
        "data": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "balance": u.balance,
                "seller_points": u.seller_points,
                "is_suspended": getattr(u, "is_suspended", False),
                "is_banned": getattr(u, "is_banned", False),
                "suspended_until": u.suspended_until.isoformat() if getattr(u, "suspended_until", None) else None,
                "ban_reason": getattr(u, "ban_reason", None),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    body: UserSuspendRequest = Body(default=UserSuspendRequest()),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot suspend admin accounts")

    hours = body.hours or 24
    user.is_suspended = True
    user.suspended_until = datetime.utcnow() + timedelta(hours=hours)
    user.suspension_reason = body.reason

    log_action(db, current_admin, f"Suspended user for {hours}h",
               "User", user.id, user.username, {"reason": body.reason})
    db.commit()
    return {"success": True, "message": f"User suspended for {hours} hours"}


@router.patch("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    body: UserBanRequest = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot ban admin accounts")

    user.is_banned = True
    user.ban_reason = body.reason

    log_action(db, current_admin, "Permanently banned user",
               "User", user.id, user.username, {"reason": body.reason})
    db.commit()
    return {"success": True, "message": "User permanently banned"}


@router.patch("/users/{user_id}/restore")
async def restore_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_suspended = False
    user.is_banned = False
    user.suspended_until = None
    user.ban_reason = None
    user.suspension_reason = None

    log_action(db, current_admin, "Restored user account",
               "User", user.id, user.username)
    db.commit()
    return {"success": True, "message": "User account restored"}


# ════════════════════════════════════════════════════════════════════════
#  LISTING MODERATION
# ════════════════════════════════════════════════════════════════════════

@router.get("/listings")
async def list_all_prices(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Price)
    if status:
        query = query.filter(Price.status == status)
    total = query.count()
    prices = query.order_by(Price.submitted_at.desc()).offset(skip).limit(limit).all()

    # Get submitter usernames
    user_ids = {p.submitted_by for p in prices if p.submitted_by}
    users_map = {}
    if user_ids:
        users_list = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u.username or u.display_name or f"User #{u.id}" for u in users_list}

    # Get category names
    cat_ids = {p.category_id for p in prices if p.category_id}
    cat_map = {}
    if cat_ids:
        cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
        cat_map = {c.id: c.name for c in cats}

    return {
        "success": True,
        "total": total,
        "data": [
            {
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "price": p.price,
                "location": p.location,
                "retailer": p.retailer,
                "status": p.status,
                "submitted_by": p.submitted_by,
                "seller_name": users_map.get(p.submitted_by, "Unknown"),
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
                "created_at": p.submitted_at.isoformat() if p.submitted_at else None,
                "view_count": p.view_count or 0,
                "category_id": p.category_id,
                "category": cat_map.get(p.category_id, "Uncategorized"),
                "is_featured": p.is_featured or False,
                "is_flagged": p.status == "flagged",
                "flag_reason": getattr(p, "flag_reason", None),
            }
            for p in prices
        ],
    }


@router.get("/listings/{price_id}")
async def admin_get_listing_detail(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Full listing detail for admin review."""
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")

    seller = db.query(User).filter(User.id == price.submitted_by).first() if price.submitted_by else None
    category = db.query(Category).filter(Category.id == price.category_id).first() if price.category_id else None

    photos = []
    if price.photos:
        try:
            photos = json.loads(price.photos)
        except Exception:
            photos = []

    return {
        "success": True,
        "data": {
            "id": price.id,
            "name": price.name,
            "brand": price.brand,
            "price": price.price,
            "location": price.location,
            "retailer": price.retailer,
            "status": price.status,
            "listing_status": getattr(price, "listing_status", None),
            "description": price.description,
            "condition": getattr(price, "condition", None),
            "quantity": getattr(price, "quantity", 1),
            "is_negotiable": getattr(price, "is_negotiable", False),
            "delivery_options": getattr(price, "delivery_options", None),
            "subcategory": getattr(price, "subcategory", None),
            "photos": photos,
            "submitted_by": price.submitted_by,
            "seller_name": (seller.display_name or seller.username) if seller else "Unknown",
            "seller_username": seller.username if seller else None,
            "submitted_at": price.submitted_at.isoformat() if price.submitted_at else None,
            "view_count": price.view_count or 0,
            "category_id": price.category_id,
            "category": category.name if category else "Uncategorized",
            "is_featured": price.is_featured or False,
            "is_flagged": price.status == "flagged",
            "flag_reason": getattr(price, "flag_reason", None),
            "pack_size": getattr(price, "pack_size", None),
            "pack_unit": getattr(price, "pack_unit", None),
            "expires_at": price.expires_at.isoformat() if getattr(price, "expires_at", None) else None,
        },
    }


@router.patch("/listings/{price_id}/approve")
async def admin_approve_listing(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.status = "approved"
    if not price.listing_status or price.listing_status == "draft":
        price.listing_status = "active"
    log_action(db, current_admin, "Approved listing", "Listing", price.id, price.name)

    # Notify the seller so approved listings surface clearly on their dashboard
    if price.submitted_by:
        db.add(Notification(
            user_id=price.submitted_by,
            type="listing_approved",
            title="Listing approved",
            body=f'"{price.name}" is now live on your storefront.',
            related_id=price.id,
            related_type="Listing",
            action_url=f"/seller/listings",
        ))
    db.commit()
    return {"success": True, "message": "Listing approved"}


@router.patch("/listings/{price_id}/reject")
async def admin_reject_listing(
    price_id: int,
    reason: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.status = "rejected"
    log_action(db, current_admin, "Rejected listing", "Listing", price.id, price.name,
               {"reason": reason or ""})
    if price.submitted_by:
        db.add(Notification(
            user_id=price.submitted_by,
            type="listing_rejected",
            title="Listing rejected",
            body=f'"{price.name}" was not approved.' + (f" Reason: {reason}" if reason else ""),
            related_id=price.id,
            related_type="Listing",
            action_url=f"/seller/listings",
        ))
    db.commit()
    return {"success": True, "message": "Listing rejected"}


@router.delete("/listings/{price_id}")
async def admin_remove_listing(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    name = price.name
    log_action(db, current_admin, "Removed listing", "Listing", price_id, name)
    db.delete(price)
    db.commit()
    return {"success": True, "message": "Listing removed"}


@router.patch("/listings/{price_id}/flag")
async def admin_flag_listing(
    price_id: int,
    reason: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.status = "flagged"
    if reason:
        price.flag_reason = reason
    log_action(db, current_admin, "Flagged listing", "Listing", price.id, price.name,
               {"reason": reason or ""})
    if price.submitted_by:
        from app.models import Notification as _Notif
        db.add(_Notif(
            user_id=price.submitted_by,
            type="listing_flagged",
            title="Your listing has been flagged",
            body=(
                f'Your listing "{price.name}" has been flagged for review. '
                f"Please check it for policy compliance. "
                f"If you believe this is an error, contact support."
            ),
            related_id=price.id,
            related_type="Listing",
            is_read=False,
            action_url="/seller/listings",
        ))
    db.commit()
    return {"success": True, "message": "Listing flagged"}


@router.patch("/listings/{price_id}/unflag")
async def admin_unflag_listing(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.status = "approved"
    log_action(db, current_admin, "Cleared flagged listing", "Listing", price.id, price.name)
    db.commit()
    return {"success": True, "message": "Listing cleared"}


@router.put("/listings/{price_id}/feature")
async def admin_feature_listing(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.is_featured = True
    price.featured_until = datetime.utcnow() + timedelta(days=30)
    log_action(db, current_admin, "Featured listing", "Listing", price.id, price.name)
    db.commit()
    return {"success": True, "message": "Listing featured"}


@router.put("/listings/{price_id}/unfeature")
async def admin_unfeature_listing(
    price_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    price = db.query(Price).filter(Price.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="Listing not found")
    price.is_featured = False
    price.featured_until = None
    log_action(db, current_admin, "Unfeatured listing", "Listing", price.id, price.name)
    db.commit()
    return {"success": True, "message": "Listing unfeatured"}


# ════════════════════════════════════════════════════════════════════════
#  ANNOUNCEMENTS
# ════════════════════════════════════════════════════════════════════════

@router.get("/announcements")
async def list_announcements(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    items = db.query(Announcement).order_by(Announcement.created_at.desc()).all()
    return {
        "success": True,
        "data": [
            {
                "id": a.id,
                "title": a.title,
                "message": a.message,
                "type": a.type,
                "audience": a.audience,
                "is_active": a.is_active,
                "banner_url": a.banner_url,
                "cta_label": a.cta_label,
                "cta_href": a.cta_href,
                "created_by": a.created_by,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in items
        ],
    }


@router.post("/announcements", status_code=201)
async def create_announcement(
    data: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    ann = Announcement(**data.dict(), created_by=current_admin.id)
    db.add(ann)
    log_action(db, current_admin, "Published announcement", "Announcement", None, data.title)
    db.commit()
    db.refresh(ann)
    return {"success": True, "id": ann.id, "message": "Announcement published"}


@router.patch("/announcements/{ann_id}")
async def update_announcement(
    ann_id: int,
    data: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for field, value in data.dict(exclude_none=True).items():
        setattr(ann, field, value)
    log_action(db, current_admin, "Updated announcement", "Announcement", ann_id, ann.title)
    db.commit()
    return {"success": True, "message": "Announcement updated"}


@router.delete("/announcements/{ann_id}")
async def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    title = ann.title
    log_action(db, current_admin, "Deleted announcement", "Announcement", ann_id, title)
    db.delete(ann)
    db.commit()
    return {"success": True, "message": "Announcement deleted"}


# ════════════════════════════════════════════════════════════════════════
#  REPORTS
# ════════════════════════════════════════════════════════════════════════

@router.get("/reports")
async def list_reports(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    reports = query.order_by(Report.created_at.desc()).all()

    reporter_ids = {r.reporter_id for r in reports}
    users_map = {}
    if reporter_ids:
        users_list = db.query(User).filter(User.id.in_(reporter_ids)).all()
        users_map = {u.id: u.username or u.display_name or f"User #{u.id}" for u in users_list}

    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "reporter_name": users_map.get(r.reporter_id, "Unknown"),
                "target_type": r.target_type,
                "target_id": r.target_id,
                "target_name": r.target_name,
                "reason": r.reason,
                "status": r.status,
                "admin_notes": r.admin_notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            }
            for r in reports
        ],
    }


@router.patch("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: int,
    body: ReportResolveRequest = Body(default=ReportResolveRequest()),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "Resolved"
    report.admin_notes = body.admin_notes
    report.resolved_by = current_admin.id
    report.resolved_at = datetime.utcnow()
    log_action(db, current_admin, "Resolved report", "Report", report_id,
               f"{report.target_type}: {report.target_name}")
    db.commit()
    return {"success": True, "message": "Report resolved"}


@router.patch("/reports/{report_id}/review")
async def mark_report_under_review(
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "Under Review"
    db.commit()
    return {"success": True, "message": "Report marked under review"}


# ════════════════════════════════════════════════════════════════════════
#  DISPUTES
# ════════════════════════════════════════════════════════════════════════

@router.get("/disputes")
async def list_disputes(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Dispute)
    if status:
        query = query.filter(Dispute.status == status)
    disputes = query.order_by(Dispute.created_at.desc()).all()

    user_ids = set()
    for d in disputes:
        if d.buyer_id:
            user_ids.add(d.buyer_id)
        if d.seller_id:
            user_ids.add(d.seller_id)
    users_map = {}
    if user_ids:
        users_list = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u.username or u.display_name or f"User #{u.id}" for u in users_list}

    return {
        "success": True,
        "data": [
            {
                "id": d.id,
                "buyer_id": d.buyer_id,
                "buyer_name": users_map.get(d.buyer_id, "Unknown"),
                "seller_id": d.seller_id,
                "seller_name": users_map.get(d.seller_id, "Unknown") if d.seller_id else None,
                "price_id": d.price_id,
                "listing_name": d.listing_name,
                "issue": d.issue,
                "status": d.status,
                "admin_notes": d.admin_notes,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            }
            for d in disputes
        ],
    }


@router.patch("/disputes/{dispute_id}")
async def update_dispute(
    dispute_id: int,
    body: DisputeUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute.status = body.status
    if body.admin_notes:
        dispute.admin_notes = body.admin_notes
    if body.status == "Resolved":
        dispute.resolved_by = current_admin.id
        dispute.resolved_at = datetime.utcnow()
    log_action(db, current_admin, f"Updated dispute to {body.status}", "Dispute", dispute_id,
               dispute.listing_name)
    db.commit()
    return {"success": True, "message": f"Dispute updated to {body.status}"}


# ════════════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ════════════════════════════════════════════════════════════════════════

@router.get("/audit-log")
async def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    target_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(AuditLog)
    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "total": total,
        "data": [
            {
                "id": l.id,
                "admin_id": l.admin_id,
                "admin_name": l.admin_name,
                "action": l.action,
                "target_type": l.target_type,
                "target_id": l.target_id,
                "target_desc": l.target_desc,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }


# ════════════════════════════════════════════════════════════════════════
#  CATEGORIES
# ════════════════════════════════════════════════════════════════════════

@router.get("/categories")
async def list_categories(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    cats = db.query(Category).all()
    # Get listing counts per category
    from sqlalchemy import func
    counts = dict(
        db.query(Price.category_id, func.count(Price.id))
        .group_by(Price.category_id)
        .all()
    )
    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "name": c.name,
                "icon": c.icon,
                "description": c.description,
                "listing_count": counts.get(c.id, 0),
            }
            for c in cats
        ],
    }


@router.post("/categories", status_code=201)
async def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = Category(name=data.name, icon=data.icon, description=data.description)
    db.add(cat)
    log_action(db, current_admin, "Created category", "Category", None, data.name)
    db.commit()
    db.refresh(cat)
    return {"success": True, "id": cat.id, "message": "Category created"}


@router.patch("/categories/{cat_id}")
async def update_category(
    cat_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.dict(exclude_none=True).items():
        setattr(cat, field, value)
    log_action(db, current_admin, "Updated category", "Category", cat_id, cat.name)
    db.commit()
    return {"success": True, "message": "Category updated"}


@router.delete("/categories/{cat_id}")
async def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # Check if has listings
    count = db.query(Price).filter(Price.category_id == cat_id).count()
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {count} listings")
    name = cat.name
    log_action(db, current_admin, "Deleted category", "Category", cat_id, name)
    db.delete(cat)
    db.commit()
    return {"success": True, "message": "Category deleted"}


# ════════════════════════════════════════════════════════════════════════
#  FLASH SALES (ADMIN VIEW)
# ════════════════════════════════════════════════════════════════════════

@router.get("/flash-sales")
async def admin_list_flash_sales(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    sales = db.query(FlashSale).order_by(FlashSale.created_at.desc()).all()
    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "price_id": s.price_id,
                "seller_id": s.seller_id,
                "title": s.title,
                "original_price": s.original_price,
                "sale_price": s.sale_price,
                "discount_pct": s.discount_pct,
                "start_time": s.start_time.isoformat() if s.start_time else None,
                "end_time": s.end_time.isoformat() if s.end_time else None,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "item_name": s.price_item.name if s.price_item else None,
            }
            for s in sales
        ],
    }
