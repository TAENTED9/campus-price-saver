/**
 * lib/settingsApi.ts — Typed API client for the Persistent Settings System.
 *
 * Endpoints:
 *   GET  /api/settings          getSettings
 *   PATCH /api/settings         patchSettings   (partial upsert)
 *   POST /api/settings/reset    resetSettings
 *   GET  /api/settings/export   exportSettings
 *
 * All methods require a valid Bearer token.
 * patchSettings throws on 409 conflict — caller should re-fetch and retry.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string | { message?: string } }).detail;
    const msg =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail?.message
        ? detail.message
        : "Request failed";
    throw new Error(msg);
  }
  return data as T;
}

// ── Response types ─────────────────────────────────────────────────────────────

export type NotifEmailSettings = {
  messages: boolean;
  price_drop: boolean;
  new_listing: boolean;
  order_update: boolean;
  review: boolean;
  weekly_digest: boolean;
  announcements: boolean;
  verification: boolean;
  login_alert: boolean;
  inquiry: boolean;
  follower: boolean;
  expiry: boolean;
  competitor: boolean;
  karma: boolean;
};

export type NotifPushSettings = {
  messages: boolean;
  price_drop: boolean;
  new_listing: boolean;
  order_update: boolean;
  review: boolean;
  announcements: boolean;
  inquiry: boolean;
  follower: boolean;
};

export type UserSettingsData = {
  // Appearance
  theme: "light" | "dark" | "system";
  language: string;
  // Privacy
  profile_visibility: "public" | "unilag" | "private";
  show_dept: boolean;
  read_receipts: boolean;
  show_online_status: boolean;
  show_last_seen: boolean;
  allow_follow: boolean;
  show_wishlist_count: boolean;
  show_review_history: boolean;
  // Security
  two_factor_enabled: boolean;
  login_alerts: boolean;
  // Notifications
  notifications: {
    email: NotifEmailSettings;
    push: NotifPushSettings;
  };
  // Seller-specific
  store_status: "open" | "limited" | "closed";
  vacation_mode: boolean;
  vacation_resume_date: string | null;
  auto_renew_listings: boolean;
  default_negotiable: boolean;
  default_listing_duration: number;
  default_pickup_location: string | null;
  // Flexible JSONB blob
  preferences: Record<string, unknown>;
  // Sync metadata
  version: number;
  updated_at: string | null;
};

/** Body accepted by PATCH /api/settings — all fields optional. */
export type SettingsUpdateBody = {
  theme?: "light" | "dark" | "system";
  language?: string;
  profile_visibility?: "public" | "unilag" | "private";
  show_dept?: boolean;
  read_receipts?: boolean;
  show_online_status?: boolean;
  show_last_seen?: boolean;
  allow_follow?: boolean;
  show_wishlist_count?: boolean;
  show_review_history?: boolean;
  login_alerts?: boolean;
  notifications?: {
    email?: Partial<NotifEmailSettings>;
    push?: Partial<NotifPushSettings>;
  };
  store_status?: "open" | "limited" | "closed";
  vacation_mode?: boolean;
  vacation_resume_date?: string | null;
  auto_renew_listings?: boolean;
  default_negotiable?: boolean;
  default_listing_duration?: 7 | 14 | 30;
  default_pickup_location?: string | null;
  preferences?: Record<string, unknown>;
  /** Current client version — triggers 409 if server is ahead. */
  client_version?: number;
};

// ── API ────────────────────────────────────────────────────────────────────────

export const settingsApi = {
  /**
   * Fetch full settings. Auto-creates a default row server-side if
   * this user has never accessed settings before.
   */
  getSettings: (token: string) =>
    request<{ settings: UserSettingsData }>("/api/settings", {
      headers: authHeaders(token),
    }),

  /**
   * Partial upsert. Only fields present in body are updated.
   * Throws on network error or 409 version conflict.
   */
  patchSettings: (token: string, body: SettingsUpdateBody) =>
    request<{ settings: UserSettingsData }>("/api/settings", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  /** Reset all settings to role-appropriate defaults. */
  resetSettings: (token: string) =>
    request<{ settings: UserSettingsData; message: string }>("/api/settings/reset", {
      method: "POST",
      headers: authHeaders(token),
    }),

  /** Export full settings as JSON (for device transfer / backup). */
  exportSettings: (token: string) =>
    request<{ export: UserSettingsData; exported_at: string; user_uuid: string }>(
      "/api/settings/export",
      { headers: authHeaders(token) }
    ),
};
