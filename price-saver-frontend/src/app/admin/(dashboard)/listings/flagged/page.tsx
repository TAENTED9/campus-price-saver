"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminListing } from "@/lib/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle, Trash2, ShieldCheck } from "lucide-react";

export default function FlaggedContentPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminListing | null>(null);
  const [clearTarget, setClearTarget] = useState<AdminListing | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getListings(token!, "flagged"), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminListing[] }>(fetchData, 30000, isAuthenticated && !!token);

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(removeTarget.id);
    try {
      await adminApi.removeListing(token!, removeTarget.id);
      showToast("Listing removed", "success");
      refetch();
      setRemoveTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const confirmClear = async () => {
    if (!clearTarget) return;
    setActionLoading(clearTarget.id);
    try {
      await adminApi.unflagListing(token!, clearTarget.id);
      showToast("Flag cleared, listing restored", "success");
      refetch();
      setClearTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle size={24} className="text-red-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Flagged Content</h1>
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">{data?.total ?? 0}</span>
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">These listings have been flagged and require immediate review. Remove or clear within 24 hrs.</p>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Listing</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Seller</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Reason</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Price</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Flagged</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 2 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No flagged content</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{item.name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{item.seller_name}</td>
                <td className="px-5 py-4 text-red-600 dark:text-red-400">{item.flag_reason || "—"}</td>
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{item.price}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setClearTarget(item)} disabled={actionLoading === item.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><ShieldCheck size={14} /> Clear</button>
                    <button type="button" onClick={() => setRemoveTarget(item)} disabled={actionLoading === item.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"><Trash2 size={14} /> Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Delete Listing"
        description={`Remove flagged listing "${removeTarget?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete Listing"
        cancelLabel="Keep It"
        variant="danger"
        loading={actionLoading === removeTarget?.id}
      />

      <ConfirmModal
        isOpen={!!clearTarget}
        onClose={() => setClearTarget(null)}
        onConfirm={confirmClear}
        title="Clear Flag"
        description={`Clear flag on "${clearTarget?.name ?? ""}"? This will restore the listing.`}
        confirmLabel="Clear Flag"
        variant="primary"
        loading={actionLoading === clearTarget?.id}
      />
    </div>
  );
}
