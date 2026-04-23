"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { userApi, type PointsTransaction } from "@/lib/api";

export default function PointsPage() {
  const { token } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    userApi
      .getPoints(token)
      .then((res) => {
        setBalance(res.balance);
        setTransactions(res.transactions);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Points &amp; Karma</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Earn points by contributing prices. Spend them to boost your listings.
        </p>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 dot-pattern" />
        <div className="relative z-10">
          <p className="text-brand-100 text-sm mb-1">Your balance</p>
          {loading ? (
            <div className="h-10 w-24 bg-white/20 rounded animate-pulse mb-1" />
          ) : (
            <p className="text-4xl font-bold mb-1">{(balance ?? 0).toLocaleString()} <span className="text-2xl">pts</span></p>
          )}
          <p className="text-brand-100 text-sm">Use points to feature your listings and reach more buyers</p>
        </div>
      </div>

      {/* How to earn / spend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-green-600 dark:text-green-400 mb-3">Earn Points</h3>
          <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-center gap-2"><span className="text-green-500">+5</span> pts — Price submission approved</li>
            <li className="flex items-center gap-2"><span className="text-green-500">+10</span> pts — Purchase confirmed by buyer</li>
            <li className="flex items-center gap-2"><span className="text-green-500">+2</span> pts — First review left</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-red-500 dark:text-red-400 mb-3">Spend Points</h3>
          <ul className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-center gap-2"><span className="text-red-400">−50</span> pts — Boost a listing 7 days</li>
            <li className="flex items-center gap-2"><span className="text-red-400">−150</span> pts — Boost a listing 30 days</li>
          </ul>
          <Link
            href="/dashboard/submissions"
            className="mt-4 inline-flex items-center text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
          >
            Manage your listings →
          </Link>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Transaction History</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 text-sm text-red-500">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">⭐</p>
            <p className="font-medium text-gray-900 dark:text-white">No transactions yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Submit a price to start earning points!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${t.amount > 0 ? "bg-green-100 dark:bg-green-500/10" : "bg-red-100 dark:bg-red-500/10"}`}>
                  {t.amount > 0 ? "+" : "−"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{t.reason ?? "Points transaction"}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })}
                  </p>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${t.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {t.amount > 0 ? `+${t.amount}` : t.amount} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
