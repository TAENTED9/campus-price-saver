"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Zap, Flame } from "lucide-react";
import { flashSalesApi, type FlashSale } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";

function getTimeRemaining(endTime: string) {
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

function FlashSaleCard({ sale, onExpire }: { sale: FlashSale; onExpire: (id: number) => void }) {
  const remaining = useCountdown(sale.end_time);

  useEffect(() => {
    if (remaining.total <= 0) onExpire(sale.id);
  }, [remaining.total, sale.id, onExpire]);

  const isEndingSoon = remaining.total > 0 && remaining.total < 3600 * 1000;
  const countdown =
    remaining.total <= 0
      ? "Expired"
      : `${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  return (
    <Link href={`/listing/${sale.price_id}`} className="group block">
      <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 hover:shadow-lg transition-shadow relative h-full flex flex-col min-h-[240px]">
        <span className="absolute top-3 right-3 text-[10px] bg-white text-red-600 px-2 py-0.5 rounded-full font-bold">
          -{Math.round(sale.discount_pct)}% OFF
        </span>

        <p className="font-bold text-white text-base leading-snug pr-16 truncate">
          {sale.item_name ?? sale.title ?? "Flash Sale"}
        </p>
        {sale.item_brand && <p className="text-white/75 text-xs mt-0.5 truncate">{sale.item_brand}</p>}

        <div className="mt-3">
          <p className="text-white/60 line-through text-sm">{formatPrice(sale.original_price)}</p>
          <p className="text-white font-black text-2xl">{formatPrice(sale.sale_price)}</p>
        </div>

        {(sale.item_retailer || sale.item_location) && (
          <p className="text-white/80 text-xs flex items-center gap-1 mt-2 truncate">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{sale.item_retailer ?? sale.item_location}</span>
          </p>
        )}

        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className={`text-xs font-semibold tabular-nums ${isEndingSoon ? "text-yellow-200" : "text-white/85"}`}>
            {countdown}
          </span>
          <span className="inline-flex items-center bg-white text-red-600 rounded-full text-xs font-semibold px-3 py-1 group-hover:bg-gray-100 transition-colors">
            Shop Now →
          </span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-gradient-to-br from-red-200 to-rose-300 rounded-xl p-5 animate-pulse min-h-[240px] flex flex-col">
      <div className="h-4 bg-white/40 rounded w-2/3 mb-3" />
      <div className="h-3 bg-white/30 rounded w-1/3 mb-4" />
      <div className="h-4 bg-white/30 rounded w-1/4 mb-1" />
      <div className="h-8 bg-white/40 rounded w-1/2" />
      <div className="mt-auto pt-4 flex items-center justify-between">
        <div className="h-3 bg-white/30 rounded w-1/4" />
        <div className="h-7 bg-white/40 rounded-full w-24" />
      </div>
    </div>
  );
}

export default function DealsPage() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    flashSalesApi
      .getActive(60)
      .then((data) => { setSales(data); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load deals"))
      .finally(() => setLoading(false));
  }, []);

  const handleExpire = (id: number) => setSales((prev) => prev.filter((s) => s.id !== id));

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 xl:px-0 py-8 xl:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-red-500 mb-2">
          <Flame size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Limited-Time Deals</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Zap size={28} className="text-red-500" />
          Flash Sales
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xl">
          Discounts ending soon from verified campus sellers. Grab them before the timer runs out.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] py-20 text-center">
          <Zap size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-base font-semibold text-gray-700 dark:text-white/80">No active flash sales</p>
          <p className="text-sm text-gray-500 mt-1">Check back soon — sellers launch new deals every day.</p>
          <Link href="/" className="inline-block mt-5 rounded-lg bg-brand-500 text-white text-sm font-semibold px-5 py-2.5 hover:bg-brand-600 transition-colors">
            Browse all listings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sales.map((sale) => (
            <FlashSaleCard key={sale.id} sale={sale} onExpire={handleExpire} />
          ))}
        </div>
      )}
    </main>
  );
}
