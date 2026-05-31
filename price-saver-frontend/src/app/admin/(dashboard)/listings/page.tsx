"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { formatDateTimeWAT } from "@/utils/date";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminListing, type AdminListingDetail } from "@/lib/api";
import { Package, Flag, CheckCircle, Trash2, Search, Star, StarOff, RefreshCw, Eye, X, MapPin, Tag, Store, Calendar, Camera, Film, Maximize2 } from "lucide-react";

// Cloudinary auto-generates a JPG thumbnail of the first frame when the video
// extension is swapped for .jpg — works for any video uploaded with
// resource_type='video'. Used as a <video> poster so the tile shows a frame
// instantly even before metadata loads.
function cloudinaryVideoThumb(videoUrl: string): string | null {
  if (!videoUrl || !videoUrl.includes("/video/upload/")) return null;
  const lower = videoUrl.toLowerCase();
  for (const ext of [".mp4", ".mov", ".webm", ".m4v"]) {
    if (lower.endsWith(ext)) return videoUrl.slice(0, -ext.length) + ".jpg";
  }
  return null;
}

// Explicit MIME for the <source> tag — avoids the Chrome "blank player" bug
// triggered when CDN headers don't disambiguate the codec.
function videoMimeType(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov") || lower.endsWith(".m4v")) return "video/quicktime";
  return "video/mp4";
}

function tryAutoplayWithFallback(v: HTMLVideoElement) {
  v.muted = true;
  const p = v.play();
  if (!p || typeof p.catch !== "function") return;
  p.catch(() => {
    const resume = () => { v.play().catch(() => {}); };
    document.addEventListener("click", resume, { once: true });
    document.addEventListener("touchstart", resume, { once: true, passive: true });
  });
}
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/formatPrice";

function wat(iso: string | null) {
  if (!iso) return "—";
  // Shared WAT formatter — normalizes naive-UTC timestamps (no hour-behind bug).
  return formatDateTimeWAT(iso);
}

type FilterType = "all" | "flagged" | "featured" | "pending" | "approved" | "rejected";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All",      value: "all" },
  { label: "Flagged",  value: "flagged" },
  { label: "Featured", value: "featured" },
  { label: "Pending",  value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

type ActionType = "approve" | "reject" | "flag" | "unflag" | "remove" | "feature" | "unfeature";

export default function ListingsPage() {
  const { token } = useAdminAuth();
  const { showToast } = useToast();
  const [filter, setFilter]         = useState<FilterType>("all");
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [flagReason, setFlagReason]  = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ item: AdminListing; action: ActionType } | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminListingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Fullscreen video viewer for the detail-modal media grid.
  const [videoViewerUrl, setVideoViewerUrl] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDetail = async (id: number) => {
    if (!token) return;
    setDetailLoading(true);
    try {
      const res = await adminApi.getListingDetail(token, id);
      setDetailTarget(res.data);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed to load listing", "error"); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchData = useCallback(() => adminApi.getListings(token!), [token]);
  const { data, loading, error, refetch } = usePolling<{ success: boolean; total: number; data: AdminListing[] }>(
    fetchData, 30_000, !!token
  );

  const handleConfirm = async () => {
    if (!confirmTarget || !token) return;
    const { item, action } = confirmTarget;
    setActionLoading(item.id);
    try {
      if (action === "approve")   await adminApi.approveListing(token, item.id);
      else if (action === "reject")    await adminApi.rejectListing(token, item.id, rejectReason || undefined);
      else if (action === "flag")      await adminApi.flagListing(token, item.id, flagReason || undefined);
      else if (action === "unflag")    await adminApi.unflagListing(token, item.id);
      else if (action === "remove")    await adminApi.removeListing(token, item.id);
      else if (action === "feature")   await adminApi.featureListing(token, item.id);
      else if (action === "unfeature") await adminApi.unfeatureListing(token, item.id);
      refetch();
      setConfirmTarget(null);
      setFlagReason("");
      setRejectReason("");
    } catch (e) { showToast(e instanceof Error ? e.message : "Action failed", "error"); }
    finally { setActionLoading(null); }
  };

  const allItems = data?.data ?? [];

  const filtered = allItems.filter((item) => {
    const q = debouncedSearch.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.seller_name.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === "flagged")  return item.is_flagged;
    if (filter === "featured") return item.is_featured;
    if (filter === "pending")  return item.status === "pending";
    if (filter === "approved") return item.status === "approved";
    if (filter === "rejected") return item.status === "rejected";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package size={22} className="text-brand-500" />
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">All Listings</h1>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{data?.total ?? 0}</span>
        </div>
        <button type="button" onClick={() => refetch()} title="Refresh"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-1 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Search listings…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-4 text-sm text-gray-800 dark:text-white/90 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {["Listing", "Seller", "Category", "Price", "Status", "Posted", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">No listings found</td>
                  </tr>
                )
                : filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {item.is_featured && <Star size={12} className="text-yellow-500 shrink-0" />}
                          <span className="font-medium text-gray-800 dark:text-white/90 max-w-[180px] truncate">{item.name}</span>
                        </div>
                        {item.is_flagged && item.flag_reason && (
                          <p className="text-[11px] text-red-500 mt-0.5 max-w-[180px] truncate">{item.flag_reason}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400">{item.seller_name}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500">{item.category}</span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-800 dark:text-white/90">
                        {formatPrice(Number(item.price))}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={item.is_flagged ? "flagged" : item.status} />
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => openDetail(item.id)}
                            disabled={detailLoading}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 disabled:opacity-50">
                            <Eye size={12} /> View
                          </button>
                          {item.status !== "approved" && (
                            <button type="button" onClick={() => setConfirmTarget({ item, action: "approve" })}
                              disabled={actionLoading === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100 disabled:opacity-50">
                              <CheckCircle size={12} /> Approve
                            </button>
                          )}
                          {item.is_flagged ? (
                            <button type="button" onClick={() => setConfirmTarget({ item, action: "unflag" })}
                              disabled={actionLoading === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-700/30 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 disabled:opacity-50">
                              <Flag size={12} /> Unflag
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setFlagReason(""); setConfirmTarget({ item, action: "flag" }); }}
                              disabled={actionLoading === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 disabled:opacity-50">
                              <Flag size={12} /> Flag
                            </button>
                          )}
                          {item.is_featured ? (
                            <button type="button" onClick={() => setConfirmTarget({ item, action: "unfeature" })}
                              disabled={actionLoading === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/30 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 disabled:opacity-50">
                              <StarOff size={12} /> Unfeature
                            </button>
                          ) : (
                            <button type="button" onClick={() => setConfirmTarget({ item, action: "feature" })}
                              disabled={actionLoading === item.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-500/10 dark:border-purple-500/30 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-100 disabled:opacity-50">
                              <Star size={12} /> Feature
                            </button>
                          )}
                          <button type="button" onClick={() => setConfirmTarget({ item, action: "remove" })}
                            disabled={actionLoading === item.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 disabled:opacity-50">
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remove / feature / unfeature / unflag confirm */}
      <ConfirmModal
        isOpen={!!confirmTarget && ["remove", "unfeature", "unflag", "approve", "feature"].includes(confirmTarget?.action ?? "")}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirm}
        title={
          confirmTarget?.action === "remove"    ? "Remove Listing" :
          confirmTarget?.action === "approve"   ? "Approve Listing" :
          confirmTarget?.action === "feature"   ? "Feature Listing" :
          confirmTarget?.action === "unfeature" ? "Remove from Featured" :
          "Unflag Listing"
        }
        description={`Apply action "${confirmTarget?.action}" to "${confirmTarget?.item.name}"?`}
        confirmLabel={confirmTarget?.action === "remove" ? "Remove" : "Confirm"}
        variant={confirmTarget?.action === "remove" ? "danger" : "primary"}
        loading={actionLoading === confirmTarget?.item.id}
      />

      {/* Flag with reason */}
      {confirmTarget?.action === "flag" && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmTarget(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Flag Listing</h3>
            <p className="text-sm text-gray-500">"{confirmTarget.item.name}"</p>
            <input type="text" placeholder="Reason (optional)" value={flagReason} onChange={(e) => setFlagReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-amber-400 focus:outline-none" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmTarget(null)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleConfirm} disabled={actionLoading === confirmTarget.item.id}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 flex items-center gap-2">
                {actionLoading === confirmTarget.item.id && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                Flag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal — shows all seller-inputted fields */}
      {detailTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{detailTarget.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detailTarget.is_flagged ? "flagged" : detailTarget.status} />
                  {detailTarget.is_featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 text-[10px] font-semibold">
                      <Star size={10} /> Featured
                    </span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setDetailTarget(null)}
                aria-label="Close detail view" title="Close"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Block 5D: media section — photos AND videos, with an accurate count badge */}
              {((detailTarget.photos && detailTarget.photos.length > 0) ||
                (detailTarget.videos && detailTarget.videos.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <span>Media</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <Camera size={11} />
                      {detailTarget.photos?.length ?? 0} photo{(detailTarget.photos?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                    {detailTarget.videos && detailTarget.videos.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <Film size={11} />
                        {detailTarget.videos.length} video{detailTarget.videos.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detailTarget.photos?.map((url, i) => (
                      <a key={`photo-${i}`} href={url} target="_blank" rel="noopener noreferrer"
                        title={`Photo ${i + 1}`} aria-label={`Open photo ${i + 1} in new tab`}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                        <Image src={url} alt={`Photo ${i + 1}`} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                      </a>
                    ))}
                    {detailTarget.videos?.map((url, i) => (
                      <div key={`video-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-black">
                        <video
                          poster={cloudinaryVideoThumb(url) ?? undefined}
                          autoPlay
                          muted
                          loop
                          playsInline
                          controls
                          preload="auto"
                          className="absolute inset-0 w-full h-full object-contain"
                          onLoadedMetadata={(e) => {
                            e.currentTarget.muted = true;
                            e.currentTarget.defaultMuted = true;
                          }}
                          onCanPlay={(e) => tryAutoplayWithFallback(e.currentTarget)}
                        >
                          <source src={url} type={videoMimeType(url)} />
                          Your browser does not support inline video playback.
                        </video>
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-bold">
                          <Film size={9} /> Video {i + 1}
                        </span>
                        <button
                          type="button"
                          title="View video fullscreen"
                          onClick={() => setVideoViewerUrl(url)}
                          className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 flex items-center justify-center text-white transition-colors"
                        >
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DetailCell icon={<Tag size={13} />} label="Price" value={formatPrice(Number(detailTarget.price))} />
                <DetailCell icon={<Package size={13} />} label="Category" value={detailTarget.category} />
                <DetailCell icon={<Store size={13} />} label="Seller" value={`${detailTarget.seller_name}${detailTarget.seller_username ? ` (@${detailTarget.seller_username})` : ""}`} />
                <DetailCell icon={<Tag size={13} />} label="Brand" value={detailTarget.brand || "—"} />
                <DetailCell icon={<MapPin size={13} />} label="Location" value={detailTarget.location || "—"} />
                <DetailCell icon={<Tag size={13} />} label="Condition" value={detailTarget.condition || "—"} />
                <DetailCell icon={<Tag size={13} />} label="Quantity" value={String(detailTarget.quantity ?? "—")} />
                <DetailCell icon={<Tag size={13} />} label="Negotiable" value={detailTarget.is_negotiable ? "Yes" : "No"} />
                <DetailCell icon={<Tag size={13} />} label="Delivery" value={detailTarget.delivery_options || "—"} />
                <DetailCell icon={<Tag size={13} />} label="Subcategory" value={detailTarget.subcategory || "—"} />
                <DetailCell icon={<Eye size={13} />} label="Views" value={detailTarget.view_count.toLocaleString("en-NG")} />
                <DetailCell icon={<Calendar size={13} />} label="Submitted" value={wat(detailTarget.submitted_at)} />
              </div>

              {detailTarget.description && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{detailTarget.description}</p>
                </div>
              )}

              {detailTarget.flag_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 p-3">
                  <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase">Flag Reason</p>
                  <p className="text-sm text-red-800 dark:text-red-300 mt-1">{detailTarget.flag_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen video viewer */}
      {videoViewerUrl && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setVideoViewerUrl(null)}
        >
          <button
            type="button"
            title="Close"
            onClick={() => setVideoViewerUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X size={20} />
          </button>
          <video
            src={videoViewerUrl}
            autoPlay
            controls
            playsInline
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Reject with reason */}
      {confirmTarget?.action === "reject" && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmTarget(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Reject Listing</h3>
            <p className="text-sm text-gray-500">"{confirmTarget.item.name}"</p>
            <input type="text" placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:text-white/90 focus:border-red-400 focus:outline-none" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmTarget(null)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleConfirm} disabled={actionLoading === confirmTarget.item.id}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-2">
                {actionLoading === confirmTarget.item.id && <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{value}</p>
    </div>
  );
}
