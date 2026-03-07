"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { itemsApi, type Price } from "@/lib/api";
import { CategoryIcon } from "@/lib/categoryIcons";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(p: number) {
  return `₦${p.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-brand-500 p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="w-16 h-4 rounded-full bg-gray-200" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  );
}

// ─── Featured Card ────────────────────────────────────────────────────────────

function FeaturedCard({ item }: { item: Price }) {
  return (
    <Link href={`/listing/${item.id}`} className="block group">
      <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-brand-500 p-4 hover:shadow-md transition-shadow duration-200 relative h-full flex flex-col">
        {/* Promoted badge */}
        <span className="absolute top-3 right-3 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium leading-tight whitespace-nowrap">
          <Star size={10} className="inline-block fill-yellow-500 text-yellow-500" /> Promoted
        </span>

        {/* Icon */}
        <div className="mb-3">
          <CategoryIcon id={item.category_id} size={18} containerSize="w-10 h-10" />
        </div>

        {/* Name + Brand */}
        <p className="font-medium text-gray-900 text-sm truncate leading-snug group-hover:text-brand-500 transition-colors pr-16">
          {item.name}
        </p>
        {item.brand && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.brand}</p>
        )}

        {/* Price */}
        <p className="text-brand-500 font-semibold text-sm mt-2">
          {formatPrice(item.price)}
        </p>

        {/* Pack size */}
        {(item.pack_size || item.pack_unit) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {[item.pack_size, item.pack_unit].filter(Boolean).join(" ")}
          </p>
        )}

        {/* Retailer */}
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-auto pt-2 truncate">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">{item.retailer ?? "Campus Store"}</span>
        </p>
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeaturedSection() {
  const [items, setItems] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsApi
      .getFeatured(8)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // If not loading and empty, render nothing
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 xl:py-15">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        {/* Section header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white xl:text-2xl">
            Featured Products
          </h2>
          <Link
            href="/search?sort=featured"
            className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors"
          >
            View all →
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => <FeaturedCard key={item.id} item={item} />)}
        </div>
      </div>
    </section>
  );
}
