"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  storefrontApi, reviewsApi, uploadApi,
  type SellerInfo, type ListingDetail, type ReviewSummary,
} from "@/lib/api";
import { thumbnailImage, optimizeImage } from "@/lib/cloudinary";
import Avatar from "@/components/ui/avatar/Avatar";
import {
  UserPlus, UserCheck, MessageCircle, Link2, ShieldCheck,
  MapPin, GraduationCap, Star, Package, Eye, Users,
  CheckCircle2, X, Check, Phone, Instagram,
  Camera, Pencil, Loader2, Clock,
} from "lucide-react";
import { getCategoryConfig } from "@/lib/categoryIcons";
import { formatPrice } from "@/lib/formatPrice";
import { resizeImage } from "@/utils/resizeImage";

// Extra seller fields the backend may return beyond the SellerInfo type
type RichSeller = SellerInfo & {
  location?: string | null;
  department?: string | null;
  faculty?: string | null;
  confirmed_sales?: number | null;
  view_count?: number | null;
  whatsapp?: string | null;
  instagram?: string | null;
  pickup_policy?: string | null;
  return_policy?: string | null;
  payment_policy?: string | null;
};

function ConditionChip({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    New: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Fairly Used": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Used: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[condition] ?? map["Used"]}`}>
      {condition}
    </span>
  );
}

function ListingCard({ listing }: { listing: ListingDetail }) {
  const photo = listing.photos?.[0];
  const cfg = getCategoryConfig(listing.category_id);
  const Icon = cfg.icon;
  return (
    <Link
      href={`/listing/${listing.uuid ?? listing.id}`}
      className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors"
    >
      <div className="aspect-square bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        {photo ? (
          <Image
            src={thumbnailImage(photo, 400)}
            alt={listing.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${cfg.bg}`}>
            <Icon size={36} className={cfg.color} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-gray-800 dark:text-white line-clamp-2 leading-snug">{listing.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <ConditionChip condition={listing.condition} />
          {listing.is_negotiable && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 uppercase tracking-wide">
              Negotiable
            </span>
          )}
        </div>
        <p className="text-base font-black text-brand-600 dark:text-brand-400">
          {formatPrice(listing.price)}
        </p>
        {listing.location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} /> {listing.location}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StorePageClient({
  seller: sellerProp,
  listings,
  listingCount,
  ownerUserId,
  ownerUuid,
}: {
  seller: SellerInfo;
  listings: ListingDetail[];
  listingCount: number;
  ownerUserId?: number | null;
  ownerUuid?: string | null;
}) {
  const seller = sellerProp as RichSeller;
  const { token, user } = useAuth();
  const router = useRouter();

  const _ownerId = ownerUserId ?? seller.id;
  const _ownerUuid = ownerUuid ?? seller.uuid;
  const isOwner = !!user && (
    user.id === _ownerId ||
    (!!_ownerUuid && user.username === seller.username)
  );

  const [activeTab, setActiveTab] = useState<"listings" | "reviews" | "about">("listings");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [followCount, setFollowCount] = useState(seller.follower_count);
  const [followLoading, setFollowLoading] = useState(false);
  const [followLoaded, setFollowLoaded] = useState(false);
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Owner edit states
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>(seller.banner_url);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(seller.avatar_url);
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [aboutEditing, setAboutEditing] = useState(false);
  const [aboutText, setAboutText] = useState(seller.bio ?? "");
  const [aboutSaving, setAboutSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setFollowLoaded(true); return; }
    storefrontApi.getFollowStatus(token, seller.id)
      .then((r) => { setFollowing(r.following); setFollowCount(r.follower_count); })
      .catch(() => {})
      .finally(() => setFollowLoaded(true));
  }, [token, seller.id]);

  useEffect(() => {
    if (activeTab !== "reviews" || reviews !== null || reviewsLoading) return;
    setReviewsLoading(true);
    reviewsApi.getForSeller(seller.id)
      .then(setReviews)
      .catch(() => setReviews({ total: 0, avg_rating: null, reviews: [] }))
      .finally(() => setReviewsLoading(false));
  }, [activeTab, seller.id, reviews, reviewsLoading]);

  async function toggleFollow() {
    if (!token) { router.push("/signin"); return; }
    setFollowLoading(true);
    try {
      const r = await storefrontApi.followSeller(token, seller.id);
      setFollowing(r.following);
      setFollowCount(r.follower_count);
    } catch { /* silent */ }
    finally { setFollowLoading(false); }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try { await navigator.share({ title: seller.display_name, url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  }

  async function handleCoverPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!token || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setCoverUploading(true);
    try {
      const resized = await resizeImage(file, 1200, 300);
      const resizedFile = new File([resized], file.name, { type: "image/jpeg" });
      const url = await uploadApi.uploadBanner(token, resizedFile);
      await storefrontApi.updateCoverPhoto(token, url);
      setBannerUrl(url);
    } catch { /* silent */ }
    finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!token || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setAvatarUploading(true);
    try {
      const resized = await resizeImage(file, 400, 400);
      const resizedFile = new File([resized], file.name, { type: "image/jpeg" });
      const url = await uploadApi.uploadAvatar(token, resizedFile);
      setAvatarUrl(url);
    } catch { /* silent */ }
    finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function saveAbout() {
    if (!token) return;
    setAboutSaving(true);
    try {
      await storefrontApi.updateAbout(token, aboutText);
      setAboutEditing(false);
    } catch { /* silent */ }
    finally { setAboutSaving(false); }
  }

  // Unique categories present in this seller's listings
  const categories: [number, string][] = Array.from(
    new Map(listings.map((l) => [l.category_id, getCategoryConfig(l.category_id).label] as [number, string]))
  );

  const filteredListings = catFilter ? listings.filter((l) => l.category_id === catFilter) : listings;

  const TABS = [
    { key: "listings" as const, label: `Listings (${listingCount})` },
    { key: "reviews" as const, label: `Reviews${reviews ? ` (${reviews.total})` : ""}` },
    { key: "about" as const, label: "About" },
  ];

  return (
    <div className="pb-16">

      {/* ── Cover photo (200 px fixed height) — Feature 1A ── */}
      <div className="relative h-[200px] overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-[#06b6d4]">
        {bannerUrl && (
          <Image
            src={optimizeImage(bannerUrl, 1200)}
            alt={`${seller.display_name} cover`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-black/20" />

        {/* Owner: camera button for cover photo */}
        {isOwner && (
          <button
            type="button"
            aria-label="Change cover photo"
            disabled={coverUploading}
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {coverUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {coverUploading ? "Uploading…" : "Edit cover"}
          </button>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload cover photo"
          className="hidden"
          onChange={handleCoverPhotoChange}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* ── Profile section — sits below cover in normal document flow ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-4 pb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-end gap-4">
            {/* Avatar with optional edit overlay for owner */}
            <div className="relative flex-shrink-0 -mt-12">
              <Avatar
                src={avatarUrl ? thumbnailImage(avatarUrl, 80) : null}
                name={seller.display_name || seller.username || "Seller"}
                size="xxl"
                verified={!!(seller.is_verified || seller.verification_status === "approved")}
                className="border-4 border-white dark:border-gray-900"
              />
              {isOwner && (
                <button
                  type="button"
                  aria-label="Change profile photo"
                  disabled={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-60"
                >
                  {avatarUploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                aria-label="Upload profile photo"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Info column */}
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                  {seller.display_name || seller.username}
                </h1>
              </div>
              {/* Feature 3: Verified badge */}
              {(seller.is_verified || seller.verification_status === "approved") && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300 mt-1">
                  <ShieldCheck size={12} /> Verified UNILAG Seller
                </span>
              )}
              {/* Pending verification notice (owner only) */}
              {isOwner && seller.verification_status === "pending" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 mt-1">
                  <Clock size={12} /> Verification pending review
                </span>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{seller.username}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                {seller.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin size={11} /> {seller.location}
                  </span>
                )}
                {(seller.faculty || seller.department) && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <GraduationCap size={11} /> {seller.faculty ?? seller.department}
                  </span>
                )}
                {seller.avg_rating != null && (
                  <span className="flex items-center gap-1 text-xs text-yellow-500 font-semibold">
                    <Star size={11} className="fill-yellow-400" />
                    {seller.avg_rating} ({seller.review_count ?? 0} reviews)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 sm:pb-1 flex-wrap">
            {/* Follow button — hidden for owner */}
            {!isOwner && (
              <button
                type="button"
                onClick={toggleFollow}
                disabled={followLoading || !followLoaded}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[40px] disabled:opacity-60 ${
                  following
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 border border-brand-300 dark:border-brand-500/40"
                    : "bg-brand-500 hover:bg-brand-600 text-white"
                }`}
              >
                {following ? <UserCheck size={15} /> : <UserPlus size={15} />}
                {following ? "Following" : "Follow"}
              </button>
            )}
            {/* Message button — hidden for owner */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => { if (!token) { router.push("/signin"); return; } setMsgOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors min-h-[40px]"
              >
                <MessageCircle size={15} /> Message
              </button>
            )}
            {/* Owner: link to seller dashboard */}
            {isOwner && (
              <Link
                href="/seller"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors min-h-[40px]"
              >
                <Pencil size={15} /> Manage Store
              </Link>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors min-h-[40px]"
            >
              <Link2 size={15} /> Share
            </button>
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="flex flex-wrap gap-5 py-4 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <Package size={14} /> <strong>{listingCount}</strong> Listings
        </span>
        {seller.confirmed_sales != null && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} /> <strong>{seller.confirmed_sales}</strong> Sales
          </span>
        )}
        {seller.avg_rating != null && (
          <span className="flex items-center gap-1.5">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            <strong>{seller.avg_rating}</strong> Rating
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users size={14} /> <strong>{followCount.toLocaleString()}</strong> Followers
        </span>
        {seller.view_count != null && (
          <span className="flex items-center gap-1.5">
            <Eye size={14} /> <strong>{seller.view_count.toLocaleString()}</strong> Store Views
          </span>
        )}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 mt-6 mb-6 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-2xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

        {/* ── Listings tab ── */}
        {activeTab === "listings" && (
        <div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                type="button"
                onClick={() => setCatFilter(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  catFilter === null
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                All
              </button>
              {categories.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCatFilter(catFilter === id ? null : id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    catFilter === id
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {filteredListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package size={40} className="text-gray-300 dark:text-gray-700 mb-3" />
              <p className="font-bold text-gray-700 dark:text-white mb-1">No listings in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      )}

        {/* ── Reviews tab ── */}
        {activeTab === "reviews" && (
        <div>
          {reviewsLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/4 bg-gray-100 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!reviewsLoading && reviews && (
            <>
              {reviews.avg_rating != null && reviews.total > 0 && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="text-center flex-shrink-0">
                    <p className="text-4xl font-black text-gray-900 dark:text-white">{reviews.avg_rating}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < Math.round(reviews.avg_rating!) ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-700"} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{reviews.total} review{reviews.total !== 1 ? "s" : ""}</p>
                  </div>
                  {reviews.rating_distribution && (
                    <div className="flex-1 space-y-1.5 w-full">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = reviews.rating_distribution![star] ?? 0;
                        const pct = reviews.total > 0 ? Math.round((count / reviews.total) * 100) : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-3 text-right text-gray-400">{star}</span>
                            <Star size={10} className="fill-yellow-400 text-yellow-400" />
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-5 text-gray-400">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {reviews.reviews.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.reviews.map((r) => (
                    <div key={r.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar
                          src={r.reviewer_avatar}
                          name={r.reviewer_name || "User"}
                          size="sm"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">{r.reviewer_name}</p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} size={10} className={i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-700"} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 dark:text-gray-400">{r.comment}</p>}
                      {r.seller_response && (
                        <div className="mt-3 pl-3 border-l-2 border-brand-200">
                          <p className="text-xs font-semibold text-brand-500 mb-0.5">Seller response:</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{r.seller_response}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

        {/* ── About tab ── */}
        {activeTab === "about" && (
          <div className="space-y-5 max-w-2xl">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">About</h3>
                {isOwner && !aboutEditing && (
                  <button type="button" onClick={() => setAboutEditing(true)} className="text-gray-400 hover:text-brand-500 transition-colors" aria-label="Edit about">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {aboutEditing ? (
                <>
                  <textarea
                    value={aboutText}
                    onChange={(e) => setAboutText(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    placeholder="Tell buyers about yourself, what you sell, and how to reach you…"
                    aria-label="About section"
                    className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={saveAbout}
                      disabled={aboutSaving}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                    >
                      {aboutSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {aboutSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAboutEditing(false); setAboutText(seller.bio ?? ""); }}
                      className="px-4 py-1.5 border border-gray-200 dark:border-gray-700 text-xs font-semibold rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                  {aboutText || <span className="text-gray-400 italic">{isOwner ? "Add a bio to tell buyers about yourself." : "No bio provided."}</span>}
                </p>
              )}
            </div>
            {(seller.pickup_policy || seller.return_policy || seller.payment_policy) && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Store Policies</h3>
              {seller.pickup_policy && (
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Pickup</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{seller.pickup_policy}</p>
                </div>
              )}
              {seller.return_policy && (
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Returns</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{seller.return_policy}</p>
                </div>
              )}
              {seller.payment_policy && (
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Payment</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{seller.payment_policy}</p>
                </div>
              )}
            </div>
          )}
            {(seller.whatsapp || seller.instagram) && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</h3>
              {seller.whatsapp && (
                <a
                  href={`https://wa.me/${seller.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:underline"
                >
                  <Phone size={14} /> WhatsApp
                </a>
              )}
              {seller.instagram && (
                <a
                  href={`https://instagram.com/${seller.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline"
                >
                  <Instagram size={14} /> @{seller.instagram.replace("@", "")}
                </a>
              )}
            </div>
          )}
          </div>
        )}

        {/* ── Message modal ── */}
      {msgOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMsgOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-white">Message Seller</h3>
              <button type="button" aria-label="Close" onClick={() => setMsgOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              To contact <strong>{seller.display_name}</strong>, open any of their listings and use the{" "}
              <strong>&quot;Message Seller&quot;</strong> button.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setMsgOpen(false); setActiveTab("listings"); }}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
              >
                View Listings
              </button>
              <button
                type="button"
                onClick={() => setMsgOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

        {/* ── Share toast ── */}
        {shareToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
            <Check size={14} /> Link copied!
          </div>
        )}
      </div>{/* /max-w-5xl */}
    </div>
  );
}
