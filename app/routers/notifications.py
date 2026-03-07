"""Notification center router — in-app bell, mark read, clear."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str, db: Session) -> User:
    from app.routers.auth import decode_access_token
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/")
async def list_notifications(
    token: str = Query(...),
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """Get the current user's notifications, newest first."""
    user = get_current_user(token, db)
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .count()
    )
    return {
        "unread_count": unread_count,
        "notifications": [_notif_dict(n) for n in notifs],
    }


@router.get("/unread-count")
async def unread_count(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Lightweight endpoint for the notification bell badge."""
    user = get_current_user(token, db)
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .count()
    )
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(token, db)
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_read(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(token, db)
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(token, db)
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"success": True}


@router.delete("/")
async def clear_all_notifications(
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(token, db)
    db.query(Notification).filter(Notification.user_id == user.id).delete()
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
        "created_at": n.created_at.isoformat(),
    }
