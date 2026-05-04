"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { ordersApi, type Order } from "@/lib/api";
import { thumbnailImage } from "@/lib/cloudinary";
import { formatPrice } from "@/lib/formatPrice";
import {
  Package, MapPin, Calendar, ExternalLink, X,
  CheckCircle2, Clock, ShoppingBag, AlertTriangle,
} from "lucide-react";

const STATUS_TABS = [
  { key: "",           label: "All" },
  { key: "pending",    label: "Pending" },
  { key: "met_up",     label: "Met Up" },
  { key: "completed",  label: "Completed" },
  { key: "cancelled",  label: "Cancelled" },
] as const;

function statusStyle(status: string): string {
  const map: Record<string, string> = {
    pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    met_up:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  return map[status] ?? map["pending"];
}

function statusLabel(status: string): string {
  return { pending: "Pending", met_up: "Met Up", completed: "Completed", cancelled: "Cancelled" }[status] ?? status;
}

function SellerInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {letters.toUpperCase()}
    </div>
  );
}

function timeAgo(iso: string) {
  const utc = iso && !iso.endsWith("Z") ? iso + "Z" : iso;
  const diff = Date.now() - new Date(utc).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function OrdersPage() {
  const { token } = useAuth();
  const { markCategoryRead } = useNotifications();
  const [activeStatus, setActiveStatus] = useState("");

  // Clear the orders notification badge as soon as the user views the page
  useEffect(() => { markCategoryRead("orders"); }, []);
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrders = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    ordersApi.list(token, activeStatus || undefined)
      .then((r) => setOrders(r.data))
      .catch(() => { setError(true); setOrders([]); })
      .finally(() => setLoading(false));
  }, [token, activeStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function confirmCancel() {
    if (!cancelId || !token) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(token, cancelId);
      setOrders((prev) => prev.map((o) =>
        (o.uuid ?? String(o.id)) === cancelId ? { ...o, status: "cancelled" } : o
      ));
    } catch { /* silent */ }
    finally { setCancelling(false); setCancelId(null); }
  }

  const CARD = "rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">My Orders</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track your purchases and order history</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-2xl w-fit overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveStatus(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeStatus === tab.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${CARD} p-4 animate-pulse`}>
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className={`${CARD} p-8 text-center`}>
          <AlertTriangle size={32} className="text-warning-400 mx-auto mb-3" />
          <p className="font-bold text-gray-800 dark:text-white mb-1">Could not load orders</p>
          <button type="button" onClick={fetchOrders}
            className="mt-3 text-sm text-brand-500 font-semibold hover:underline">Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && orders.length === 0 && (
        <div className={`${CARD} p-16 text-center`}>
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={28} className="text-gray-400" />
          </div>
          <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">No orders yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
            Once you purchase from a seller, your orders will appear here.
          </p>
          <Link href="/search"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-accent-500 text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity">
            Browse Listings
          </Link>
        </div>
      )}

      {/* Orders list */}
      {!loading && !error && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => {
            const photo = order.listing_photos?.[0];
            const orderKey = order.uuid ?? String(order.id);
            return (
              <div key={order.id} className={`${CARD} p-4`}>
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative flex-shrink-0">
                    {photo ? (
                      <Image src={thumbnailImage(photo, 80)} alt={order.listing_name} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={20} className="text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-800 dark:text-white truncate flex-1">
                        {order.listing_name}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyle(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    {/* Seller */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {order.seller_avatar ? (
                        <Image src={thumbnailImage(order.seller_avatar, 32)} alt={order.seller_name} width={20} height={20} className="rounded-full object-cover" />
                      ) : (
                        <SellerInitials name={order.seller_name} />
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">{order.seller_name}</span>
                    </div>

                    <p className="text-base font-black text-brand-600 dark:text-brand-400">
                      {formatPrice(order.listing_price)}
                      {order.listing_condition && (
                        <span className="text-xs font-normal text-gray-400 ml-2">{order.listing_condition}</span>
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                      {order.meetup_location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={10} /> {order.meetup_location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={10} /> {timeAgo(order.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Link
                        href={`/listing/${order.listing_uuid ?? order.listing_id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-500 border border-brand-200 dark:border-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                      >
                        <ExternalLink size={11} /> View Listing
                      </Link>
                      {order.status === "completed" && (
                        <Link
                          href={`/listing/${order.listing_uuid ?? order.listing_id}#reviews`}
                          className="flex items-center gap-1 text-xs font-semibold text-green-600 border border-green-200 dark:border-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                        >
                          <CheckCircle2 size={11} /> Leave Review
                        </Link>
                      )}
                      {order.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => setCancelId(orderKey)}
                          className="flex items-center gap-1 text-xs font-semibold text-error-500 border border-error-200 dark:border-error-700 px-3 py-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCancelId(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-warning-500" />
            </div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-2">Cancel this order?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCancelId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400">
                Keep Order
              </button>
              <button type="button" onClick={confirmCancel} disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-error-500 text-white text-sm font-bold hover:bg-error-600 transition-colors disabled:opacity-50">
                {cancelling ? "Cancelling…" : "Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
