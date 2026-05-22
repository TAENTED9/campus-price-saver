"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminUser } from "@/lib/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PromptModal from "@/components/ui/PromptModal";
import { useToast } from "@/components/ui/Toast";
import { Users, Ban, ShieldCheck, ShieldOff } from "lucide-react";

export default function BuyersPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<AdminUser | null>(null);

  useEffect(() => { if (!authLoading && !isAuthenticated) router.push("/admin/signin"); }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getUsers(token!, "user"), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminUser[] }>(fetchData, 30000, isAuthenticated && !!token);

  const confirmSuspend = async (reason: string) => {
    if (!suspendTarget) return;
    setActionLoading(suspendTarget.id);
    try {
      await adminApi.suspendUser(token!, suspendTarget.id, { reason, hours: 24 });
      showToast("User suspended", "success");
      refetch();
      setSuspendTarget(null);
    } catch (err) { showToast(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const confirmBan = async (reason: string) => {
    if (!banTarget) return;
    setActionLoading(banTarget.id);
    try {
      await adminApi.banUser(token!, banTarget.id, reason);
      showToast("User permanently banned", "success");
      refetch();
      setBanTarget(null);
    } catch (err) { showToast(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(restoreTarget.id);
    try {
      await adminApi.restoreUser(token!, restoreTarget.id);
      showToast("User restored", "success");
      refetch();
      setRestoreTarget(null);
    } catch (err) { showToast(err instanceof Error ? err.message : "Failed", "error"); }
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
                    <button onClick={() => setRestoreTarget(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50"><ShieldCheck size={14} /> Restore</button>
                  ) : (<>
                    <button onClick={() => setSuspendTarget(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"><ShieldOff size={14} /> Suspend</button>
                    <button onClick={() => setBanTarget(u)} disabled={actionLoading === u.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"><Ban size={14} /> Ban</button>
                  </>)}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PromptModal
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onSubmit={confirmSuspend}
        title="Suspend User"
        description={`Suspending "${suspendTarget?.username ?? suspendTarget?.display_name ?? ""}".`}
        label="Reason"
        placeholder="Why is this user being suspended?"
        confirmLabel="Suspend"
        variant="danger"
        multiline
        loading={actionLoading === suspendTarget?.id}
      />

      <PromptModal
        isOpen={!!banTarget}
        onClose={() => setBanTarget(null)}
        onSubmit={confirmBan}
        title="Ban User"
        description={`Permanently ban "${banTarget?.username ?? banTarget?.display_name ?? ""}". Their email will be blacklisted from re-registering — this cannot be undone without admin restore.`}
        label="Reason"
        placeholder="Why is this user being banned?"
        confirmLabel="Ban Permanently"
        variant="danger"
        required
        multiline
        loading={actionLoading === banTarget?.id}
      />

      <ConfirmModal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        title="Restore User"
        description={`Restore access for "${restoreTarget?.username ?? restoreTarget?.display_name ?? ""}"?`}
        confirmLabel="Restore"
        variant="primary"
        loading={actionLoading === restoreTarget?.id}
      />
    </div>
  );
}
