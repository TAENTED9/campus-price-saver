"use client";

import React, { useState, useCallback } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminVerification } from "@/lib/api";
import { Store, CheckCircle, XCircle, Clock, UserCheck, AlertCircle, FileText } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";

type Tab = "Pending" | "Approved" | "Rejected";

const TABS: Tab[] = ["Pending", "Approved", "Rejected"];

const TAB_COLORS: Record<Tab, string> = {
  Pending:  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  Approved: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400",
};

function elapsed(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1 hour ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SellersPage() {
  const { token } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("Pending");

  const [approveTarget, setApproveTarget] = useState<AdminVerification | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<AdminVerification | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetch = useCallback(
    () => adminApi.getVerifications(token!, tab),
    [token, tab]
  );
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminVerification[] }>(
    fetch, 30_000, !!token
  );

  const verifications: AdminVerification[] = data?.data ?? [];

  const handleApprove = async () => {
    if (!approveTarget || !token) return;
    setActionLoading(true);
    try {
      await adminApi.approveVerification(token, approveTarget.id);
      refetch();
      setApproveTarget(null);
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to approve"); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectTarget || !token) return;
    setActionLoading(true);
    try {
      await adminApi.rejectVerification(token, rejectTarget.id, rejectReason || undefined);
      refetch();
      setRejectTarget(null);
      setRejectReason("");
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to reject"); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store size={22} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Seller Verification</h1>
        <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">
          {verifications.length}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Info banner for pending */}
      {tab === "Pending" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10 px-4 py-3">
          <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Review each seller's UNILAG student ID and portal screenshot. Aim to resolve within 24–48 hours.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && verifications.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] py-16 text-center">
          <UserCheck size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-base font-semibold text-gray-700 dark:text-white/80">No {tab.toLowerCase()} verifications</p>
          <p className="mt-1 text-sm text-gray-400">Check back later.</p>
        </div>
      )}

      {/* Table */}
      {(loading || verifications.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Seller", "Matric No.", "Faculty", "Business", "Email", "Submitted", "Status", ...(tab === "Pending" ? ["Actions"] : [])].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: tab === "Pending" ? 8 : 7 }).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : verifications.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                              {(v.seller_name || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white/90">{v.seller_name}</p>
                              {v.document_url && (
                                <a href={v.document_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[11px] text-brand-500 hover:underline mt-0.5">
                                  <FileText size={10} /> View ID
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{v.matric_no}</td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.faculty || "—"}</td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.business_name}</td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.email}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(v.submitted_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</span>
                          <p className="text-[11px] text-gray-400">{elapsed(v.submitted_at)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TAB_COLORS[v.status as Tab] ?? TAB_COLORS.Pending}`}>
                            {v.status}
                          </span>
                          {v.admin_notes && (
                            <p className="mt-1 text-[11px] text-gray-400 max-w-[140px] truncate" title={v.admin_notes}>
                              {v.admin_notes}
                            </p>
                          )}
                        </td>
                        {tab === "Pending" && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setApproveTarget(v)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400 transition-colors"
                              >
                                <CheckCircle size={13} /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejectTarget(v); setRejectReason(""); }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 transition-colors"
                              >
                                <XCircle size={13} /> Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve confirm modal */}
      <ConfirmModal
        isOpen={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
        title="Approve Verification"
        description={`Approve verification for "${approveTarget?.seller_name}"? They will gain seller access immediately.`}
        confirmLabel="Approve"
        variant="primary"
        loading={actionLoading}
      />

      {/* Reject modal with reason input */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reject Verification</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Rejecting <span className="font-semibold text-gray-700 dark:text-gray-200">{rejectTarget.seller_name}</span>. Optionally add a reason to notify the seller.
            </p>
            <textarea
              rows={3}
              placeholder="Rejection reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-red-400 focus:outline-none resize-none"
            />
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setRejectTarget(null)} disabled={actionLoading}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleReject} disabled={actionLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-2">
                {actionLoading && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
