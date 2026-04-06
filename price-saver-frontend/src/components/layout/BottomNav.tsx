"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Store,
  Package,
  Heart,
  MessageCircle,
  User,
  BarChart3,
  Settings,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

const BUYER_NAV: NavItem[] = [
  { href: "/",                    label: "Market",   icon: <Store size={20} /> },
  { href: "/dashboard/orders",    label: "Orders",   icon: <Package size={20} /> },
  { href: "/dashboard/wishlist",  label: "Wishlist",  icon: <Heart size={20} /> },
  { href: "/dashboard/messages",  label: "Messages",  icon: <MessageCircle size={20} /> },
  { href: "/dashboard/settings",  label: "Profile",   icon: <User size={20} /> },
];

const SELLER_NAV: NavItem[] = [
  { href: "/",                label: "Market",   icon: <Store size={20} /> },
  { href: "/seller/listings", label: "Listings", icon: <Package size={20} /> },
  { href: "/seller",          label: "Stats",    icon: <BarChart3 size={20} /> },
  { href: "/seller/inbox",    label: "Inbox",    icon: <MessageCircle size={20} /> },
  { href: "/seller/settings", label: "Settings", icon: <Settings size={20} /> },
];

export default function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  const isSeller = user?.role === "seller";
  const items = isSeller ? SELLER_NAV : BUYER_NAV;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden">
      <div className="flex items-center justify-around px-1 py-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px] min-h-[44px] justify-center ${
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
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
