"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { MessageCircle, Heart, Package, Search, ArrowRight } from "lucide-react";

export default function BuyerDashboard({ params }: { params: { userId: string } }) {
  const { user } = useAuth();
  const { counts } = useNotifications();

  const quickActions = [
    {
      label: "Browse Listings",
      description: "Discover products across campus",
      icon: <Search size={20} className="text-brand-500" />,
      href: "/search",
      accent: "from-brand-500/10 to-accent-500/10 border-brand-200/60 dark:border-brand-800/60",
    },
    {
      label: "Messages",
      description: counts.messages > 0
        ? `${counts.messages} unread message${counts.messages > 1 ? "s" : ""}`
        : "Chat with sellers",
      icon: <MessageCircle size={20} className="text-brand-500" />,
      href: "/messages",
      badge: counts.messages || undefined,
      accent: "from-brand-500/10 to-accent-500/10 border-brand-200/60 dark:border-brand-800/60",
    },
    {
      label: "Wishlist",
      description: "Items you've saved",
      icon: <Heart size={20} className="text-rose-500" />,
      href: `/buyer/${params.userId}/wishlist`,
      accent: "from-rose-500/10 to-pink-500/10 border-rose-200/60 dark:border-rose-800/60",
    },
    {
      label: "Orders",
      description: "Coming soon",
      icon: <Package size={20} className="text-amber-500" />,
      href: `/buyer/${params.userId}/orders`,
      accent: "from-amber-500/10 to-yellow-400/10 border-amber-200/60 dark:border-amber-800/60",
    },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">
          Welcome back{user?.username ? `, ${user.username}` : ""} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Find the best prices across campus.
        </p>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`relative rounded-2xl border bg-gradient-to-br ${a.accent} bg-white dark:bg-white/[0.03] p-4 flex items-center gap-3 hover:shadow-sm transition-shadow`}
            >
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-white">{a.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.description}</p>
              </div>
              {a.badge ? (
                <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {a.badge > 9 ? "9+" : a.badge}
                </span>
              ) : (
                <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Messages CTA if unread */}
      {counts.messages > 0 && (
        <section className="rounded-2xl border border-brand-200/60 dark:border-brand-800/60 bg-gradient-to-br from-brand-500/8 to-accent-500/6 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800 dark:text-white text-sm">
              You have {counts.messages} unread message{counts.messages > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sellers are waiting for your reply.
            </p>
          </div>
          <Link
            href="/messages"
            className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-4 py-2 flex-shrink-0 transition-colors"
          >
            View
          </Link>
        </section>
      )}
    </div>
  );
}
