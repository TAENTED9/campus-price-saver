"use client";

import { useEffect, useState } from "react";
import { storefrontApi, type PlatformStats } from "@/lib/api";

export default function StatsStrip() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    storefrontApi.getPlatformStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const items = stats
    ? [
        { value: `${stats.active_listings.toLocaleString()}+`, label: "Active Listings" },
        { value: `${stats.total_users.toLocaleString()}+`, label: "Verified Sellers" },
        { value: `${stats.total_categories}`, label: "Categories" },
      ]
    : null;

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
          {items
            ? items.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              ))
            : [1, 2, 3].map((i) => (
                <div key={i} className="text-center animate-pulse">
                  <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-700 mx-auto mb-1" />
                  <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 mx-auto" />
                </div>
              ))}

          {/* Updated live indicator */}
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 dark:text-gray-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            Updated live
          </div>
        </div>
      </div>
    </div>
  );
}
