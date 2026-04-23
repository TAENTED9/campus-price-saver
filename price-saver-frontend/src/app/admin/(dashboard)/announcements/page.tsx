"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, AdminAnnouncement, uploadApi } from "@/lib/api";
import { Megaphone, Plus, Pencil, Trash2, X, Send, Upload, Link as LinkIcon } from "lucide-react";

const BLANK_FORM = { title: "", message: "", type: "info", audience: "all", banner_url: "", cta_label: "", cta_href: "" };
const BANNER_W = 1280;
const BANNER_H = 480;

export default function AnnouncementsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [broadcastMsg, setBroadcastMsg] = useState<Record<number, string>>({});
  const [bannerTab, setBannerTab] = useState<"url" | "upload">("url");
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchData = useCallback(() => adminApi.getAnnouncements(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; data: AdminAnnouncement[] }>(fetchData, 30000, isAuthenticated && !!token);

  const resetForm = () => { setForm(BLANK_FORM); setEditId(null); setShowForm(false); setBannerTab("url"); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    setActionLoading(-1);
    try {
      const payload = {
        ...form,
        banner_url: form.banner_url.trim() || undefined,
        cta_label: form.cta_label.trim() || undefined,
        cta_href: form.cta_href.trim() || undefined,
      };
      if (editId) {
        await adminApi.updateAnnouncement(token!, editId, payload);
      } else {
        await adminApi.createAnnouncement(token!, payload);
      }
      refetch();
      resetForm();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(null); }
  };

  const handleEdit = (a: AdminAnnouncement) => {
    setForm({ title: a.title, message: a.message, type: a.type, audience: a.audience, banner_url: a.banner_url ?? "", cta_label: a.cta_label ?? "", cta_href: a.cta_href ?? "" });
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

  const handleBroadcast = async (a: AdminAnnouncement) => {
    setActionLoading(a.id * 1000);
    try {
      const res = await adminApi.broadcastAnnouncement(token!, a.id);
      setBroadcastMsg(prev => ({ ...prev, [a.id]: `Sent to ${res.sent_to} user(s)` }));
      setTimeout(() => setBroadcastMsg(prev => { const n = { ...prev }; delete n[a.id]; return n; }), 4000);
    } catch (e) { alert(e instanceof Error ? e.message : "Broadcast failed"); }
    finally { setActionLoading(null); }
  };

  if (authLoading || !isAuthenticated) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>;

  const items = data?.data || [];
  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      promo: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
      system: "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
      maintenance: "bg-gray-100 text-gray-800 dark:bg-gray-500/10 dark:text-gray-400",
      info: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400",
      banner: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type] || colors.info}`}>
        {type === "banner" && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>}
        {type}
      </span>
    );
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

          {/* Banner image — URL or file upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Homepage Banner Image <span className="font-normal text-gray-400">(optional — shows as hero slide background)</span>
            </label>
            {/* Tab switcher */}
            <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 w-fit">
              <button type="button" onClick={() => setBannerTab("url")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${bannerTab === "url" ? "bg-brand-500 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                <LinkIcon size={11} /> Paste URL
              </button>
              <button type="button" onClick={() => setBannerTab("upload")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${bannerTab === "upload" ? "bg-brand-500 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                <Upload size={11} /> Upload File
              </button>
            </div>

            {bannerTab === "url" ? (
              <input type="url" placeholder="https://…/banner.jpg" value={form.banner_url}
                onChange={e => setForm(f => ({ ...f, banner_url: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-500 focus:outline-none" />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
                  <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Required size: <strong>{BANNER_W} × {BANNER_H} px</strong> — images that don&apos;t match will be rejected.</p>
                </div>
                <label className={`flex flex-col items-center justify-center w-full h-24 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${bannerUploading ? "opacity-60 pointer-events-none" : "hover:border-brand-400"} border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40`}>
                  {bannerUploading
                    ? <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    : <>
                        <Upload size={20} className="text-gray-400 mb-1" />
                        <span className="text-xs text-gray-400">JPEG / PNG / WebP · max 5 MB · exactly {BANNER_W}×{BANNER_H} px</span>
                      </>
                  }
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !token) return;
                      // Client-side dimension pre-check
                      await new Promise<void>((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                          URL.revokeObjectURL(img.src);
                          if (img.naturalWidth !== BANNER_W || img.naturalHeight !== BANNER_H) {
                            alert(`Image must be exactly ${BANNER_W}×${BANNER_H} px.\nYours is ${img.naturalWidth}×${img.naturalHeight} px.`);
                            e.target.value = "";
                          }
                          resolve();
                        };
                        img.onerror = () => { resolve(); };
                        img.src = URL.createObjectURL(file);
                      });
                      if (!e.target.files?.[0]) return;
                      setBannerUploading(true);
                      try {
                        const url = await uploadApi.uploadBannerSlide(token, file);
                        setForm(f => ({ ...f, banner_url: url }));
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Upload failed");
                      } finally {
                        setBannerUploading(false);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            {form.banner_url.startsWith("http") && (
              <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img src={form.banner_url} alt="Banner preview" className="h-28 w-full object-cover" />
                <button type="button" title="Remove banner" onClick={() => setForm(f => ({ ...f, banner_url: "" }))}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors">
                  <X size={12} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white text-[10px] truncate">{form.banner_url}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
              <select title="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:[color-scheme:dark] px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90">
                <option value="info">Info</option>
                <option value="promo">Promo</option>
                <option value="system">System</option>
                <option value="maintenance">Maintenance</option>
                <option value="banner">Banner (Homepage Slide)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Audience</label>
              <select title="Audience" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:[color-scheme:dark] px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:text-white/90">
                <option value="all">All Users</option>
                <option value="sellers">Sellers Only</option>
                <option value="buyers">Buyers Only</option>
              </select>
            </div>
          </div>

          {form.type === "banner" && (
            <>
              <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 px-4 py-3">
                <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" /></svg>
                <p className="text-xs text-brand-700 dark:text-brand-300">
                  <span className="font-semibold">Homepage Banner Slide:</span> Appears in the hero carousel. Upload a <strong>{BANNER_W}×{BANNER_H} px</strong> background image and set a CTA button below.
                </p>
              </div>
              {/* CTA fields — only for banner type */}
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">CTA Button Label</label>
                  <input type="text" placeholder="e.g. Shop Now" maxLength={60} value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))} className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-500 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">CTA Button URL</label>
                  <input type="text" placeholder="e.g. /search?category=3" maxLength={500} value={form.cta_href} onChange={e => setForm(f => ({ ...f, cta_href: e.target.value }))} className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
            </>
          )}

          <p className="text-xs text-gray-400">Notifications are automatically sent to the selected audience on create.</p>
          <button type="submit" disabled={actionLoading === -1} className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {actionLoading === -1 ? "Saving…" : editId ? "Update" : "Create & Notify"}
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
            <div key={a.id} className={`rounded-2xl border bg-white p-5 dark:bg-white/[0.03] ${a.type === "banner" ? "border-brand-200 dark:border-brand-500/30" : "border-gray-200 dark:border-gray-800"}`}>
              {/* Banner hero preview */}
              {a.type === "banner" && a.banner_url && (
                <div className="relative rounded-xl overflow-hidden mb-4 h-28">
                  <img src={a.banner_url} alt={a.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center px-5">
                    <div>
                      <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{a.type}</p>
                      <p className="text-white font-bold text-sm">{a.title}</p>
                      <p className="text-white/70 text-xs line-clamp-1">{a.message}</p>
                    </div>
                  </div>
                  <span className="absolute top-2 right-2 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Homepage Slide</span>
                </div>
              )}
              {a.type === "banner" && !a.banner_url && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 mb-3">
                  <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-xs text-amber-700 dark:text-amber-400">No banner image — edit this announcement to add one so it appears as a homepage slide.</p>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-800 dark:text-white/90">{a.title}</h3>
                    {typeBadge(a.type)}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${a.is_active ? "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>{a.is_active ? "Active" : "Inactive"}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">{a.audience}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{a.message}</p>
                  {a.type !== "banner" && a.banner_url && (
                    <img src={a.banner_url} alt="Banner" className="mt-2 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700 max-w-xs" />
                  )}
                  <p className="mt-2 text-xs text-gray-400">Created: {new Date(a.created_at).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" })}</p>
                  {broadcastMsg[a.id] && (
                    <p className="mt-1 text-xs font-semibold text-green-600 dark:text-green-400">{broadcastMsg[a.id]}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <button type="button" onClick={() => handleBroadcast(a)} disabled={actionLoading === a.id * 1000} title="Re-send notifications to audience" className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500/30 px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-100 disabled:opacity-50">
                    <Send size={11} /> Re-broadcast
                  </button>
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
