"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { userApi, itemsApi, type PriceAlert, type Category } from "@/lib/api";
import { Bell, Trash2, Plus } from "lucide-react";
import { formatPrice } from "@/lib/formatPrice";
import NumberInput from "@/components/ui/NumberInput";

const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]";

export default function AlertsPage() {
  const { token } = useAuth();
  const [alerts, setAlerts]       = useState<PriceAlert[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<number | null>(null);

  const [itemName, setItemName]       = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [catId, setCatId]             = useState("");
  const [creating, setCreating]       = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadAlerts = async () => {
    if (!token) return;
    try {
      const res = await userApi.getAlerts(token);
      setAlerts(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    itemsApi.getCategories().then(setCategories).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !itemName || !targetPrice) return;
    setFormError(null);
    setFormSuccess(null);
    setCreating(true);
    try {
      const res = await userApi.createAlert(token, {
        item_name: itemName,
        target_price: parseFloat(targetPrice),
        category_id: catId ? parseInt(catId) : undefined,
      });
      setFormSuccess(res.message);
      setItemName(""); setTargetPrice(""); setCatId("");
      await loadAlerts();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create alert");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    setDeleting(id);
    try {
      await userApi.deleteAlert(token, id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Price Alerts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Get notified when a product drops below your target price
        </p>
      </div>

      {/* Create form */}
      <div className={CARD + " p-5"}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
            <Plus size={16} className="text-brand-500" />
          </div>
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Set a New Alert</h3>
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-sm text-error-600 dark:text-error-400">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20 text-sm text-success-700 dark:text-success-400">
            ✅ {formSuccess}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Item Name *</label>
              <input
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Rice (5kg)"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Alert below (₦) *</label>
              <NumberInput
                required
                value={targetPrice === "" ? "" : Number(targetPrice)}
                onValueChange={(v) => setTargetPrice(v === "" ? "" : String(v))}
                placeholder="e.g. 5000"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Category (optional)</label>
              <select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:[color-scheme:dark] text-gray-800 dark:text-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 dark:focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
              >
                <option value="">Any category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <Bell size={14} />
            {creating ? "Creating…" : "Set Alert"}
          </button>
        </form>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${CARD} p-5 animate-pulse`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
                  <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 text-sm text-error-600 dark:text-error-400">
          {error}
        </div>
      ) : alerts.length === 0 ? (
        <div className={`${CARD} p-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
            <Bell size={28} className="text-brand-400" />
          </div>
          <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">No active alerts</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            Set an alert above — we&apos;ll notify you when prices drop!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className={`${CARD} flex items-center gap-4 p-4`}>
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                <Bell size={16} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[14px] text-gray-800 dark:text-white truncate">{a.item_name}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Alert when below{" "}
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    {formatPrice(a.target_price)}
                  </span>
                  {a.trigger_count > 0 && (
                    <span className="ml-2 text-success-600 dark:text-success-400">
                      · Triggered {a.trigger_count}×
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0 text-[11px] text-gray-400">
                {new Date(a.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={deleting === a.id}
                title="Remove alert"
                className="w-8 h-8 rounded-lg border border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 flex items-center justify-center text-error-500 hover:bg-error-100 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {deleting === a.id ? (
                  <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
