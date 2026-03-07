"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminAnnouncement } from "@/lib/api";
import { Megaphone, Plus, Pencil, Trash2, X } from "lucide-react";

export default function AnnouncementsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", message: "", type: "info", audience: "all" });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getAnnouncements(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminAnnouncement[] }>(fetchData, 30000, isAuthenticated && !!token);

  const resetForm = () => { setForm({ title: "", message: "", type: "info", audience: "all" }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setActionLoading(-1);
    try {
      if (editId) {
        await adminApi.updateAnnouncement(token!, editId, form);
      } else {
        await adminApi.createAnnouncement(token!, form);
      }
      refetch();
      resetForm();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleEdit = (a: AdminAnnouncement) => {
    setForm({ title: a.title, message: a.message, type: a.type, audience: a.audience });
    setEditId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (a: AdminAnnouncement) => {
    if (!window.confirm(`Delete announcement "${a.title}"?`)) return;
    setActionLoading(a.id);
    try { await adminApi.deleteAnnouncement(token!, a.id); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleToggle = async (a: AdminAnnouncement) => {
    setActionLoading(a.id);
    try { await adminApi.updateAnnouncement(token!, a.id, { is_active: !a.is_active }); refetch(); } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];
  const typeBadge = (type: string) => {
    const colors: Record<string, string> = { promo: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400", system: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400", maintenance: "bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400", info: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400" };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] || colors.info}`}>{type}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone size={24} className="text-brand-500" />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Announcements</h1>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{items.length}</span>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 dark:text-white/90">{editId ? "Edit Announcement" : "New Announcement"}</h2>
            <button type="button" onClick={resetForm} title="Close form" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <input type="text" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90 focus:border-brand-500 focus:outline-none" required />
          <textarea placeholder="Message" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90 focus:border-brand-500 focus:outline-none" required />
          <div className="flex gap-4">
            <select title="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90">
              <option value="info">Info</option>
              <option value="promo">Promo</option>
              <option value="system">System</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select title="Audience" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className="rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90">
              <option value="all">All Users</option>
              <option value="sellers">Sellers</option>
              <option value="buyers">Buyers</option>
            </select>
          </div>
          <button type="submit" disabled={actionLoading === -1} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {editId ? "Update" : "Create"}
          </button>
        </form>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400 dark:border-gray-800 dark:bg-white/[0.03]">No announcements yet</div>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800 dark:text-white/90">{a.title}</h3>
                    {typeBadge(a.type)}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${a.is_active ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>{a.is_active ? "Active" : "Inactive"}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{a.message}</p>
                  <p className="mt-2 text-xs text-gray-400">Audience: {a.audience} · Created: {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => handleToggle(a)} disabled={actionLoading === a.id} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 disabled:opacity-50">
                    {a.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" onClick={() => handleEdit(a)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    <Pencil size={12} /> Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(a)} disabled={actionLoading === a.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
