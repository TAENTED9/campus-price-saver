"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { wishlistApi } from "@/lib/api";
import { thumbnailImage } from "@/lib/cloudinary";
import { Heart, Trash2, MapPin, TrendingDown, Search } from "lucide-react";

type WishlistItem = {
  wishlist_id: number;
  listing_id: number;
  name: string;
  price: number;
  saved_price?: number | null;
  location?: string | null;
  listing_status: string;
  photos: string[];
  uuid?: string | null;
  saved_at: string;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]";

export default function WishlistPage() {
  const { token } = useAuth();
  const [items, setItems]   = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  const fetchWishlist = useCallback(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    wishlistApi.list(token)
      .then((data) => setItems(data as unknown as WishlistItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  async function handleRemove(listingId: number) {
    if (!token) return;
    setRemoving(listingId);
    try {
      await wishlistApi.toggle(token, listingId);
      setItems((prev) => prev.filter((i) => i.listing_id !== listingId));
    } catch { /* silent */ }
    finally { setRemoving(null); }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight flex items-center gap-2">
            <Heart size={22} className="text-error-500" /> My Wishlist
            {items.length > 0 && (
              <span className="bg-error-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {items.length}
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "Loading…" : `${items.length} saved ${items.length === 1 ? "item" : "items"}`}
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-4 py-2 text-sm font-bold hover:opacity-90 transition-opacity min-h-[40px]"
        >
          <Search size={14} /> Browse
        </Link>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`${CARD} animate-pulse`}>
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-t-2xl" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 bg-gray-100 dark:bg-gray-700 rounded" />
                <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className={`${CARD} p-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-error-50 dark:bg-error-500/10 flex items-center justify-center mx-auto mb-4">
            <Heart size={28} className="text-error-400" />
          </div>
          <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">Your wishlist is empty</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-5">
            Tap the heart icon on any listing to save it here for later.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Start Browsing
          </Link>
        </div>
      )}

      {/* Items grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const photo = item.photos?.[0];
            const priceDrop = item.saved_price != null && item.price < item.saved_price;
            return (
              <div key={item.wishlist_id} className={`${CARD} relative overflow-hidden flex flex-col`}>
                {/* Price drop banner */}
                {priceDrop && (
                  <div className="absolute top-0 left-0 right-0 z-10 bg-green-500 text-white text-[10px] font-bold px-2 py-1 flex items-center gap-1">
                    <TrendingDown size={10} /> Price dropped!
                  </div>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.listing_id)}
                  disabled={removing === item.listing_id}
                  aria-label="Remove from wishlist"
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center text-error-500 hover:bg-white dark:hover:bg-gray-900 transition-colors shadow-sm"
                >
                  {removing === item.listing_id
                    ? <span className="w-3 h-3 border border-error-500 border-t-transparent rounded-full animate-spin" />
                    : <Trash2 size={12} />}
                </button>

                <Link href={`/listing/${item.uuid ?? item.listing_id}`} className="flex-1 group">
                  <div className={`aspect-square bg-gray-100 dark:bg-gray-800 relative overflow-hidden ${priceDrop ? "mt-6" : ""}`}>
                    {photo ? (
                      <Image
                        src={thumbnailImage(photo, 400)}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-3xl font-black text-gray-200 dark:text-gray-700">
                          {item.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white line-clamp-2 leading-snug mb-1">
                      {item.name}
                    </p>
                    {item.location && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                        <MapPin size={10} /> {item.location}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="text-base font-black text-brand-600 dark:text-brand-400">
                        {formatPrice(item.price)}
                      </p>
                      {priceDrop && item.saved_price && (
                        <p className="text-xs line-through text-gray-400">{formatPrice(item.saved_price)}</p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
