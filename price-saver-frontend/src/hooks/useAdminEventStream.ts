"use client";

/**
 * Block 6C — SSE hook for real-time admin portal event stream.
 * Connects to GET /api/admin/events/stream?token=<adminJWT>.
 * Reconnects automatically after 10 s on error.
 */

import { useEffect, useRef, useCallback } from "react";

export interface AdminStreamEvent {
  type: string;
  user_email: string;
  requires_action: boolean;
  created_at: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useAdminEventStream(
  adminToken: string | null | undefined,
  onEvent: (event: AdminStreamEvent) => void,
) {
  const esRef        = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef   = useRef(onEvent);

  // Keep callback ref fresh without re-triggering the effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!adminToken) return;

    const url =
      `${API_BASE}/api/admin/events/stream` +
      `?token=${encodeURIComponent(adminToken)}`;

    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data: AdminStreamEvent = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Reconnect after 10 s
      reconnectRef.current = setTimeout(connect, 10_000);
    };

    esRef.current = es;
  }, [adminToken]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);
}
