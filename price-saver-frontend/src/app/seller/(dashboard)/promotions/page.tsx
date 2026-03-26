"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { sellerApi } from "@/lib/api";

export default function PromotionsPage() {
  const { token } = useAuth();
  const [karma, setKarma] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    sellerApi.getStats(token)
      .then(res => { if (res.success) setKarma(res.data.sellerPoints || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Promotions</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Boost visibility using your Karma Points — 100% free</p>
      </div>

      {/* Karma balance card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Your Karma Points</h3>
            <p className="text-xs text-gray-400 mt-0.5">Earn by selling, getting reviews, staying active</p>
          </div>
          <div className="text-right">
            {loading ? (
              <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : (
              <div className="text-3xl font-black text-blue-600">
                {karma} <span className="text-sm font-normal text-gray-400">pts</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { cost: "50 pts", label: "Boost listing 24h", icon: "⚡" },
            { cost: "120 pts", label: "Category feature 48h", icon: "⭐" },
            { cost: "300 pts", label: "Homepage week", icon: "🚀" },
          ].map(({ cost, label, icon }) => (
            <div key={label}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group">
              <div className="text-2xl mb-1.5">{icon}</div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">{cost}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">Boost purchasing coming soon</p>
      </div>

      {/* Flash Sales */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900 dark:text-white">Flash Sales</h3>
          <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">Coming Soon</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Run a time-limited discount on any of your listings</p>

        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Flash Sales Coming Soon</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Create time-limited discounts to drive urgency and move inventory faster.
          </p>
        </div>
      </div>

      {/* How to earn karma */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-4">How to Earn Karma Points</h3>
        <div className="space-y-3">
          {[
            { action: "Complete a sale", pts: "+25 pts", icon: "🤝" },
            { action: "Receive a 5-star review", pts: "+15 pts", icon: "⭐" },
            { action: "Complete your profile", pts: "+50 pts", icon: "👤" },
            { action: "Get verified", pts: "+100 pts", icon: "✅" },
            { action: "Respond to inquiries within 1h", pts: "+5 pts", icon: "💬" },
          ].map(({ action, pts, icon }) => (
            <div key={action} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
              </div>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">{pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
