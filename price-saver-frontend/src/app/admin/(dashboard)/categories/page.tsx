"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminCategory } from "@/lib/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { Tags, Plus, Pencil, Trash2, X } from "lucide-react";

export default function CategoriesPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "" });
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getCategories(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminCategory[] }>(fetchData, 30000, isAuthenticated && !!token);

  const resetForm = () => { setForm({ name: "", description: "", icon: "" }); setEditId(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setActionLoading(-1);
    try {
      if (editId) {
        await adminApi.updateCategory(token!, editId, form);
      } else {
        await adminApi.createCategory(token!, form);
      }
      refetch();
      resetForm();
    } catch (err) { showToast(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  const handleEdit = (c: AdminCategory) => {
    setForm({ name: c.name, description: c.description || "", icon: c.icon || "" });
    setEditId(c.id);
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setActionLoading(id);
    try {
      await adminApi.deleteCategory(token!, id);
      showToast("Category deleted", "success");
      refetch();
      setDeleteTarget(null);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tags size={24} className="text-brand-500" />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Categories</h1>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{items.length}</span>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus size={16} /> Add Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 dark:text-white/90">{editId ? "Edit Category" : "New Category"}</h2>
            <button type="button" onClick={resetForm} title="Close form" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="flex gap-4">
            <input type="text" placeholder="Icon (emoji)" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="w-20 rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-center text-xl dark:border-gray-700 focus:border-brand-500 focus:outline-none" />
            <input type="text" placeholder="Category name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="flex-1 rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90 focus:border-brand-500 focus:outline-none" required />
          </div>
          <input type="text" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90 focus:border-brand-500 focus:outline-none" />
          <button type="submit" disabled={actionLoading === -1} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {editId ? "Update" : "Create"}
          </button>
        </form>
      )}

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Icon</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Description</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Listings</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
            <th className="px-5 py-4 text-left font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /></td>)}</tr>) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No categories yet</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-5 py-4 text-2xl">{c.icon || "—"}</td>
                <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{c.name}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{c.description || "—"}</td>
                <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{c.listing_count ?? 0}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.is_active ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>{c.is_active ? "Active" : "Disabled"}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleEdit(c)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                      <Pencil size={12} /> Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(c)} disabled={actionLoading === c.id} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        description={`Delete category "${deleteTarget?.name ?? ""}"? Listings in this category will become uncategorized.`}
        confirmLabel="Delete"
        variant="danger"
        loading={actionLoading === deleteTarget?.id}
      />
    </div>
  );
}
