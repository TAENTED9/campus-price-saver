"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Zap, Play, ShoppingBag } from "lucide-react";
import { flashSalesApi, type FlashSale } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import { thumbnailImage } from "@/lib/cloudinary";

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
      : `${pad(remaining.hours)}:${pad(remaining.minutes)}:${pad(remaining.seconds)}`;

  // Block 5/6A: cover_media is the new field; item_photo is the legacy fallback.
  const coverUrl = sale.cover_media ?? sale.item_photo ?? null;
  const isVideoThumb = sale.cover_media_kind === "video_thumb";
  const listingHref = `/listing/${sale.item_uuid ?? sale.price_id}`;

  return (
    <Link href={listingHref} className="block group h-full">
      <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        {/* Cover media */}
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-error-500 to-error-600 overflow-hidden">
          {coverUrl ? (
            <Image
              src={isVideoThumb ? coverUrl : thumbnailImage(coverUrl, 480)}
              alt={sale.item_name ?? sale.title ?? "Flash sale"}
              fill
              sizes="(max-width: 640px) 60vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              unoptimized={isVideoThumb}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90">
              <ShoppingBag size={28} strokeWidth={1.5} />
              <span className="mt-1 text-[10px] font-semibold tracking-widest uppercase">Campify</span>
            </div>
          )}

          {isVideoThumb && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                <Play size={14} className="fill-white text-white" />
              </span>
            </span>
          )}

          <span className="absolute top-2 right-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold shadow-md">
            -{Math.round(sale.discount_pct)}% OFF
          </span>

          <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isEndingSoon ? "bg-yellow-400 text-black" : "bg-black/65 text-white"}`}>
            <Zap size={9} className={isEndingSoon ? "fill-black" : "fill-white"} />
            <span className="tabular-nums">{countdownLabel}</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-3 flex-1 flex flex-col">
          <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug min-h-[2.6em] mb-1">
            {sale.item_name ?? sale.title ?? "Flash Sale Item"}
          </p>
          {sale.item_brand && (
            <p className="text-xs text-gray-400 truncate mb-1">{sale.item_brand}</p>
          )}

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-black text-red-600 dark:text-red-400">
              {formatPrice(sale.sale_price)}
            </span>
            <span className="text-[11px] line-through text-gray-400">
              {formatPrice(sale.original_price)}
            </span>
          </div>

          {(sale.item_retailer || sale.item_location) && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-2 truncate">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{sale.item_retailer ?? sale.item_location}</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
      <div className="aspect-[4/3] bg-gray-200 dark:bg-gray-800 animate-pulse" />
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3 mt-1" />
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
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap size={20} className="text-red-500" />
            <span>Flash Sales</span>
          </h2>
          <Link
            href="/deals"
            className="text-sm text-brand-500 dark:text-brand-400 font-medium hover:underline transition-colors"
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
