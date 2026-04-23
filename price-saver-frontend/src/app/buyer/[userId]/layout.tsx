"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";

/**
 * Buyer Layout
 * Shopping tools and personal dashboard for buyers
 * Protected: Accessible to all authenticated users
 */

interface BuyerLayoutProps {
  children: React.ReactNode;
  params: {
    userId: string;
  };
}

export default function BuyerLayout({ children, params }: BuyerLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const userId = params.userId;

  // Validate user owns this buyer profile
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
      return;
    }

    if (!isLoading && user && user.id.toString() !== userId) {
      // User trying to access another buyer's profile - redirect
      router.push(`/buyer/${user.id.toString()}/dashboard`);
    }
  }, [user, userId, isLoading, router]);

  if (isLoading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Buyer Sidebar */}
      <aside className="w-60 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto flex-shrink-0">
        <BuyerMenu userId={userId} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

function BuyerMenu({ userId }: { userId: string }) {
  const pathname = usePathname();
  const { counts } = useNotifications();

  const menuItems = [
    { label: "Dashboard",       href: `/buyer/${userId}/dashboard` },
    { label: "Wishlist",        href: `/buyer/${userId}/wishlist` },
    { label: "Orders",          href: `/buyer/${userId}/orders` },
    { label: "Messages",        href: `/messages`,                badge: counts.messages || undefined },
    { label: "Saved Locations", href: `/buyer/${userId}/locations` },
    { label: "Settings",        href: `/buyer/${userId}/settings` },
  ];

  return (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Buyer Dashboard</p>
      </div>
      <ul className="p-3 space-y-0.5">
        {menuItems.map((item) => {
          const active = item.href === "/messages"
            ? pathname === "/messages"
            : pathname?.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {item.label}
                {item.badge ? (
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
