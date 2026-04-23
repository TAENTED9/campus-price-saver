"use client";

import React, { useCallback } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminAnalytics } from "@/lib/api";
import { Users, Package, Eye, UserCheck, PauseCircle, Clock, Trash2, BarChart2 } from "lucide-react";

function BarChart({
  data,
  color = "bg-brand-500",
  loading,
}: {
  data: { label: string; count: number }[];
  color?: string;
  loading: boolean;
}) {
  const max = data.length ? Math.max(...data.map((d) => d.count), 1) : 1;
  if (loading) {
    return (
      <div className="flex h-40 items-end gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full h-16 animate-pulse rounded-t bg-gray-200 dark:bg-gray-700" />
            <div className="h-2.5 w-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }
  if (!data.length) return <p className="py-8 text-center text-sm text-gray-400">No data available</p>;
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => {
        const pct = Math.max((d.count / max) * 100, 3);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1 group/bar min-w-0">
            <span className="text-[10px] font-medium text-gray-500 opacity-0 group-hover/bar:opacity-100 transition-opacity">
              {d.count}
            </span>
            <div
              className={`w-full rounded-t ${color} transition-all duration-500`}
              style={{ height: `${pct}%` }}
              title={`${d.label}: ${d.count}`}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label.slice(-5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const { token } = useAdminAuth();

  const fetchAnalytics = useCallback(() => adminApi.getAnalytics(token!), [token]);
  const { data, loading, error } = usePolling<AdminAnalytics>(fetchAnalytics, 60_000, !!token);

  const totals = data?.totals;

  const TOTAL_CARDS = [
    { label: "Total Users",       value: totals?.total_users          ?? 0, icon: Users,       color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
    { label: "Buyers",            value: totals?.total_buyers         ?? 0, icon: Users,       color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" },
    { label: "Sellers",           value: totals?.total_sellers        ?? 0, icon: UserCheck,   color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
    { label: "Total Listings",    value: totals?.total_listings       ?? 0, icon: Package,     color: "text-brand-500 bg-brand-500/10" },
    { label: "Total Views",       value: totals?.total_views          ?? 0, icon: Eye,         color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
    { label: "Paused Accounts",   value: totals?.paused_accounts      ?? 0, icon: PauseCircle, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
    { label: "Pending Verifs.",   value: totals?.pending_verifications ?? 0, icon: Clock,      color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
    { label: "Delete Requests",   value: totals?.delete_requests      ?? 0, icon: Trash2,      color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
  ];

  const signupData  = (data?.daily_signups  ?? []).map((d) => ({ label: d.day,  count: d.count }));
  const listingData = (data?.daily_listings ?? []).map((d) => ({ label: d.day,  count: d.count }));
  const catMax      = data?.top_categories?.length
    ? Math.max(...data.top_categories.map((c) => c.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 size={22} className="text-brand-500" />
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Analytics</h1>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load analytics: {error}
        </div>
      )}

      {/* Totals grid */}
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
                <div className="mb-3 h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="mb-1.5 h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))
          : TOTAL_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${c.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
                  <h4 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{c.value.toLocaleString("en-NG")}</h4>
                </div>
              );
            })}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Daily signups */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Daily Sign-ups (last 30 days)</h2>
          <BarChart data={signupData} color="bg-brand-500" loading={loading} />
        </div>

        {/* Daily listings */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Daily Listings (last 30 days)</h2>
          <BarChart data={listingData} color="bg-green-500" loading={loading} />
        </div>
      </div>

      {/* Top categories + Top sellers */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Top categories */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">Top Categories</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-8 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : data?.top_categories?.length ? (
            <div className="space-y-3">
              {data.top_categories.map((c) => {
                const pct = Math.max((c.count / catMax) * 100, 3);
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-xs font-medium text-gray-700 dark:text-gray-300">{c.category}</span>
                    <div className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">{c.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">No category data</p>
          )}
        </div>

        {/* Top sellers */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Top Sellers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Seller", "Email", "Views", "Listings"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.top_sellers?.length ? (
                  data.top_sellers.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[10px] font-bold text-brand-700 dark:text-brand-400">
                            {((s.display_name || s.email || "?")[0]).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 dark:text-white/90">{s.display_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400">{s.email || "—"}</td>
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-white/90">{s.total_views.toLocaleString("en-NG")}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{s.listing_count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-400">No seller data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
