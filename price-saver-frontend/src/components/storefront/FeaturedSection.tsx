"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 xl:py-15">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 xl:px-8 2xl:px-0">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
            : items.map((item) => (
                <ListingCard
                  // FIX #12: namespace key to avoid cross-section duplicate-id warnings.
                  key={`featured-${item.id}`}
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
                  isFeatured
                />
              ))}
        </div>
      </div>
    </section>
  );
}
