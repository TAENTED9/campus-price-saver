"use client";

import React from "react";

export default function SellerPromotionsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Promotions &amp; Boosts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Flash sales, coupon codes, and karma point boosts</p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-16 text-center">
        <div className="text-5xl mb-4">⚡</div>
        <p className="font-bold text-lg text-gray-800 dark:text-white mb-2">Promotions &amp; Boosts</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          Create flash sales, generate coupon codes, and use karma points to boost your listings to the top.
        </p>
      </div>
    </div>
  );
}
