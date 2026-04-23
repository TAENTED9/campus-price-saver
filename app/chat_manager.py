"""
Shared in-memory WebSocket broadcast hub for real-time chat.
Imported by both main.py (WS endpoint) and routers/messages.py (REST send endpoint).
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger("campify")


class _ChatRoomManager:
    """One room per conversation_id. Broadcasts to all connected participants."""

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)

    def join(self, ws: WebSocket, conv_id: int) -> None:
        self._rooms[conv_id].add(ws)

    def leave(self, ws: WebSocket, conv_id: int) -> None:
        self._rooms[conv_id].discard(ws)
        if conv_id in self._rooms and not self._rooms[conv_id]:
            del self._rooms[conv_id]

    async def broadcast(
        self, conv_id: int, payload: str, exclude: "WebSocket | None" = None
    ) -> None:
        """Send to every connected participant in the conversation."""
        dead: set[WebSocket] = set()
        for ws in list(self._rooms.get(conv_id, [])):
            if ws is exclude:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.leave(ws, conv_id)

    async def broadcast_message(self, conv_id: int, msg_id: int, sender_id: int, content: str, created_at: str) -> None:
        """Convenience: broadcast a new chat message to all participants in a room."""
        payload = json.dumps({
            "id": msg_id,
            "conversation_uuid": str(conv_id),
            "sender_id": sender_id,
            "content": content,
            "created_at": created_at,
            "is_read": False,
        })
        await self.broadcast(conv_id, payload)


# Module-level singleton — import this everywhere
chat_manager = _ChatRoomManager()
