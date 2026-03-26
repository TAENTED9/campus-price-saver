const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ===================== TYPES =====================

export type LoginResponse = {
  success: boolean;
  user_id?: number;
  user_name?: string;
  admin_id?: number;
  admin_name?: string;
  user_role: string;
  access_token: string;
  token_type: string;
  message: string;
};

export type UserInfo = {
  id: number;
  username: string;
  email?: string;
  email_verified?: boolean;
  display_name?: string;
  role: string;
  balance?: number;
  phone?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  level?: string | null;
};

export type ApiError = {
  detail: string;
};

// ===================== HELPERS =====================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    let message: string;
    if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      // FastAPI validation errors: detail is an array of { msg, loc, type }
      message = body.detail.map((e: { msg?: string }) => e.msg || "Validation error").join("; ");
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

// ===================== AUTH API =====================

export const authApi = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string, email?: string) =>
    request<LoginResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, ...(email ? { email } : {}) }),
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

  updateProfile: (token: string, data: { display_name?: string; phone?: string; department?: string; level?: string }) =>
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
  username: string;
  display_name: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  availability_status: string;
  vacation_mode: boolean;
  auto_reply_message?: string | null;
  verified: boolean;
  follower_count: number;
  trust_tier?: string;
  seller_points?: number;
  avg_rating?: number | null;
  review_count?: number;
  response_rate?: number;
  completion_rate?: number;
};

export type ListingDetail = {
  id: number;
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
};

export type ThreadMessage = { sender: "buyer" | "seller"; text: string; at: string };

export type Inquiry = {
  id: number;
  listing_id: number;
  listing_name: string;
  buyer_id: number;
  buyer_name: string;
  message: string;
  is_read: boolean;
  seller_reply: string | null;
  replied_at: string | null;
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
    request<{ ok: boolean; view_count: number }>(
      `/api/items/prices/${priceId}/view`, { method: "POST" }
    ),

  boostListing: (priceId: number, sellerId: number, days: 7 | 30 = 7) =>
    request<{ ok: boolean; points_spent: number; points_remaining: number }>(
      `/api/items/prices/${priceId}/boost?seller_id=${sellerId}&days=${days}`, { method: "POST" }
    ),

  confirmPurchase: (priceId: number, sellerId: number) =>
    request<{ ok: boolean; points_awarded: number; total_points: number }>(
      `/api/items/prices/${priceId}/confirm_purchase?seller_id=${sellerId}`, { method: "POST" }
    ),
};

// ===================== FLASH SALES API =====================

export const flashSalesApi = {
  getActive: (limit = 6) =>
    request<FlashSale[]>(`/api/flash-sales/active?limit=${limit}`),

  create: (
    data: { price_id: number; title?: string; discount_pct: number; end_time: string },
    sellerId: number
  ) =>
    request<FlashSale>(`/api/flash-sales/?seller_id=${sellerId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  cancel: (saleId: number, sellerId: number) =>
    request<{ ok: boolean }>(`/api/flash-sales/${saleId}?seller_id=${sellerId}`, {
      method: "DELETE",
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
    request<{ message: string }>("/api/auth/settings", {
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
};

// ===================== VERIFICATION API =====================

export const verificationApi = {
  submit: (data: SellerVerificationSubmit) =>
    request<{ success: boolean; message: string; verification_id: number }>(
      "/api/admin/verification/submit",
      { method: "POST", body: JSON.stringify(data) }
    ),
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
};

// ===================== SELLER DASHBOARD TYPES =====================

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
};

export type SellerListing = {
  id: number;
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

  getAnalytics: (token: string) =>
    request<{ success: boolean; data: SellerAnalytics }>("/api/seller/analytics", {
      headers: authHeaders(token),
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

  setVacation: (token: string, body: { enabled: boolean; resume_date: string | null }) =>
    request<{ message: string }>("/api/seller/vacation-mode", {
      method: "POST",
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
};

// ===================== LISTING API (public) =====================

export const listingApi = {
  getDetail: (id: number) =>
    request<ListingDetail>(`/api/storefront/listing/${id}`),

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

export type AdminUser = {
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

export type AdminAnnouncement = {
  id: number;
  title: string;
  message: string;
  type: string;
  audience: string;
  is_active: boolean;
  banner_url: string | null;
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
  email: string;
  document_url: string | null;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
};

// ===================== ADMIN API =====================

export const adminApi = {
  // Stats
  getStats: (token: string) =>
    request<{ success: boolean; registeredStudents: number; pendingVerifications: number; activeListings: number; openReports: number; newUsersToday: number }>("/api/admin/stats", {
      headers: authHeaders(token),
    }),

  getMonthlyAnalytics: (token: string) =>
    request<{ success: boolean; months: Array<{ month: string; submissions: number; revenue: number }> }>("/api/admin/analytics/monthly", {
      headers: authHeaders(token),
    }),

  // Users
  getUsers: (token: string, role?: string) =>
    request<{ success: boolean; total: number; data: AdminUser[] }>(`/api/admin/users${role ? `?role=${role}` : ""}`, {
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

  // Announcements
  getAnnouncements: (token: string) =>
    request<{ success: boolean; data: AdminAnnouncement[] }>("/api/admin/announcements", {
      headers: authHeaders(token),
    }),

  createAnnouncement: (token: string, data: { title: string; message: string; type?: string; audience?: string; banner_url?: string }) =>
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

  updateAnnouncement: (token: string, annId: number, data: Partial<{ title: string; message: string; type: string; audience: string; is_active: boolean; banner_url: string }>) =>
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

  // Verifications
  getVerifications: (token: string, status?: string) =>
    request<{ success: boolean; data: AdminVerification[] }>(`/api/admin/verification/${status ? `?status_filter=${status}` : ""}`, {
      headers: authHeaders(token),
    }),

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
      `/api/notifications/?token=${token}&skip=${skip}&limit=${limit}${scope ? `&scope=${scope}` : ""}`
    ),

  unreadCount: (token: string, scope?: string) =>
    request<{ unread_count: number }>(`/api/notifications/unread-count?token=${token}${scope ? `&scope=${scope}` : ""}`),

  markRead: (token: string, id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read?token=${token}`, {
      method: "PATCH",
    }),

  markAllRead: (token: string) =>
    request<{ success: boolean }>(`/api/notifications/mark-all-read?token=${token}`, {
      method: "POST",
    }),

  delete: (token: string, id: number) =>
    request<{ success: boolean }>(`/api/notifications/${id}?token=${token}`, {
      method: "DELETE",
    }),
};

// ===================== WISHLIST API =====================

export const wishlistApi = {
  toggle: (token: string, listingId: number) =>
    request<{ wishlisted: boolean }>(
      `/api/wishlist/toggle/${listingId}?token=${token}`,
      { method: "POST" }
    ),

  status: (token: string, listingId: number) =>
    request<{ wishlisted: boolean }>(`/api/wishlist/status/${listingId}?token=${token}`),

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
    }>>(`/api/wishlist/?token=${token}`),
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
      `/api/reviews/listing/${listingId}?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment, photo_url: photoUrl }),
      }
    ),

  sellerRespond: (token: string, reviewId: number, response: string) =>
    request<{ success: boolean }>(
      `/api/reviews/${reviewId}/respond?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      }
    ),

  flag: (token: string, reviewId: number, reason?: string) =>
    request<{ success: boolean }>(
      `/api/reviews/${reviewId}/flag?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }
    ),
};
