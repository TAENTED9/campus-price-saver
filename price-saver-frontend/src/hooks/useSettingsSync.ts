"use client";

/**
 * hooks/useSettingsSync.ts
 *
 * Provides two helpers:
 *   debouncedSync(patch, delayMs?) — optimistic UI update + debounced server write
 *   immediateSync(patch)           — optimistic UI update + instant server write
 *
 * Both accept a partial settings patch. The Zustand store handles rollback on error.
 */

import { useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAuth } from "@/context/AuthContext";
import type { UserSettingsState } from "@/stores/settingsStore";

export function useSettingsSync() {
  const { token }      = useAuth();
  const syncToServer   = useSettingsStore((s) => s.syncToServer);
  const updateLocal    = useSettingsStore((s) => s.updateLocal);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSync = useCallback(
    (patch: Partial<UserSettingsState>, delayMs = 500) => {
      // 1. Update UI instantly (optimistic)
      updateLocal(patch);

      // 2. Debounce the server write
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (token) syncToServer(patch, token);
      }, delayMs);
    },
    [token, syncToServer, updateLocal]
  );

  const immediateSync = useCallback(
    (patch: Partial<UserSettingsState>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      updateLocal(patch);
      if (token) syncToServer(patch, token);
    },
    [token, syncToServer, updateLocal]
  );

  return { debouncedSync, immediateSync };
}
