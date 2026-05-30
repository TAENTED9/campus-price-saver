"""
Extended Admin Router — User Management, Announcements, Reports, Disputes, AuditLog, Categories.
All endpoints require a valid admin JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import json
import logging

logger = logging.getLogger(__name__)

from app.dependencies import get_db
from app.models import (
    User, Price, Category, FlashSale,
    Announcement, Report, Dispute, AuditLog, Notification, BannedEmail,
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

# FIX #14: GET /admin/users moved to app/routers/admin_stats.py
# (the canonical handler — this duplicate was shadowed by route order).


@router.patch("/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    body: UserSuspendRequest = Body(default=UserSuspendRequest()),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Indefinite suspension. Lifts only when admin calls /restore.
    Time-boxed suspensions are gone — the UI label says 'Suspend until I unsuspend'."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot suspend admin accounts")

    reason = body.reason or "Admin suspension"
    user.is_suspended = True
    user.suspended_until = None
    user.suspension_reason = reason
    user.is_paused = True
    user.paused_at = datetime.utcnow()
    user.paused_by = "admin"
    user.pause_reason = reason

    if user.role == "seller":
        db.query(Price).filter(
            Price.submitted_by == user_id, Price.listing_status == "active"
        ).update({"listing_status": "paused"}, synchronize_session=False)

    log_action(db, current_admin, "Suspended user (indefinite)",
               "User", user.id, user.username, {"reason": reason})
    db.commit()

    # Email + in-app notification
    try:
        from app.tasks.email_tasks import send_email
        from app.services.email_templates import ACCOUNT_SUSPENDED_EMAIL
        if user.email:
            send_email.delay(
                to=user.email,
                subject="Your Campify account has been suspended",
                body=ACCOUNT_SUSPENDED_EMAIL(user.display_name or user.username or "User", reason),
            )
    except Exception as e:
        print(f"[suspend_user] email enqueue failed: {e}")

    db.add(Notification(
        user_id=user.id,
        type="account_suspended",
        title="Account suspended",
        body=f"Your account has been suspended. Reason: {reason}",
        action_url="/support",
    ))
    db.commit()

    return {"success": True, "message": "User suspended indefinitely"}


@router.patch("/users/{user_id}/ban")
async def ban_user(
    user_id: int,
    body: UserBanRequest = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Permanent ban. Blacklists the email so it can't re-register."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot ban admin accounts")

    reason = body.reason or "Severe policy violation"
    user.is_banned = True
    user.ban_reason = reason
    user.is_paused = True
    user.paused_at = datetime.utcnow()
    user.paused_by = "admin"
    user.pause_reason = reason

    # Hide all listings
    if user.role == "seller":
        db.query(Price).filter(
            Price.submitted_by == user_id, Price.listing_status == "active"
        ).update({"listing_status": "paused"}, synchronize_session=False)

    # Blacklist the email — survives even if user row is later deleted.
    email_norm = (user.email or "").strip().lower()
    if email_norm:
        existing = db.query(BannedEmail).filter(BannedEmail.email == email_norm).first()
        if not existing:
            db.add(BannedEmail(
                email=email_norm,
                reason=reason,
                banned_by=current_admin.id,
                original_user_id=user.id,
            ))

    log_action(db, current_admin, "Permanently banned user",
               "User", user.id, user.username, {"reason": reason, "email": email_norm})
    db.commit()

    # Email + in-app notification
    try:
        from app.tasks.email_tasks import send_email
        from app.services.email_templates import ACCOUNT_BANNED_EMAIL
        if user.email:
            send_email.delay(
                to=user.email,
                subject="Your Campify account has been permanently banned",
                body=ACCOUNT_BANNED_EMAIL(user.display_name or user.username or "User", reason),
            )
    except Exception as e:
        print(f"[ban_user] email enqueue failed: {e}")

    db.add(Notification(
        user_id=user.id,
        type="account_banned",
        title="Account banned",
        body=f"Your account has been permanently banned. Reason: {reason}",
        action_url="/support",
    ))
    db.commit()

    return {"success": True, "message": "User permanently banned"}


@router.patch("/users/{user_id}/restore")
async def restore_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Lift every active hold: suspension, pause, ban. Removes email from blacklist."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    was_banned = bool(user.is_banned)

    user.is_suspended = False
    user.is_banned = False
    user.suspended_until = None
    user.ban_reason = None
    user.suspension_reason = None
    user.is_paused = False
    user.paused_at = None
    user.paused_by = None
    user.pause_reason = None

    # Un-hide listings paused by the suspension/ban
    if user.role == "seller":
        db.query(Price).filter(
            Price.submitted_by == user_id, Price.listing_status == "paused"
        ).update({"listing_status": "active"}, synchronize_session=False)

    # Lift email blacklist if this user's email was on it.
    email_norm = (user.email or "").strip().lower()
    if email_norm:
        db.query(BannedEmail).filter(BannedEmail.email == email_norm).delete(synchronize_session=False)

    log_action(db, current_admin, "Restored user account",
               "User", user.id, user.username, {"was_banned": was_banned})
    db.commit()

    # Email + in-app
    try:
        from app.tasks.email_tasks import send_email
        from app.services.email_templates import ACCOUNT_REACTIVATED_EMAIL
        if user.email:
            send_email.delay(
                to=user.email,
                subject="Your Campify account has been restored",
                body=ACCOUNT_REACTIVATED_EMAIL(user.display_name or user.username or "User"),
            )
    except Exception as e:
        print(f"[restore_user] email enqueue failed: {e}")

    db.add(Notification(
        user_id=user.id,
        type="account_restored",
        title="Account restored",
        body="Your account has been reactivated. Welcome back!",
        action_url="/",
    ))
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
            if not isinstance(photos, list):
                photos = []
        except Exception:
            photos = []
    videos = []
    if getattr(price, "videos", None):
        try:
            videos = json.loads(price.videos)
            if not isinstance(videos, list):
                videos = []
        except Exception:
            videos = []

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
            "videos": videos,
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

    # Fan out matching price-alert notifications. Approval is the moment the
    # listing becomes visible to buyers, so it's the right place to fire.
    try:
        from app.services.price_alerts import notify_matching_price_alerts
        notify_matching_price_alerts(db, price)
    except Exception as e:
        logger.warning(f"[admin_approve_listing] price-alert fan-out failed for listing {price.id}: {e}")

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

    try:
        from app.services.listing_cleanup import delete_listing_with_children
        log_action(db, current_admin, "Removed listing", "Listing", price_id, name)
        delete_listing_with_children(db, price)
        db.commit()
        return {"success": True, "message": "Listing removed"}

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete listing {price_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete listing: {e}",
        )


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

    seller = None
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
        seller = db.query(User).filter(User.id == price.submitted_by).first()
    db.commit()

    # Email the seller about the flag (fire-and-forget via Celery)
    if seller and seller.email:
        try:
            from app.tasks.email_tasks import send_email
            from app.services.email_templates import LISTING_FLAGGED_EMAIL
            send_email.delay(
                to=seller.email,
                subject=f'Your Campify listing "{price.name}" has been flagged',
                body=LISTING_FLAGGED_EMAIL(
                    seller.display_name or seller.username or "Seller",
                    price.name,
                    reason or "",
                ),
            )
        except Exception as e:
            logger.warning(f"[admin_flag_listing] email enqueue failed for listing {price.id}: {e}")

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
#  ANNOUNCEMENTS — canonical handlers live in app/routers/admin_stats.py
#  (GET/POST/PATCH/DELETE /admin/announcements). FIX #14 removed the
#  duplicates here that were silently shadowed.
# ════════════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════════════
#  REPORTS — canonical handlers live in app/routers/admin_stats.py
#  (GET /admin/reports, PATCH /admin/reports/{id}/resolve|review).
#  FIX #14 removed the duplicates here that were silently shadowed.
# ════════════════════════════════════════════════════════════════════════


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
