"use client";

import React from "react";
import Link from "next/link";

export default function OrdersPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">My Orders</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track your purchases and order history</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-16 text-center">
        <div className="text-5xl mb-4">📦</div>
        <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">No orders yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-6">
          Once you purchase from a seller, your orders will appear here with full tracking details.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-500 to-[#06b6d4] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          Browse Prices
        </Link>
      </div>
    </div>
  );
}
