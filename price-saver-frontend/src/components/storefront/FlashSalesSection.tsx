"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Zap } from "lucide-react";
import { flashSalesApi, type FlashSale } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(p: number) {
  return `₦${p.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getTimeRemaining(endTime: string): {
  total: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const total = new Date(endTime).getTime() - Date.now();
  if (total <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor(total / 1000 / 60 / 60);
  return { total, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Countdown Hook ───────────────────────────────────────────────────────────

function useCountdown(endTime: string) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(endTime));

  useEffect(() => {
    const tick = () => setRemaining(getTimeRemaining(endTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return remaining;
}

// ─── Flash Sale Card ──────────────────────────────────────────────────────────

function FlashSaleCard({
  sale,
  onExpire,
}: {
  sale: FlashSale;
  onExpire: (id: number) => void;
}) {
  const remaining = useCountdown(sale.end_time);

  useEffect(() => {
    if (remaining.total <= 0) {
      onExpire(sale.id);
    }
  }, [remaining.total, sale.id, onExpire]);

  const isEndingSoon = remaining.total > 0 && remaining.total < 3600 * 1000;
  const countdownLabel =
    remaining.total <= 0
      ? "Expired"
      : isEndingSoon
      ? "Ending soon!"
      : `${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  return (
    <Link href={`/listing/${sale.price_id}`} className="block group">
      <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 hover:shadow-md transition-shadow duration-200 relative h-full flex flex-col min-h-[200px]">
        {/* Discount badge */}
        <span className="absolute top-3 right-3 text-[10px] bg-white text-red-600 px-2 py-0.5 rounded-full font-bold leading-tight whitespace-nowrap">
          -{Math.round(sale.discount_pct)}% OFF
        </span>

        {/* Item name */}
        <p className="font-bold text-white text-sm leading-snug pr-16 truncate">
          {sale.item_name ?? sale.title ?? "Flash Sale Item"}
        </p>

        {/* Brand */}
        {sale.item_brand && (
          <p className="text-white/70 text-xs mt-0.5 truncate">{sale.item_brand}</p>
        )}

        {/* Prices */}
        <div className="mt-2">
          <p className="text-white/60 line-through text-sm leading-tight">
            {formatPrice(sale.original_price)}
          </p>
          <p className="text-white font-bold text-xl leading-tight">
            {formatPrice(sale.sale_price)}
          </p>
        </div>

        {/* Retailer */}
        {(sale.item_retailer || sale.item_location) && (
          <p className="text-white/70 text-xs flex items-center gap-1 mt-1 truncate">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">
              {sale.item_retailer ?? sale.item_location}
            </span>
          </p>
        )}

        {/* Countdown */}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${
              isEndingSoon || remaining.total <= 0
                ? "text-yellow-200"
                : "text-white/80"
            }`}
          >
            {countdownLabel}
          </span>

          {/* Shop Now button */}
          <span className="inline-flex items-center bg-white text-red-600 rounded-full text-sm font-medium px-4 py-1.5 group-hover:bg-gray-100 transition-colors shrink-0">
            Shop Now →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-gradient-to-br from-red-200 to-rose-300 rounded-xl p-4 animate-pulse min-h-[200px] flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 bg-white/40 rounded w-2/3" />
        <div className="w-14 h-5 bg-white/40 rounded-full" />
      </div>
      <div className="h-3 bg-white/30 rounded w-1/3 mb-4" />
      <div className="h-4 bg-white/30 rounded w-1/4 mb-1" />
      <div className="h-7 bg-white/40 rounded w-1/2 mb-4" />
      <div className="mt-auto flex items-center justify-between">
        <div className="h-3 bg-white/30 rounded w-1/4" />
        <div className="h-8 bg-white/40 rounded-full w-24" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FlashSalesSection() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    flashSalesApi
      .getActive(6)
      .then(setSales)
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, []);

  const handleExpire = (id: number) => {
    setSales((prev) =>
      prev.filter((s) => s.id !== id)
    );
  };

  if (!loading && sales.length === 0) {
    return null;
  }

  return (
    <section className="py-12 xl:py-15">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white xl:text-2xl flex items-center gap-2">
            <Zap size={20} className="text-red-500" />
            <span>Flash Sales</span>
          </h2>
          <Link
            href="/deals"
            className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
          >
            View all →
          </Link>
        </div>

        {/* Grid — horizontal scroll on mobile, 2×3 on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-x-visible">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[260px] sm:min-w-0">
                  <SkeletonCard />
                </div>
              ))
            : sales.map((sale) => (
                <div key={sale.id} className="min-w-[260px] sm:min-w-0">
                  <FlashSaleCard sale={sale} onExpire={handleExpire} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
