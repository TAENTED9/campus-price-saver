"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { userApi, itemsApi, flashSalesApi, type FlashSale } from "@/lib/api";
import { Bell, Heart, ClipboardList, Zap, TrendingUp, Store, MapPin } from "lucide-react";
// import { Star } from "lucide-react"; // karma — re-enable when implemented
import MarketplaceFeed from "@/components/marketplace/MarketplaceFeed";
import HowItWorks from "@/components/marketplace/HowItWorks";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Block 2: wishlist count comes from the server.

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// Price type extended with fields the backend returns but TS type omits
interface TrendingItem {
  id: number;
  name: string;
  price: number;
  brand?: string | null;
  retailer?: string | null;
  location?: string | null;
}

export default function BrowseMarketPage() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const verifiedPending = searchParams.get("verified") === "pending";

  // const [balance, setBalance]           = useState<number | null>(null); // karma — re-enable when implemented
  const [submissionsCount, setSubmissions] = useState<number | null>(null);
  const [alertsCount, setAlertsCount]      = useState<number | null>(null);
  const [wishlistCount, setWishlistCount]  = useState<number>(0);
  const [flashSales, setFlashSales]        = useState<FlashSale[]>([]);
  const [trending, setTrending]            = useState<TrendingItem[]>([]);
  const [loading, setLoading]              = useState(true);

  useEffect(() => {
    const publicFetches = Promise.all([
      flashSalesApi.getActive(4).then(setFlashSales).catch(() => {}),
      itemsApi.getTrending(6).then((r) => setTrending(r as unknown as TrendingItem[])).catch(() => {}),
    ]);

    if (token) {
      Promise.all([
        // userApi.getPoints(token).then((r) => setBalance(r.balance)).catch(() => {}), // karma — re-enable when implemented
        userApi.getSubmissions(token).then((r) => setSubmissions(r.data.length)).catch(() => {}),
        userApi.getAlerts(token).then((r) => setAlertsCount(r.data.length)).catch(() => {}),
        userApi.getDashboardStats(token).then((s) => setWishlistCount(s.wishlist_count ?? 0)).catch(() => {}),
        publicFetches,
      ]).finally(() => setLoading(false));
    } else {
      publicFetches.finally(() => setLoading(false));
    }
  }, [token]);

  // karma — re-enable when investors are onboard:
  // const karmaPoints = balance ?? 0;
  // const karmaTier = karmaPoints >= 2000 ? "Gold" : karmaPoints >= 500 ? "Silver" : "Bronze";
  // const tierColors: Record<string, string> = {
  //   Bronze: "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
  //   Silver: "bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300",
  //   Gold:   "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
  // };

  const stats = [
    // Karma Points card — re-enable when investors are onboard:
    // {
    //   label: "Karma Points",
    //   value: loading ? "---" : (balance ?? 0).toLocaleString(),
    //   icon: <Star size={18} />,
    //   iconBg: "bg-warning-50 dark:bg-warning-500/10",
    //   iconColor: "text-warning-500",
    //   href: "/dashboard/settings",
    //   badge: loading ? null : karmaTier,
    //   badgeClass: tierColors[karmaTier] || "",
    // },
    {
      label: "Submissions",
      value: loading ? "---" : (submissionsCount ?? 0).toString(),
      icon: <ClipboardList size={18} />,
      iconBg: "bg-brand-500/10",
      iconColor: "text-brand-400",
      href: "/dashboard/submissions",
      badge: null as string | null,
      badgeClass: "",
    },
    {
      label: "Price Alerts",
      value: loading ? "---" : (alertsCount ?? 0).toString(),
      icon: <Bell size={18} />,
      iconBg: "bg-warning-500/10",
      iconColor: "text-warning-400",
      href: "/dashboard/alerts",
      badge: null as string | null,
      badgeClass: "",
    },
    {
      label: "Wishlist",
      value: loading ? "---" : wishlistCount.toString(),
      icon: <Heart size={18} />,
      iconBg: "bg-error-500/10",
      iconColor: "text-error-400",
      href: "/dashboard/wishlist",
      badge: null as string | null,
      badgeClass: "",
    },
  ];

  const CARD = "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900";

  return (
    <div className="p-6 space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-0.5">{getGreeting()}, {user?.display_name || user?.username || "there"}</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Buyer Dashboard</h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors min-h-[44px]"
        >
          <Store size={16} />
          <span className="hidden sm:inline">Browse Marketplace</span>
        </Link>
      </div>

      {/* Seller verification pending banner */}
      {verifiedPending && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-warning-500/10 border border-warning-500/30">
          <ClipboardList size={18} className="text-warning-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-warning-800 dark:text-warning-300 text-sm">
              Seller verification submitted!
            </p>
            <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
              An admin will review your details. You&apos;ll be notified when your seller account is approved.
            </p>
          </div>
        </div>
      )}

      <div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`${CARD} p-5 flex flex-col gap-3 hover:border-brand-700 transition-colors min-h-[44px]`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.iconBg} flex-shrink-0`}>
                <span className={s.iconColor}>{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{s.value}</p>
              <p className="text-sm text-gray-400">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* 3 & 4. Category Bar + Listings Grid (client shell owns category state) */}
        <MarketplaceFeed />

        {/* 5. Flash Sales */}
        {flashSales.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-warning-500" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  Flash Sales
                </h2>
              </div>
              <span className="text-xs font-semibold text-warning-400 bg-warning-500/10 px-2 py-0.5 rounded-full">
                Limited time
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {flashSales.map((sale) => {
                const timeLeft  = new Date(sale.end_time).getTime() - Date.now();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / 3_600_000));
                const minsLeft  = Math.max(0, Math.floor((timeLeft % 3_600_000) / 60_000));
                return (
                  <Link
                    key={sale.id}
                    href={`/search?q=${encodeURIComponent(sale.item_name ?? "")}`}
                    className={`${CARD} p-4 flex items-center gap-4 hover:border-warning-500/40 transition-colors`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-warning-500/10 flex items-center justify-center text-warning-400 flex-shrink-0">
                      <Zap size={22} />
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
          </section>
        )}

        {/* 6. Trending */}
        {trending.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-400" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                  Trending Now
                </h2>
              </div>
              <Link href="/search" className="text-sm text-brand-400 font-medium hover:underline transition-colors">
                See all →
              </Link>
            </div>
            <div className="space-y-2">
              {trending.map((item, idx) => (
                <Link
                  key={item.id}
                  href={`/search?q=${encodeURIComponent(item.name)}`}
                  className={`${CARD} flex items-center gap-4 p-4 hover:border-brand-700 transition-colors`}
                >
                  <span className="w-6 text-center font-black text-[15px] text-gray-400 dark:text-gray-600 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 font-black flex-shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">{item.name}</p>
                    {item.brand    && <p className="text-[11px] text-gray-400 truncate">{item.brand}</p>}
                    {item.location && <p className="text-[11px] text-gray-400 truncate flex items-center gap-1"><MapPin size={10} />{item.location}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-[14px] text-gray-800 dark:text-white">{formatPrice(item.price)}</p>
                    {item.retailer && <p className="text-[11px] text-gray-400">{item.retailer}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* 7. How It Works — full-width section outside content padding */}
      <div>
        <HowItWorks />
      </div>

    </div>
  );
}
