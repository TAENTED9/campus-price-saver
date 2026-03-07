"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminReport } from "@/lib/api";
import { Flag, CheckCircle, Eye } from "lucide-react";

export default function ReportsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getReports(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminReport[] }>(fetchData, 30000, isAuthenticated && !!token);

  const handleResolve = async (r: AdminReport) => {
    const notes = window.prompt(`Resolve report on "${r.target_name}" — admin notes?`);
    if (notes === null) return;
    setActionLoading(r.id);
    try { await adminApi.resolveReport(token!, r.id, notes); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleReview = async (r: AdminReport) => {
    setActionLoading(r.id);
    try { await adminApi.reviewReport(token!, r.id); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];
  const openCount = items.filter(r => r.status !== "resolved").length;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      open: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
      under_review: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
      resolved: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || map.open}`}>{status.replace("_", " ")}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag size={24} className="text-red-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Reported Content</h1>
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">{openCount} open</span>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Reporter</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Target</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Reason</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Reported</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 2 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No reports found</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{r.reporter_name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{r.target_name}</td>
                <td className="px-5 py-4"><span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{r.target_type}</span></td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{r.reason}</td>
                <td className="px-5 py-4">{statusBadge(r.status)}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  {r.status !== "resolved" ? (
                    <div className="flex gap-2">
                      {r.status === "open" && <button type="button" onClick={() => handleReview(r)} disabled={actionLoading === r.id} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 disabled:opacity-50"><Eye size={14} /> Review</button>}
                      <button type="button" onClick={() => handleResolve(r)} disabled={actionLoading === r.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><CheckCircle size={14} /> Resolve</button>
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
    </div>
  );
}
