"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { usePolling } from "@/hooks/usePolling";
import { adminApi, type AdminEvent } from "@/lib/api";
import {
  Users, Clock, Package, AlertTriangle, UserPlus,
  Activity, RefreshCw, ExternalLink,
} from "lucide-react";
import Link from "next/link";

type StatsData = {
  success: boolean;
  data: {
    registeredStudents: number;
    pendingVerifications: number;
    activeListings: number;
    openReports: number;
    newUsersToday: number;
  };
};

type MonthlyData = {
  success: boolean;
  data: {
    months: Array<{ month: string; submissions: number; revenue: number }>;
  };
};

type EventsData = {
  success: boolean;
  total: number;
  unread_count: number;
  data: AdminEvent[];
};

const EVENT_COLORS: Record<string, string> = {
  new_user:           "bg-blue-500",
  new_listing:        "bg-green-500",
  new_report:         "bg-red-500",
  new_verification:   "bg-amber-500",
  verification_approved: "bg-green-500",
  verification_rejected: "bg-red-500",
  user_banned:        "bg-red-600",
  listing_flagged:    "bg-amber-500",
  default:            "bg-gray-400",
};

function eventColor(type: string) {
  return EVENT_COLORS[type] ?? EVENT_COLORS.default;
}

function eventLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminOverview() {
  const { token, isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/admin/signin");
  }, [authLoading, isAuthenticated, router]);

  const fetchStats   = useCallback(() => adminApi.getStats(token!),             [token]);
  const fetchMonthly = useCallback(() => adminApi.getMonthlyAnalytics(token!),  [token]);
  const fetchEvents  = useCallback(() => adminApi.getEvents(token!, { limit: 20 }), [token]);

  const { data: stats,   loading: statsLoading,   error: statsError }   = usePolling<StatsData>  (fetchStats,   10_000, isAuthenticated && !!token);
  const { data: monthly, loading: monthlyLoading, error: monthlyError } = usePolling<MonthlyData>(fetchMonthly, 60_000, isAuthenticated && !!token);
  const { data: events,  loading: eventsLoading }                        = usePolling<EventsData> (fetchEvents,  15_000, isAuthenticated && !!token);

  useEffect(() => { if (stats) setLastUpdated(new Date()); }, [stats]);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const metricCards = [
    { label: "Registered Students",   value: stats?.data?.registeredStudents   ?? 0, icon: Users,         color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",       href: "/admin/users" },
    { label: "Pending Verifications", value: stats?.data?.pendingVerifications ?? 0, icon: Clock,         color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",     href: "/admin/seller" },
    { label: "Active Listings",       value: stats?.data?.activeListings       ?? 0, icon: Package,       color: "text-green-600 bg-green-50 dark:bg-green-900/20",     href: "/admin/listings" },
    { label: "Open Reports",          value: stats?.data?.openReports          ?? 0, icon: AlertTriangle, color: "text-red-600 bg-red-50 dark:bg-red-900/20",           href: "/admin/reports" },
    { label: "New Users Today",       value: stats?.data?.newUsersToday        ?? 0, icon: UserPlus,      color: "text-brand-500 bg-brand-500/10 dark:bg-brand-500/20", href: "/admin/users" },
  ];

  const monthlyList = monthly?.data?.months ?? [];
  const maxSubmissions = monthlyList.length
    ? Math.max(...monthlyList.map((m) => m.submissions), 1)
    : 1;

  const eventList = events?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Dashboard Overview</h1>
        {lastUpdated && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw size={11} className="animate-spin-slow" />
            {lastUpdated.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos" })}
          </span>
        )}
      </div>

      {statsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Failed to load stats: {statsError}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-5">
        {statsLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="mb-3 h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="mb-2 h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-7 w-12 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))
          : metricCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.label} href={card.href}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <h4 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white/90">{card.value.toLocaleString("en-NG")}</h4>
                </Link>
              );
            })}
      </div>

      {/* Main content — chart + event feed */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Monthly submissions chart — 2/3 width */}
        <div className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <h2 className="mb-5 text-base font-semibold text-gray-800 dark:text-white/90">Monthly Submissions</h2>
          {monthlyError && <p className="text-sm text-red-500 mb-3">Failed to load chart: {monthlyError}</p>}
          {monthlyLoading ? (
            <div className="flex h-52 items-end gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full h-24 animate-pulse rounded-t-md bg-gray-200 dark:bg-gray-700" />
                  <div className="h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : monthlyList.length ? (
            <div className="flex h-52 items-end gap-2">
              {monthlyList.map((m) => {
                const pct = (m.submissions / maxSubmissions) * 100;
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5 group/bar">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {m.submissions}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-brand-500 hover:bg-brand-600 transition-all duration-500"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${m.month}: ${m.submissions} submission${m.submissions !== 1 ? "s" : ""}`}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.month}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">No monthly data available yet.</p>
          )}
        </div>

        {/* Live event feed — 1/3 width */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-brand-500" />
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Live Events</h2>
            </div>
            {events?.unread_count ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {events.unread_count}
              </span>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto max-h-60 divide-y divide-gray-100 dark:divide-gray-800">
            {eventsLoading && !eventList.length ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))
            ) : eventList.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No events yet</p>
            ) : (
              eventList.map((ev) => (
                <div key={ev.id} className={`flex items-start gap-3 px-5 py-3 ${!ev.is_read ? "bg-brand-500/[0.04]" : ""}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${eventColor(ev.event_type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-white/90 truncate">
                      {eventLabel(ev.event_type)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{ev.user_email || "—"}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(ev.created_at)}</span>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3">
            <Link href="/admin/analytics" className="flex items-center justify-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
              View full analytics <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
