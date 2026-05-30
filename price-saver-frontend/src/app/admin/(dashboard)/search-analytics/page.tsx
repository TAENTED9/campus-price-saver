"use client";

/**
 * Admin · Search Analytics
 *
 * Drives off the new /api/admin/search-analytics/* endpoints (Block 8).
 * Four panels at a glance:
 *   • Headline summary cards — total searches, CTR, zero-rate, unique users
 *   • Top searches table — volume + avg result count + last seen
 *   • Zero-result queries — the inventory-gold panel ("buyers walked away")
 *   • Trending queries — period-over-period growth, ▲ / ▼ delta arrows
 *
 * Range selector toggles all four queries between 1 / 7 / 30 / 90 days.
 * Each panel handles its own loading + empty + error state so a slow
 * endpoint doesn't block the others.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Eye,
  Minus,
  MousePointerClick,
  Search as SearchIcon,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Endpoint response shapes ────────────────────────────────────────────────

interface SummaryResponse {
  days: number;
  total_searches: number;
  total_clicks: number;
  click_through_rate: number;
  zero_result_count: number;
  zero_result_rate: number;
  unique_users: number;
  unique_queries: number;
}

interface TopRow {
  query: string;
  searches: number;
  avg_results: number;
  last_seen: string | null;
}

interface ZeroRow {
  query: string;
  searches: number;
  last_seen: string | null;
}

interface TrendRow {
  query: string;
  current: number;
  previous: number;
  growth: number;
  delta: number;
}

// ── Range options ───────────────────────────────────────────────────────────

const RANGES = [
  { value: 1,  label: "24h"   },
  { value: 7,  label: "7 days"  },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;
type RangeValue = (typeof RANGES)[number]["value"];

// ── Generic typed fetcher ───────────────────────────────────────────────────

async function fetchJson<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("en-NG").format(n);
}

function fmtPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "—";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Panel building blocks ───────────────────────────────────────────────────

interface PanelProps {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

function Panel({ title, icon: Icon, hint, children, className }: PanelProps) {
  return (
    <section
      className={[
        "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
        "p-5 flex flex-col gap-3",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-brand-500" />
          <h2 className="font-semibold text-sm text-gray-800 dark:text-white">
            {title}
          </h2>
        </div>
        {hint && (
          <p className="text-[11px] text-gray-400 max-w-[60%] text-right leading-tight">
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function SummaryCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div
        className={[
          "mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl",
          accent,
        ].join(" ")}
      >
        <Icon size={16} />
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-800 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-xs text-gray-400">
      {message}
    </p>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
      <AlertTriangle size={13} />
      <span className="truncate">Failed to load: {message}</span>
    </div>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex h-10 items-center justify-between animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        />
      ))}
    </ul>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SearchAnalyticsPage() {
  const { token, isLoading: authLoading } = useAdminAuth();

  const [days, setDays] = useState<RangeValue>(7);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [top, setTop] = useState<TopRow[]>([]);
  const [zero, setZero] = useState<ZeroRow[]>([]);
  const [trending, setTrending] = useState<TrendRow[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingZero, setLoadingZero] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);

  const [errSummary, setErrSummary] = useState<string | null>(null);
  const [errTop, setErrTop] = useState<string | null>(null);
  const [errZero, setErrZero] = useState<string | null>(null);
  const [errTrending, setErrTrending] = useState<string | null>(null);

  // Single fetch function — refreshes all four panels in parallel.
  // Independent error / loading state per panel so one slow endpoint
  // doesn't gate the rest.
  const refresh = useCallback(
    (signal?: AbortSignal) => {
      if (!token) return;

      setLoadingSummary(true);
      setLoadingTop(true);
      setLoadingZero(true);
      setLoadingTrending(true);
      setErrSummary(null);
      setErrTop(null);
      setErrZero(null);
      setErrTrending(null);

      const base = `/api/admin/search-analytics`;

      fetchJson<SummaryResponse>(`${base}/summary?days=${days}`, token, signal)
        .then(setSummary)
        .catch((e) => setErrSummary((e as Error).message))
        .finally(() => setLoadingSummary(false));

      fetchJson<TopRow[]>(`${base}/top?days=${days}&limit=15`, token, signal)
        .then(setTop)
        .catch((e) => setErrTop((e as Error).message))
        .finally(() => setLoadingTop(false));

      fetchJson<ZeroRow[]>(
        `${base}/zero-results?days=${days}&limit=15`,
        token,
        signal,
      )
        .then(setZero)
        .catch((e) => setErrZero((e as Error).message))
        .finally(() => setLoadingZero(false));

      // Trending uses period-over-period growth — capped at 30 days
      // by the backend (longer windows make growth comparisons noisy).
      const trendDays = Math.min(days, 30);
      fetchJson<TrendRow[]>(
        `${base}/trending?days=${trendDays}&limit=15`,
        token,
        signal,
      )
        .then(setTrending)
        .catch((e) => setErrTrending((e as Error).message))
        .finally(() => setLoadingTrending(false));
    },
    [token, days],
  );

  useEffect(() => {
    if (authLoading || !token) return;
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [authLoading, token, refresh]);

  // Derived headline cards
  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Total searches",
        value: fmtNumber(summary.total_searches),
        icon: SearchIcon,
        accent: "text-brand-500 bg-brand-500/10",
      },
      {
        label: "Click-through rate",
        value: fmtPct(summary.click_through_rate),
        icon: MousePointerClick,
        accent: "text-green-600 bg-green-50 dark:bg-green-900/20",
      },
      {
        label: "Zero-result rate",
        value: fmtPct(summary.zero_result_rate),
        icon: AlertTriangle,
        accent: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
      },
      {
        label: "Unique users",
        value: fmtNumber(summary.unique_users),
        icon: Users,
        accent: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
      },
      {
        label: "Unique queries",
        value: fmtNumber(summary.unique_queries),
        icon: Eye,
        accent: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
      },
      {
        label: "Total clicks",
        value: fmtNumber(summary.total_clicks),
        icon: Zap,
        accent: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
      },
    ];
  }, [summary]);

  // Top searches: build a normalized bar width vs the max-volume query
  // so the eye can spot the long-tail vs head distribution instantly.
  const topMax = top.length ? Math.max(...top.map((r) => r.searches), 1) : 1;

  return (
    <div className="space-y-6">
      {/* ── Header + range selector ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart2 size={22} className="text-brand-500" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Search Analytics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              What buyers are looking for — and what they can&apos;t find.
            </p>
          </div>
        </div>

        <div className="ml-auto inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-white/[0.03]">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                days === r.value
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {loadingSummary
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="mb-2 h-9 w-9 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="mb-1.5 h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-6 w-14 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))
          : errSummary
            ? (
              <div className="col-span-2 md:col-span-3 lg:col-span-6">
                <ErrorRow message={errSummary} />
              </div>
            )
            : summaryCards.map((c) => (
                <SummaryCard key={c.label} {...c} />
              ))}
      </div>

      {/* ── Two-column main grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ── Top searches ─────────────────────────────────────────── */}
        <Panel
          title="Top searches"
          icon={SearchIcon}
          hint={`Most-issued queries in the last ${days === 1 ? "24h" : `${days} days`}.`}
        >
          {loadingTop && <SkeletonRows count={6} />}
          {!loadingTop && errTop && <ErrorRow message={errTop} />}
          {!loadingTop && !errTop && top.length === 0 && (
            <EmptyRow message="No searches in this window." />
          )}
          {!loadingTop && !errTop && top.length > 0 && (
            <ul className="space-y-1.5">
              {top.map((row) => {
                const pct = Math.max((row.searches / topMax) * 100, 4);
                return (
                  <li
                    key={row.query}
                    className="relative overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800"
                  >
                    {/* Volume bar — sits behind the row content */}
                    <div
                      className="absolute inset-y-0 left-0 bg-brand-500/8 dark:bg-brand-500/15"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center gap-3 px-3 py-2">
                      <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-white">
                        {row.query}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        avg {row.avg_results.toFixed(1)} results
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 tabular-nums">
                        {fmtNumber(row.searches)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* ── Zero-result queries ───────────────────────────────────── */}
        <Panel
          title="Zero-result queries"
          icon={AlertTriangle}
          hint="Buyers searched and found nothing — inventory opportunities."
        >
          {loadingZero && <SkeletonRows count={6} />}
          {!loadingZero && errZero && <ErrorRow message={errZero} />}
          {!loadingZero && !errZero && zero.length === 0 && (
            <EmptyRow message="No empty-result searches — every query found at least one listing." />
          )}
          {!loadingZero && !errZero && zero.length > 0 && (
            <ul className="space-y-1.5">
              {zero.map((row) => (
                <li
                  key={row.query}
                  className="flex items-center gap-3 rounded-lg border border-amber-200/60 bg-amber-50/40 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/10"
                >
                  <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-white">
                    {row.query}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                    {relativeTime(row.last_seen)}
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 tabular-nums">
                    {fmtNumber(row.searches)}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── Trending queries (spans both cols on large) ──────────── */}
        <Panel
          title="Trending queries"
          icon={TrendingUp}
          hint={`Growth vs the prior ${Math.min(days, 30)}-day window.`}
          className="lg:col-span-2"
        >
          {loadingTrending && <SkeletonRows count={4} />}
          {!loadingTrending && errTrending && <ErrorRow message={errTrending} />}
          {!loadingTrending && !errTrending && trending.length === 0 && (
            <EmptyRow message="Not enough volume yet for a growth signal — need queries with ≥3 hits in the current window." />
          )}
          {!loadingTrending && !errTrending && trending.length > 0 && (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-2 pl-2">Query</th>
                    <th className="py-2 text-right">Current</th>
                    <th className="py-2 text-right">Previous</th>
                    <th className="py-2 text-right">Δ</th>
                    <th className="py-2 pr-2 text-right">Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {trending.map((row) => {
                    const up = row.delta > 0;
                    const down = row.delta < 0;
                    const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
                    const color = up
                      ? "text-green-600 dark:text-green-400"
                      : down
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-400";
                    return (
                      <tr
                        key={row.query}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 pl-2 font-medium text-gray-800 dark:text-white truncate max-w-[280px]">
                          {row.query}
                        </td>
                        <td className="py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {fmtNumber(row.current)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                          {fmtNumber(row.previous)}
                        </td>
                        <td className={`py-2 text-right tabular-nums font-medium ${color}`}>
                          {row.delta > 0 ? "+" : ""}
                          {fmtNumber(row.delta)}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${color}`}>
                            <Icon size={12} />
                            {(row.growth * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
