"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, itemsApi, type SellerListing, type Category } from "@/lib/api";
import { Plus, Eye, Trash2, PencilLine, Copy, CheckCircle, Pause, Play, Moon } from "lucide-react";

type ListingStatusTab = "all" | "draft" | "active" | "paused" | "sold" | "expired";

const STATUS_TABS: { key: ListingStatusTab; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "draft",   label: "Draft" },
  { key: "active",  label: "Active" },
  { key: "paused",  label: "Paused" },
  { key: "sold",    label: "Sold" },
  { key: "expired", label: "Expired" },
];

function listingStatusStyle(s: string) {
  const v = s?.toLowerCase();
  if (v === "active")  return "bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400";
  if (v === "paused")  return "bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400";
  if (v === "sold")    return "bg-brand-50 dark:bg-brand-500/10 text-brand-500";
  if (v === "expired") return "bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400";
  if (v === "draft")   return "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
  return "bg-gray-100 dark:bg-gray-800 text-gray-500";
}

function approvalStyle(s: string) {
  const v = s?.toLowerCase();
  if (v === "approved") return "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400";
  if (v === "pending")  return "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400";
  if (v === "rejected") return "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400";
  return "bg-gray-100 text-gray-500";
}

function healthScore(l: SellerListing) {
  let score = 0;
  if (l.description && l.description.length >= 20) score += 25;
  if (l.photos && l.photos.length > 0) score += 35;
  if (l.location) score += 20;
  if (l.category_id) score += 20;
  return score;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 flex items-center gap-4 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-1.5 w-36 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
      <div className="h-6 w-16 rounded bg-gray-100 dark:bg-gray-700" />
    </div>
  );
}

export default function SellerListingsPage() {
  const { token } = useAuth();
  const [listings, setListings]     = useState<SellerListing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab]   = useState<ListingStatusTab>("all");
  const [loading, setLoading]       = useState(true);
  const [vacationMode, setVacationMode] = useState(false);
  const [togglingVacation, setTogglingVacation] = useState(false);
  const [deleting, setDeleting]     = useState<number | null>(null);
  const [actioning, setActioning]   = useState<number | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const categoryMap = React.useMemo(() => {
    const m: Record<number, string> = {};
    categories.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const fetchListings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sellerApi.getListings(token);
      if (res.success) setListings(res.data);
      // Also get vacation mode from stats
      const stats = await sellerApi.getStats(token);
      if (stats.success) setVacationMode(stats.data.vacationMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { itemsApi.getCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => { fetchListings(); }, [fetchListings]);

  const handleDelete = async (id: number) => {
    if (!token || !window.confirm("Delete this listing permanently?")) return;
    setDeleting(id);
    try {
      await sellerApi.deleteListing(token, id);
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const handleSetStatus = async (id: number, status: string) => {
    if (!token) return;
    setActioning(id);
    try {
      await sellerApi.setListingStatus(token, id, status);
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, listing_status: status } : l));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActioning(null);
    }
  };

  const handleDuplicate = async (id: number) => {
    if (!token) return;
    setActioning(id);
    try {
      await sellerApi.duplicateListing(token, id);
      await fetchListings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setActioning(null);
    }
  };

  const handleVacationToggle = async () => {
    if (!token) return;
    setTogglingVacation(true);
    try {
      const res = await sellerApi.toggleVacation(token);
      setVacationMode(res.vacation_mode);
      await fetchListings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setTogglingVacation(false);
    }
  };

  const filtered = activeTab === "all"
    ? listings
    : listings.filter((l) => (l.listing_status || "active") === activeTab);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">My Listings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage all your campus product listings</p>
        </div>
        <Link href="/seller/listings/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-sm hover:opacity-90 transition-opacity">
          <Plus size={15} /> New Listing
        </Link>
      </div>

      {/* Vacation mode banner + toggle */}
      <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
        vacationMode
          ? "border-warning-200 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"
      }`}>
        <div className="flex items-center gap-3">
          <Moon size={18} className={vacationMode ? "text-warning-500" : "text-gray-400"} />
          <div>
            <p className={`text-sm font-semibold ${vacationMode ? "text-warning-700 dark:text-warning-400" : "text-gray-700 dark:text-gray-300"}`}>
              Vacation Mode {vacationMode ? "— Active" : ""}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {vacationMode ? "All your listings are paused. Buyers cannot contact you." : "Pause all listings while you're away."}
            </p>
          </div>
        </div>
        <button type="button" onClick={handleVacationToggle} disabled={togglingVacation}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
            vacationMode
              ? "bg-warning-500 text-white hover:bg-warning-600"
              : "border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
          }`}>
          {togglingVacation ? "..." : vacationMode ? "Turn Off" : "Enable"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all" ? listings.length
            : listings.filter((l) => (l.listing_status || "active") === tab.key).length;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-500"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-white/[0.03] text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
              }`}>
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 p-4">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && filtered.map((l) => {
          const score = healthScore(l);
          const lstatus = l.listing_status || "active";
          const firstPhoto = l.photos?.[0];
          const isActioning = actioning === l.id;
          return (
            <div key={l.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 flex items-start gap-4">
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                {firstPhoto
                  ? <img src={firstPhoto} alt={l.name} className="w-full h-full object-cover" />
                  : <span className="text-2xl font-black text-brand-400">{l.name.charAt(0).toUpperCase()}</span>}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-[15px] text-gray-800 dark:text-white truncate">{l.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${listingStatusStyle(lstatus)}`}>
                    {lstatus.charAt(0).toUpperCase() + lstatus.slice(1)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${approvalStyle(l.status)}`}>
                    {l.status}
                  </span>
                  {l.condition && l.condition !== "New" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                      {l.condition}
                    </span>
                  )}
                  {l.photos && l.photos.length > 0 && (
                    <span className="text-[10px] text-gray-400">📷 {l.photos.length}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[12px] text-gray-400 mb-2 flex-wrap">
                  <span className="flex items-center gap-1"><Eye size={11} /> {l.view_count.toLocaleString()}</span>
                  {categoryMap[l.category_id] && <span>{categoryMap[l.category_id]}</span>}
                  {l.location && <span>📍 {l.location}</span>}
                  <span>Health: <strong className={score >= 80 ? "text-success-500" : score >= 50 ? "text-warning-500" : "text-error-500"}>{score}/100</strong></span>
                </div>

                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full w-36">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    score >= 80 ? "bg-success-500" : score >= 50 ? "bg-warning-400" : "bg-error-500"
                  }`} style={{ width: `${score}%` }} />
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="font-extrabold text-[16px] text-gray-800 dark:text-white">
                  ₦{l.price.toLocaleString("en-NG")}
                </p>
                {l.is_featured && <span className="text-[10px] text-warning-500 font-semibold">⭐ Featured</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Edit */}
                <Link href={`/seller/listings/${l.id}/edit`} title="Edit"
                  className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-brand-500 hover:border-brand-300 transition-colors">
                  <PencilLine size={14} />
                </Link>

                {/* Duplicate */}
                <button type="button" title="Duplicate as draft" disabled={isActioning}
                  onClick={() => handleDuplicate(l.id)}
                  className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:text-brand-500 hover:border-brand-300 transition-colors disabled:opacity-40">
                  <Copy size={14} />
                </button>

                {/* Mark as Sold */}
                {lstatus !== "sold" && (
                  <button type="button" title="Mark as Sold" disabled={isActioning}
                    onClick={() => handleSetStatus(l.id, "sold")}
                    className="w-8 h-8 rounded-lg border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors disabled:opacity-40">
                    <CheckCircle size={14} />
                  </button>
                )}

                {/* Pause / Activate */}
                {lstatus === "active" && (
                  <button type="button" title="Pause listing" disabled={isActioning}
                    onClick={() => handleSetStatus(l.id, "paused")}
                    className="w-8 h-8 rounded-lg border border-warning-200 dark:border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center text-warning-600 hover:bg-warning-100 transition-colors disabled:opacity-40">
                    <Pause size={14} />
                  </button>
                )}
                {lstatus === "paused" && (
                  <button type="button" title="Activate listing" disabled={isActioning}
                    onClick={() => handleSetStatus(l.id, "active")}
                    className="w-8 h-8 rounded-lg border border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 flex items-center justify-center text-success-600 hover:bg-success-100 transition-colors disabled:opacity-40">
                    <Play size={14} />
                  </button>
                )}

                {/* Delete */}
                <button type="button" title="Delete listing" disabled={deleting === l.id}
                  onClick={() => handleDelete(l.id)}
                  className="w-8 h-8 rounded-lg border border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 flex items-center justify-center text-error-500 hover:bg-error-100 transition-colors disabled:opacity-40">
                  {deleting === l.id
                    ? <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="font-bold text-gray-800 dark:text-white mb-1">No listings</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {activeTab === "all" ? "Start selling by adding your first product" : `No ${activeTab} listings`}
            </p>
            {activeTab === "all" && (
              <Link href="/seller/listings/new"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity">
                <Plus size={14} /> Add Your First Listing
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
