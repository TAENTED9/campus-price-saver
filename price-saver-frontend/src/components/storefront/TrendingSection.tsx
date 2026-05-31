"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { itemsApi, type Price } from "@/lib/api";
import ListingCard from "@/components/marketplace/ListingCard";
import ListingCardSkeleton from "@/components/marketplace/ListingCardSkeleton";

function normaliseCondition(raw?: string | null): "new" | "fairly_used" | "used" {
  switch ((raw ?? "").toLowerCase()) {
    case "new":         return "new";
    case "fairly used":
    case "fairly_used": return "fairly_used";
    default:            return "used";
  }
}

export default function TrendingSection() {
  const [items, setItems] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsApi
      .getTrending(8)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) {
    return (
      <section className="py-12 xl:py-15">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 xl:px-8 2xl:px-0">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white xl:text-2xl">
              Trending on Campus
            </h2>
            <Link href="/search?sort=trending" className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors">
              View all →
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Flame size={40} className="text-orange-400 mb-3" />
            <p className="text-sm">Nothing trending yet. Be the first to explore!</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 xl:py-15">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 xl:px-8 2xl:px-0">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white xl:text-2xl">
            Trending on Campus
          </h2>
          <Link href="/search?sort=trending" className="text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
            : items.map((item) => (
                <ListingCard
                  // FIX #12: namespace so duplicate ids across sections never collide.
                  key={`trending-${item.id}`}
                  id={item.id}
                  uuid={item.uuid}
                  title={item.name}
                  price={item.price}
                  condition={normaliseCondition(item.condition)}
                  imageUrl={item.photos?.[0] ?? ""}
                  sellerName={item.retailer ?? "Campus Store"}
                  sellerVerified={false}
                  category={String(item.category_id)}
                  createdAt={item.submitted_at ?? new Date().toISOString()}
                  viewsCount={item.view_count ?? 0}
                  isNegotiable={item.is_negotiable ?? false}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
