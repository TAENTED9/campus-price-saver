"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { sellerApi, type SellerAnalytics } from "@/lib/api";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-5";

const TRAFFIC_SOURCES = [
  { label: "Search",          pct: 48, color: "bg-brand-500" },
  { label: "Homepage Browse", pct: 27, color: "bg-accent-500" },
  { label: "Direct Link",     pct: 17, color: "bg-purple-500" },
  { label: "Category Page",   pct:  8, color: "bg-warning-400" },
];

function SkeletonCard() {
  return (
    <div className={CARD}>
      <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700 animate-pulse mb-5" />
      <div className="h-48 w-full rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

const RANGES = [
  { label: "7 days",  value: "7d"  },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export default function SellerAnalyticsPage() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [range, setRange]         = useState<Range>("30d");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    sellerApi.getAnalytics(token, range)
      .then((r) => { if (r.success) setAnalytics(r.data); else setError("Failed to load analytics."); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [token, range]);

  if (error) {
    return (
      <div className={CARD}>
        <p className="text-sm text-error-500 dark:text-error-400">{error}</p>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  /* ── Data prep ── */
  const months       = analytics.months.slice(-7);
  const viewsData    = analytics.views.slice(-7);
  const listingsData = analytics.listings.slice(-7);
  const totalViews     = viewsData.reduce((s, v) => s + v, 0);
  const totalListings  = listingsData.reduce((s, v) => s + v, 0);
  const confirmedSales = analytics.topListings?.length ?? 0;

  const chartOptions: ApexOptions = {
    chart: { fontFamily: "Outfit, sans-serif", type: "area", toolbar: { show: false }, zoom: { enabled: false } },
    colors: ["#2563eb", "#06b6d4"],
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
    dataLabels: { enabled: false },
    markers: { size: 0, hover: { size: 5 } },
    grid: { borderColor: "#f1f5f9", xaxis: { lines: { show: false } } },
    xaxis: { categories: months, axisBorder: { show: false }, axisTicks: { show: false },
      labels: { style: { fontSize: "11px", colors: "#9ca3af" } } },
    yaxis: { labels: { style: { fontSize: "11px", colors: ["#9ca3af"] } } },
    tooltip: { theme: "light", x: { show: true } },
    legend: { show: true, position: "top", horizontalAlign: "right", fontSize: "12px" },
  };

  const chartSeries = [
    { name: "Views",    data: viewsData },
    { name: "Listings", data: listingsData },
  ];

  return (
    <div className="space-y-6">

      {/* Title + range picker */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Analytics</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track your store performance</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button key={r.value} type="button" onClick={() => setRange(r.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                range === r.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50"
              }`}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── A. Views & Listings Line Chart (ApexCharts) ── */}
        <div className={CARD}>
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white mb-3">Views Over Time</h3>
          <div className="overflow-hidden">
            <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={200} />
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
            <span><strong className="text-gray-800 dark:text-white">{totalViews.toLocaleString()}</strong> total views</span>
            <span><strong className="text-gray-800 dark:text-white">{totalListings}</strong> listings</span>
          </div>
        </div>

        {/* ── B. Traffic Sources ── */}
        <div className={CARD}>
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white mb-5">Traffic Sources</h3>
          <div className="space-y-4">
            {TRAFFIC_SOURCES.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-gray-500 dark:text-gray-400">{s.label}</span>
                  <span className="font-bold text-gray-800 dark:text-white">{s.pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-4">* Traffic breakdown — live data coming soon</p>
        </div>

        {/* ── C. Conversion Funnel ── */}
        <div className={CARD}>
          <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white mb-5">Conversion Funnel</h3>
          {[
            { label: "Listing Views",   value: totalViews.toLocaleString(),      pct: 100 },
            { label: "Inquiries Sent",  value: Math.round(totalViews * 0.022).toLocaleString(), pct: 22 },
            { label: "Confirmed Sales", value: confirmedSales.toLocaleString(),  pct: 6  },
          ].map((f, i) => {
            const opacities = ["opacity-100", "opacity-70", "opacity-45"];
            return (
              <div key={f.label} className="flex items-center gap-3 mb-3">
                <div
                  className={`flex-1 h-9 rounded-lg flex items-center px-3 bg-brand-50 dark:bg-brand-500/20 ${opacities[i]}`}
                >
                  <span className="text-[12px] font-bold text-brand-600 dark:text-brand-400">{f.label}</span>
                </div>
                <span className="font-extrabold text-[14px] text-gray-800 dark:text-white w-16 text-right flex-shrink-0">
                  {f.value}
                </span>
              </div>
            );
          })}

          {/* Top listings table */}
          {analytics.topListings.length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Top Listings</p>
              <div className="space-y-2">
                {analytics.topListings.slice(0, 3).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 text-[12px]">
                    <span className="text-gray-400 w-4">{idx + 1}.</span>
                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{item.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">{item.views.toLocaleString()} views</span>
                    <span className="text-gray-800 dark:text-white font-bold">{formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Price Benchmark Card ── */}
      <div className={CARD}>
        <h3 className="font-extrabold text-[15px] text-gray-800 dark:text-white mb-1">Price Benchmark</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">How your prices compare to the market average.</p>
        {analytics.benchmarks && analytics.benchmarks.length > 0 ? (
          <div className="space-y-3">
            {analytics.benchmarks.slice(0, 5).map((b) => {
              const diff = b.your_price - b.avg_market_price;
              const pct  = b.avg_market_price > 0 ? Math.round((diff / b.avg_market_price) * 100) : 0;
              return (
                <div key={b.listing_id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-white truncate">{b.name}</p>
                    <p className="text-[11px] text-gray-400">
                      Yours: <strong>{formatCurrency(b.your_price)}</strong> · Market avg: {formatCurrency(b.avg_market_price)}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    b.competitive
                      ? "bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400"
                      : "bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400"
                  }`}>
                    {diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(pct)}% {diff > 0 ? "above" : "below"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp size={32} className="text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">No benchmark data yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add listings with prices to see how you compare to the market.</p>
          </div>
        )}
      </div>
    </div>
  );
}
