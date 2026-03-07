"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { storefrontApi, type SellerStorefront, type ListingDetail } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";
import {
  UserCheck, Users, Package, MapPin, ShoppingBag,
  AlertTriangle, BadgeCheck, Clock
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────

function Initials({ name, size = "lg" }: { name: string; size?: "sm" | "lg" }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  const cls = size === "lg"
    ? "w-20 h-20 text-2xl font-black border-4 border-white dark:border-gray-900"
    : "w-10 h-10 text-sm font-bold";
  return (
    <div className={`rounded-full bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white flex-shrink-0 ${cls}`}>
      {letters.toUpperCase()}
    </div>
  );
}

function AvailabilityChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    open: { label: "Open for orders", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    limited: { label: "Limited availability", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    closed: { label: "Not taking orders", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  };
  const { label, color } = map[status] ?? map.open;
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>{label}</span>;
}

function ConditionChip({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    New: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    "Fairly Used": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Used: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[condition] ?? map.Used}`}>
      {condition}
    </span>
  );
}


// ── listing card ───────────────────────────────────────────────────────────

function ListingCard({ listing }: { listing: ListingDetail }) {
  const photo = listing.photos?.[0];
  return (
    <Link href={`/listing/${listing.id}`} className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors">
      {/* Photo / emoji placeholder */}
      <div className="aspect-square bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        {photo ? (
          <img src={photo} alt={listing.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-cyan-50 dark:from-brand-900/20 dark:to-cyan-900/20">
            <CategoryIcon id={listing.category_id} size={36} containerSize="w-20 h-20" />
          </div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-gray-800 dark:text-white line-clamp-2 leading-snug">{listing.name}</p>
        <div className="flex items-center gap-1.5">
          <ConditionChip condition={listing.condition} />
          {listing.is_negotiable && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 uppercase tracking-wide">Negotiable</span>
          )}
        </div>
        <p className="text-base font-black text-brand-600 dark:text-brand-400">
          ₦{listing.price.toLocaleString()}
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

// ── follow button ──────────────────────────────────────────────────────────

function FollowButton({ sellerId, token, onLogin }: { sellerId: number; token: string | null; onLogin: () => void }) {
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoaded(true); return; }
    storefrontApi.getFollowStatus(token, sellerId)
      .then((r) => { setFollowing(r.following); setCount(r.follower_count); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token, sellerId]);

  async function toggle() {
    if (!token) { onLogin(); return; }
    setBusy(true);
    try {
      const r = await storefrontApi.followSeller(token, sellerId);
      setFollowing(r.following);
      setCount(r.follower_count);
    } catch { /* silent */ }
    finally { setBusy(false); }
  }

  if (!loaded) return <div className="w-28 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        following
          ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-500/40"
          : "bg-brand-500 hover:bg-brand-600 text-white"
      }`}
    >
      <UserCheck size={15} />
      {following ? `Following · ${count.toLocaleString()}` : `Follow · ${count.toLocaleString()}`}
    </button>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default function SellerStorefrontPage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  const { token } = useAuth();

  const [data, setData] = useState<SellerStorefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    storefrontApi.getSellerPage(username)
      .then(setData)
      .catch((e: Error) => setError(e.message || "Seller not found"))
      .finally(() => setLoading(false));
  }, [username]);

  const goLogin = useCallback(() => router.push("/auth/signin"), [router]);

  // ── loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen">
        {/* banner skeleton */}
        <div className="h-44 bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 -mt-10">
          <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse border-4 border-white dark:border-gray-900 mb-4" />
          <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
          <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <p className="font-bold text-gray-800 dark:text-white">Seller not found</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "This storefront doesn't exist or has been removed."}</p>
        <Link href="/" className="text-sm font-semibold text-brand-500 hover:underline">← Back to home</Link>
      </div>
    );
  }

  const { seller, listings, listing_count } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Banner ── */}
      <div className="relative h-44 md:h-56">
        {seller.banner_url ? (
          <img src={seller.banner_url} alt="banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-500 via-brand-600 to-[#06b6d4]" />
        )}
        {/* dark overlay for text legibility */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* ── Profile header ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 pb-6 border-b border-gray-200 dark:border-gray-800">
          {/* Left: avatar + name */}
          <div className="flex items-end gap-4">
            {seller.avatar_url ? (
              <img
                src={seller.avatar_url}
                alt={seller.display_name}
                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-gray-900 flex-shrink-0"
              />
            ) : (
              <Initials name={seller.display_name || seller.username} size="lg" />
            )}
            <div className="pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-gray-900 dark:text-white">
                  {seller.display_name || seller.username}
                </h1>
                {seller.verified && (
                  <BadgeCheck size={18} className="text-brand-500 flex-shrink-0" aria-label="Verified seller" />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">@{seller.username}</p>
            </div>
          </div>

          {/* Right: follow button */}
          <div className="sm:pb-1">
            <FollowButton sellerId={seller.id} token={token} onLogin={goLogin} />
          </div>
        </div>

        {/* ── Chips row ── */}
        <div className="flex flex-wrap items-center gap-3 py-4 border-b border-gray-200 dark:border-gray-800">
          <AvailabilityChip status={seller.vacation_mode ? "closed" : seller.availability_status} />

          {seller.vacation_mode && (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Clock size={12} /> On vacation — not accepting orders
            </span>
          )}

          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Package size={13} /> {listing_count} {listing_count === 1 ? "listing" : "listings"}
          </span>

          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Users size={13} /> {seller.follower_count.toLocaleString()} {seller.follower_count === 1 ? "follower" : "followers"}
          </span>
        </div>

        {/* ── Bio ── */}
        {seller.bio && (
          <div className="py-5 border-b border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line max-w-2xl">
              {seller.bio}
            </p>
          </div>
        )}

        {/* ── Listings ── */}
        <div className="py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-gray-800 dark:text-white">Active Listings</h2>
            {listing_count > 0 && (
              <span className="text-xs text-gray-400">{listing_count} total</span>
            )}
          </div>

          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <ShoppingBag size={28} className="text-gray-400" />
              </div>
              <p className="font-bold text-gray-700 dark:text-white mb-1">No active listings</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This seller hasn't posted any listings yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer nav ── */}
        <div className="py-4 border-t border-gray-200 dark:border-gray-800 mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 transition-colors">
            ← Browse all listings
          </Link>
        </div>
      </div>
    </div>
  );
}
