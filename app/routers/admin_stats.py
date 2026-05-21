"""
Admin statistics and seller verification management router.
All endpoints require a valid admin JWT token.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, text as sa_text
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
import asyncio
import json
import time

from app.dependencies import get_db
from app.models import User, Price, PendingPrice, SellerVerification, AdminEvent, CloudinaryAsset, Announcement, Report, Order
from app.routers.auth import get_current_admin, decode_access_token
from app.routers.admin_users import log_action

# Simple in-memory analytics cache (Block 6A)
_analytics_cache: dict = {"data": None, "expires_at": 0.0}

router = APIRouter(prefix="/admin", tags=["admin-stats"])

# FIX #14: This router and app/routers/admin_users.py both mount at /admin.
# Their non-overlapping handlers coexist fine. The previously-shadowed
# duplicates (/admin/users list, /admin/announcements*, /admin/reports*)
# have been removed from admin_users.py — this file is the canonical
# implementation for those paths.


# ── Pydantic schemas ──────────────────────────────────────────────────────────

import re as _re
_MATRIC_PATTERN = _re.compile(r"^\d{9}(/[A-Z]{2,4})?$")


class SellerVerificationCreate(BaseModel):
    seller_name: str
    matric_no: str
    faculty: str
    business_name: str
    business_description: Optional[str] = None
    business_category: Optional[str] = None
    pickup_location: Optional[str] = None
    email: str
    document_url: Optional[str] = None
    portal_screenshot_url: Optional[str] = None
    user_id: Optional[int] = None

    @field_validator("matric_no", mode="before")
    @classmethod
    def _normalise_matric(cls, v):
        if v is None:
            raise ValueError("Matric number is required")
        s = str(v).strip().upper()
        if not _MATRIC_PATTERN.match(s):
            raise ValueError(
                "Matric number must be 9 digits, optionally with '/XX' suffix (e.g. 190101001 or 190101001/ED)"
            )
        return s

    @field_validator("user_id", mode="before")
    @classmethod
    def _coerce_user_id(cls, v):
        if v is None or v == "" or v == "null":
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None


class RejectBody(BaseModel):
    admin_notes: Optional[str] = None


# ── Platform statistics ───────────────────────────────────────────────────────

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Return high-level platform statistics for the admin overview cards."""
    student_count = db.query(User).filter(User.role != "admin").count()

    pending_verif = (
        db.query(SellerVerification)
        .filter(SellerVerification.status.in_(["Pending", "Under Review"]))
        .count()
    )

    active_listings = (
        db.query(Price).filter(Price.status == "approved").count()
    )

    open_reports = (
        db.query(Report).filter(Report.status == "pending").count()
    )

    # New users registered today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    new_today = (
        db.query(User)
        .filter(User.role != "admin", User.created_at >= today_start)
        .count()
    )

    return {
        "success": True,
        "data": {
            "registeredStudents": student_count,
            "pendingVerifications": pending_verif,
            "activeListings": active_listings,
            "openReports": open_reports,
            "newUsersToday": new_today,
        },
    }


# ── Monthly analytics (for charts) ───────────────────────────────────────────

@router.get("/analytics/monthly")
async def get_monthly_analytics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Return 12-month submission counts and revenue aggregates for charts."""
    now = datetime.utcnow()
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    months_list: list[dict] = []

    for offset in range(11, -1, -1):
        # Walk back month by month
        m = (now.month - offset - 1) % 12 + 1
        y = now.year - ((now.month - offset - 1) // 12)

        count = (
            db.query(Price)
            .filter(
                extract("month", Price.submitted_at) == m,
                extract("year", Price.submitted_at) == y,
            )
            .count()
        )

        total_revenue = (
            db.query(func.sum(Price.price))
            .filter(
                extract("month", Price.submitted_at) == m,
                extract("year", Price.submitted_at) == y,
                Price.status == "approved",
            )
            .scalar()
            or 0
        )

        months_list.append({
            "month": month_names[m - 1],
            "submissions": count,
            "revenue": round(float(total_revenue), 2),
        })

    return {
        "success": True,
        "data": {
            "months": months_list,
        },
    }


# ── Seller verification CRUD ──────────────────────────────────────────────────

@router.get("/verification/")
async def list_verifications(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """List seller verification requests (defaults to pending/under-review)."""
    query = db.query(SellerVerification)
    if status_filter:
        query = query.filter(SellerVerification.status == status_filter)
    else:
        query = query.filter(
            SellerVerification.status.in_(["Pending", "Under Review"])
        )

    verifications = query.order_by(SellerVerification.submitted_at.desc()).all()

    return {
        "success": True,
        "data": [
            {
                "id": v.id,
                "user_id": v.user_id,
                "seller_name": v.seller_name,
                "matric_no": v.matric_no,
                "faculty": v.faculty,
                "business_name": v.business_name,
                "business_category": getattr(v, "business_category", None),
                "pickup_location": getattr(v, "pickup_location", None),
                "email": v.email,
                "document_url": v.document_url,
                "portal_screenshot_url": getattr(v, "portal_screenshot_url", None),
                "submitted_at": v.submitted_at.isoformat() if v.submitted_at else None,
                "status": v.status,
                "admin_notes": v.admin_notes,
            }
            for v in verifications
        ],
        "count": len(verifications),
    }


@router.get("/verification/{verification_id}")
async def get_verification_detail(
    verification_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get full details of a single verification request."""
    v = (
        db.query(SellerVerification)
        .filter(SellerVerification.id == verification_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    return {
        "success": True,
        "data": {
            "id": v.id,
            "user_id": v.user_id,
            "seller_name": v.seller_name,
            "matric_no": v.matric_no,
            "faculty": v.faculty,
            "business_name": v.business_name,
            "business_description": v.business_description,
            "business_category": getattr(v, "business_category", None),
            "pickup_location": getattr(v, "pickup_location", None),
            "email": v.email,
            "document_url": v.document_url,
            "portal_screenshot_url": getattr(v, "portal_screenshot_url", None),
            "status": v.status,
            "admin_notes": v.admin_notes,
            "submitted_at": v.submitted_at.isoformat() if v.submitted_at else None,
            "reviewed_at": v.reviewed_at.isoformat() if v.reviewed_at else None,
            "reviewed_by": v.reviewed_by,
        },
    }


@router.patch("/verification/{verification_id}/review")
async def mark_under_review(
    verification_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Mark a verification as 'Under Review'."""
    v = (
        db.query(SellerVerification)
        .filter(SellerVerification.id == verification_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")
    v.status = "Under Review"
    db.commit()
    return {"success": True, "message": "Marked as under review"}


@router.patch("/verification/{verification_id}/approve")
async def approve_verification(
    verification_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Approve a seller verification and promote the user to 'seller' role."""
    v = (
        db.query(SellerVerification)
        .filter(SellerVerification.id == verification_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    v.status = "Approved"
    v.reviewed_at = datetime.utcnow()
    v.reviewed_by = current_admin.id

    # Promote the linked user to seller role
    if v.user_id:
        user = db.query(User).filter(User.id == v.user_id).first()
        if user:
            user.role = "seller"
            # Award 100 karma points for getting verified
            from app.models import PointsTransaction, Notification
            user.seller_points = (user.seller_points or 0) + 100
            db.add(PointsTransaction(user_id=user.id, amount=100, reason="seller_verified"))
            try:
                from app.services.karma import award_karma
                award_karma(user.id, 100, "get_verified", db, reference_id=str(v.id))
            except Exception:
                pass
            # Recalc trust tier
            pts = user.seller_points
            if pts >= 500:
                user.trust_tier = "top_seller"
            elif pts >= 200:
                user.trust_tier = "trusted"
            elif pts >= 50:
                user.trust_tier = "rising"
            else:
                user.trust_tier = "new_seller"
            # Block 3A — typed in-app notification with deep link
            db.add(Notification(
                user_id=user.id,
                type="verification_approved",
                title="Seller account verified",
                body=(
                    "Congratulations! Your UNILAG seller badge is now live. "
                    "You earned 100 karma points. Start listing products."
                ),
                action_url="/seller/listings/new",
            ))

    log_action(db, current_admin, "Approved seller verification",
               "Verification", v.id, v.seller_name)
    db.commit()

    # Block 3A — email via template (fire-and-forget)
    try:
        import asyncio as _asyncio
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import VERIFICATION_APPROVED_EMAIL
        _asyncio.create_task(send_user_email_bg(
            v.email,
            "Seller account approved — Campify",
            VERIFICATION_APPROVED_EMAIL(v.seller_name),
        ))
    except Exception:
        pass

    # Block 3C — structured admin event
    try:
        from app.services.admin_notifications import notify_admin
        await notify_admin(db, "verification_approved", v.user_id, v.email, "seller",
                           {"seller_name": v.seller_name})
    except Exception:
        pass

    return {"success": True, "message": "Seller verification approved"}


@router.patch("/verification/{verification_id}/reject")
async def reject_verification(
    verification_id: int,
    body: RejectBody = Body(default=RejectBody()),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Reject a seller verification with optional admin notes."""
    v = (
        db.query(SellerVerification)
        .filter(SellerVerification.id == verification_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Verification not found")

    v.status = "Rejected"
    v.reviewed_at = datetime.utcnow()
    v.reviewed_by = current_admin.id
    if body.admin_notes:
        v.admin_notes = body.admin_notes

    # Block 3B — typed in-app notification with deep link
    if v.user_id:
        _user = db.query(User).filter(User.id == v.user_id).first()
        if _user:
            from app.models import Notification as _Notif
            db.add(_Notif(
                user_id=_user.id,
                type="verification_rejected",
                title="Seller verification update",
                body=(
                    f"Your verification was not approved. "
                    f"Reason: {body.admin_notes or 'See admin notes'}. "
                    "You can resubmit documents in Settings."
                ),
                action_url="/seller/settings?tab=verification",
            ))

    log_action(db, current_admin, "Rejected seller verification",
               "Verification", v.id, v.seller_name, {"notes": body.admin_notes})
    db.commit()

    # Block 3B — email via template (fire-and-forget)
    try:
        import asyncio as _asyncio
        from app.services.admin_notifications import send_user_email_bg
        from app.services.email_templates import VERIFICATION_REJECTED_EMAIL
        _asyncio.create_task(send_user_email_bg(
            v.email,
            "Seller verification update — Campify",
            VERIFICATION_REJECTED_EMAIL(v.seller_name, body.admin_notes or ""),
        ))
    except Exception:
        pass

    # Block 3C — structured admin event
    try:
        from app.services.admin_notifications import notify_admin
        await notify_admin(db, "verification_rejected", v.user_id, v.email, "seller",
                           {"seller_name": v.seller_name, "reason": body.admin_notes or ""})
    except Exception:
        pass

    return {"success": True, "message": "Seller verification rejected"}


# ── Public: submit a new verification request (called during seller signup) ──

@router.post("/verification/submit")
async def submit_verification(
    data: SellerVerificationCreate,
    db: Session = Depends(get_db),
):
    """
    Submit a new seller verification request.
    Called immediately after a seller creates their account.
    No auth required — submission is tied to user_id if provided.
    """
    # Prevent duplicate submissions for same matric number
    existing = (
        db.query(SellerVerification)
        .filter(
            SellerVerification.matric_no == data.matric_no,
            SellerVerification.status.in_(["Pending", "Under Review", "Approved"]),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A verification for this matric number is already pending or approved.",
        )

    verification = SellerVerification(
        user_id=data.user_id,
        seller_name=data.seller_name,
        matric_no=data.matric_no,
        faculty=data.faculty,
        business_name=data.business_name,
        business_description=data.business_description,
        business_category=data.business_category,
        pickup_location=data.pickup_location,
        email=data.email,
        document_url=data.document_url,
        portal_screenshot_url=data.portal_screenshot_url,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)

    # Fire-and-forget emails (non-blocking)
    try:
        from app.services.email import send_seller_submission_email, send_admin_new_verification_email
        send_seller_submission_email(data.email, data.seller_name)
        send_admin_new_verification_email(data.seller_name, data.matric_no, data.business_name)
    except Exception:
        pass  # Never crash on email failure

    # Block 2D — structured admin event for seller application
    try:
        from app.services.admin_notifications import notify_admin
        uid = data.user_id or (verification.user_id)
        await notify_admin(
            db, "new_seller_application", uid,
            data.email, "seller",
            {"business_name": data.business_name,
             "matric_no": data.matric_no,
             "faculty": data.faculty},
            requires_action=True,
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Verification submitted. An admin will review it shortly.",
        "verification_id": verification.id,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 3A — Admin event feed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _event_dict(e: AdminEvent) -> dict:
    return {
        "id":               e.id,
        "event_type":       e.event_type,
        "user_id":          e.user_id,
        "user_email":       e.user_email,
        "user_role":        e.user_role,
        "payload":          json.loads(e.payload) if e.payload else {},
        "is_read":          bool(e.is_read),
        "requires_action":  bool(e.requires_action),
        "created_at":       e.created_at.isoformat() if e.created_at else None,
    }


@router.get("/events")
async def list_admin_events(
    type: Optional[str] = None,
    unread: bool = False,
    requires_action: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 3A — Paginated admin event feed."""
    q = db.query(AdminEvent)
    if type:
        q = q.filter(AdminEvent.event_type == type)
    if unread:
        q = q.filter(AdminEvent.is_read == False)
    if requires_action:
        q = q.filter(AdminEvent.requires_action == True)

    total = q.count()
    unread_count = db.query(AdminEvent).filter(AdminEvent.is_read == False).count()
    events = q.order_by(AdminEvent.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "success": True,
        "total": total,
        "unread_count": unread_count,
        "data": [_event_dict(e) for e in events],
    }


@router.patch("/events/{event_id}/read")
async def mark_event_read(
    event_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 3A — Mark a single event as read."""
    event = db.query(AdminEvent).filter(AdminEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.is_read = True
    db.commit()
    return {"success": True}


@router.patch("/events/read-all")
async def mark_all_events_read(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 3A — Mark all events as read."""
    db.query(AdminEvent).filter(AdminEvent.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 3B — User detail / list view for admin
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,   # active | paused | deleted
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 3B — Paginated user list with optional role/status filters."""
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if status == "active":
        q = q.filter(User.is_deleted != True, User.is_paused != True)
    elif status == "paused":
        q = q.filter(User.is_paused == True, User.is_deleted != True)
    elif status == "deleted":
        q = q.filter(User.is_deleted == True)

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "success": True,
        "total": total,
        "data": [
            {
                "id":           u.id,
                "username":     u.username,
                "email":        u.email,
                "display_name": u.display_name,
                "role":         u.role,
                "avatar_url":   getattr(u, "avatar_url", None),
                "is_paused":    bool(getattr(u, "is_paused", False)),
                "is_deleted":   bool(getattr(u, "is_deleted", False)),
                "is_banned":    bool(getattr(u, "is_banned", False)),
                "created_at":   u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 3B — Full user profile + docs + listings + events for admin."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    listings = db.query(Price).filter(Price.submitted_by == user_id).order_by(Price.submitted_at.desc()).limit(20).all()
    verification = db.query(SellerVerification).filter(SellerVerification.user_id == user_id).order_by(SellerVerification.submitted_at.desc()).first()
    assets = db.query(CloudinaryAsset).filter(CloudinaryAsset.user_id == user_id).all()
    events = db.query(AdminEvent).filter(AdminEvent.user_id == user_id).order_by(AdminEvent.created_at.desc()).limit(20).all()

    return {
        "success": True,
        "data": {
            "id":           u.id,
            "username":     u.username,
            "email":        u.email,
            "display_name": u.display_name,
            "role":         u.role,
            "phone":        u.phone,
            "avatar_url":   u.avatar_url,
            "department":   u.department,
            "level":        u.level,
            "bio":          u.bio,
            "seller_points": u.seller_points,
            "balance":      u.balance,
            "is_paused":    bool(getattr(u, "is_paused", False)),
            "paused_at":    u.paused_at.isoformat() if getattr(u, "paused_at", None) else None,
            "paused_by":    getattr(u, "paused_by", None),
            "pause_reason": getattr(u, "pause_reason", None),
            "is_deleted":   bool(getattr(u, "is_deleted", False)),
            "deleted_at":   u.deleted_at.isoformat() if getattr(u, "deleted_at", None) else None,
            "is_banned":    bool(getattr(u, "is_banned", False)),
            "is_suspended": bool(getattr(u, "is_suspended", False)),
            "deletion_requested_at": u.deletion_requested_at.isoformat() if getattr(u, "deletion_requested_at", None) else None,
            "deletion_request_reason": getattr(u, "deletion_request_reason", None),
            "reactivation_requested_at": u.reactivation_requested_at.isoformat() if getattr(u, "reactivation_requested_at", None) else None,
            "created_at":   u.created_at.isoformat() if u.created_at else None,
            "listings": [
                {"id": p.id, "name": p.name, "price": p.price,
                 "listing_status": p.listing_status, "status": p.status,
                 "created_at": p.submitted_at.isoformat() if p.submitted_at else None}
                for p in listings
            ],
            "verification": {
                "id":         verification.id,
                "status":     verification.status,
                "seller_name": verification.seller_name,
                "matric_no":  verification.matric_no,
                "document_url": verification.document_url,
                "portal_screenshot_url": verification.portal_screenshot_url,
                "submitted_at": verification.submitted_at.isoformat() if verification.submitted_at else None,
            } if verification else None,
            "cloudinary_assets": [
                {"id": a.id, "asset_type": a.asset_type, "url": a.url,
                 "folder": a.folder, "bytes": a.bytes, "format": a.format,
                 "uploaded_at": a.uploaded_at.isoformat() if a.uploaded_at else None}
                for a in assets
            ],
            "admin_events": [_event_dict(e) for e in events],
        },
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 4 — User lifecycle: pause / delete / reactivate (admin-side)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class PauseBody(BaseModel):
    reason: str


@router.post("/users/{user_id}/pause")
async def admin_pause_user(
    user_id: int,
    body: PauseBody,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 4C — Admin pauses a user account and hides all their listings."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u or getattr(u, "is_deleted", False):
        raise HTTPException(status_code=404, detail="User not found")

    u.is_paused = True
    u.paused_at = datetime.utcnow()
    u.paused_by = "admin"
    u.pause_reason = body.reason

    if u.role == "seller":
        db.query(Price).filter(
            Price.submitted_by == user_id, Price.listing_status == "active"
        ).update({"listing_status": "paused"})

    db.commit()

    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import ACCOUNT_PAUSED_EMAIL
    await notify_admin(db, "account_paused", u.id, u.email or "", u.role,
                       {"reason": body.reason, "paused_by": "admin"})
    asyncio.create_task(send_user_email_bg(
        u.email or "",
        "Your Campify account has been paused",
        ACCOUNT_PAUSED_EMAIL(u.display_name or u.username or "User", body.reason),
    ))

    log_action(db, current_admin, "Paused account", "User", user_id, body.reason)
    return {"success": True, "message": "Account paused", "user_id": user_id}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Block 4D — Hard delete: wipes Cloudinary assets, listings, reviews, etc.
    Anonymises the user record (soft-delete for audit trail).
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Preserve identity before wiping
    saved_email = u.email or ""
    saved_name  = u.display_name or u.username or "User"

    # 2. Delete Cloudinary assets
    try:
        from app.services.cloudinary_service import delete_asset
        assets = db.query(CloudinaryAsset).filter(CloudinaryAsset.user_id == user_id).all()
        for asset in assets:
            delete_asset(asset.public_id)
            db.delete(asset)
        db.flush()
    except Exception as e:
        print(f"[admin_delete] Cloudinary cleanup error for user {user_id}: {e}")

    # 3. Delete listings
    db.query(Price).filter(Price.submitted_by == user_id).delete(synchronize_session=False)

    # 4. Delete wishlist
    try:
        from app.models import Wishlist
        db.query(Wishlist).filter(Wishlist.user_id == user_id).delete(synchronize_session=False)
    except Exception:
        pass

    # 5. Delete reviews
    try:
        from app.models import Review
        db.query(Review).filter(
            (Review.reviewer_id == user_id) | (Review.seller_id == user_id)
        ).delete(synchronize_session=False)
    except Exception:
        pass

    # 6. Delete notifications
    try:
        from app.models import Notification
        db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    except Exception:
        pass

    # 7. Delete verification record
    db.query(SellerVerification).filter(SellerVerification.user_id == user_id).delete(synchronize_session=False)

    # 8. Nullify buyer_id on inquiries (keep conversation history intact)
    try:
        from app.models import Inquiry
        db.query(Inquiry).filter(
            (Inquiry.buyer_id == user_id) | (Inquiry.seller_id == user_id)
        ).update({"buyer_id": None, "seller_id": None}, synchronize_session=False)
    except Exception:
        pass

    # 9. Block 5 — drop per-user isolated tables (total data wipe)
    try:
        from app.services.user_db import drop_user_tables
        from app.database import engine as _engine
        drop_user_tables(user_id, _engine)
    except Exception as e:
        print(f"[admin_delete] per-user table drop failed for {user_id}: {e}")

    # 10. Soft-delete the user record
    ts = int(datetime.utcnow().timestamp())
    u.is_deleted     = True
    u.deleted_at     = datetime.utcnow()
    u.email          = f"deleted_{user_id}_{ts}@deleted.invalid"
    u.username       = f"deleted_user_{user_id}"
    u.display_name   = "Deleted User"
    u.password_hash  = ""
    u.phone          = None
    u.avatar_url     = None

    # 11. Commit
    db.commit()

    # 12. Confirm email to saved address
    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import ACCOUNT_DELETED_EMAIL
    asyncio.create_task(send_user_email_bg(
        saved_email,
        "Your Campify account has been deleted",
        ACCOUNT_DELETED_EMAIL(saved_name),
    ))

    # 13. Log event
    await notify_admin(db, "account_deleted", user_id, saved_email, "deleted",
                       {"deleted_by": "admin", "deleted_at": datetime.utcnow().isoformat()})
    log_action(db, current_admin, "Deleted account", "User", user_id, saved_email)

    return {"success": True, "message": "Account deleted", "user_id": user_id}


@router.post("/users/{user_id}/reactivate")
async def admin_reactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 4E — Admin reactivates a paused account and restores their listings."""
    u = db.query(User).filter(User.id == user_id).first()
    if not u or getattr(u, "is_deleted", False):
        raise HTTPException(status_code=404, detail="User not found")

    u.is_paused                  = False
    u.paused_at                  = None
    u.paused_by                  = None
    u.pause_reason               = None
    u.reactivation_requested_at  = None

    if u.role == "seller":
        db.query(Price).filter(
            Price.submitted_by == user_id, Price.listing_status == "paused"
        ).update({"listing_status": "active"})

    db.commit()

    from app.services.admin_notifications import notify_admin, send_user_email_bg
    from app.services.email_templates import ACCOUNT_REACTIVATED_EMAIL
    asyncio.create_task(send_user_email_bg(
        u.email or "",
        "Your Campify account has been reactivated",
        ACCOUNT_REACTIVATED_EMAIL(u.display_name or u.username or "User"),
    ))
    await notify_admin(db, "account_reactivated", u.id, u.email or "", u.role,
                       {"reactivated_by": "admin"})
    log_action(db, current_admin, "Reactivated account", "User", user_id, u.email or "")

    return {"success": True, "message": "Account reactivated"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 6A — Real-time analytics (60s in-memory cache)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/analytics")
async def get_analytics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Block 6A — Platform analytics snapshot, cached for 60 seconds."""
    if time.time() < _analytics_cache["expires_at"] and _analytics_cache["data"]:
        return _analytics_cache["data"]

    # Platform totals
    total_users    = db.query(User).filter(User.is_deleted != True).count()
    total_buyers   = db.query(User).filter(User.role == "buyer",  User.is_deleted != True).count()
    total_sellers  = db.query(User).filter(User.role == "seller", User.is_deleted != True).count()
    total_listings = db.query(Price).filter(Price.listing_status == "active").count()
    total_views    = db.query(func.coalesce(func.sum(Price.view_count), 0)).scalar() or 0
    paused_accounts = db.query(User).filter(User.is_paused == True).count()
    pending_verifications = db.query(SellerVerification).filter(
        SellerVerification.status.in_(["Pending", "Under Review"])
    ).count()
    delete_requests = db.query(User).filter(
        User.deletion_requested_at != None, User.is_deleted != True
    ).count()

    # Block 10 — order + report metrics (real DB queries, not hardcoded).
    total_orders     = db.query(Order).count()
    completed_orders = db.query(Order).filter(Order.status == "completed").count()
    open_reports     = db.query(Report).filter(Report.status == "open").count()
    conversion_rate  = round(
        (completed_orders / total_orders * 100) if total_orders else 0, 1
    )

    # Daily signups — last 30 days (SQLite raw)
    daily_signups_rows = db.execute(sa_text("""
        SELECT DATE(created_at) as day, COUNT(*) as cnt
        FROM users
        WHERE created_at >= DATE('now', '-30 days') AND (is_deleted IS NULL OR is_deleted = 0)
        GROUP BY DATE(created_at)
        ORDER BY day
    """)).fetchall()
    daily_signups = [{"day": r[0], "count": r[1]} for r in daily_signups_rows]

    # Daily listings — last 30 days
    daily_listings_rows = db.execute(sa_text("""
        SELECT DATE(submitted_at) as day, COUNT(*) as cnt
        FROM prices
        WHERE submitted_at >= DATE('now', '-30 days')
        GROUP BY DATE(submitted_at)
        ORDER BY day
    """)).fetchall()
    daily_listings = [{"day": r[0], "count": r[1]} for r in daily_listings_rows]

    # Top categories
    top_categories_rows = db.execute(sa_text("""
        SELECT c.name, COUNT(p.id) as cnt
        FROM prices p JOIN categories c ON p.category_id = c.id
        WHERE p.listing_status = 'active'
        GROUP BY c.name
        ORDER BY cnt DESC
        LIMIT 8
    """)).fetchall()
    top_categories = [{"category": r[0], "count": r[1]} for r in top_categories_rows]

    # Top sellers by views
    top_sellers_rows = db.execute(sa_text("""
        SELECT u.display_name, u.email,
               COALESCE(SUM(p.view_count), 0) as total_views,
               COUNT(p.id) as listing_count
        FROM users u JOIN prices p ON p.submitted_by = u.id
        WHERE u.role = 'seller' AND (u.is_deleted IS NULL OR u.is_deleted = 0)
        GROUP BY u.id
        ORDER BY total_views DESC
        LIMIT 10
    """)).fetchall()
    top_sellers = [
        {"display_name": r[0], "email": r[1], "total_views": r[2], "listing_count": r[3]}
        for r in top_sellers_rows
    ]

    # Recent events
    recent_events = db.query(AdminEvent).order_by(AdminEvent.created_at.desc()).limit(10).all()

    result = {
        "success": True,
        "totals": {
            "total_users":            total_users,
            "total_buyers":           total_buyers,
            "total_sellers":          total_sellers,
            "total_listings":         total_listings,
            "total_views":            int(total_views),
            "paused_accounts":        paused_accounts,
            "pending_verifications":  pending_verifications,
            "delete_requests":        delete_requests,
            "total_orders":           total_orders,
            "completed_orders":       completed_orders,
            "open_reports":           open_reports,
            "conversion_rate":        conversion_rate,
        },
        "daily_signups":    daily_signups,
        "daily_listings":   daily_listings,
        "top_categories":   top_categories,
        "top_sellers":      top_sellers,
        "recent_events":    [_event_dict(e) for e in recent_events],
    }

    _analytics_cache["data"]       = result
    _analytics_cache["expires_at"] = time.time() + 60
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 6B — Server-Sent Events stream (real-time admin portal updates)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/events/stream")
async def admin_event_stream(
    token: str = Query(..., description="Admin JWT (SSE cannot send Bearer headers)"),
    db: Session = Depends(get_db),
):
    """Block 6B — SSE stream; poll every 5 s for new AdminEvent rows."""
    # Manually verify admin token (SSE can't send Authorization header)
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        admin = db.query(User).filter(User.id == int(user_id), User.role == "admin").first()
        if not admin:
            raise HTTPException(status_code=401, detail="Unauthorized")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    async def event_generator():
        last_id = 0
        while True:
            new_events = (
                db.query(AdminEvent)
                .filter(AdminEvent.id > last_id)
                .order_by(AdminEvent.created_at.asc())
                .limit(5)
                .all()
            )
            if new_events:
                last_id = max(e.id for e in new_events)
                for e in new_events:
                    data = json.dumps({
                        "type":            e.event_type,
                        "user_email":      e.user_email,
                        "requires_action": bool(e.requires_action),
                        "created_at":      e.created_at.isoformat() if e.created_at else None,
                    })
                    yield f"data: {data}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 16 — Announcements CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AnnouncementCreate(BaseModel):
    title: str
    message: str
    type: str = "System"
    audience: str = "All"
    is_active: bool = True
    banner_url: Optional[str] = None
    cta_label: Optional[str] = None
    cta_href: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    audience: Optional[str] = None
    is_active: Optional[bool] = None
    banner_url: Optional[str] = None
    cta_label: Optional[str] = None
    cta_href: Optional[str] = None


@router.get("/announcements")
async def list_announcements(
    audience: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """GET /api/admin/announcements — list all announcements."""
    q = db.query(Announcement)
    if audience:
        q = q.filter(Announcement.audience == audience)
    if is_active is not None:
        q = q.filter(Announcement.is_active == is_active)
    total = q.count()
    items = q.order_by(Announcement.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "total": total,
        "data": [_ann_dict(a) for a in items],
    }


@router.post("/announcements", status_code=201)
async def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """POST /api/admin/announcements — create a new announcement."""
    ann = Announcement(
        title=body.title.strip(),
        message=body.message.strip(),
        type=body.type,
        audience=body.audience,
        is_active=body.is_active,
        banner_url=body.banner_url,
        cta_label=body.cta_label,
        cta_href=body.cta_href,
        created_by=current_admin.id,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    log_action(db, current_admin, "create_announcement", "Announcement", ann.id, ann.title)
    return {"success": True, "id": ann.id, "message": "Announcement created", **_ann_dict(ann)}


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: int,
    body: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """PATCH /api/admin/announcements/{id} — partial update."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ann, field, value)
    ann.updated_at = datetime.utcnow()
    db.commit()
    log_action(db, current_admin, "update_announcement", "Announcement", ann.id, ann.title)
    return {"success": True, "message": "Updated", **_ann_dict(ann)}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """DELETE /api/admin/announcements/{id}."""
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    title = ann.title
    db.delete(ann)
    db.commit()
    log_action(db, current_admin, "delete_announcement", "Announcement", announcement_id, title)
    return {"success": True, "message": "Deleted"}


# Public endpoint — no auth required
@router.get("/announcements/public", include_in_schema=True)
async def public_announcements(
    audience: Optional[str] = "All",
    db: Session = Depends(get_db),
):
    """GET /api/admin/announcements/public — active announcements for the UI banner."""
    items = (
        db.query(Announcement)
        .filter(
            Announcement.is_active == True,
            Announcement.audience.in_([audience, "All"]),
        )
        .order_by(Announcement.created_at.desc())
        .limit(5)
        .all()
    )
    return {"announcements": [_ann_dict(a) for a in items]}


def _ann_dict(a: Announcement) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "message": a.message,
        "type": a.type,
        "audience": a.audience,
        "is_active": a.is_active,
        "banner_url": getattr(a, "banner_url", None),
        "cta_label": getattr(a, "cta_label", None),
        "cta_href": getattr(a, "cta_href", None),
        "created_by": a.created_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BLOCK 16 — Reports management
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/reports")
async def list_reports(
    status: Optional[str] = None,
    target_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """GET /api/admin/reports — list all user reports."""
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    if target_type:
        q = q.filter(Report.target_type == target_type)
    total = q.count()
    items = q.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "total": total,
        "data": [_report_dict(r) for r in items],
    }


@router.patch("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: int,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """PATCH /api/admin/reports/{id}/resolve — mark report resolved."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "Resolved"
    report.resolved_by = current_admin.id
    report.resolved_at = datetime.utcnow()
    if body and body.get("admin_notes"):
        report.admin_notes = body["admin_notes"]
    db.commit()
    log_action(db, current_admin, "resolve_report", "Report", report_id, f"{report.target_type}:{report.target_id}")
    return {"success": True, "message": "Report resolved", **_report_dict(report)}


@router.patch("/reports/{report_id}/review")
async def mark_report_under_review(
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """PATCH /api/admin/reports/{id}/review — mark report Under Review."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "Under Review"
    db.commit()
    return {"success": True, "message": "Report marked under review", **_report_dict(report)}


def _report_dict(r: Report) -> dict:
    return {
        "id": r.id,
        "reporter_id": r.reporter_id,
        "reporter_name": None,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "target_name": r.target_name,
        "reason": r.reason,
        "status": r.status,
        "admin_notes": r.admin_notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
    }


@router.patch("/reports/{report_id}/dismiss")
async def dismiss_report(
    report_id: int,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """PATCH /api/admin/reports/{id}/dismiss — dismiss (close without action)."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "Dismissed"
    report.resolved_by = current_admin.id
    report.resolved_at = datetime.utcnow()
    if body and body.get("reason"):
        report.admin_notes = body["reason"]
    db.commit()
    log_action(db, current_admin, "dismiss_report", "Report", report_id,
               f"{report.target_type}:{report.target_id}")
    return {"success": True, "message": "Report dismissed"}


@router.post("/announcements/{announcement_id}/broadcast")
async def broadcast_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """POST /api/admin/announcements/{id}/broadcast — push as notification to audience."""
    from app.models import Notification
    ann = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    q = db.query(User).filter(User.role != "admin", User.is_deleted.isnot(True))
    if ann.audience == "Sellers":
        q = q.filter(User.role == "seller")
    elif ann.audience == "Buyers":
        q = q.filter(User.role == "buyer")

    users = q.all()
    for u in users:
        db.add(Notification(
            user_id=u.id,
            type="system",
            title=ann.title,
            body=ann.message[:500],
            related_id=ann.id,
            related_type="Announcement",
        ))
    db.commit()
    log_action(db, current_admin, "broadcast_announcement",
               "Announcement", ann.id, ann.title)
    return {"success": True, "sent_to": len(users), "message": f"Sent to {len(users)} users"}
