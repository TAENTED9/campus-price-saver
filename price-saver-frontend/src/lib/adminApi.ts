/**
 * Admin API client — all calls include the admin JWT from localStorage.
 * Only used by client components inside the /admin/* route group.
 */

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
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
  getStats: () =>
    apiFetch<{ success: boolean; data: AdminStats }>("/api/admin/stats"),

  /** Monthly submissions + revenue (charts) */
  getMonthlyAnalytics: () =>
    apiFetch<{ success: boolean; data: MonthlyAnalytics }>(
      "/api/admin/analytics/monthly"
    ),

  /** List pending/under-review seller verifications */
  getVerifications: (statusFilter?: string) => {
    const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
    return apiFetch<{
      success: boolean;
      data: VerificationRequest[];
      count: number;
    }>(`/api/admin/verification/${qs}`);
  },

  /** Get single verification detail */
  getVerification: (id: number) =>
    apiFetch<{ success: boolean; data: VerificationRequest }>(
      `/api/admin/verification/${id}`
    ),

  /** Approve a verification */
  approveVerification: (id: number) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/admin/verification/${id}/approve`,
      { method: "PATCH" }
    ),

  /** Reject a verification with optional notes */
  rejectVerification: (id: number, adminNotes?: string) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/admin/verification/${id}/reject`,
      {
        method: "PATCH",
        body: JSON.stringify({ admin_notes: adminNotes ?? null }),
      }
    ),

  /** Mark verification as under review */
  markUnderReview: (id: number) =>
    apiFetch<{ success: boolean; message: string }>(
      `/api/admin/verification/${id}/review`,
      { method: "PATCH" }
    ),
};
