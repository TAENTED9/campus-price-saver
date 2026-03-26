"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userApi, itemsApi, flashSalesApi, type Category, type Price, type FlashSale } from "@/lib/api";
import { Star, Bell, Heart, ClipboardList, ChevronRight, Zap, TrendingUp } from "lucide-react";
import { getCategoryConfig } from "@/lib/categoryIcons";

const WL_KEY = "ps_wishlist";
function getWlCount(): number {
  if (typeof window === "undefined") return 0;
  try { return (JSON.parse(localStorage.getItem(WL_KEY) || "[]") as unknown[]).length; }
  catch { return 0; }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function BrowseMarketPage() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const verifiedPending = searchParams.get("verified") === "pending";

  const [balance, setBalance]               = useState<number | null>(null);
  const [submissionsCount, setSubmissions]  = useState<number | null>(null);
  const [alertsCount, setAlertsCount]       = useState<number | null>(null);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [flashSales, setFlashSales]         = useState<FlashSale[]>([]);
  const [trending, setTrending]             = useState<Price[]>([]);
  const [loading, setLoading]               = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    const publicFetches = Promise.all([
      itemsApi.getCategories().then(setCategories).catch(() => {}),
      flashSalesApi.getActive(4).then(setFlashSales).catch(() => {}),
      itemsApi.getTrending(6).then(setTrending).catch(() => {}),
    ]);

    if (token) {
      Promise.all([
        userApi.getPoints(token).then((r) => setBalance(r.balance)).catch(() => {}),
        userApi.getSubmissions(token).then((r) => setSubmissions(r.data.length)).catch(() => {}),
        userApi.getAlerts(token).then((r) => setAlertsCount(r.data.length)).catch(() => {}),
        publicFetches,
      ]).finally(() => setLoading(false));
    } else {
      publicFetches.finally(() => setLoading(false));
    }
  }, [token]);

  const stats = [
    {
      label: "Karma Points",
      value: loading ? "—" : (balance ?? 0).toLocaleString(),
      icon: <Star size={18} />,
      iconBg: "bg-warning-50 dark:bg-warning-500/10",
      iconColor: "text-warning-500",
      href: "/dashboard/settings",
    },
    {
      label: "Submissions",
      value: loading ? "—" : (submissionsCount ?? 0).toString(),
      icon: <ClipboardList size={18} />,
      iconBg: "bg-[#06b6d4]/10",
      iconColor: "text-[#06b6d4]",
      href: "/dashboard/submissions",
    },
    {
      label: "Price Alerts",
      value: loading ? "—" : (alertsCount ?? 0).toString(),
      icon: <Bell size={18} />,
      iconBg: "bg-brand-50 dark:bg-brand-500/10",
      iconColor: "text-brand-500",
      href: "/dashboard/alerts",
    },
    {
      label: "Wishlist",
      value: getWlCount().toString(),
      icon: <Heart size={18} />,
      iconBg: "bg-error-50 dark:bg-error-500/10",
      iconColor: "text-error-500",
      href: "/dashboard/wishlist",
    },
  ];

  const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]";

  return (
    <div className="space-y-6">

      {/* Seller verification pending banner */}
      {verifiedPending && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30">
          <ClipboardList size={18} className="text-warning-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-warning-800 dark:text-warning-300 text-sm">Seller verification submitted!</p>
            <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
              An admin will review your details. You&apos;ll be notified when your seller account is approved.
            </p>
          </div>
        </div>
      )}

      {/* Hero banner */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-brand-500 to-[#06b6d4] p-6 sm:p-8 text-white relative">
        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-white/80 text-sm mb-1">{greeting}, {user?.display_name || user?.username}</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Browse Market</h1>
          <p className="text-white/70 text-sm mb-5">
            UNILAG Campus · {categories.length > 0 ? `${categories.length} categories` : "All categories"}
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-white text-brand-600 font-bold text-sm rounded-full px-5 py-2.5 hover:bg-white/90 transition-opacity"
          >
            Search Prices <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`${CARD} p-5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${s.iconBg} ${s.iconColor}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Browse by Category</h2>
            <Link href="/search" className="text-[13px] text-brand-500 font-semibold hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {categories.slice(0, 8).map((cat) => (
              <Link
                key={cat.id}
                href={`/search?category_id=${cat.id}`}
                className={`${CARD} p-4 flex items-center gap-3 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-colors`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getCategoryConfig(cat.id).bg}`}>
                  {(() => { const { icon: Icon, color } = getCategoryConfig(cat.id); return <Icon size={18} className={color} strokeWidth={1.5} />; })()}
                </div>
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Flash Sales */}
      {flashSales.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-warning-500" />
              <h2 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Flash Sales</h2>
            </div>
            <span className="text-[11px] font-semibold text-warning-500 bg-warning-50 dark:bg-warning-500/10 px-2 py-0.5 rounded-full">
              Limited time
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {flashSales.map((sale) => {
              const timeLeft = new Date(sale.end_time).getTime() - Date.now();
              const hoursLeft = Math.max(0, Math.floor(timeLeft / 3_600_000));
              const minsLeft  = Math.max(0, Math.floor((timeLeft % 3_600_000) / 60_000));
              return (
                <Link
                  key={sale.id}
                  href={`/search?q=${encodeURIComponent(sale.item_name ?? "")}`}
                  className={`${CARD} p-4 flex items-center gap-4 hover:border-warning-300 dark:hover:border-warning-500/40 transition-colors`}
                >
                  <div className="w-12 h-12 rounded-xl bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center text-warning-500 font-black text-xl flex-shrink-0">
                    ⚡
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{sale.item_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{sale.item_retailer}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-black text-[15px] text-warning-600 dark:text-warning-400">{formatPrice(sale.sale_price)}</span>
                      <span className="text-[11px] line-through text-gray-400">{formatPrice(sale.original_price)}</span>
                      <span className="text-[10px] font-bold bg-warning-100 dark:bg-warning-500/20 text-warning-700 dark:text-warning-400 px-1.5 py-0.5 rounded-full">
                        -{sale.discount_pct}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400">Ends in</p>
                    <p className="font-bold text-[12px] text-error-500">
                      {hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-500" />
              <h2 className="font-extrabold text-[15px] text-gray-800 dark:text-white">Trending Now</h2>
            </div>
            <Link href="/search" className="text-[13px] text-brand-500 font-semibold hover:underline">
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {trending.map((item, idx) => (
              <Link
                key={item.id}
                href={`/search?q=${encodeURIComponent(item.name)}`}
                className={`${CARD} flex items-center gap-4 p-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors`}
              >
                <span className="w-6 text-center font-black text-[15px] text-gray-300 dark:text-gray-600 flex-shrink-0">
                  {idx + 1}
                </span>
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 font-black flex-shrink-0">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{item.name}</p>
                  {item.brand && <p className="text-[11px] text-gray-400 truncate">{item.brand}</p>}
                  {item.location && <p className="text-[11px] text-gray-400 truncate">📍 {item.location}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-[14px] text-gray-800 dark:text-white">{formatPrice(item.price)}</p>
                  {item.retailer && <p className="text-[11px] text-gray-400">{item.retailer}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
