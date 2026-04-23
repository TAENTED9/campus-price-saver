"use client";

/**
 * components/providers/SettingsSyncProvider.tsx
 *
 * Block 6D — Re-fetches settings from the server whenever the user returns
 * to the tab after being away for more than 5 minutes.
 *
 * Mount once inside AuthProvider in the root layout.
 */

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSettingsStore, type UserSettingsState } from "@/stores/settingsStore";
import { useSettingsWebSocket } from "@/hooks/useSettingsWebSocket";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STALE_MS = 5 * 60 * 1000; // 5 minutes

export function SettingsSyncProvider({ children }: { children: React.ReactNode }) {
  const { token }  = useAuth();
  const hydrate    = useSettingsStore((s) => s.hydrate);
  const lastSynced = useSettingsStore((s) => s.lastSynced);

  // Block 7B — open WebSocket for multi-device real-time sync
  useSettingsWebSocket();

  useEffect(() => {
    if (!token) return;

    const handleFocus = async () => {
      const elapsed = lastSynced
        ? Date.now() - new Date(lastSynced).getTime()
        : Infinity;

      if (elapsed < STALE_MS) return;

      try {
        const res = await fetch(`${API}/api/settings`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.settings) hydrate(data.settings as UserSettingsState);
      } catch { /* network unavailable — keep cached state */ }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [token, lastSynced, hydrate]);

  return <>{children}</>;
}
