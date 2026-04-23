"use client";

/**
 * Block 13B — WebSocket hook for real-time chat.
 * - Auto-reconnect on disconnect (3 s delay)
 * - Token passed as query param
 * - Cleanup on unmount (ws.close(1000))
 * - Message deduplication by message ID
 */

import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws");

export interface ChatWsMessage {
  id: string | number;
  conversation_uuid: string;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface TypingEvent {
  type: "typing_start" | "typing_stop";
  conversation_id: number;
  user_id: number;
}

type WsStatus = "connecting" | "open" | "closed" | "error";

interface UseWebSocketReturn {
  status: WsStatus;
  send: (payload: object) => void;
}

export function useWebSocket(
  conversationUuid: string | null | undefined,
  token: string | null | undefined,
  onMessage: (msg: ChatWsMessage) => void,
  onTyping?: (event: TypingEvent) => void
): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIds = useRef<Set<string | number>>(new Set());
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const [status, setStatus] = useState<WsStatus>("closed");

  // Keep callback refs fresh without triggering reconnect
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const connect = useCallback(() => {
    if (!conversationUuid || !token) return;

    setStatus("connecting");
    const url = `${WS_BASE}/ws/chat/${conversationUuid}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus("open");
      // Clear reconnect timer on successful open
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Route typed events (typing indicators) — no dedup needed
        if (data.type === "typing_start" || data.type === "typing_stop") {
          onTypingRef.current?.(data as TypingEvent);
          return;
        }
        // Regular message — deduplicate by ID
        const msgId = (data as ChatWsMessage).id;
        if (msgId != null && seenIds.current.has(msgId)) return;
        if (msgId != null) seenIds.current.add(msgId);
        // Prevent set from growing unboundedly
        if (seenIds.current.size > 500) {
          const oldest = seenIds.current.values().next().value as string | number;
          seenIds.current.delete(oldest);
        }
        onMessageRef.current(data as ChatWsMessage);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = (evt) => {
      setStatus("closed");
      wsRef.current = null;
      // Don't reconnect on intentional close (code 1000)
      if (evt.code !== 1000) {
        reconnectRef.current = setTimeout(connect, 3_000);
      }
    };

    wsRef.current = ws;
  }, [conversationUuid, token]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return { status, send };
}
