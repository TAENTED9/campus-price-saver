"use client";

/**
 * Block 2 — Zero client-side storage.
 * Recently-viewed items come from the server (`GET /api/auth/recently-viewed`),
 * which is populated by listing view logging. The previous localStorage
 * implementation has been removed.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { thumbnailImage } from "@/lib/cloudinary";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ServerViewed {
  id: number;
  name: string;
  price: number;
  photos: string[];
}

interface ViewedItem {
  id: number;
  title: string;
  price: number;
  imageUrl: string;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function RecentlyViewedSection() {
  const { isAuthenticated, token } = useAuth();
  const [items, setItems] = useState<ViewedItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/recently-viewed?limit=4`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) return;
        const data: ServerViewed[] = await res.json();
        if (cancelled) return;
        setItems(
          (data ?? []).slice(0, 4).map((p) => ({
            id: p.id,
            title: p.name,
            price: p.price,
            imageUrl: p.photos?.[0] ?? "",
          }))
        );
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  if (!isAuthenticated || items.length === 0) return null;

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye size={18} className="text-gray-400" />
            Recently Viewed
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item) => {
            const thumb = item.imageUrl ? thumbnailImage(item.imageUrl, 300) : "";
            return (
              <Link
                key={`recent-${item.id}`}
                href={`/store/listing/${item.id}`}
                className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="relative h-32 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={32} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-xs text-gray-900 dark:text-white line-clamp-1">
                    {item.title}
                  </p>
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">
                    {formatPrice(item.price)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
