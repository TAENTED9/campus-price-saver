"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Store, Users } from "lucide-react";
import { storefrontApi, type PlatformStats } from "@/lib/api";

const ICONS = [TrendingUp, Store, Users];

export default function StatsStrip() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    storefrontApi.getPlatformStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const items = stats
    ? [
        { icon: TrendingUp, value: `${stats.active_listings.toLocaleString()}+`, label: "Active Listings" },
        { icon: Store,      value: `${stats.total_users.toLocaleString()}+`,     label: "Verified Sellers" },
        { icon: Users,      value: `${stats.total_categories}`,                  label: "Categories" },
      ]
    : null;

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {items
            ? items.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                    <Icon size={17} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white leading-tight">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
                  </div>
                </div>
              ))
            : ICONS.map((Icon, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0" />
                  <div>
                    <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-700 mb-1" />
                    <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              ))}

          {/* Live pulse */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
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
