"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import buyerApi from "@/lib/buyerApi";

/**
 * Buyer Orders Page
 * View purchase history and order details
 */

interface Order {
  id: string;
  seller: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  created_at: string;
  updated_at: string;
}

export default function OrdersPage({
  params,
}: {
  params: { userId: string };
}) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const data = await buyerApi.getOrders(params.userId);
        setOrders(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load orders"
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user, params.userId]);

  if (loading) {
    return <div className="text-center py-10">Loading orders...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">My Orders</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">You haven't placed any orders yet</p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isExpanded={expandedOrder === order.id}
              onToggle={() =>
                setExpandedOrder(
                  expandedOrder === order.id ? null : order.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
}: {
  order: Order;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "processing":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors flex justify-between items-center"
      >
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <p className="font-semibold">Order #{order.id}</p>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                order.status
              )}`}
            >
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            from <span className="font-medium">{order.seller.name}</span> •{" "}
            {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{order.items.length} items</p>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <h3 className="font-semibold mb-3">Order Items</h3>
          <div className="space-y-2 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-600">
                    Qty: {item.quantity} × ${item.price.toFixed(2)}
                  </p>
                </div>
                <p className="font-semibold">
                  ${(item.quantity * item.price).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-300 pt-3 mb-4">
            <div className="flex justify-between">
              <p className="font-semibold">Total</p>
              <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
              View Details
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100">
              Contact Seller
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
