"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import {
  Store,
  Package,
  Heart,
  MessageCircle,
  User,
  BarChart3,
  Settings,
} from "lucide-react";

const NAV_ICON_SIZE = 20;

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

const SELLER_NAV: NavItem[] = [
  { href: "/",                label: "Market",   icon: <Store size={NAV_ICON_SIZE} /> },
  { href: "/seller/listings", label: "Listings", icon: <Package size={NAV_ICON_SIZE} /> },
  { href: "/seller",          label: "Stats",    icon: <BarChart3 size={NAV_ICON_SIZE} /> },
  { href: "/seller/messages", label: "Inbox",    icon: <MessageCircle size={NAV_ICON_SIZE} /> },
  { href: "/seller/settings", label: "Settings", icon: <Settings size={NAV_ICON_SIZE} /> },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { counts, markCategoryRead } = useNotifications();
  const pathname = usePathname();

  const isSeller = user?.role === "seller";

  const BUYER_NAV: NavItem[] = [
    { href: "/",                   label: "Market",   icon: <Store size={NAV_ICON_SIZE} /> },
    { href: "/dashboard/orders",   label: "Orders",   icon: <Package size={NAV_ICON_SIZE} /> },
    { href: "/dashboard/wishlist", label: "Wishlist", icon: <Heart size={NAV_ICON_SIZE} /> },
    { href: "/messages",           label: "Messages", icon: <MessageCircle size={NAV_ICON_SIZE} />, badge: counts.messages || undefined },
    { href: "/dashboard/settings", label: "Profile",  icon: <User size={NAV_ICON_SIZE} /> },
  ];

  const items = isSeller ? SELLER_NAV : BUYER_NAV;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (!pathname?.startsWith(href + "/")) return false;
    // Prevent a short prefix (e.g. /seller) from matching when a more
    // specific sibling nav item (e.g. /seller/messages) already matches.
    return !items.some(
      (item) => item.href !== href && item.href !== "/" && pathname.startsWith(item.href)
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[30] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden">
      <div className="flex items-center justify-around py-1.5">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { if (item.label === "Messages" || item.label === "Inbox") markCategoryRead("messages"); }}
              className={`relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px] min-h-[44px] justify-center ${
                active
                  ? "text-brand-500 dark:text-brand-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {item.icon}
              <span className="text-xs font-semibold">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
