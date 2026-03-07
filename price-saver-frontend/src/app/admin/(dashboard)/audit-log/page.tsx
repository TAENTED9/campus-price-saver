"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminAuditEntry } from "@/lib/api";
import { ScrollText } from "lucide-react";

const typeFilters = ["All", "verification", "user", "listing", "announcement", "report", "dispute", "category"];

export default function AuditLogPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getAuditLog(token!, filter === "All" ? undefined : filter), [token, filter]);
  const { data, loading, error } = usePolling<{ success: boolean; data: AdminAuditEntry[] }>(fetchData, 30000, isAuthenticated && !!token);

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      verification: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
      user: "bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400",
      listing: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
      announcement: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400",
      report: "bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400",
      dispute: "bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400",
      category: "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
    };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] || colors.category}`}>{type}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText size={24} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Audit Log</h1>
        <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{items.length} actions</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeFilters.map(t => (
          <button key={t} type="button" onClick={() => setFilter(t)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === t ? "bg-brand-500 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"}`}>
            {t === "All" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Admin</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Action</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Target</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No audit log entries</td></tr>
            ) : items.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{entry.admin_name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{entry.action}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{entry.target_desc}</td>
                <td className="px-5 py-4">{entry.target_type ? typeBadge(entry.target_type) : "—"}</td>
                <td className="px-5 py-4 font-mono text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
