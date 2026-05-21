/**
 * Admin API client.
 *
 * Block 2 — Zero client-side storage.
 * Each method takes the admin access token as the first argument.
 * Callers should obtain it from `useAdminAuth().token` (in-memory only).
 * The old localStorage read of "admin_token" has been removed.
 */

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

function authHeaders(token: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  registeredStudents: number;
  pendingVerifications: number;
  activeListings: number;
  openReports: number;
  newUsersToday: number;
}

export interface VerificationRequest {
  id: number;
  sellerName: string;
  matricNo: string;
  faculty: string;
  businessName: string;
  email: string;
  documentUrl: string | null;
  submittedAt: string;
  status: "Pending" | "Under Review" | "Approved" | "Rejected";
}

export interface MonthlyAnalytics {
  months: string[];
  sales: number[];
  revenue: number[];
}

// ── API methods ───────────────────────────────────────────────────────────────

export const adminApi = {
  /** Platform overview stats (top cards) */
  getStats: (token: string | null) =>
    apiFetch<{ success: boolean; data: AdminStats }>(token, "/api/admin/stats"),

  /** Monthly submissions + revenue (charts) */
  getMonthlyAnalytics: (token: string | null) =>
    apiFetch<{ success: boolean; data: MonthlyAnalytics }>(
      token,
      "/api/admin/analytics/monthly"
    ),

  /** List pending/under-review seller verifications */
  getVerifications: (token: string | null, statusFilter?: string) => {
    const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
    return apiFetch<{
      success: boolean;
      data: VerificationRequest[];
      count: number;
    }>(token, `/api/admin/verification/${qs}`);
  },

  /** Get single verification detail */
  getVerification: (token: string | null, id: number) =>
    apiFetch<{ success: boolean; data: VerificationRequest }>(
      token,
      `/api/admin/verification/${id}`
    ),

  /** Approve a verification */
  approveVerification: (token: string | null, id: number) =>
    apiFetch<{ success: boolean; message: string }>(
      token,
      `/api/admin/verification/${id}/approve`,
      { method: "PATCH" }
    ),

  /** Reject a verification with optional notes */
  rejectVerification: (token: string | null, id: number, adminNotes?: string) =>
    apiFetch<{ success: boolean; message: string }>(
      token,
      `/api/admin/verification/${id}/reject`,
      {
        method: "PATCH",
        body: JSON.stringify({ admin_notes: adminNotes ?? null }),
      }
    ),

  /** Mark verification as under review */
  markUnderReview: (token: string | null, id: number) =>
    apiFetch<{ success: boolean; message: string }>(
      token,
      `/api/admin/verification/${id}/review`,
      { method: "PATCH" }
    ),
};
