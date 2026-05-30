/**
 * Homepage — "Find Nearby Sellers"
 *
 * Replaces the legacy NearbySellersSection (hardcoded location chips) AND
 * the older HomepageLocationShortcut (auto-navigated on chip click).
 *
 * Behaviour, per product owner:
 *   1. Default state ("All campus" chip selected) → top 6 newest listings overall.
 *   2. Clicking a parent zone chip → inline preview of top 6 listings whose
 *      canonical locations array contains ANY child of that zone. We DO NOT
 *      navigate away on chip click — the user sees the result on the homepage.
 *   3. Below the preview, a "View more in <zone>" button → /search?locations=…
 *      so the user can see the full filtered set on the search page.
 *
 * The chips themselves come from the canonical 5-zone tree returned by
 * GET /api/locations — they auto-sync if the backend's hierarchy changes.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MapPin, Package, ArrowRight } from "lucide-react";
import { itemsApi, type Price } from "@/lib/api";
import { useLocations, type LocationGroup } from "@/lib/locations";
import { CategoryIcon } from "@/lib/categoryIcons";
import { formatPrice } from "@/lib/formatPrice";
import { thumbnailImage } from "@/lib/cloudinary";

const PREVIEW_LIMIT = 6;

type ListingPreview = Price & { photos?: string[]; locations?: string[] | null };

function PreviewCard({ item }: { item: ListingPreview }) {
  const photo = item.photos?.[0];
  return (
    <Link href={`/listing/${item.uuid ?? item.id}`} className="group block h-full">
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-500/40 overflow-hidden transition-colors h-full flex flex-col">
        <div className="relative aspect-[4/3] w-full bg-gray-50 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
          {photo ? (
            <Image
              src={thumbnailImage(photo, 400)}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <CategoryIcon id={item.category_id} size={32} containerSize="w-16 h-16" />
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <p className="font-semibold text-sm text-gray-800 dark:text-white line-clamp-2 leading-snug min-h-[2.6em] group-hover:text-brand-500 transition-colors">
            {item.name}
          </p>
          {item.location && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{item.location}</span>
            </p>
          )}
          <p className="text-sm font-black text-brand-600 dark:text-brand-400 mt-auto pt-2">
            {formatPrice(item.price)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden h-full flex flex-col">
      <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3 mt-1" />
      </div>
    </div>
  );
}

export default function FindNearbySellersSection() {
  const { groups, loading: groupsLoading } = useLocations();
  const router = useRouter();

  // Selected zone — null means "All campus".
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [items, setItems] = useState<ListingPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const activeZone: LocationGroup | null = useMemo(
    () => (activeKey ? groups.find((g) => g.key === activeKey) ?? null : null),
    [activeKey, groups],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const filters = activeZone
      ? { locations: activeZone.children, limit: PREVIEW_LIMIT }
      : { limit: PREVIEW_LIMIT };

    itemsApi
      .searchPrices(filters)
      .then((data) => {
        if (cancelled) return;
        setItems((data as ListingPreview[]) ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeZone]);

  const viewMoreHref = activeZone
    ? `/search?locations=${encodeURIComponent(activeZone.children.join(","))}`
    : "/search";

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin size={20} className="text-brand-500 inline-block align-text-bottom" />
            Find Nearby Sellers
          </h2>
          <Link href="/search" className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors hidden sm:inline">
            Browse everything →
          </Link>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xl">
          Pick a UNILAG zone to see listings that meet there. Tap a zone for a quick preview, then tap <em>View more</em> to see them all.
        </p>

        {/* Zone chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setActiveKey(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeKey === null
                ? "bg-brand-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All campus
          </button>
          {groupsLoading && groups.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={`zone-skel-${i}`}
                  className="h-9 w-32 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse shrink-0"
                />
              ))
            : groups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveKey(g.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    activeKey === g.key
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {g.name}
                </button>
              ))}
        </div>

        {/* Preview grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {Array.from({ length: PREVIEW_LIMIT }).map((_, i) => (
              <SkeletonCard key={`nearby-skel-${i}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3 bg-gray-50 dark:bg-white/[0.02] rounded-2xl">
            <Package size={40} className="text-gray-300" />
            <p className="text-sm text-center">
              {activeZone
                ? `No listings yet in ${activeZone.name}.`
                : "No listings yet — check back soon."}
            </p>
            {activeZone && (
              <button
                type="button"
                onClick={() => setActiveKey(null)}
                className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
              >
                Back to All campus
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              {items.map((item) => (
                <PreviewCard key={`nearby-${item.id}`} item={item} />
              ))}
            </div>

            {/* View more — only meaningful when a zone is picked */}
            {activeZone && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => router.push(viewMoreHref)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition-colors shadow-sm"
                >
                  View more in {activeZone.name}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
