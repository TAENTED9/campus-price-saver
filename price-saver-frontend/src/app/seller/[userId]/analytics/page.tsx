"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";

/**
 * Seller Analytics Dashboard
 * Revenue reports, top products, customer insights
 */

interface AnalyticsData {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topProducts: Array<{
    id: string;
    name: string;
    revenue: number;
    unitsSold: number;
  }>;
  revenueByDay: Array<{
    date: string;
    revenue: number;
  }>;
  customerMetrics: {
    totalCustomers: number;
    returningCustomers: number;
    repeatPurchaseRate: number;
  };
}

export default function AnalyticsPage({
  params,
}: {
  params: { userId: string };
}) {
  const { user, token } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await sellerApi.getAnalytics(token!, period);
        const data = (res as { success?: boolean; data?: AnalyticsData })?.data ?? (res as unknown as AnalyticsData);
        setAnalytics(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user && token) {
      fetchAnalytics();
    }
  }, [user, token, params.userId, period]);

  if (loading) {
    return <div className="text-center py-10">Loading analytics...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center py-10">No data available</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Sales Analytics</h1>
        <div className="flex gap-2">
          {(["week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Revenue"
          value={`$${analytics.totalRevenue.toFixed(2)}`}
          icon="💰"
        />
        <MetricCard
          title="Orders"
          value={analytics.totalOrders.toString()}
          icon="📦"
        />
        <MetricCard
          title="Avg Order Value"
          value={`$${analytics.averageOrderValue.toFixed(2)}`}
          icon="📊"
        />
        <MetricCard
          title="Customers"
          value={analytics.customerMetrics.totalCustomers.toString()}
          icon="👥"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Revenue Trend</h2>
          <RevenueChart data={analytics.revenueByDay} />
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Top Products</h2>
          {analytics.topProducts.length === 0 ? (
            <p className="text-gray-500">No product data available</p>
          ) : (
            <div className="space-y-4">
              {analytics.topProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex justify-between items-start pb-4 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-600">
                      {product.unitsSold} units sold
                    </p>
                  </div>
                  <p className="font-bold">${product.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Metrics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Customer Insights</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Total Customers</span>
                <span className="font-bold">
                  {analytics.customerMetrics.totalCustomers}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Returning Customers</span>
                <span className="font-bold">
                  {analytics.customerMetrics.returningCustomers}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Repeat Purchase Rate</span>
                <span className="font-bold">
                  {(analytics.customerMetrics.repeatPurchaseRate * 100).toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={analytics.customerMetrics.repeatPurchaseRate}
                max={1}
              />
            </div>
          </div>
        </div>

        {/* Period Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">
            {period.charAt(0).toUpperCase() + period.slice(1)} Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-700">Period</span>
              <span className="font-medium">{analytics.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Total Revenue</span>
              <span className="font-bold">
                ${analytics.totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Orders Placed</span>
              <span className="font-bold">{analytics.totalOrders}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-700">Avg per Order</span>
              <span className="font-bold">
                ${analytics.averageOrderValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="mt-8 flex gap-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          📥 Export Report
        </button>
        <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
          🖨️ Print
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function RevenueChart({
  data,
}: {
  data: Array<{ date: string; revenue: number }>;
}) {
  if (data.length === 0) {
    return <p className="text-gray-500">No data available</p>;
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="space-y-2">
      {data.map((day) => (
        <div key={day.date}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">
              {new Date(day.date).toLocaleDateString()}
            </span>
            <span className="font-medium">${day.revenue.toFixed(2)}</span>
          </div>
          <ProgressBar value={day.revenue} max={maxRevenue} />
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percentage = (value / max) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className="bg-blue-600 h-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
