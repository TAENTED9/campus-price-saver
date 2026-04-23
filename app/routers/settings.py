"""
app/routers/settings.py — Persistent Settings API

Endpoints:
  GET  /api/settings         — fetch full settings (auto-creates with defaults)
  PATCH /api/settings        — partial upsert (optimistic concurrency)
  POST /api/settings/reset   — reset to role defaults
  GET  /api/settings/export  — export full settings as JSON (for device sync)

All endpoints require a valid Bearer token.
Rate limit: 60 PATCH requests per minute per user.
"""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models import User
from app.schemas.settings_schemas import SettingsUpdateRequest
from app.services.settings_service import (
    apply_settings_update,
    get_or_create_settings,
    reset_to_defaults,
    serialize_settings,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ── Per-user WebSocket room manager ───────────────────────────────────────────

class _RoomManager:
    """In-memory broadcast hub keyed by room string (e.g. 'settings:{user_uuid}')."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, ws: WebSocket, room: str) -> None:
        self._rooms[room].add(ws)

    def disconnect(self, ws: WebSocket, room: str) -> None:
        self._rooms[room].discard(ws)
        if not self._rooms[room]:
            del self._rooms[room]

    async def broadcast(self, room: str, payload: dict) -> None:
        dead: set[WebSocket] = set()
        for ws in list(self._rooms.get(room, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, room)


_ws_manager = _RoomManager()


async def _broadcast_settings_update(user_uuid: str, settings_data: dict) -> None:
    """Broadcast updated settings to every connected device of this user."""
    await _ws_manager.broadcast(
        f"settings:{user_uuid}",
        {"type": "settings_updated", "settings": settings_data},
    )


@router.get(
    "",
    summary="Get user settings",
    description=(
        "Returns the full settings object for the authenticated user. "
        "Auto-provisions a default row if none exists yet. "
        "Call on every app boot, login, or tab focus to stay in sync."
    ),
)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(current_user, db)
    return {"settings": serialize_settings(settings)}


@router.patch(
    "",
    summary="Update user settings",
    description=(
        "Partial upsert — only fields present in the request body are updated. "
        "Omitted fields are never wiped. "
        "Supports optimistic concurrency via client_version: include your "
        "last-known version and receive a 409 if another device has written ahead."
    ),
)
@limiter.limit("60/minute")
async def update_settings(
    request: Request,
    body: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(current_user, db)

    updates = body.model_dump(
        exclude_none=True,
        exclude={"client_version"},
    )

    result = apply_settings_update(
        settings       = settings,
        updates        = updates,
        db             = db,
        client_version = body.client_version,
    )

    if result.get("conflict"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code":    "SETTINGS_CONFLICT",
                "message": (
                    "Settings were updated by another device. "
                    "Re-sync with the returned state before retrying."
                ),
                "current": result["current"],
            },
        )

    # Broadcast to other connected devices of this user (fire-and-forget)
    asyncio.create_task(
        _broadcast_settings_update(str(current_user.uuid), result)
    )

    return {"settings": result}


@router.websocket("/ws/{user_uuid}")
async def settings_ws(
    websocket: WebSocket,
    user_uuid: str,
    token: str = Query(...),
):
    """
    Block 7A — Per-user settings sync channel.
    Room = user_uuid so all devices of the same user share it.
    When Device A patches settings, Device B receives the update instantly.
    """
    from app.routers.auth import decode_access_token

    # Accept the handshake first — closing before accept() sends HTTP 403 instead of a WS close frame
    await websocket.accept()

    # Verify token and ownership (Block 9: tokens use 'uid'; older tokens use 'sub')
    try:
        payload = decode_access_token(token)
        raw_id = payload.get("uid") or payload.get("sub")
        user_id = int(raw_id)
    except Exception:
        await websocket.close(code=4001, reason="invalid_token")
        return

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or str(user.uuid) != user_uuid:
            await websocket.close(code=4001, reason="forbidden")
            return
    finally:
        db.close()

    room = f"settings:{user_uuid}"
    await _ws_manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        _ws_manager.disconnect(websocket, room)


@router.post(
    "/reset",
    summary="Reset settings to defaults",
    description=(
        "Resets ALL settings to role-appropriate defaults "
        "(buyer defaults or seller defaults). "
        "Version is bumped so any stale in-flight updates from other devices "
        "will correctly surface as conflicts."
    ),
)
async def reset_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = reset_to_defaults(current_user, db)
    return {
        "settings": result,
        "message": "Settings reset to defaults",
    }


@router.get(
    "/export",
    summary="Export settings as JSON",
    description=(
        "Returns the full settings object as a JSON export. "
        "Intended for manual backup or import on a new device."
    ),
)
async def export_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_or_create_settings(current_user, db)
    return {
        "export":      serialize_settings(settings),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_uuid":   str(current_user.uuid),
    }
