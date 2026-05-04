"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Package } from "lucide-react";
import { itemsApi, type Price } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";
import { formatPrice } from "@/lib/formatPrice";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = [
  "All Locations",
  "Moremi",
  "Fagunwa",
  "Jaja",
  "ETF",
  "Faculty of Science",
  "Faculty of Arts",
  "Faculty of Engineering",
  "Opposite Buka",
  "Amina",
];

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
      <div className="w-full aspect-[4/3] rounded-lg bg-gray-100 dark:bg-gray-800 mb-3" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-2" />
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    </div>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

type ListingPrice = Price & { condition?: string; photos?: string[]; listing_status?: string };

function ListingCard({ item }: { item: ListingPrice }) {
  const photo = item.photos?.[0];

  return (
    <Link href={`/listing/${item.id}`} className="block group">
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-500/40 overflow-hidden transition-colors h-full flex flex-col">
        {/* Photo / icon placeholder */}
        <div className="w-full aspect-[4/3] bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
          {photo ? (
            <img src={photo} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <CategoryIcon id={item.category_id} size={32} containerSize="w-16 h-16" />
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <p className="font-semibold text-sm text-gray-800 dark:text-white truncate leading-snug group-hover:text-brand-500 transition-colors">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NearbySellersSection() {
  const [selected, setSelected] = useState("All Locations");
  const [items, setItems] = useState<ListingPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const location = selected === "All Locations" ? undefined : selected;
    itemsApi
      .searchPrices({ location, limit: 8 })
      .then((data) => setItems(data as ListingPrice[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin size={20} className="text-brand-500 inline-block align-text-bottom" />
            Nearby Sellers
          </h2>
          <Link href="/search" className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors">
            View all →
          </Link>
        </div>

        {/* Location chips — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setSelected(loc)}
              className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                selected === loc
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Package size={40} className="text-gray-300" />
            <p className="text-sm text-center">
              No listings found near <span className="font-medium">{selected === "All Locations" ? "campus" : selected}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => <ListingCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
