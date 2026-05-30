"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Zap, Flame, Play, ShoppingBag } from "lucide-react";
import { flashSalesApi, type FlashSale } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import { thumbnailImage } from "@/lib/cloudinary";

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

  // Block 5/6A: prefer the new `cover_media` field; fall back to legacy
  // `item_photo` for older API responses still in flight.
  const coverUrl = sale.cover_media ?? sale.item_photo ?? null;
  const isVideoThumb = sale.cover_media_kind === "video_thumb";
  // Use the UUID-based listing route when available; old API still returns numeric id.
  const listingHref = `/listing/${sale.item_uuid ?? sale.price_id}`;

  return (
    <Link href={listingHref} className="group block h-full">
      <div className="rounded-xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow h-full flex flex-col">
        {/* Cover media — 4:3 to match the rest of the marketplace cards. */}
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-red-500 to-rose-600 overflow-hidden">
          {coverUrl ? (
            <Image
              src={isVideoThumb ? coverUrl : thumbnailImage(coverUrl, 480)}
              alt={sale.item_name ?? sale.title ?? "Flash sale"}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              unoptimized={isVideoThumb}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90">
              <ShoppingBag size={32} strokeWidth={1.5} />
              <span className="mt-1 text-[10px] font-semibold tracking-widest uppercase">Campify</span>
            </div>
          )}

          {/* Play-icon overlay if the cover is a video frame */}
          {isVideoThumb && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
                <Play size={16} className="fill-white text-white" />
              </span>
            </span>
          )}

          {/* Discount badge overlays the image (top-right) */}
          <span className="absolute top-2 right-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold shadow-md">
            -{Math.round(sale.discount_pct)}% OFF
          </span>

          {/* Countdown ribbon (bottom-left, lives on the image like a sale badge) */}
          <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isEndingSoon ? "bg-yellow-400 text-black" : "bg-black/65 text-white"}`}>
            <Zap size={9} className={isEndingSoon ? "fill-black" : "fill-white"} />
            <span className="tabular-nums">{countdown}</span>
          </span>
        </div>

        {/* Card body */}
        <div className="p-4 flex-1 flex flex-col">
          <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug min-h-[2.6em] mb-1.5">
            {sale.item_name ?? sale.title ?? "Flash Sale"}
          </p>
          {sale.item_brand && (
            <p className="text-xs text-gray-400 truncate mb-1">{sale.item_brand}</p>
          )}

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-black text-red-600 dark:text-red-400">
              {formatPrice(sale.sale_price)}
            </span>
            <span className="text-xs line-through text-gray-400">
              {formatPrice(sale.original_price)}
            </span>
          </div>

          {(sale.item_retailer || sale.item_location) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-2 truncate">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{sale.item_retailer ?? sale.item_location}</span>
            </p>
          )}

          <div className="mt-auto pt-3">
            <span className="inline-flex w-full items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold px-3 py-2 transition-colors">
              Shop Now →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-800 animate-pulse" />
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3 mt-1" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full mt-auto" />
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
      .getActive(50)
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
