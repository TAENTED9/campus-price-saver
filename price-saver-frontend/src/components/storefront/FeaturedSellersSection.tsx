"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Package } from "lucide-react";
import { storefrontApi } from "@/lib/api";

type FeaturedSeller = {
  id: number;
  display_name: string;
  avatar_url?: string | null;
  slug?: string | null;
  category?: string | null;
  listing_count?: number;
};

export default function FeaturedSellersSection() {
  const [sellers, setSellers] = useState<FeaturedSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storefrontApi
      .getPlatformStats()
      .then(() => {
        // Try fetching featured sellers from the storefront API
        return fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/storefront/featured?limit=6`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (Array.isArray(data)) setSellers(data);
            else if (data?.data && Array.isArray(data.data)) setSellers(data.data);
          });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Don't render section if no sellers
  if (!loading && sellers.length === 0) return null;

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
            Top Sellers This Month
          </h2>
          <Link
            href="/search?sort=top_sellers"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            See all &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800 mb-3" />
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 -mt-9 ml-3 mb-2" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {sellers.map((seller) => {
              const initial = (seller.display_name?.[0] ?? "S").toUpperCase();
              return (
                <Link
                  key={seller.id}
                  href={seller.slug ? `/store/${seller.slug}` : `/store/${seller.id}`}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Cover strip */}
                  <div className="h-16 rounded-xl overflow-hidden relative bg-gradient-to-r from-blue-500 to-cyan-400" />

                  {/* Avatar */}
                  <div className="-mt-6 ml-3 w-12 h-12 rounded-full border-2 border-white dark:border-gray-900 ring-2 ring-blue-500 overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-500 relative z-10">
                    {seller.avatar_url ? (
                      <Image
                        src={seller.avatar_url}
                        alt={seller.display_name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-black text-sm">{initial}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="mt-2">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        {seller.display_name}
                      </p>
                      <ShieldCheck size={12} className="text-blue-500 flex-shrink-0" />
                    </div>
                    {seller.category && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{seller.category}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-500">
                      <Package size={10} />
                      <span>{seller.listing_count ?? 0} listings</span>
                    </div>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-2 group-hover:underline">
                      Visit Store &rarr;
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
