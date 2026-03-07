"use client";

import { useEffect, useState } from "react";
import { storefrontApi, type PlatformStats } from "@/lib/api";

export default function StatsStrip() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    storefrontApi.getPlatformStats()
      .then(setStats)
      .catch(() => {}); // silently fall back to null
  }, []);

  const items = stats
    ? [
        { value: `${stats.total_users.toLocaleString()}+`, label: "Students Saving" },
        { value: `${stats.active_listings.toLocaleString()}+`, label: "Active Listings" },
        { value: `${stats.total_categories}`, label: "Categories" },
      ]
    : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mt-8">
      {items
        ? items.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          ))
        : /* skeleton while loading */
          [1, 2, 3].map((i) => (
            <div key={i} className="text-center animate-pulse">
              <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700 mx-auto mb-1" />
              <div className="h-4 w-28 rounded bg-gray-100 dark:bg-gray-800 mx-auto" />
            </div>
          ))}
    </div>
  );
}
