/**
 * stores/settingsStore.ts — Zustand store for the Persistent Settings System.
 *
 * Authority order (highest → lowest):
 *   Server  →  in-memory state  →  hardcoded defaults
 *
 * The store:
 *   - hydrate()       : called after login / refresh / /me — replaces state with server data
 *   - updateLocal()   : optimistic update before server write
 *   - syncToServer()  : optimistic update + debounced PATCH /api/settings
 *   - resetToDefaults(): POST /api/settings/reset
 *   - clearSettings() : called on logout
 *
 * Block 2 — Zero client-side storage:
 *   - No localStorage/sessionStorage persist middleware.
 *   - Theme is duplicated to a cookie (`campify_theme`) so the inline
 *     bootstrap script in app/layout.tsx can apply it before first paint
 *     without reading localStorage. The cookie is non-sensitive (not
 *     HttpOnly, no Secure flag), is overwritten on every hydrate(), and
 *     is cleared on logout.
 */

import { create } from "zustand";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotifPrefs {
  messages:       boolean;
  price_drop:     boolean;
  new_listing:    boolean;
  order_update:   boolean;
  review:         boolean;
  weekly_digest?: boolean;
  announcements:  boolean;
  verification?:  boolean;
  login_alert?:   boolean;
  inquiry?:       boolean;
  follower?:      boolean;
  expiry?:        boolean;
  competitor?:    boolean;
  karma?:         boolean;
}

export interface UserSettingsState {
  // Appearance
  theme:    "light" | "dark" | "system";
  language: string;
  // Privacy
  profile_visibility:  "public" | "unilag" | "private";
  show_dept:           boolean;
  read_receipts:       boolean;
  show_online_status:  boolean;
  show_last_seen:      boolean;
  allow_follow:        boolean;
  show_wishlist_count: boolean;
  show_review_history: boolean;
  // Security
  two_factor_enabled: boolean;
  login_alerts:       boolean;
  // Notifications
  notifications: {
    email: NotifPrefs;
    push:  Omit<NotifPrefs,
               "weekly_digest" | "verification" | "login_alert" |
               "expiry" | "competitor" | "karma">;
  };
  // Seller
  store_status:             "open" | "limited" | "closed";
  vacation_mode:            boolean;
  vacation_resume_date:     string | null;
  auto_renew_listings:      boolean;
  default_negotiable:       boolean;
  default_listing_duration: number;
  default_pickup_location:  string | null;
  // Flexible
  preferences: Record<string, unknown>;
  // Sync metadata
  version:    number;
  updated_at: string | null;
}

interface SettingsStore {
  settings:   UserSettingsState | null;
  isLoading:  boolean;
  isSyncing:  boolean;
  lastSynced: string | null;
  error:      string | null;

  hydrate:         (data: UserSettingsState) => void;
  updateLocal:     (patch: Partial<UserSettingsState>) => void;
  syncToServer:    (patch: Partial<UserSettingsState>, token: string) => Promise<void>;
  resetToDefaults: (token: string) => Promise<void>;
  clearSettings:   () => void;
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

const THEME_COOKIE = "campify_theme";

/**
 * Persist the user's chosen theme as a non-HttpOnly cookie so the inline
 * <script> in app/layout.tsx can apply it before first paint, with no
 * client storage involved. Cookie is non-sensitive — the theme is a UI
 * preference, not a secret.
 */
function writeThemeCookie(theme: "light" | "dark" | "system"): void {
  if (typeof document === "undefined") return;
  // 1 year, root path, lax — non-HttpOnly so the boot script can read it.
  document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

function clearThemeCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=;path=/;max-age=0;SameSite=Lax`;
}

export function applyTheme(theme: "light" | "dark" | "system"): void {
  if (typeof window === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  writeThemeCookie(theme);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
  (set, get) => ({
    settings:   null,
    isLoading:  false,
    isSyncing:  false,
    lastSynced: null,
    error:      null,

    hydrate: (data) => {
      set({
        settings:   data,
        lastSynced: new Date().toISOString(),
        error:      null,
      });
      applyTheme(data.theme);
    },

    updateLocal: (patch) => {
      const current = get().settings;
      if (!current) return;
      const next = { ...current, ...patch };
      set({ settings: next });
      if (patch.theme) applyTheme(patch.theme);
    },

    syncToServer: async (patch, token) => {
      const current = get().settings;
      if (!current) return;

      // Optimistic update — instant UI response
      get().updateLocal(patch);
      const prevSettings = current;

      set({ isSyncing: true, error: null });
      try {
        const res = await fetch(`${API}/api/settings`, {
          method:      "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...patch,
            client_version: current.version,
          }),
        });

        if (res.status === 409) {
          // Server has newer state — another device wrote first
          const data = await res.json();
          get().hydrate(data.detail.current);
          set({ error: "Settings synced from another device" });
          return;
        }

        if (!res.ok) {
          // Roll back on error
          set({ settings: prevSettings, error: "Failed to save settings" });
          return;
        }

        const data = await res.json();
        set({
          settings:   data.settings,
          lastSynced: new Date().toISOString(),
          error:      null,
        });
      } catch {
        // Roll back on network error
        set({
          settings: prevSettings,
          error:    "Connection error. Settings not saved.",
        });
      } finally {
        set({ isSyncing: false });
      }
    },

    resetToDefaults: async (token) => {
      set({ isSyncing: true });
      try {
        const res = await fetch(`${API}/api/settings/reset`, {
          method:      "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.settings) get().hydrate(data.settings);
      } finally {
        set({ isSyncing: false });
      }
    },

    clearSettings: () => {
      clearThemeCookie();
      set({ settings: null, lastSynced: null, error: null });
    },
  })
);
