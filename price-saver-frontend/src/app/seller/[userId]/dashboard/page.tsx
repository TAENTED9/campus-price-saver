"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";

/**
 * Seller Dashboard
 * Overview of sales, inventory, and recent orders
 */

interface SellerStats {
  totalSales: number;
  revenueToday: number;
  activeListings: number;
  pendingOrders: number;
  averageRating: number;
}

interface RecentOrder {
  id: string;
  buyerName: string;
  amount: number;
  status: "pending" | "completed" | "cancelled";
  createdAt: string;
}

export default function SellerDashboard({
  params,
}: {
  params: { userId: string };
}) {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch seller stats
        const statsRes = await sellerApi.getStats(token!);
        setStats(((statsRes as unknown) as { success?: boolean; data?: SellerStats })?.data ?? null);

        // Fetch recent orders
        const listingsRes = await sellerApi.getListings(token!);
        setOrders(((listingsRes as unknown) as { success?: boolean; data?: RecentOrder[] })?.data ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user && token) {
      fetchDashboardData();
    }
  }, [user, token, params.userId]);

  if (loading) {
    return <div className="text-center py-10">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Seller Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total Sales"
          value={stats?.totalSales || 0}
          format="currency"
        />
        <StatCard
          title="Revenue Today"
          value={stats?.revenueToday || 0}
          format="currency"
        />
        <StatCard
          title="Active Listings"
          value={stats?.activeListings || 0}
          format="number"
        />
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          format="number"
        />
        <StatCard
          title="Average Rating"
          value={stats?.averageRating || 0}
          format="rating"
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500">No recent orders</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Order ID</th>
                <th className="text-left py-2">Buyer</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 font-mono text-sm">{order.id}</td>
                  <td className="py-3">{order.buyerName}</td>
                  <td className="py-3 text-right font-semibold">
                    ${order.amount.toFixed(2)}
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        order.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : order.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  format,
}: {
  title: string;
  value: number;
  format: "currency" | "number" | "rating";
}) {
  let formatted = value.toString();
  if (format === "currency") {
    formatted = `$${value.toFixed(2)}`;
  } else if (format === "rating") {
    formatted = value.toFixed(1);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-gray-600 text-sm">{title}</p>
      <p className="text-2xl font-bold mt-2">{formatted}</p>
    </div>
  );
}
