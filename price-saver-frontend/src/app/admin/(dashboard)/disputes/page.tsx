"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminDispute } from "@/lib/api";
import PromptModal from "@/components/ui/PromptModal";
import { useToast } from "@/components/ui/Toast";
import { Scale, CheckCircle, AlertTriangle } from "lucide-react";

export default function DisputesPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [resolveTarget, setResolveTarget] = useState<AdminDispute | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<AdminDispute | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getDisputes(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminDispute[] }>(fetchData, 30000, isAuthenticated && !!token);

  const confirmResolve = async (notes: string) => {
    if (!resolveTarget) return;
    setActionLoading(resolveTarget.id);
    try {
      await adminApi.updateDispute(token!, resolveTarget.id, { status: "resolved", admin_notes: notes });
      showToast("Dispute resolved", "success");
      refetch();
      setResolveTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const confirmEscalate = async (notes: string) => {
    if (!escalateTarget) return;
    setActionLoading(escalateTarget.id);
    try {
      await adminApi.updateDispute(token!, escalateTarget.id, { status: "escalated", admin_notes: notes });
      showToast("Dispute escalated", "success");
      refetch();
      setEscalateTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];
  const openCount = items.filter(d => d.status !== "resolved").length;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
      under_review: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
      escalated: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
      resolved: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || map.open}`}>{status.replace("_", " ")}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Scale size={24} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Disputes</h1>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">{openCount} open</span>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Resolve buyer-seller disputes fairly. If a seller is found guilty of scamming, escalate to account suspension.</p>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Buyer</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Seller</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Listing</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Issue</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Filed</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 2 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No disputes found</td></tr>
            ) : items.map((d) => (
              <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{d.buyer_name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{d.seller_name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{d.listing_name}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{d.issue}</td>
                <td className="px-5 py-4">{statusBadge(d.status)}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{new Date(d.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                <td className="px-5 py-4">
                  {d.status !== "resolved" ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setResolveTarget(d)} disabled={actionLoading === d.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><CheckCircle size={14} /> Resolve</button>
                      {d.status !== "escalated" && <button type="button" onClick={() => setEscalateTarget(d)} disabled={actionLoading === d.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"><AlertTriangle size={14} /> Escalate</button>}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Resolved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PromptModal
        isOpen={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        onSubmit={confirmResolve}
        title="Resolve Dispute"
        description={`Resolving dispute on "${resolveTarget?.listing_name ?? ""}".`}
        label="Admin notes (optional)"
        placeholder="What was the resolution?"
        confirmLabel="Resolve"
        variant="primary"
        multiline
        loading={actionLoading === resolveTarget?.id}
      />

      <PromptModal
        isOpen={!!escalateTarget}
        onClose={() => setEscalateTarget(null)}
        onSubmit={confirmEscalate}
        title="Escalate Dispute"
        description={`Escalating dispute on "${escalateTarget?.listing_name ?? ""}".`}
        label="Reason"
        placeholder="Why is this being escalated?"
        confirmLabel="Escalate"
        variant="danger"
        required
        multiline
        loading={actionLoading === escalateTarget?.id}
      />
    </div>
  );
}
