"use client";

import React from "react";
import { Package, Clock } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/10 to-[#06b6d4]/10 border border-brand-200/60 dark:border-brand-800/60 flex items-center justify-center mb-6">
        <Package size={36} className="text-brand-500" />
      </div>

      <div className="inline-flex items-center gap-1.5 bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/30 text-warning-700 dark:text-warning-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
        <Clock size={12} />
        Coming Soon
      </div>

      <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight mb-2">
        Orders &amp; Purchase History
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        We&apos;re building a full order management system. Track your purchases,
        view receipts, and manage returns — all in one place.
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
        {[
          { label: "Order tracking", done: false },
          { label: "Purchase history", done: false },
          { label: "Return requests", done: false },
        ].map((f) => (
          <div
            key={f.label}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] px-4 py-3 text-center"
          >
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
              {f.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
