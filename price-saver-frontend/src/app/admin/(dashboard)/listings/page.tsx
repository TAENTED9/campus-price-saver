"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminListing } from "@/lib/api";
import { Package, Trash2, Flag, CheckCircle, XCircle } from "lucide-react";

export default function ListingsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getListings(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminListing[] }>(fetchData, 30000, isAuthenticated && !!token);

  const handleAction = async (action: "approve" | "reject" | "flag" | "remove", item: AdminListing) => {
    if (action === "remove") {
      if (!window.confirm(`Remove listing "${item.name}"? This cannot be undone.`)) return;
      setActionLoading(item.id);
      try { await adminApi.removeListing(token!, item.id); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    } else if (action === "flag") {
      const reason = window.prompt(`Flag "${item.name}" — reason?`);
      if (!reason) return;
      setActionLoading(item.id);
      try { await adminApi.flagListing(token!, item.id, reason); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    } else if (action === "approve") {
      setActionLoading(item.id);
      try { await adminApi.approveListing(token!, item.id); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    } else {
      const reason = window.prompt(`Reject "${item.name}" — reason?`);
      if (!reason) return;
      setActionLoading(item.id);
      try { await adminApi.rejectListing(token!, item.id, reason); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    }
    setActionLoading(null);
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];
  const flaggedCount = items.filter(i => i.is_flagged).length;

  const statusBadge = (item: AdminListing) => {
    if (item.is_flagged) return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">Flagged</span>;
    if (item.status === "approved") return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-400">Approved</span>;
    if (item.status === "rejected") return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">Rejected</span>;
    return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">Pending</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package size={24} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">All Listings</h1>
        <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{data?.total ?? 0}</span>
      </div>
      <div className="flex gap-3">
        <Link href="/admin/listings/flagged" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <Flag size={14} /> Flagged Content ({flaggedCount})
        </Link>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Listing</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Seller</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Price</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Posted</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No listings found</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{item.name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{item.seller_name}</td>
                <td className="px-5 py-4"><span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{item.category}</span></td>
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">₦{Number(item.price).toLocaleString("en-NG")}</td>
                <td className="px-5 py-4">{statusBadge(item)}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    {item.status !== "approved" && <button type="button" onClick={() => handleAction("approve", item)} disabled={actionLoading === item.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><CheckCircle size={14} /> Approve</button>}
                    {!item.is_flagged && <button type="button" onClick={() => handleAction("flag", item)} disabled={actionLoading === item.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"><Flag size={14} /> Flag</button>}
                    <button type="button" onClick={() => handleAction("remove", item)} disabled={actionLoading === item.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"><Trash2 size={14} /> Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
