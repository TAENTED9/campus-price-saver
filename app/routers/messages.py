"""
Block 16 — Messages / Conversations router.

Endpoints consumed by messageApi.ts:
  GET  /api/messages/conversations
  GET  /api/messages/conversation/{id}
  POST /api/messages/send
  PATCH /api/messages/conversation/{id}/mark-read
  POST /api/messages/report/{user_uuid}

Also implements the WebSocket chat at /ws/chat/{conversation_uuid}
which is registered in main.py, NOT here.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import Column, ForeignKey, Integer, String, Text, Boolean, DateTime
from sqlalchemy.orm import Session, relationship

from app.database import Base, SessionLocal, get_db
from app.limiter import limiter
from app.models import User, Notification
from app.routers.auth import get_current_user

logger = logging.getLogger("campify")

router = APIRouter(prefix="/messages", tags=["Messages"])


# ── Inline models (no separate migration needed — add to init_db if missing) ──

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), nullable=True, unique=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    last_message_at = Column(DateTime, nullable=True)
    last_message_preview = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_a = relationship("User", foreign_keys=[user_a_id])
    user_b = relationship("User", foreign_keys=[user_b_id])
    messages = relationship("DirectMessage", back_populates="conversation",
                            order_by="DirectMessage.created_at")


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    is_automated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_conversation(
    user_a_id: int, user_b_id: int, db: Session
) -> Conversation:
    lo, hi = min(user_a_id, user_b_id), max(user_a_id, user_b_id)
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_a_id == lo,
            Conversation.user_b_id == hi,
        )
        .first()
    )
    if not conv:
        conv = Conversation(user_a_id=lo, user_b_id=hi)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def _conv_dict(conv: Conversation, current_user_id: int, db: Session | None = None) -> dict:
    other_id = conv.user_b_id if conv.user_a_id == current_user_id else conv.user_a_id
    unread = 0
    if db is not None:
        unread = (
            db.query(DirectMessage)
            .filter(
                DirectMessage.conversation_id == conv.id,
                DirectMessage.sender_id != current_user_id,
                DirectMessage.is_read == False,
            )
            .count()
        )
    return {
        "id": conv.id,
        "user_a_id": conv.user_a_id,
        "user_b_id": conv.user_b_id,
        "other_user_id": other_id,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "last_message_preview": conv.last_message_preview,
        "created_at": conv.created_at.isoformat(),
        "unread_count": unread,
    }


def _msg_dict(msg: DirectMessage) -> dict:
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
    }


# ── Ensure tables exist at module load ────────────────────────────────────────

def ensure_message_tables():
    """Create conversations and direct_messages tables if missing."""
    from sqlalchemy import text
    from app.database import engine
    Base.metadata.create_all(bind=engine, tables=[
        Conversation.__table__,
        DirectMessage.__table__,
    ])
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_conv_users "
            "ON conversations(user_a_id, user_b_id)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_dm_conv "
            "ON direct_messages(conversation_id, created_at)"
        ))
        conn.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/conversations")
async def start_conversation(
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /api/messages/conversations — start or return an existing conversation."""
    target_user_id: int | None = body.get("target_user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id required")
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    conv = _get_or_create_conversation(current_user.id, target_user_id, db)
    d = _conv_dict(conv, current_user.id, db)
    d["other_user_name"] = target.display_name or target.username
    d["other_user_avatar"] = target.avatar_url
    return d


@router.get("/conversations/unread-count")
async def conversations_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/messages/conversations/unread-count — total unread DM count for badge."""
    count = (
        db.query(DirectMessage)
        .join(Conversation, DirectMessage.conversation_id == Conversation.id)
        .filter(
            (Conversation.user_a_id == current_user.id)
            | (Conversation.user_b_id == current_user.id),
            DirectMessage.sender_id != current_user.id,
            DirectMessage.is_read == False,
        )
        .count()
    )
    return {"unread_count": count}


@router.get("/conversations")
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/messages/conversations — all conversations for the current user."""
    total = (
        db.query(Conversation)
        .filter(
            (Conversation.user_a_id == current_user.id)
            | (Conversation.user_b_id == current_user.id)
        )
        .count()
    )
    convs = (
        db.query(Conversation)
        .filter(
            (Conversation.user_a_id == current_user.id)
            | (Conversation.user_b_id == current_user.id)
        )
        .order_by(Conversation.last_message_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )
    result = []
    for c in convs:
        d = _conv_dict(c, current_user.id, db)
        other = db.query(User).filter(User.id == d["other_user_id"]).first()
        if other:
            d["other_user_name"] = other.display_name or other.username
            d["other_user_avatar"] = other.avatar_url
        result.append(d)
    return {
        "conversations": result,
        "total_count": total,
    }


@router.get("/conversation/{conversation_id}")
async def get_messages(
    conversation_id: int,
    limit: int = Query(20, ge=1, le=100),
    cursor: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/messages/conversation/{id} — paginated messages (cursor-based)."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.user_a_id, conv.user_b_id):
        raise HTTPException(status_code=403, detail="Not your conversation")

    q = db.query(DirectMessage).filter(DirectMessage.conversation_id == conversation_id)
    total = q.count()

    if cursor:
        q = q.filter(DirectMessage.id < cursor)

    messages = q.order_by(DirectMessage.created_at.desc()).limit(limit).all()
    messages.reverse()

    # Mark incoming messages as read
    db.query(DirectMessage).filter(
        DirectMessage.conversation_id == conversation_id,
        DirectMessage.sender_id != current_user.id,
        DirectMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()

    oldest_id = messages[0].id if messages else None
    has_earlier = db.query(DirectMessage).filter(
        DirectMessage.conversation_id == conversation_id,
        DirectMessage.id < (oldest_id or 0),
    ).count() > 0 if oldest_id else False

    return {
        "messages": [_msg_dict(m) for m in messages],
        "has_earlier": has_earlier,
        "cursor": oldest_id,
        "total_count": total,
    }


@router.post("/send")
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /api/messages/send — send a direct message, creates conversation if needed."""
    from app.chat_manager import chat_manager as _chat_manager

    receiver_id: int | None = body.get("receiver_id")
    content: str | None = body.get("content", "").strip()

    if not receiver_id:
        raise HTTPException(status_code=400, detail="receiver_id required")
    if not content:
        raise HTTPException(status_code=400, detail="content cannot be empty")
    if len(content) > 4000:
        raise HTTPException(status_code=400, detail="Message too long (max 4000 chars)")
    if receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    receiver = db.query(User).filter(User.id == receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    conv = _get_or_create_conversation(current_user.id, receiver_id, db)

    msg = DirectMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(msg)

    conv.last_message_at = datetime.utcnow()
    conv.last_message_preview = content[:200]

    # Notify receiver
    notif = Notification(
        user_id=receiver_id,
        type="new_message",
        title=f"New message from {current_user.display_name or current_user.username}",
        body=content[:100],
        related_id=conv.id,
        related_type="Conversation",
        action_url=f"/dashboard/messages?conv={conv.id}",
    )
    db.add(notif)
    db.commit()
    db.refresh(msg)

    # Broadcast to all WS participants so the receiver sees it in the chat window
    await _chat_manager.broadcast_message(
        conv_id=conv.id,
        msg_id=msg.id,
        sender_id=current_user.id,
        content=content,
        created_at=msg.created_at.isoformat(),
    )

    return _msg_dict(msg)


@router.patch("/conversation/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """PATCH /api/messages/conversation/{id}/mark-read."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.user_a_id, conv.user_b_id):
        raise HTTPException(status_code=403, detail="Not your conversation")

    db.query(DirectMessage).filter(
        DirectMessage.conversation_id == conversation_id,
        DirectMessage.sender_id != current_user.id,
        DirectMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "Marked as read"}


@router.put("/{message_id}/read")
async def mark_message_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    PUT /api/messages/{message_id}/read

    FIX #10: the path param is the integer DirectMessage.id (DB primary
    key). The previous `message_uuid: int` naming was a contradiction —
    a UUID is not an int. Use the per-conversation `mark-read` endpoint
    if you only have a conversation handle.
    """
    msg = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    # SEC-004: only a participant in the conversation may mark messages as read
    conv = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first()
    if not conv or current_user.id not in (conv.user_a_id, conv.user_b_id):
        raise HTTPException(status_code=403, detail="Not your message")
    msg.is_read = True
    db.commit()
    return {"success": True}


@router.post("/report/{user_uuid}")
@limiter.limit("10/hour")
async def report_user(
    request: Request,
    user_uuid: str,
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /api/messages/report/{user_uuid} — report a user from chat."""
    from app.models import Report
    target = db.query(User).filter(User.uuid == user_uuid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    reason = (body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="reason required")

    report = Report(
        reporter_id=current_user.id,
        target_type="User",
        target_id=target.id,
        target_name=target.display_name or target.username,
        reason=reason,
    )
    db.add(report)
    db.commit()
    return {"ok": True, "message": "Report submitted"}
