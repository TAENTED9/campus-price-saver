"use client";

/**
 * hooks/useSettingsWebSocket.ts — Block 7B
 *
 * Opens a WebSocket to /api/settings/ws/{userUuid} and hydrates the
 * Zustand store whenever another device pushes a settings_updated event.
 *
 * Features:
 *   - 30s keepalive ping
 *   - Auto-reconnect after 5s on unexpected close
 *   - Ignores updates that already match the current version
 *
 * Mount once per authenticated session (e.g. in SettingsSyncProvider or root layout).
 */

import { useEffect, useRef } from "react";
import { useSettingsStore, type UserSettingsState } from "@/stores/settingsStore";
import { useAuth } from "@/context/AuthContext";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useSettingsWebSocket() {
  const { user, token } = useAuth();
  const hydrate         = useSettingsStore((s) => s.hydrate);
  const wsRef           = useRef<WebSocket | null>(null);
  const reconnectRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id || !token) return;

    const userUuid = String(user.id); // /me returns uuid as the id field

    function connect() {
      const ws = new WebSocket(
        `${WS_BASE}/api/settings/ws/${encodeURIComponent(userUuid)}?token=${encodeURIComponent(token!)}`
      );

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type?: string; settings?: UserSettingsState };
          if (msg.type === "settings_updated" && msg.settings) {
            hydrate(msg.settings);
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onclose = (e) => {
        if (pingRef.current) clearInterval(pingRef.current);
        wsRef.current = null;
        // Reconnect unless the close was clean (1000) or auth failure (4001)
        if (e.code !== 1000 && e.code !== 4001) {
          reconnectRef.current = setTimeout(connect, 5_000);
        }
      };

      ws.onopen = () => {
        // Keepalive ping every 30s to prevent proxy/load-balancer timeouts
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30_000);
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close(1000);
      wsRef.current = null;
    };
  }, [user?.id, token, hydrate]);
}
