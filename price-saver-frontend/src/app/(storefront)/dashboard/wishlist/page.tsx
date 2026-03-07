"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { itemsApi, type Price } from "@/lib/api";
import { Heart, Trash2 } from "lucide-react";

const WL_KEY = "ps_wishlist";

function getWishlistIds(): number[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(WL_KEY) || "[]"); } catch { return []; }
}

export function removeFromWishlist(id: number) {
  const ids = getWishlistIds().filter((i) => i !== id);
  localStorage.setItem(WL_KEY, JSON.stringify(ids));
}

export function addToWishlist(id: number) {
  const ids = getWishlistIds();
  if (!ids.includes(id)) { ids.push(id); localStorage.setItem(WL_KEY, JSON.stringify(ids)); }
}

export function isInWishlist(id: number): boolean {
  return getWishlistIds().includes(id);
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]";

export default function WishlistPage() {
  const [ids, setIds]     = useState<number[]>([]);
  const [items, setItems] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = getWishlistIds();
    setIds(saved);
    if (saved.length === 0) { setLoading(false); return; }
    itemsApi.getPrices(0, 200)
      .then((all) => setItems(all.filter((p) => saved.includes(p.id))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = (id: number) => {
    removeFromWishlist(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    setIds((prev) => prev.filter((i) => i !== id));
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Wishlist</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {ids.length} saved {ids.length === 1 ? "item" : "items"}
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Browse Prices
        </Link>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${CARD} p-5 animate-pulse`}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-700" />
                  <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
                </div>
              </div>
              <div className="h-5 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
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
            Browse Prices
          </Link>
        </div>
      )}

      {/* Items grid */}
      {!loading && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className={`${CARD} p-5 flex flex-col`}>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 font-black text-xl flex-shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-gray-800 dark:text-white line-clamp-2">{item.name}</p>
                    {item.brand && <p className="text-[11px] text-gray-400 mt-0.5">{item.brand}</p>}
                    {item.location && <p className="text-[11px] text-gray-400 mt-0.5 truncate">📍 {item.location}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    title="Remove from wishlist"
                    className="w-8 h-8 rounded-lg border border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 flex items-center justify-center text-error-500 hover:bg-error-100 transition-colors flex-shrink-0"
                  >
                    <Heart size={13} className="fill-current" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <p className="font-extrabold text-[18px] text-gray-800 dark:text-white">{formatPrice(item.price)}</p>
                  {item.retailer && <p className="text-[11px] text-gray-400">{item.retailer}</p>}
                </div>

                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/search?q=${encodeURIComponent(item.name)}`}
                    className="flex-1 text-center py-2 text-xs font-bold text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                  >
                    Compare prices
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    title="Remove"
                    className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-error-500 hover:border-error-200 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-gray-400">
            Wishlist saved locally on this device. Sync across browsers coming soon.
          </p>
        </>
      )}
    </div>
  );
}
