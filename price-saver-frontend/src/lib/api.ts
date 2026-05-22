const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ===================== TYPES =====================

export type LoginResponse = {
  success: boolean;
  user_id?: number;
  user_name?: string;
  admin_id?: number;
  admin_name?: string;
  user_role?: string;
  access_token?: string;  // absent when mfa_required
  token_type?: string;
  message: string;
  // Block 10 — MFA two-step login
  mfa_required?: boolean;
  temp_token?: string;
  // Block 4A — settings rehydration on login
  settings?: import("@/lib/settingsApi").UserSettingsData;
};

export type UserInfo = {
  /** FIX #1: integer primary key. Safe to compare with message.sender_id etc. */
  id: number;
  /** FIX #1: public string UUID. Use this in URLs, never expose `id`. */
  uuid?: string | null;
  /** Deprecated alias for `id` — kept for back-compat with older code paths. */
  numeric_id?: number;
  username: string;
  email?: string;
  email_verified?: boolean;
  display_name?: string;
  role: string;
  balance?: number;
  seller_points?: number;
  avg_rating?: number | null;
  availability_status?: string;
  phone?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  level?: string | null;
  // Block 4B — settings embedded in /me response
  settings?: import("@/lib/settingsApi").UserSettingsData;
};

export type ApiError = {
  detail: string;
};

/** Returned by POST /api/auth/register when email is provided (no JWT). */
export type RegisterResponse = {
  success: boolean;
  verified: boolean;
  email: string;
  message: string;
  /** Present only when no email was supplied at registration (backward compat). */
  access_token?: string;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  token_type?: string;
};

// ===================== IN-MEMORY TOKEN STORE (Block 13A) =====================

let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;
let _onTokenRefreshed: ((token: string) => void) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setTokenRefreshCallback(cb: ((token: string) => void) | null): void {
  _onTokenRefreshed = cb;
}

async function _silentRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) { _accessToken = null; return null; }
      const data = await res.json();
      _accessToken = data.access_token ?? null;
      if (_accessToken && _onTokenRefreshed) _onTokenRefreshed(_accessToken);
      return _accessToken;
    } catch {
      _accessToken = null;
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// ===================== HELPERS =====================

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 12_000
): Promise<T> {
  const supplied = (options.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...supplied,
  };

  // Auto-inject in-memory access token when the caller hasn't set one
  if (!headers["Authorization"] && _accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include", // always send the HttpOnly refresh cookie
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(tid);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw err;
  }
  clearTimeout(tid);

  // ── 401 → silent refresh → retry once ─────────────────────────────────────
  // Skip for credential endpoints — a 401 there means wrong password, not expired token.
  const _noSilentRefresh = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/admin"]);
  if (res.status === 401 && !_noSilentRefresh.has(endpoint)) {
    const newToken = await _silentRefresh();
    if (newToken) {
      const retryRes = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        credentials: "include",
      });
      if (!retryRes.ok) {
        const b = await retryRes.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(typeof b.detail === "string" ? b.detail : "Request failed");
      }
      return retryRes.json() as Promise<T>;
    }
    // Refresh failed — session truly expired
    _accessToken = null;
    const b = await res.json().catch(() => ({ detail: "Session expired" }));
    throw new Error(typeof b.detail === "string" ? b.detail : "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    let message: string;
    if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      message = body.detail.map((e: { msg?: string }) => e.msg || "Validation error").join("; ");
    } else if (body.detail && typeof body.detail === "object") {
      message = JSON.stringify(body.detail);
    } else {
      message = "Request failed";
    }
    throw new Error(message || "Request failed");
  }

  return res.json() as Promise<T>;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ===================== API CLIENT (default export for sellerApi / buyerApi) ====

const apiClient = {
  get: <T = unknown>(url: string, opts?: RequestInit) =>
    request<T>(url.startsWith("/api") ? url : `/api${url}`, opts),
  post: <T = unknown>(url: string, body?: unknown, opts?: RequestInit) =>
    request<T>(url.startsWith("/api") ? url : `/api${url}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  put: <T = unknown>(url: string, body?: unknown, opts?: RequestInit) =>
    request<T>(url.startsWith("/api") ? url : `/api${url}`, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      ...opts,
    }),
  delete: <T = unknown>(url: string, opts?: RequestInit) =>
    request<T>(url.startsWith("/api") ? url : `/api${url}`, {
      method: "DELETE",
      ...opts,
    }),
};
export default apiClient;

// ===================== AUTH API =====================

export const authApi = {
  login: (username: string, password: string, rememberMe = false) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, remember_me: rememberMe }),
    }),

  register: (username: string, password: string, email?: string, role?: string) =>
    request<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, ...(email ? { email } : {}), ...(role ? { role } : {}) }),
    }),

  verifyEmailToken: (token: string) =>
    request<{ message: string; redirect: string; email?: string }>(
      `/api/auth/verify-email?token=${encodeURIComponent(token)}`
    ),

  resendVerification: (email: string) =>
    request<{ message: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  me: (token: string) =>
    request<UserInfo>("/api/auth/me", {
      headers: authHeaders(token),
    }),

  validateToken: (token: string) =>
    request<{ valid: boolean; user_id: number; username: string; role: string }>(
      "/api/auth/validate-token",
      { method: "POST", headers: authHeaders(token) }
    ),

  logout: () =>
    request<{ success: boolean; message: string }>("/api/auth/logout", {
      method: "POST",
    }),

  // Dedupe concurrent calls. Two contexts (AuthContext + AdminAuthContext)
  // can mount at the same time, and React StrictMode in dev runs the boot
  // effect twice — without this mutex, the second call hits the backend
  // after the first has already rotated/revoked the refresh token, which
  // trips token-theft detection and wipes ALL the user's refresh tokens.
  refresh: (() => {
    let inFlight: Promise<{ access_token: string; token_type: string; settings?: import("@/lib/settingsApi").UserSettingsData }> | null = null;
    return () => {
      if (inFlight) return inFlight;
      inFlight = request<{ access_token: string; token_type: string; settings?: import("@/lib/settingsApi").UserSettingsData }>(
        "/api/auth/refresh",
        { method: "POST" },
      ).finally(() => { inFlight = null; });
      return inFlight;
    };
  })(),

  mfaVerify: (temp_token: string, code: string) =>
    request<{ success: boolean; access_token: string; token_type: string; backup_used: boolean; remaining_backup_codes: number }>("/api/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ temp_token, code }),
    }),

  mfaSetup: (token: string, password: string) =>
    request<{ qr_code: string; secret: string; manual_entry: string }>("/api/auth/mfa/setup", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ password }),
    }),

  mfaConfirm: (token: string, code: string) =>
    request<{ backup_codes: string[]; message: string }>("/api/auth/mfa/confirm", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ code }),
    }),

  mfaDisable: (token: string, code: string) =>
    request<{ success: boolean; message: string }>("/api/auth/mfa/disable", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ code }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, email: string, password: string) =>
    request<{ success: boolean; message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, email, password }),
    }),

  updateProfile: (token: string, data: { display_name?: string; phone?: string; department?: string; level?: string; avatar_url?: string }) =>
    request<{ success: boolean; message: string; display_name?: string; phone?: string; department?: string; level?: string }>(
      "/api/auth/me",
      { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }
    ),

  sendOtp: (token: string, email: string) =>
    request<{ success: boolean; message: string }>("/api/auth/send-otp", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (token: string, email: string, otp: string) =>
    request<{ success: boolean; message: string }>("/api/auth/verify-otp", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ email, otp }),
    }),

  changePassword: (token: string, body: { current_password: string; new_password: string }) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  getSessions: (token: string) =>
    request<{ sessions: Array<{ id: string; device: string; location: string; last_active: string; current: boolean }> }>("/api/auth/sessions", {
      headers: authHeaders(token),
    }),

  revokeSession: (token: string, sessionId: string) =>
    request<{ message: string }>(`/api/auth/sessions/${sessionId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),
};

// ===================== ITEM TYPES =====================

export type Category = {
  id: number;
  name: string;
  icon?: string | null;
  description?: string | null;
};

export type Price = {
  id: number;
  uuid?: string | null;
  category_id: number;
  store_id?: number | null;
  name: string;
  brand?: string | null;
  pack_size?: string | null;
  pack_unit?: string | null;
  price: number;
  price_per_unit?: number | null;
  retailer?: string | null;
  location?: string | null;
  status: string;
  photos?: string[] | null;
  condition?: string | null;
  is_negotiable?: boolean | null;
  submitted_at?: string | null;
  view_count?: number | null;
  description?: string | null;
};

// ─── Flash Sale type ──────────────────────────────────────────────────────────

export type FlashSale = {
  id: number;
  price_id: number;
  seller_id: number;
  title?: string | null;
  original_price: number;
  sale_price: number;
  discount_pct: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  item_name?: string | null;
  item_brand?: string | null;
  item_location?: string | null;
  item_retailer?: string | null;
};

export type Store = {
  id: number;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  listing_count?: number;
};

export type SearchFilters = {
  q?: string;
  min_price?: number;
  max_price?: number;
  category_id?: number;
  location?: string;
  condition?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "most_viewed";
  skip?: number;
  limit?: number;
};

// ─── Marketplace listing (full detail) ───────────────────────────────────────

export type SellerInfo = {
  id: number;
  uuid?: string | null;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  availability_status: string;
  vacation_mode: boolean;
  auto_reply_message?: string | null;
  verified: boolean;
  is_verified?: boolean;
  verification_status?: "approved" | "pending" | "rejected" | "none";
  trust_signal?: string | null;
  whatsapp?: string | null;
  show_whatsapp?: boolean;
  instagram?: string | null;
  pickup_policy?: string | null;
  return_policy?: string | null;
  payment_policy?: string | null;
  follower_count: number;
  view_count?: number | null;
  confirmed_sales?: number | null;
  trust_tier?: string;
  seller_points?: number;
  avg_rating?: number | null;
  review_count?: number;
  response_rate?: number;
  completion_rate?: number;
};

export type ListingDetail = {
  id: number;
  uuid?: string | null;
  name: string;
  brand?: string | null;
  price: number;
  location?: string | null;
  category_id: number;
  subcategory?: string | null;
  description?: string | null;
  condition: string;
  quantity: number;
  is_negotiable: boolean;
  delivery_options?: string | null;
  delivery_fee?: number | null;
  photos: string[];
  status: string;
  listing_status: string;
  view_count: number;
  is_featured: boolean;
  submitted_at: string;
  expires_at?: string | null;
  pack_size?: string | null;
  pack_unit?: string | null;
  seller?: SellerInfo | null;
};

export type SellerStorefront = {
  seller: SellerInfo;
  listings: ListingDetail[];
  listing_count: number;
  owner_user_id?: number | null;
  owner_uuid?: string | null;
};

export type ThreadMessage = { sender: "buyer" | "seller"; text: string; at: string };

export type Inquiry = {
  id: number;
  listing_id: number;
  listing_name: string;
  buyer_id: number;
  buyer_uuid: string | null;
  buyer_name: string;
  message: string;
  is_read: boolean;
  seller_reply: string | null;
  replied_at: string | null;
  label: string | null;
  thread: ThreadMessage[] | null;
  created_at: string;
};

export type PlatformStats = {
  total_users: number;
  active_listings: number;
  total_categories: number;
};

export type FollowStatus = {
  following: boolean;
  follower_count: number;
};

// ===================== ITEMS API =====================

export const itemsApi = {
  getCategories: () =>
    request<Category[]>("/api/items/categories/all"),

  getPrices: (skip = 0, limit = 50) =>
    request<Price[]>(`/api/items/prices/all?skip=${skip}&limit=${limit}`),

  getNewArrivals: (limit = 8) =>
    request<Price[]>(`/api/items/prices/new?limit=${limit}`),

  getTrending: (limit = 8) =>
    request<Price[]>(`/api/items/prices/trending?limit=${limit}`),

  getFeatured: (limit = 8) =>
    request<Price[]>(`/api/items/prices/featured?limit=${limit}`),

  searchPrices: (filters: SearchFilters) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.min_price != null) params.set("min_price", String(filters.min_price));
    if (filters.max_price != null) params.set("max_price", String(filters.max_price));
    if (filters.category_id != null) params.set("category_id", String(filters.category_id));
    if (filters.location) params.set("location", filters.location);
    if (filters.condition) params.set("condition", filters.condition);
    if (filters.sort) params.set("sort", filters.sort);
    if (filters.skip != null) params.set("skip", String(filters.skip));
    params.set("limit", String(filters.limit ?? 10));
    return request<Price[]>(`/api/items/prices/search?${params.toString()}`);
  },

  getPricesByCategory: (categoryId: number, skip = 0, limit = 50) =>
    request<Price[]>(`/api/items/prices/category/${categoryId}?skip=${skip}&limit=${limit}`),

  incrementView: (priceId: number) =>
    request<{ counted: boolean; view_count: number }>(
      `/api/items/prices/${priceId}/view`, { method: "POST" }
    ),

  boostListing: (priceId: number, days: 7 | 30 = 7) =>
    request<{ ok: boolean; points_spent: number; points_remaining: number }>(
      `/api/items/prices/${priceId}/boost?days=${days}`, { method: "POST" }
    ),

  confirmPurchase: (priceId: number) =>
    request<{ ok: boolean; points_awarded: number; total_points: number }>(
      `/api/items/prices/${priceId}/confirm_purchase`, { method: "POST" }
    ),
};

// ===================== FLASH SALES API =====================

export const flashSalesApi = {
  getActive: async (limit = 6): Promise<FlashSale[]> => {
    const res = await request<{ data: FlashSale[] } | FlashSale[]>(
    `/api/flash-sales/active?limit=${limit}`
  );

  return Array.isArray(res) ? res : res.data ?? [];
  },
  create: (
    token: string,
    data: { listing_id: number; title?: string; discount_pct: number; end_time: string }
  ) =>
    request<FlashSale>("/api/flash-sales/", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  cancel: (token: string, saleId: number) =>
    request<{ ok: boolean }>(`/api/flash-sales/${saleId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),
};

// ===================== STORES API =====================

export const storesApi = {
  getNearby: (location = "", limit = 6) =>
    request<Store[]>(
      `/api/stores/nearby?location=${encodeURIComponent(location)}&limit=${limit}`
    ),

  getAll: (limit = 50) =>
    request<Store[]>(`/api/stores/?limit=${limit}`),
};

// ===================== USER DASHBOARD TYPES =====================

export type MySubmission = {
  id: number;
  name: string;
  brand?: string | null;
  price: number;
  location?: string | null;
  status: string;
  submitted_at: string;
  category_id: number;
  view_count: number;
};

export type PointsTransaction = {
  id: number;
  amount: number;
  reason?: string | null;
  related_price_id?: number | null;
  created_at: string;
};

export type PriceAlert = {
  id: number;
  item_name: string;
  target_price: number;
  category_id?: number | null;
  max_distance_km?: number | null;
  trigger_count: number;
  last_triggered_at?: string | null;
  created_at: string;
};

export type SellerVerificationSubmit = {
  seller_name: string;
  matric_no: string;
  faculty: string;
  business_name: string;
  business_description?: string;
  business_category?: string;
  pickup_location?: string;
  document_url?: string;
  portal_screenshot_url?: string;
  email: string;
  user_id?: number;
};

// ===================== USER API =====================

export const userApi = {
  getSubmissions: (token: string) =>
    request<{ success: boolean; data: MySubmission[] }>("/api/auth/me/submissions", {
      headers: authHeaders(token),
    }),

  getPoints: (token: string) =>
    request<{ success: boolean; balance: number; transactions: PointsTransaction[] }>(
      "/api/auth/me/points",
      { headers: authHeaders(token) }
    ),

  getAlerts: (token: string) =>
    request<{ success: boolean; data: PriceAlert[] }>("/api/auth/me/alerts", {
      headers: authHeaders(token),
    }),

  createAlert: (
    token: string,
    data: { item_name: string; target_price: number; category_id?: number; max_distance_km?: number }
  ) =>
    request<{ success: boolean; id: number; message: string }>("/api/auth/me/alerts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteAlert: (token: string, alertId: number) =>
    request<{ success: boolean; message: string }>(`/api/auth/me/alerts/${alertId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  updateSettings: (token: string, body: Record<string, unknown>) =>
    request<{ message: string }>("/api/settings", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateNotifications: (token: string, body: Record<string, unknown>) =>
    request<{ message: string }>("/api/auth/notification-preferences", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  deleteAccount: (token: string) =>
    request<{ message: string }>("/api/auth/account", {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  /** Buyer-side stat cards in one call. Backed by GET /api/auth/me/dashboard-stats. */
  getDashboardStats: (token: string) =>
    request<{
      karma_points:   number;
      karma_tier:     string;
      submissions:    number;
      price_alerts:   number;
      wishlist_count: number;
    }>("/api/auth/me/dashboard-stats", { headers: authHeaders(token) }),
};

// ===================== VERIFICATION API =====================

export const verificationApi = {
  submit: async (
    data: SellerVerificationSubmit,
    token: string,
  ): Promise<{ success: boolean; message: string; verification_id: number }> => {
    const form = new FormData();
    form.append("seller_name", data.seller_name);
    form.append("matric_number", data.matric_no);
    form.append("email", data.email);
    form.append("faculty", data.faculty || "");
    form.append("business_name", data.business_name || "");
    form.append("business_category", data.business_category || "");
    form.append("pickup_location", data.pickup_location || "");
    form.append("id_card_url", data.document_url || "");
    form.append("portal_url", data.portal_screenshot_url || "");
    if (data.user_id != null && !Number.isNaN(data.user_id)) {
      form.append("user_id", String(data.user_id));
    }
    const res = await fetch(`${API_BASE}/api/seller/verification/docs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Submission failed" }));
      throw new Error(err.detail || "Submission failed");
    }
    return res.json();
  },
};

// ===================== UPLOAD API =====================

export const uploadApi = {
  uploadSellerIdCard: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/seller-id`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadPortalScreenshot: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/seller-portal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadAvatar: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadListingPhoto: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/listing-photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadBanner: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/banner`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadBannerSlide: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/banner-slide`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },

  uploadReviewImage: async (token: string, file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload/review-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    const data: { success: boolean; url: string } = await res.json();
    return data.url;
  },
};

// ===================== SELLER DASHBOARD TYPES =====================

export type KarmaEntry = {
  id: number;
  points: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

export type SellerStats = {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  draftListings: number;
  expiredListings: number;
  totalViews: number;
  confirmedSales: number;
  sellerPoints: number;
  vacationMode: boolean;
  verificationStatus: string;
  totalInquiries?: number;
  followersCount?: number;
  availabilityStatus?: string;
  responseRate?: number;
  avgResponseTime?: string;
  completionRate?: number;
  noShowRate?: number;
  avgRating?: number | null;
  reviewCount?: number;
};

export type SellerListing = {
  id: number;
  uuid?: string | null;
  name: string;
  brand?: string | null;
  price: number;
  location?: string | null;
  category_id: number;
  status: string;
  listing_status: string;
  view_count: number;
  is_featured: boolean;
  featured_until?: string | null;
  submitted_at: string;
  description?: string | null;
  subcategory?: string | null;
  condition: string;
  quantity: number;
  is_negotiable: boolean;
  delivery_options?: string | null;
  delivery_fee?: number | null;
  duration_days?: number | null;
  expires_at?: string | null;
  photos: string[];
  pack_size?: string | null;
  pack_unit?: string | null;
};

export type SellerAnalytics = {
  months: string[];
  listings: number[];
  views: number[];
  topListings: { id: number; name: string; views: number; price: number }[];
  benchmarks: { listing_id: number; name: string; your_price: number; avg_market_price: number; competitive: boolean }[];
};

export type SellerVerificationData = {
  id: number;
  sellerName: string;
  matricNo: string;
  faculty: string;
  businessName: string;
  businessDescription?: string | null;
  email: string;
  status: string;
  adminNotes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
} | null;

// ===================== SELLER API =====================

export const sellerApi = {
  apply: (token: string, data: { business_name: string; category: string; pickup_location: string; bio?: string }) =>
    request<{ success: boolean; message: string }>("/api/seller/apply", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  getStats: (token: string) =>
    request<{ success: boolean; data: SellerStats }>("/api/seller/stats", {
      headers: authHeaders(token),
    }),

  getListings: (token: string, statusFilter?: string, listingStatus?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status_filter", statusFilter);
    if (listingStatus) params.set("listing_status", listingStatus);
    return request<{ success: boolean; data: SellerListing[] }>(
      `/api/seller/listings?${params.toString()}`,
      { headers: authHeaders(token) }
    );
  },

  createListing: (token: string, data: Partial<SellerListing> & { name: string; category_id: number; price: number }) =>
    request<{ success: boolean; id: number; message: string }>("/api/seller/listings", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  updateListing: (token: string, listingId: number, data: Partial<SellerListing>) =>
    request<{ success: boolean; message: string }>(`/api/seller/listings/${listingId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/seller/listings/${listingId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  getAnalytics: (token: string, range?: string) =>
    request<{ success: boolean; data: SellerAnalytics }>(
      `/api/seller/analytics${range ? `?range=${range}` : ""}`,
      { headers: authHeaders(token) }
    ),

  setAvailability: (token: string, status: string) =>
    request<{ success: boolean; availability_status: string }>("/api/seller/availability", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ availability_status: status }),
    }),

  getVerification: (token: string) =>
    request<{ success: boolean; data: SellerVerificationData }>("/api/seller/verification", {
      headers: authHeaders(token),
    }),

  updateProfile: (token: string, data: { display_name?: string; email?: string }) =>
    request<{ success: boolean; message: string }>("/api/seller/profile", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  setListingStatus: (token: string, listingId: number, listing_status: string) =>
    request<{ success: boolean; listing_status: string }>(
      `/api/seller/listings/${listingId}/listing-status`,
      { method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ listing_status }) }
    ),

  duplicateListing: (token: string, listingId: number) =>
    request<{ success: boolean; id: number; message: string }>(
      `/api/seller/listings/${listingId}/duplicate`,
      { method: "POST", headers: authHeaders(token) }
    ),

  toggleVacation: (token: string) =>
    request<{ success: boolean; vacation_mode: boolean }>("/api/seller/vacation", {
      method: "POST",
      headers: authHeaders(token),
    }),

  getInquiries: (token: string) =>
    request<{ success: boolean; data: Inquiry[]; unread_count: number }>("/api/seller/inquiries", {
      headers: authHeaders(token),
    }),

  markInquiryRead: (token: string, inquiryId: number) =>
    request<{ success: boolean }>(`/api/seller/inquiries/${inquiryId}/read`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  replyToInquiry: (token: string, inquiryId: number, reply: string) =>
    request<{ success: boolean; replied_at: string }>(`/api/seller/inquiries/${inquiryId}/reply`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    }),

  setInquiryLabel: (token: string, inquiryId: number, label: string | null) =>
    request<{ success: boolean; label: string | null }>(`/api/seller/inquiries/${inquiryId}/label`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }),

  blockUser: (token: string, userId: number) =>
    request<{ blocked: boolean }>(`/api/storefront/user/${userId}/block`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  reportUser: (token: string, userUuid: string, reason: string) =>
    request<{ ok: boolean; message: string }>(`/api/messages/report/${userUuid}`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),

  getProfile: (token: string) =>
    request<Record<string, unknown>>("/api/seller/profile-settings", {
      headers: authHeaders(token),
    }),

  updateStorefront: (token: string, data: Record<string, unknown>) =>
    request<{ message: string }>("/api/seller/storefront", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  checkSlug: (token: string, slug: string) =>
    request<{ available: boolean; slug: string }>(`/api/seller/check-slug?slug=${encodeURIComponent(slug)}`, {
      headers: authHeaders(token),
    }),

  updatePolicies: (token: string, body: { pickup_policy: string; return_policy: string; payment_policy: string }) =>
    request<{ message: string }>("/api/seller/policies", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateAvailability: (token: string, body: { status: string }) =>
    request<{ message: string; status: string }>("/api/seller/availability", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateAutoReplyMsg: (token: string, body: { message: string }) =>
    request<{ message: string }>("/api/seller/auto-reply", {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateDefaults: (token: string, body: { default_location: string; default_duration: number; auto_renew: boolean; default_negotiable: boolean }) =>
    request<{ message: string }>("/api/seller/listing-defaults", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  submitVerificationDocs: async (token: string, formData: FormData) => {
    const res = await fetch(`${API_BASE}/api/seller/verification/docs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  downgrade: (token: string) =>
    request<{ message: string }>("/api/seller/downgrade", {
      method: "POST",
      headers: authHeaders(token),
    }),

  getKarmaHistory: (token: string, limit = 10) =>
    request<{ success: boolean; total: number; history: KarmaEntry[] }>(
      `/api/seller/karma-history?limit=${limit}`,
      { headers: authHeaders(token) }
    ),

  checkProfileKarma: (token: string) =>
    request<{ success: boolean; awarded: boolean; new_total: number }>(
      "/api/seller/karma/check-profile",
      { method: "POST", headers: authHeaders(token) }
    ),
};

// ===================== LISTING API (public) =====================

export const listingApi = {
  getDetail: (id: number) =>
    request<ListingDetail>(`/api/storefront/listing/${id}`),

  getDetailBySlug: (slug: string) =>
    request<ListingDetail>(`/api/listings/${slug}`),

  recordView: (uuid: string) =>
    request<{ ok: boolean; view_count: number }>(`/api/listings/${uuid}/views`, { method: "POST" }),

  recordInterest: (uuid: string) =>
    request<{ ok: boolean }>(`/api/listings/${uuid}/interested`, { method: "POST" }),

  getSimilar: (id: number) =>
    request<ListingDetail[]>(`/api/storefront/listing/${id}/similar`),

  sendInquiry: (token: string, listingId: number, message: string) =>
    request<{ success: boolean; message: string }>(
      `/api/storefront/listing/${listingId}/inquiry`,
      { method: "POST", headers: authHeaders(token), body: JSON.stringify({ message }) }
    ),

  report: (token: string, listingId: number, reason: string, note?: string) =>
    request<{ success: boolean; message: string }>(
      `/api/storefront/listing/${listingId}/report`,
      { method: "POST", headers: authHeaders(token), body: JSON.stringify({ reason, note }) }
    ),
};

// ===================== STOREFRONT API =====================

export const storefrontApi = {
  getPlatformStats: () =>
    request<PlatformStats>("/api/storefront/stats"),

  getSellerPage: (username: string) =>
    request<SellerStorefront>(`/api/storefront/store/${username}`),

  followSeller: (token: string, sellerId: number) =>
    request<FollowStatus>(`/api/storefront/follow/${sellerId}`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  getFollowStatus: (token: string, sellerId: number) =>
    request<FollowStatus>(`/api/storefront/follow/${sellerId}/status`, {
      headers: authHeaders(token),
    }),

  getMyInquiries: (token: string) =>
    request<{ success: boolean; data: BuyerInquiry[]; unread_replies: number }>("/api/storefront/my-inquiries", {
      headers: authHeaders(token),
    }),

  sendFollowUp: (token: string, inquiryId: number, message: string) =>
    request<{ success: boolean; thread: ThreadMessage[] }>(`/api/storefront/inquiry/${inquiryId}/followup`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ message }),
    }),

  updateCoverPhoto: (token: string, coverPhotoUrl: string) =>
    request<{ success: boolean; banner_url: string }>("/api/storefront/cover-photo", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ cover_photo_url: coverPhotoUrl }),
    }),

  updateAbout: (token: string, about: string) =>
    request<{ success: boolean; bio: string }>("/api/storefront/about", {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ about }),
    }),
};

export type BuyerInquiry = {
  id: number;
  listing_id: number;
  listing_name: string;
  seller_id: number;
  seller_name: string;
  message: string;
  seller_reply: string | null;
  replied_at: string | null;
  thread: ThreadMessage[] | null;
  created_at: string;
};

// ===================== ADMIN API TYPES =====================

export type AdminUserLegacy = {
  id: number;
  username: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  balance: number;
  seller_points: number;
  is_suspended: boolean;
  is_banned: boolean;
  suspended_until: string | null;
  ban_reason: string | null;
  created_at: string;
};

export type AdminListing = {
  id: number;
  name: string;
  brand: string | null;
  price: string;
  location: string | null;
  retailer: string | null;
  status: string;
  submitted_by: number | null;
  seller_name: string;
  submitted_at: string;
  created_at: string;
  view_count: number;
  category_id: number;
  category: string;
  is_featured: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
};

export type AdminListingDetail = AdminListing & {
  description: string | null;
  condition: string | null;
  quantity: number | null;
  is_negotiable: boolean | null;
  delivery_options: string | null;
  delivery_fee?: number | null;
  subcategory: string | null;
  photos: string[];
  listing_status: string | null;
  pack_size: number | null;
  pack_unit: string | null;
  expires_at: string | null;
  seller_username: string | null;
};

export type AdminAnnouncement = {
  id: number;
  title: string;
  message: string;
  type: string;
  audience: string;
  is_active: boolean;
  banner_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminReport = {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: string;
  target_id: number;
  target_name: string | null;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminDispute = {
  id: number;
  buyer_id: number;
  buyer_name: string;
  seller_id: number | null;
  seller_name: string | null;
  price_id: number | null;
  listing_name: string | null;
  issue: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminAuditEntry = {
  id: number;
  admin_id: number;
  admin_name: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_desc: string | null;
  created_at: string;
};

export type AdminCategory = {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  listing_count: number;
  is_active: boolean;
};

export type AdminVerification = {
  id: number;
  user_id: number | null;
  seller_name: string;
  matric_no: string;
  faculty: string;
  business_name: string;
  business_description: string | null;
  business_category: string | null;
  pickup_location: string | null;
  email: string;
  document_url: string | null;
  portal_screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
};

// ===================== ADMIN NOTIFICATION / LIFECYCLE TYPES =====================

export type AdminEvent = {
  id: number;
  event_type: string;
  user_id: number | null;
  user_email: string;
  user_role: string;
  payload: Record<string, unknown>;
  is_read: boolean;
  requires_action: boolean;
  created_at: string | null;
};

export type AdminUserSummary = {
  id: number;
  username: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  avatar_url: string | null;
  is_paused: boolean;
  is_suspended?: boolean;
  is_deleted: boolean;
  is_banned: boolean;
  created_at: string | null;
};

export type AdminUserDetail = {
  id: number;
  username: string | null;
  email: string | null;
  display_name: string | null;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  department: string | null;
  level: string | null;
  bio: string | null;
  seller_points: number;
  balance: number;
  is_paused: boolean;
  paused_at: string | null;
  paused_by: string | null;
  pause_reason: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  is_suspended: boolean;
  suspension_reason: string | null;
  deletion_requested_at: string | null;
  deletion_request_reason: string | null;
  reactivation_requested_at: string | null;
  created_at: string | null;
  listings: {
    id: number;
    name: string;
    price: number;
    listing_status: string;
    status: string;
    created_at: string | null;
  }[];
  verification: {
    id: number;
    status: string;
    seller_name: string;
    matric_no: string;
    faculty: string | null;
    business_name: string | null;
    business_category: string | null;
    pickup_location: string | null;
    document_url: string | null;
    portal_screenshot_url: string | null;
    admin_notes: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  } | null;
  cloudinary_assets: {
    id: number;
    asset_type: string;
    url: string;
    folder: string;
    bytes: number | null;
    format: string | null;
    uploaded_at: string | null;
  }[];
  admin_events: AdminEvent[];
};

export type AdminAnalytics = {
  success: boolean;
  totals: {
    total_users: number;
    total_buyers: number;
    total_sellers: number;
    total_listings: number;
    total_views: number;
    paused_accounts: number;
    pending_verifications: number;
    delete_requests: number;
  };
  daily_signups: { day: string; count: number }[];
  daily_listings: { day: string; count: number }[];
  top_categories: { category: string; count: number }[];
  top_sellers: {
    display_name: string | null;
    email: string | null;
    total_views: number;
    listing_count: number;
  }[];
  recent_events: AdminEvent[];
};

// ===================== ADMIN API =====================

export const adminApi = {
  // Stats
  getStats: (token: string) =>
    request<{ success: boolean; data: { registeredStudents: number; pendingVerifications: number; activeListings: number; openReports: number; newUsersToday: number } }>("/api/admin/stats", {
      headers: authHeaders(token),
    }),

  getMonthlyAnalytics: (token: string) =>
    request<{ success: boolean; data: { months: Array<{ month: string; submissions: number; revenue: number }> } }>("/api/admin/analytics/monthly", {
      headers: authHeaders(token),
    }),

  // Users (legacy — kept for existing admin pages; Block 3B getUsers below supersedes this)
  getUsersLegacy: (token: string, role?: string) =>
    request<{ success: boolean; total: number; data: AdminUserLegacy[] }>(`/api/admin/users${role ? `?role=${role}` : ""}`, {
      headers: authHeaders(token),
    }),

  suspendUser: (token: string, userId: number, data: { reason?: string; hours?: number }) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}/suspend`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  banUser: (token: string, userId: number, reason: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}/ban`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    }),

  restoreUser: (token: string, userId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}/restore`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  // Listings
  getListings: (token: string, status?: string) =>
    request<{ success: boolean; total: number; data: AdminListing[] }>(`/api/admin/listings${status ? `?status=${status}` : ""}`, {
      headers: authHeaders(token),
    }),

  getListingDetail: (token: string, listingId: number) =>
    request<{ success: boolean; data: AdminListingDetail }>(`/api/admin/listings/${listingId}`, {
      headers: authHeaders(token),
    }),

  approveListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/approve`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  rejectListing: (token: string, listingId: number, reason?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/reject`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: reason ? JSON.stringify({ reason }) : undefined,
    }),

  removeListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  flagListing: (token: string, listingId: number, reason?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/flag`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: reason ? JSON.stringify({ reason }) : undefined,
    }),

  unflagListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/unflag`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  featureListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/feature`, {
      method: "PUT",
      headers: authHeaders(token),
    }),

  unfeatureListing: (token: string, listingId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/listings/${listingId}/unfeature`, {
      method: "PUT",
      headers: authHeaders(token),
    }),

  // Announcements
  getAnnouncements: (token: string) =>
    request<{ success: boolean; data: AdminAnnouncement[] }>("/api/admin/announcements", {
      headers: authHeaders(token),
    }),

  createAnnouncement: (token: string, data: { title: string; message: string; type?: string; audience?: string; banner_url?: string; cta_label?: string; cta_href?: string }) =>
    request<{ success: boolean; id: number; message: string }>("/api/admin/announcements", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  broadcastAnnouncement: (token: string, annId: number) =>
    request<{ success: boolean; sent_to: number; message: string }>(`/api/admin/announcements/${annId}/broadcast`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  updateAnnouncement: (token: string, annId: number, data: Partial<{ title: string; message: string; type: string; audience: string; is_active: boolean; banner_url: string; cta_label: string; cta_href: string }>) =>
    request<{ success: boolean; message: string }>(`/api/admin/announcements/${annId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteAnnouncement: (token: string, annId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/announcements/${annId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  // Reports
  getReports: (token: string, status?: string) =>
    request<{ success: boolean; data: AdminReport[] }>(`/api/admin/reports${status ? `?status=${status}` : ""}`, {
      headers: authHeaders(token),
    }),

  resolveReport: (token: string, reportId: number, adminNotes?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/reports/${reportId}/resolve`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ admin_notes: adminNotes }),
    }),

  reviewReport: (token: string, reportId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/reports/${reportId}/review`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  dismissReport: (token: string, reportId: number, reason?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/reports/${reportId}/dismiss`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    }),

  // Disputes
  getDisputes: (token: string, status?: string) =>
    request<{ success: boolean; data: AdminDispute[] }>(`/api/admin/disputes${status ? `?status=${status}` : ""}`, {
      headers: authHeaders(token),
    }),

  updateDispute: (token: string, disputeId: number, data: { status: string; admin_notes?: string }) =>
    request<{ success: boolean; message: string }>(`/api/admin/disputes/${disputeId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  // Audit Log
  getAuditLog: (token: string, targetType?: string) =>
    request<{ success: boolean; total: number; data: AdminAuditEntry[] }>(`/api/admin/audit-log${targetType ? `?target_type=${targetType}` : ""}`, {
      headers: authHeaders(token),
    }),

  // Categories
  getCategories: (token: string) =>
    request<{ success: boolean; data: AdminCategory[] }>("/api/admin/categories", {
      headers: authHeaders(token),
    }),

  createCategory: (token: string, data: { name: string; icon?: string; description?: string }) =>
    request<{ success: boolean; id: number; message: string }>("/api/admin/categories", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  updateCategory: (token: string, catId: number, data: Partial<{ name: string; icon: string; description: string }>) =>
    request<{ success: boolean; message: string }>(`/api/admin/categories/${catId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  deleteCategory: (token: string, catId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/categories/${catId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  // Verifications. Backend accepts both /verification and /verification/
  // and both `?status` and `?status_filter`, plus a case-insensitive match.
  getVerifications: (token: string, status?: string) =>
    request<{ success: boolean; data: AdminVerification[] }>(
      `/api/admin/verification/${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { headers: authHeaders(token) },
    ),

  approveVerification: (token: string, id: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/verification/${id}/approve`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  rejectVerification: (token: string, id: number, adminNotes?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/verification/${id}/reject`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ admin_notes: adminNotes }),
    }),

  reviewVerification: (token: string, id: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/verification/${id}/review`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  // Block 3A — Admin events
  getEvents: (token: string, params?: { type?: string; unread?: boolean; requires_action?: boolean; skip?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.type)             q.set("type", params.type);
    if (params?.unread)           q.set("unread", "true");
    if (params?.requires_action)  q.set("requires_action", "true");
    if (params?.skip != null)     q.set("skip", String(params.skip));
    if (params?.limit != null)    q.set("limit", String(params.limit));
    return request<{ success: boolean; total: number; unread_count: number; data: AdminEvent[] }>(
      `/api/admin/events${q.toString() ? "?" + q.toString() : ""}`,
      { headers: authHeaders(token) },
    );
  },

  markEventRead: (token: string, id: number) =>
    request<{ success: boolean }>(`/api/admin/events/${id}/read`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  markAllEventsRead: (token: string) =>
    request<{ success: boolean }>("/api/admin/events/read-all", {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  // Block 3B — User management
  getUsers: (token: string, params?: { role?: string; status?: string; skip?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.role)          q.set("role", params.role);
    if (params?.status)        q.set("status", params.status);
    if (params?.skip != null)  q.set("skip", String(params.skip));
    if (params?.limit != null) q.set("limit", String(params.limit));
    return request<{ success: boolean; total: number; data: AdminUserSummary[] }>(
      `/api/admin/users${q.toString() ? "?" + q.toString() : ""}`,
      { headers: authHeaders(token) },
    );
  },

  getUserDetail: (token: string, userId: number) =>
    request<{ success: boolean; data: AdminUserDetail }>(`/api/admin/users/${userId}`, {
      headers: authHeaders(token),
    }),

  // Block 4 — Lifecycle
  pauseUser: (token: string, userId: number, reason: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}/pause`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    }),

  deleteUser: (token: string, userId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),

  reactivateUser: (token: string, userId: number) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${userId}/reactivate`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  // Block 6A — Analytics
  getAnalytics: (token: string) =>
    request<AdminAnalytics>("/api/admin/analytics", { headers: authHeaders(token) }),
};

// ===================== ORDERS API =====================

export type Order = {
  id: number;
  uuid?: string | null;
  listing_id: number;
  listing_name: string;
  listing_price: number;
  listing_condition?: string | null;
  listing_photos?: string[];
  listing_uuid?: string | null;
  seller_id: number;
  seller_name: string;
  seller_avatar?: string | null;
  status: string;
  meetup_location?: string | null;
  created_at: string;
};

export const ordersApi = {
  list: (token: string, status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    return request<{ success: boolean; data: Order[] }>(
      `/api/orders${q.toString() ? "?" + q.toString() : ""}`,
      { headers: authHeaders(token) }
    );
  },

  cancel: (token: string, uuid: string) =>
    request<Order>(`/api/orders/${uuid}/status`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ status: "cancelled" }),
    }),

  expressInterest: (token: string, listingUuid: string) =>
    request<{ success: boolean; order_uuid: string; conversation_id: number; conversation_uuid: string | null; is_new_conversation: boolean; message: string }>(
      `/api/orders/express-interest/${listingUuid}`,
      { method: "POST", headers: authHeaders(token) }
    ),

  expressInterestBody: (listingUuid: string, token: string) =>
    request<{ order_uuid: string; conversation_uuid: string; is_new_conversation: boolean; message: string }>(
      "/api/orders/express-interest",
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ listing_uuid: listingUuid }),
      }
    ),
};

// ===================== NOTIFICATIONS API =====================

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  related_id: number | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
};

export const notificationsApi = {
  list: (token: string, skip = 0, limit = 30, scope?: string) =>
    request<{ unread_count: number; notifications: AppNotification[] }>(
      `/api/notifications/?skip=${skip}&limit=${limit}${scope ? `&scope=${scope}` : ""}`,
      { headers: authHeaders(token) }
    ),

  unreadCount: (token: string, scope?: string) =>
    request<{ unread_count: number }>(
      `/api/notifications/unread-count${scope ? `?scope=${scope}` : ""}`,
      { headers: authHeaders(token) }
    ),

  markRead: (token: string, id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: authHeaders(token),
    }),

  markAllRead: (token: string) =>
    request<{ success: boolean }>(`/api/notifications/mark-all-read`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  delete: (token: string, id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    }),
};

// ===================== WISHLIST API =====================

export const wishlistApi = {
  toggle: (token: string, listingId: number) =>
    request<{ wishlisted: boolean }>(
      `/api/wishlist/toggle/${listingId}`,
      { method: "POST", headers: authHeaders(token) }
    ),

  status: (token: string, listingId: number) =>
    request<{ wishlisted: boolean }>(`/api/wishlist/status/${listingId}`, {
      headers: authHeaders(token),
    }),

  list: (token: string) =>
    request<Array<{
      wishlist_id: number;
      listing_id: number;
      name: string;
      price: number;
      location: string | null;
      listing_status: string;
      photos: string[];
      saved_at: string;
    }>>(`/api/wishlist/`, { headers: authHeaders(token) }),
};

// ===================== REVIEWS API =====================

export type Review = {
  id: number;
  listing_id: number;
  reviewer_id: number;
  reviewer_name: string;
  reviewer_avatar: string | null;
  seller_id: number;
  rating: number;
  comment: string | null;
  photo_url: string | null;
  is_verified_interaction: boolean;
  seller_response: string | null;
  seller_response_at: string | null;
  is_flagged: boolean;
  created_at: string;
};

export type ReviewSummary = {
  total: number;
  avg_rating: number | null;
  rating_distribution?: Record<string, number>;
  reviews: Review[];
};

export const reviewsApi = {
  getForListing: (listingId: number) =>
    request<ReviewSummary>(`/api/reviews/listing/${listingId}`),

  getForSeller: (sellerId: number) =>
    request<ReviewSummary>(`/api/reviews/seller/${sellerId}`),

  submit: (token: string, listingId: number, rating: number, comment?: string, photoUrl?: string) =>
    request<Review>(
      `/api/reviews/listing/${listingId}`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, photo_url: photoUrl }),
      }
    ),

  sellerRespond: (token: string, reviewId: number, response: string) =>
    request<{ success: boolean }>(
      `/api/reviews/${reviewId}/respond`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      }
    ),

  flag: (token: string, reviewId: number, reason?: string) =>
    request<{ success: boolean }>(
      `/api/reviews/${reviewId}/flag`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }
    ),

  sellerRespondByUuid: (token: string, reviewUuid: string, reply: string) =>
    request<{ success: boolean; review: Review }>(
      `/api/reviews/${reviewUuid}/respond`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      }
    ),

  editReview: (token: string, reviewRef: string, comment: string, photoUrl?: string | null) =>
    request<{ success: boolean; review: Review }>(
      `/api/reviews/${reviewRef}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ comment, photo_url: photoUrl ?? null }),
      }
    ),
};
