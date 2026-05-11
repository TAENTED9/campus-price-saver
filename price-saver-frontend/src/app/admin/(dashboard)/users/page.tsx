"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminUserSummary, type AdminUserDetail } from "@/lib/api";
import {
  Users, Search, Ban, ShieldOff, ShieldCheck, Trash2, RefreshCw,
  X, ChevronRight, Package, ExternalLink,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatPrice } from "@/lib/formatPrice";
import { AdminAvatar, AdminErrorState } from "@/components/admin";

type RoleFilter = "all" | "user" | "seller" | "admin";
type StatusFilter = "all" | "paused" | "banned" | "deleted";

function userStatus(u: AdminUserSummary): string {
  if (u.is_deleted) return "deleted";
  if (u.is_banned)  return "banned";
  if (u.is_paused)  return "paused";
  return "active";
}

export default function UsersPage() {
  const { token } = useAdminAuth();

  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [actionTarget, setActionTarget]   = useState<{ user: AdminUserSummary; action: string } | null>(null);
  const [actionReason, setActionReason]   = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [drawer, setDrawer]               = useState<AdminUserDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchUsers = useCallback(() => {
    const params: Parameters<typeof adminApi.getUsers>[1] = {};
    if (roleFilter !== "all")   params.role   = roleFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return adminApi.getUsers(token!, params);
  }, [token, roleFilter, statusFilter]);

  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminUserSummary[] }>(
    fetchUsers, 30_000, !!token
  );

  const users = (data?.data ?? []).filter((u) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q)
    );
  });

  const openDrawer = async (userId: number) => {
    if (!token) return;
    setDrawerLoading(true);
    setDrawer(null);
    try {
      const res = await adminApi.getUserDetail(token, userId);
      setDrawer(res.data);
    } catch { /* silent */ }
    finally { setDrawerLoading(false); }
  };

  const handleAction = async () => {
    if (!actionTarget || !token) return;
    setActionLoading(true);
    try {
      const { user, action } = actionTarget;
      if (action === "suspend")   await adminApi.suspendUser(token, user.id, { reason: actionReason, hours: 24 });
      else if (action === "ban")  await adminApi.banUser(token, user.id, actionReason || "Policy violation");
      else if (action === "restore") await adminApi.restoreUser(token, user.id);
      else if (action === "pause")   await adminApi.pauseUser(token, user.id, actionReason || "Admin paused");
      else if (action === "delete")  await adminApi.deleteUser(token, user.id);
      refetch();
      setActionTarget(null);
      setActionReason("");
    } catch (e) { alert(e instanceof Error ? e.message : "Action failed"); }
    finally { setActionLoading(false); }
  };

  const ROLE_TABS: { label: string; value: RoleFilter }[] = [
    { label: "All", value: "all" },
    { label: "Buyers", value: "user" },
    { label: "Sellers", value: "seller" },
    { label: "Admins", value: "admin" },
  ];

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: "All",     value: "all" },
    { label: "Paused",  value: "paused" },
    { label: "Banned",  value: "banned" },
    { label: "Deleted", value: "deleted" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-brand-500" />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">All Users</h1>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">
            {data?.total ?? 0}
          </span>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          title="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        {/* Role filter */}
        <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1">
          {ROLE_TABS.map((t) => (
            <button key={t.value} type="button" onClick={() => setRoleFilter(t.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                roleFilter === t.value
                  ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.value} type="button" onClick={() => setStatusFilter(t.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === t.value
                  ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-4 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none dark:focus:border-brand-500"
          />
        </div>
      </div>

      {error && <AdminErrorState message={error} onRetry={refetch} />}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {["User", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </td>
                      ))}
                    </tr>
                  ))
                : users.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-gray-400">
                      No users found
                    </td>
                  </tr>
                )
                : users.map((u) => {
                    const st = userStatus(u);
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => openDrawer(u.id)}
                            className="flex items-center gap-3 text-left group"
                          >
                            <AdminAvatar src={u.avatar_url} name={u.display_name || u.username} size="sm" />
                            <span className="font-medium text-gray-800 dark:text-white/90 group-hover:text-brand-500 transition-colors">
                              {u.display_name || u.username || `User #${u.id}`}
                            </span>
                            <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-brand-400 transition-colors" />
                          </button>
                        </td>
                        <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{u.email || "—"}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={u.role === "user" ? "buyer" : u.role} />
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={st} /></td>
                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" }) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            {(st === "banned" || st === "paused") ? (
                              <button
                                type="button"
                                onClick={() => setActionTarget({ user: u, action: "restore" })}
                                className="inline-flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100"
                              >
                                <ShieldCheck size={12} /> Restore
                              </button>
                            ) : st === "active" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setActionTarget({ user: u, action: "suspend" }); setActionReason(""); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                >
                                  <ShieldOff size={12} /> Suspend
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setActionTarget({ user: u, action: "ban" }); setActionReason(""); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100"
                                >
                                  <Ban size={12} /> Ban
                                </button>
                              </>
                            )}
                            {st !== "deleted" && (
                              <button
                                type="button"
                                onClick={() => { setActionTarget({ user: u, action: "delete" }); setActionReason(""); }}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action confirm modal */}
      {actionTarget && actionTarget.action !== "restore" && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionTarget(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white capitalize">
              {actionTarget.action} User
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {actionTarget.action === "delete"
                ? `This will permanently delete "${actionTarget.user.username || actionTarget.user.email}". This cannot be undone.`
                : `You are about to ${actionTarget.action} "${actionTarget.user.username || actionTarget.user.email}".`}
            </p>
            {actionTarget.action !== "delete" && (
              <input
                type="text"
                placeholder="Reason (optional)"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-400 focus:outline-none"
              />
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setActionTarget(null)} disabled={actionLoading}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleAction} disabled={actionLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-2">
                {actionLoading && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore confirm modal */}
      <ConfirmModal
        isOpen={!!actionTarget && actionTarget.action === "restore"}
        onClose={() => setActionTarget(null)}
        onConfirm={handleAction}
        title="Restore User"
        description={`Restore access for "${actionTarget?.user.username || actionTarget?.user.email}"?`}
        confirmLabel="Restore"
        variant="primary"
        loading={actionLoading}
      />

      {/* User detail drawer */}
      {(drawerLoading || drawer) && (
        <div className="fixed inset-0 z-[9000] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-2xl border-l border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h2 className="font-semibold text-gray-900 dark:text-white">User Detail</h2>
              <button type="button" onClick={() => setDrawer(null)} title="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={16} />
              </button>
            </div>

            {drawerLoading && (
              <div className="flex min-h-[200px] items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              </div>
            )}

            {drawer && (
              <div className="p-5 space-y-5">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <AdminAvatar src={drawer.avatar_url} name={drawer.display_name || drawer.username} size="lg" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{drawer.display_name || drawer.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{drawer.email}</p>
                    <StatusBadge status={drawer.role === "user" ? "buyer" : drawer.role} className="mt-1" />
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Department", drawer.department || "—"],
                    ["Level", drawer.level || "—"],
                    ["Phone", drawer.phone || "—"],
                    ["Balance", formatPrice(drawer.balance ?? 0)],
                    ["Seller Points", String(drawer.seller_points ?? 0)],
                    ["Joined", drawer.created_at ? new Date(drawer.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" }) : "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Listings */}
                {drawer.listings?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Listings ({drawer.listings.length})
                    </p>
                    <div className="space-y-2">
                      {drawer.listings.slice(0, 5).map((l) => (
                        <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package size={13} className="text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{l.name}</span>
                          </div>
                          <StatusBadge status={l.listing_status || l.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification */}
                {drawer.verification && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Verification</p>
                    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Matric No.</span>
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{drawer.verification.matric_no}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Status</span>
                        <StatusBadge status={drawer.verification.status.toLowerCase()} />
                      </div>
                      {drawer.verification.document_url && (
                        <a href={drawer.verification.document_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-brand-500 hover:underline">
                          <ExternalLink size={11} /> View Document
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
