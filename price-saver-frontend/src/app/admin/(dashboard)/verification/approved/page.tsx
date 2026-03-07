"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminVerification } from "@/lib/api";
import { CheckCircle, ShieldOff } from "lucide-react";

export default function ApprovedVerificationsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getVerifications(token!, "Approved"), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminVerification[] }>(fetchData, 30000, isAuthenticated && !!token);

  const handleSuspend = async (v: AdminVerification) => {
    const reason = window.prompt(`Suspend seller "${v.seller_name}" — reason?`);
    if (reason === null) return;
    setActionLoading(v.id);
    try {
      await adminApi.rejectVerification(token!, v.id, reason);
      refetch();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle size={24} className="text-green-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Approved Sellers</h1>
        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-400">{items.length}</span>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Seller</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Matric No</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Faculty</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Business</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Approved</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 2 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No approved sellers</td></tr>
            ) : items.map((v) => (
              <tr key={v.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-400">{v.seller_name.charAt(0).toUpperCase()}</div>
                    <div>
                      <span className="font-medium text-gray-800 dark:text-white/90">{v.seller_name}</span>
                      <p className="text-xs text-gray-400">Verified Seller</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-gray-600 dark:text-gray-300">{v.matric_no}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{v.faculty}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{v.business_name}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : "—"}</td>
                <td className="px-5 py-4">
                  <button type="button" onClick={() => handleSuspend(v)} disabled={actionLoading === v.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                    <ShieldOff size={14} /> Suspend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
