"""
Admin statistics and seller verification management router.
All endpoints require a valid admin JWT token.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.dependencies import get_db
from app.models import User, Price, PendingPrice, SellerVerification
from app.routers.auth import get_current_admin
from app.routers.admin_users import log_action

router = APIRouter(prefix="/admin", tags=["admin-stats"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

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
        db.query(PendingPrice).filter(PendingPrice.status == "pending").count()
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

    months_labels: list[str] = []
    submissions_data: list[int] = []
    revenue_data: list[float] = []

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

        months_labels.append(month_names[m - 1])
        submissions_data.append(count)
        revenue_data.append(round(float(total_revenue), 2))

    return {
        "success": True,
        "data": {
            "months": months_labels,
            "sales": submissions_data,
            "revenue": revenue_data,
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
                "sellerName": v.seller_name,
                "matricNo": v.matric_no,
                "faculty": v.faculty,
                "businessName": v.business_name,
                "businessCategory": getattr(v, "business_category", None),
                "pickupLocation": getattr(v, "pickup_location", None),
                "email": v.email,
                "documentUrl": v.document_url,
                "portalScreenshotUrl": getattr(v, "portal_screenshot_url", None),
                "submittedAt": v.submitted_at.date().isoformat(),
                "status": v.status,
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
            "userId": v.user_id,
            "sellerName": v.seller_name,
            "matricNo": v.matric_no,
            "faculty": v.faculty,
            "businessName": v.business_name,
            "businessDescription": v.business_description,
            "email": v.email,
            "documentUrl": v.document_url,
            "status": v.status,
            "adminNotes": v.admin_notes,
            "submittedAt": v.submitted_at.isoformat(),
            "reviewedAt": v.reviewed_at.isoformat() if v.reviewed_at else None,
            "reviewedBy": v.reviewed_by,
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
            # In-app notification
            db.add(Notification(
                user_id=user.id, type="sale",
                title="You're verified! +100 points",
                body="Congratulations! Your seller account is now verified. You earned 100 karma points.",
            ))

    log_action(db, current_admin, "Approved seller verification",
               "Verification", v.id, v.seller_name)
    db.commit()

    try:
        from app.services.email import send_seller_approved_email
        send_seller_approved_email(v.email, v.seller_name)
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

    log_action(db, current_admin, "Rejected seller verification",
               "Verification", v.id, v.seller_name, {"notes": body.admin_notes})
    db.commit()

    try:
        from app.services.email import send_seller_rejected_email
        send_seller_rejected_email(v.email, v.seller_name, body.admin_notes or "")
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

    return {
        "success": True,
        "message": "Verification submitted. An admin will review it shortly.",
        "verification_id": verification.id,
    }
