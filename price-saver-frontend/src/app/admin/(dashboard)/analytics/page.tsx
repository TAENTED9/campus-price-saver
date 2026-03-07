"use client";

import React, { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/api";
import { Eye, UserPlus, Package, ShoppingCart } from "lucide-react";

type StatsData = {
  success: boolean;
  registeredStudents: number;
  pendingVerifications: number;
  activeListings: number;
  openReports: number;
  newUsersToday: number;
};

type MonthlyData = {
  success: boolean;
  months: Array<{ month: string; submissions: number; revenue: number }>;
};

export default function AnalyticsPage() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchStats = useCallback(
    () => adminApi.getStats(token!),
    [token]
  );

  const fetchMonthly = useCallback(
    () => adminApi.getMonthlyAnalytics(token!),
    [token]
  );

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = usePolling<StatsData>(fetchStats, 30000, isAuthenticated && !!token);

  const {
    data: monthly,
    loading: monthlyLoading,
    error: monthlyError,
  } = usePolling<MonthlyData>(fetchMonthly, 30000, isAuthenticated && !!token);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Listings",
      value: stats?.activeListings ?? 0,
      change: "All active listings",
      icon: Eye,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "New Sign-ups",
      value: stats?.registeredStudents ?? 0,
      change: `+${stats?.newUsersToday ?? 0} today`,
      icon: UserPlus,
      color: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "New Listings Posted",
      value: stats?.activeListings ?? 0,
      change: "Currently active",
      icon: Package,
      color: "text-brand-500 bg-brand-500/10 dark:bg-brand-500/20",
    },
    {
      label: "Successful Transactions",
      value: 0,
      change: "Self-reported",
      icon: ShoppingCart,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  const maxSubmissions = monthly?.months?.length
    ? Math.max(...monthly.months.map((m) => m.submissions), 1)
    : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        Analytics
      </h1>

      {/* Error banner */}
      {statsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load stats: {statsError}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 md:gap-6">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
              >
                <div className="mb-3 h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="mb-2 h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mb-1 h-7 w-14 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))
          : statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <h4 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">
                    {card.value.toLocaleString()}
                  </h4>
                  <p className="mt-1 text-xs text-gray-400">{card.change}</p>
                </div>
              );
            })}
      </div>

      {/* Monthly submissions chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          Monthly Submissions
        </h2>

        {monthlyError && (
          <p className="text-sm text-red-500">Failed to load chart: {monthlyError}</p>
        )}

        {monthlyLoading ? (
          <div className="flex items-end gap-3" style={{ height: 200 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full animate-pulse rounded-t-md bg-gray-200 dark:bg-gray-700"
                  style={{ height: 40 + Math.random() * 120 }}
                />
                <div className="h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
        ) : monthly?.months?.length ? (
          <div className="flex items-end gap-3" style={{ height: 220 }}>
            {monthly.months.map((m) => {
              const pct = (m.submissions / maxSubmissions) * 100;
              return (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {m.submissions}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-brand-500 transition-all duration-500"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                    }}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-gray-400">
            No monthly data available yet.
          </p>
        )}
      </div>
    </div>
  );
}
