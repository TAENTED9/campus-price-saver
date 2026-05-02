"""Notification center router — in-app bell, mark read, clear."""
from fastapi import APIRouter, Body, Depends, HTTPException
from app.utils.timezone import format_wat_iso
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
async def list_notifications(
    skip: int = 0,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's notifications, newest first."""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {
        "unread_count": unread_count,
        "notifications": [_notif_dict(n) for n in notifs],
    }


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lightweight endpoint — returns total + per-category breakdown."""
    base = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    total = base.count()
    messages = base.filter(Notification.type == "new_message").count()
    orders = base.filter(Notification.type.like("order%")).count()
    system = max(0, total - messages - orders)
    return {
        "unread_count": total,
        "total": total,
        "messages": messages,
        "orders": orders,
        "system": system,
    }


@router.post("/mark-read")
async def mark_category_read(
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications in a category as read."""
    category = (body.get("category") or "all").strip()
    q = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    )
    if category == "messages":
        q = q.filter(Notification.type == "new_message")
    elif category == "orders":
        q = q.filter(Notification.type.like("order%"))
    elif category == "system":
        q = q.filter(
            Notification.type != "new_message",
            ~Notification.type.like("order%"),
        )
    # "all" marks everything
    q.update({"is_read": True}, synchronize_session=False)
    db.commit()
    total = db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).count()
    messages_c = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
        Notification.type == "new_message",
    ).count()
    orders_c = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
        Notification.type.like("order%"),
    ).count()
    return {
        "success": True,
        "unread_count": total,
        "total": total,
        "messages": messages_c,
        "orders": orders_c,
        "system": max(0, total - messages_c - orders_c),
    }


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"success": True}


@router.delete("/")
async def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"success": True}


def _notif_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "related_id": n.related_id,
        "related_type": n.related_type,
        "is_read": n.is_read,
        "created_at": format_wat_iso(n.created_at),
    }
