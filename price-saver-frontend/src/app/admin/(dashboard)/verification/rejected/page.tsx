"use client";

import React, { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminVerification } from "@/lib/api";
import { XCircle } from "lucide-react";

export default function RejectedVerificationsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getVerifications(token!, "Rejected"), [token]);
  const { data, loading, error } = usePolling<{ success: boolean; data: AdminVerification[] }>(fetchData, 30000, isAuthenticated && !!token);

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <XCircle size={24} className="text-red-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Rejected Applications</h1>
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">{items.length}</span>
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Applicant</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Matric No</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Faculty</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Business</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Reason</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Rejected</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 2 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No rejected applications</td></tr>
            ) : items.map((v) => (
              <tr key={v.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{v.seller_name}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{v.matric_no}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{v.faculty}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{v.business_name}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.admin_notes || "—"}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
