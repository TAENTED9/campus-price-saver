"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { userApi, type PointsTransaction } from "@/lib/api";
import Badge from "@/components/ui/badge/Badge";

export default function SellerPointsPage() {
  const { token } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    userApi
      .getPoints(token)
      .then((res) => {
        setBalance(res.balance);
        setTransactions(res.transactions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Balance card */}
      <div className="col-span-12 xl:col-span-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-center w-12 h-12 bg-warning-50 rounded-xl dark:bg-warning-500/10 mb-4">
            <svg className="text-warning-500 size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Your Balance</span>
          <h3 className="mt-2 text-3xl font-bold text-gray-800 dark:text-white/90">
            {loading ? "—" : (balance ?? 0).toLocaleString()} <span className="text-lg text-gray-400">pts</span>
          </h3>
        </div>
      </div>

      {/* How to earn */}
      <div className="col-span-12 xl:col-span-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full">
          <h4 className="font-semibold text-gray-800 dark:text-white/90 mb-3">Earn Points</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Buyer confirms purchase</span>
              <Badge color="success">+10 pts</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Price submission approved</span>
              <Badge color="success">+5 pts</Badge>
            </li>
          </ul>
        </div>
      </div>

      {/* How to spend */}
      <div className="col-span-12 xl:col-span-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full">
          <h4 className="font-semibold text-gray-800 dark:text-white/90 mb-3">Spend Points</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Boost listing (7 days)</span>
              <Badge color="error">-50 pts</Badge>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Boost listing (30 days)</span>
              <Badge color="error">-150 pts</Badge>
            </li>
          </ul>
        </div>
      </div>

      {/* Transaction history */}
      <div className="col-span-12">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="px-5 py-4 md:px-6 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Transaction History</h3>
          </div>

          {loading ? (
            <div className="p-5 md:p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 px-5">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="text-gray-400 size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">No transactions yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Points will appear here when buyers confirm purchases.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Reason</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-gray-800 dark:text-white/90">
                        {t.reason?.replace(/_/g, " ") ?? "Points transaction"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold ${t.amount > 0 ? "text-success-500" : "text-error-500"}`}>
                          {t.amount > 0 ? `+${t.amount}` : t.amount} pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
