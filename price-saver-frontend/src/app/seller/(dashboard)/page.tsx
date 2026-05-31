"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type SellerStats, type SellerListing } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import {
  Eye,
  MessageCircle,
  CheckCircle,
  ChevronUp,
  Plus,
  Star,
  Clock,
  Sprout,
  Camera,
  Tag,
  BarChart2,
  Home,
  Package as PackageIcon,
  Users,
  Medal,
  Award,
  Crown,
} from "lucide-react";

const DEFAULT_STATS: SellerStats = {
  totalListings: 0,
  activeListings: 0,
  pendingListings: 0,
  draftListings: 0,
  expiredListings: 0,
  totalViews: 0,
  confirmedSales: 0,
  sellerPoints: 0,
  vacationMode: false,
  verificationStatus: "Not submitted",
};

function statusColors(status: string, dark = false) {
  const s = status.toLowerCase();
  if (s === "approved" || s === "active") {
    return dark
      ? "bg-success-900/40 text-success-400"
      : "bg-success-50 text-success-600";
  }
  if (s === "pending" || s === "under review") {
    return dark
      ? "bg-warning-900/40 text-warning-400"
      : "bg-warning-50 text-warning-700";
  }
  if (s === "rejected") {
    return dark
      ? "bg-error-900/40 text-error-400"
      : "bg-error-50 text-error-600";
  }
  return dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600";
}

const TIER_PERKS = [
  { icon: <Camera size={13} />, label: "8 photos/listing" },
  { icon: <Tag size={13} />, label: "Coupon codes" },
  { icon: <BarChart2 size={13} />, label: "Full analytics" },
  { icon: <Home size={13} />, label: "Homepage feature" },
];

export default function SellerOverviewPage() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<SellerStats>(DEFAULT_STATS);
  const [topListings, setTopListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      sellerApi.getStats(token).then((r) => { if (r.success) setStats(r.data); }),
      sellerApi.getListings(token).then((r) => {
        if (r.success) setTopListings(r.data.slice(0, 4));
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const fmt = (n: number) => (loading ? "—" : n.toLocaleString());

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const tierInfo =
    stats.sellerPoints >= 2000
      ? { icon: <Crown size={36} className="text-yellow-500" />, label: "Gold Seller", sub: "Top tier · All features unlocked", color: "text-yellow-500" }
      : stats.sellerPoints >= 500
      ? { icon: <Award size={36} className="text-blue-500" />, label: "Silver Seller", sub: "Rising tier · Most features unlocked", color: "text-blue-500" }
      : stats.verificationStatus === "Approved"
      ? { icon: <Medal size={36} className="text-orange-500" />, label: "Bronze Seller", sub: "Verified · Keep earning points", color: "text-orange-500" }
      : stats.verificationStatus === "Pending" || stats.verificationStatus === "Under Review"
      ? { icon: <Clock size={36} className="text-brand-400" />, label: "Pending Verification", sub: "Complete verification to unlock perks", color: "text-brand-400" }
      : { icon: <Sprout size={36} className="text-success-500" />, label: "New Seller", sub: "Submit verification to climb tiers", color: "text-success-500" };

  const respRate   = stats.responseRate   ?? 96;
  const compRate   = stats.completionRate ?? 98;
  const noShowRate = stats.noShowRate     ?? 0;
  const avgResp    = stats.avgResponseTime ?? "18 min";

  const scorecardOverall =
    respRate >= 90 && compRate >= 90 && noShowRate <= 5 ? "Excellent"
    : respRate >= 70 && compRate >= 70 ? "Good"
    : "Needs Work";

  const scorecardBadge =
    scorecardOverall === "Excellent"
      ? "bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400"
      : scorecardOverall === "Good"
      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
      : "bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400";

  const parsedResponseMinutes = parseInt(avgResp);
  const safeResponseMinutes = Number.isNaN(parsedResponseMinutes) ? 18 : parsedResponseMinutes;

  const SCORECARD_ROWS_DYNAMIC = [
    { label: "Response Rate",   value: `${respRate}%`,   bar: respRate,   color: "bg-success-500" },
    { label: "Response Time",   value: avgResp,          bar: Math.max(0, Math.round(100 - Math.min(safeResponseMinutes, 60) * (100 / 60))), color: "bg-brand-500" },
    { label: "Completion Rate", value: `${compRate}%`,   bar: compRate,   color: "bg-accent-500" },
    { label: "No-show Rate",    value: `${noShowRate}%`, bar: Math.max(0, 100 - noShowRate), color: "bg-success-500" },
  ];

  /* Listing health: a 0–100 completeness score so sellers know which listings
     need work. Kept in sync with listings/page.tsx. */
  const healthScore = (l: SellerListing) => {
    let score = 0;
    if (l.description && l.description.length >= 20) score += 25;            // a real description
    if (l.photos && l.photos.length > 0) score += 35;                       // at least one photo
    if (l.location || (l.locations && l.locations.length > 0)) score += 20; // a pickup spot
    if (l.category_id) score += 20;                                         // categorised
    return score;
  };
  const HEALTH_HINT =
    "Listing health = how complete this listing is (0–100). Points: photo +35, description (20+ chars) +25, pickup location +20, category +20.";

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">{greeting}, {user?.display_name || user?.username}</p>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Seller Overview</h1>
        </div>
        <Link
          href="/seller/listings/new"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-full px-4 py-2.5 text-sm font-bold shadow-sm hover:opacity-90 transition-opacity min-h-[44px]"
        >
          <Plus size={15} /><span className="hidden sm:inline">Add Listing</span>
        </Link>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Store Views",     value: fmt(stats.totalViews),               icon: <Eye size={16} />,           iconBg: "bg-brand-500/10",   iconColor: "text-brand-500" },
          { label: "Inquiries",       value: fmt(stats.totalInquiries ?? 0),       icon: <MessageCircle size={16} />, iconBg: "bg-accent-500/10",  iconColor: "text-accent-500" },
          { label: "Confirmed Sales", value: fmt(stats.confirmedSales),            icon: <CheckCircle size={16} />,   iconBg: "bg-success-500/10", iconColor: "text-success-500" },
          { label: "Seller Points",   value: fmt(stats.sellerPoints),              icon: <Star size={16} />,          iconBg: "bg-warning-500/10", iconColor: "text-warning-500" },
          { label: "Active Listings", value: fmt(stats.activeListings),            icon: <PackageIcon size={16} />,   iconBg: "bg-brand-500/10",   iconColor: "text-brand-400" },
          { label: "Followers",       value: fmt(stats.followersCount ?? 0),       icon: <Users size={16} />,         iconBg: "bg-accent-500/10",  iconColor: "text-accent-400" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 min-w-0">
            <div className="flex items-center mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg} ${s.iconColor}`}>
                {s.icon}
              </div>
            </div>
            <p className="text-xl font-black text-gray-800 dark:text-white tracking-tight">{s.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Scorecard + Trust Tier ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Scorecard */}
        <div className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white">Seller Scorecard</h3>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${scorecardBadge}`}>
              {scorecardOverall}
            </span>
          </div>
          <div className="space-y-4">
            {SCORECARD_ROWS_DYNAMIC.map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className="font-bold text-gray-800 dark:text-white">{row.value}</span>
                </div>
                <div className="relative h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full origin-left ${row.color}`} style={{ transform: `scaleX(${Math.round(row.bar) / 100})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Tier */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Trust Tier</h3>
          <div className="text-center mb-4">
            <div className="flex justify-center mb-2">{tierInfo.icon}</div>
            <p className="font-black text-base text-gray-800 dark:text-white">{tierInfo.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tierInfo.sub}</p>
          </div>
          {stats.verificationStatus === "Approved" && (
            <div className="grid grid-cols-2 gap-2">
              {TIER_PERKS.map((p) => (
                <div key={p.label} className="border border-gray-200 dark:border-gray-800 hover:border-brand-500 rounded-lg p-2.5 text-xs font-medium text-gray-500 dark:text-gray-300 hover:text-brand-400 transition-colors text-center">
                  <p className="flex items-center justify-center gap-1">{p.icon} {p.label}</p>
                </div>
              ))}
            </div>
          )}
          {stats.verificationStatus !== "Approved" && (
            <Link
              href="/seller/verification"
              className="block w-full text-center bg-brand-500 text-white rounded-xl py-2 text-sm font-bold hover:bg-brand-600 transition-colors mt-2"
            >
              Start Verification →
            </Link>
          )}
        </div>
      </div>

      {/* ── Top Listings ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-gray-800 dark:text-white">Top Listings This Week</h3>
          <Link href="/seller/listings" className="text-[13px] text-brand-500 font-semibold hover:underline">
            Manage all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : topListings.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <PackageIcon className="mx-auto mb-2 opacity-40" size={36} />
            <p className="text-sm">No listings yet. Add your first product!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {topListings.map((l) => {
              const score = healthScore(l);
              return (
                <div
                  key={l.id}
                  className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-800"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 flex-shrink-0 font-bold text-lg">
                    {l.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{l.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1"><Eye size={10} /> {l.view_count.toLocaleString()} views</span>
                      <span title={HEALTH_HINT} className="cursor-help">Health: <strong className={score > 70 ? "text-success-500" : "text-warning-500"}>{score}/100</strong></span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full mt-1.5 w-28 overflow-hidden">
                      <div
                        className={`h-full rounded-full origin-left ${score > 70 ? "bg-success-500" : "bg-warning-400"}`}
                        style={{ transform: `scaleX(${score / 100})` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-[14px] text-gray-800 dark:text-white">
                      {formatPrice(l.price)}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors(l.status)}`}>
                      {l.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

