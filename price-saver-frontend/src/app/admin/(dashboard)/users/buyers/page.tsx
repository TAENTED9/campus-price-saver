"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminUser } from "@/lib/api";
import { Users, Ban, ShieldCheck, ShieldOff } from "lucide-react";

export default function BuyersPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => { if (!authLoading && !isAuthenticated) router.push("/admin/signin"); }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getUsers(token!, "user"), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminUser[] }>(fetchData, 30000, isAuthenticated && !!token);

  const handleSuspend = async (u: AdminUser) => {
    const reason = window.prompt(`Suspend "${u.username}" — reason?`);
    if (reason === null) return;
    setActionLoading(u.id);
    try { await adminApi.suspendUser(token!, u.id, { reason, hours: 24 }); refetch(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleBan = async (u: AdminUser) => {
    const reason = window.prompt(`Permanently ban "${u.username}" — reason?`);
    if (!reason) return;
    if (!window.confirm(`Are you sure you want to permanently ban "${u.username}"?`)) return;
    setActionLoading(u.id);
    try { await adminApi.banUser(token!, u.id, reason); refetch(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleRestore = async (u: AdminUser) => {
    setActionLoading(u.id);
    try { await adminApi.restoreUser(token!, u.id); refetch(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const users = data?.data || [];
  const statusBadge = (u: AdminUser) => {
    if (u.is_banned) return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/10 dark:text-red-400">Banned</span>;
    if (u.is_suspended) return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">Suspended</span>;
    return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-500/10 dark:text-green-400">Active</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Users size={24} className="text-brand-500" /><h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Buyers</h1><span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{data?.total ?? 0}</span></div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Joined</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No buyers found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{u.username || u.display_name || `User #${u.id}`}</td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{u.email || "—"}</td>
                <td className="px-5 py-4">{statusBadge(u)}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{new Date(u.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</td>
                <td className="px-5 py-4"><div className="flex gap-2">
                  {(u.is_suspended || u.is_banned) ? (
                    <button onClick={() => handleRestore(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><ShieldCheck size={14} /> Restore</button>
                  ) : (<>
                    <button onClick={() => handleSuspend(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"><ShieldOff size={14} /> Suspend</button>
                    <button onClick={() => handleBan(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"><Ban size={14} /> Ban</button>
                  </>)}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
