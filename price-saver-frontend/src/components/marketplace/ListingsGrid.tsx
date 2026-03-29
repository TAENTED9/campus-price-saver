"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { itemsApi, type SearchFilters } from "@/lib/api";
import ListingCard from "./ListingCard";
import ListingCardSkeleton from "./ListingCardSkeleton";

export interface ListingsGridProps {
  category?: string;
}

// Extended shape — the backend returns more fields than the TS Price type declares.
// All extra fields are optional so fallbacks handle missing data gracefully.
interface MarketplaceItem {
  id: number;
  name: string;
  price: number;
  condition?: string | null;
  photos?: string[] | null;
  view_count?: number | null;
  submitted_at?: string | null;
  category_id?: number | null;
  retailer?: string | null;
  location?: string | null;
  listing_status?: string | null;
  seller?: {
    username?: string;
    display_name?: string;
    is_verified?: boolean;
    verified?: boolean;
  } | null;
}

// Map CategoryBar slugs → SearchFilters.
// category_id values match seed order in main.py:
//   1=Food & Groceries  2=Drinks & Beverages  3=Fashion & Clothing
//   4=Tech & Gadgets    5=Books & Stationery  6=Beauty & Personal Care
//   7=Services & Skills
const SLUG_TO_FILTER: Record<string, SearchFilters> = {
  all:      {},
  food:     { category_id: 1 },
  fashion:  { category_id: 3 },
  tech:     { category_id: 4 },
  books:    { category_id: 5 },
  beauty:   { category_id: 6 },
  services: { category_id: 7 },
  handmade: { q: "handmade" },
  hostel:   { q: "hostel"   },
};

const PAGE_SIZE = 12;

function normaliseCondition(raw?: string | null): "new" | "fairly_used" | "used" {
  switch ((raw ?? "").toLowerCase()) {
    case "new":          return "new";
    case "fairly used":
    case "fairly_used":  return "fairly_used";
    default:             return "used";
  }
}

export default function ListingsGrid({ category = "all" }: ListingsGridProps) {
  const [items, setItems]       = useState<MarketplaceItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(true);

  const fetchPage = useCallback(
    async (skip: number, replace: boolean) => {
      const base = SLUG_TO_FILTER[category] ?? {};
      const filters: SearchFilters = { ...base, skip, limit: PAGE_SIZE, sort: "newest" };

      try {
        const results = await itemsApi.searchPrices(filters);
        const typed = results as unknown as MarketplaceItem[];
        if (replace) {
          setItems(typed);
        } else {
          setItems((prev) => [...prev, ...typed]);
        }
        setHasMore(typed.length === PAGE_SIZE);
        setError(null);
      } catch {
        setError("Couldn't load listings. Please try again.");
      }
    },
    [category]
  );

  // Re-fetch from scratch when category changes
  useEffect(() => {
    setLoading(true);
    setItems([]);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await fetchPage(items.length, false);
    setLoadingMore(false);
  }

  if (error) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); fetchPage(0, true).finally(() => setLoading(false)); }}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))
          : items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index, 7) * 0.05 }}
              >
                <ListingCard
                  id={item.id}
                  title={item.name}
                  price={item.price}
                  condition={normaliseCondition(item.condition)}
                  imageUrl={item.photos?.[0] ?? ""}
                  sellerName={
                    item.seller?.display_name ||
                    item.seller?.username ||
                    item.retailer ||
                    "Campus Seller"
                  }
                  sellerVerified={item.seller?.is_verified ?? item.seller?.verified ?? false}
                  category={String(item.category_id ?? "")}
                  createdAt={item.submitted_at ?? new Date().toISOString()}
                  viewsCount={item.view_count ?? 0}
                />
              </motion.div>
            ))}
      </div>

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <ShoppingCart size={40} strokeWidth={1.25} className="text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            No listings found in this category yet.
          </p>
        </div>
      )}

      {/* Load more */}
      {!isLoading && hasMore && items.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-8 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 rounded-xl hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all disabled:opacity-50"
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
