"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { userApi, itemsApi, type MySubmission, type Category } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import NumberInput from "@/components/ui/NumberInput";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function SubmissionsPage() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New submission form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCat, setFormCat] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      userApi.getSubmissions(token).then((r) => setSubmissions(r.data)),
      itemsApi.getCategories().then(setCategories),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formName || !formPrice || !formCat) return;
    setSubmitting(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/items/prices/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          price: parseFloat(formPrice),
          category_id: parseInt(formCat),
          location: formLocation || undefined,
          brand: formBrand || undefined,
        }),
      });
      setSuccessMsg("Price submitted! It will appear once approved.");
      setFormName(""); setFormPrice(""); setFormLocation(""); setFormCat(""); setFormBrand("");
      setShowForm(false);
      // Refresh list
      const fresh = await userApi.getSubmissions(token);
      setSubmissions(fresh.data);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Price Submissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            You earn points every time a submission gets approved
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setSuccessMsg(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition-colors"
        >
          <span>{showForm ? "✕ Cancel" : "+ Submit Price"}</span>
        </button>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/20 text-sm text-green-700 dark:text-green-400">
          {successMsg}
        </div>
      )}

      {/* Submission form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Report a Price You&apos;ve Seen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">Item Name *</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Indomie noodles"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">Price (₦) *</label>
                <NumberInput
                  required
                  value={formPrice === "" ? "" : Number(formPrice)}
                  onValueChange={(v) => setFormPrice(v === "" ? "" : String(v))}
                  placeholder="e.g. 150"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">Category *</label>
                <select
                  required
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-900 dark:[color-scheme:dark] dark:border-gray-600 text-gray-800 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">Brand (optional)</label>
                <input
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  placeholder="e.g. Dangote"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block mb-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">Where did you see it?</label>
                <input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Moremi canteen, Awolowo hostel shop"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Price"}
            </button>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold text-gray-900 dark:text-white mb-1">No submissions yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Help your fellow students — report prices you see on campus!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Item</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Views</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                      {s.brand && <p className="text-xs text-gray-400">{s.brand}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatPrice(s.price)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[140px] truncate">
                      {s.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[s.status] ?? STATUS_STYLES.pending}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{s.view_count}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(s.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
