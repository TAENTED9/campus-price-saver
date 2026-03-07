"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { notificationsApi } from "@/lib/api";
import {
  ShoppingBag,
  Package,
  Heart,
  MessageCircle,
  Bell,
  Settings,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const WL_KEY = "ps_wishlist";
function getWishlistCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return (JSON.parse(localStorage.getItem(WL_KEY) || "[]") as unknown[]).length;
  } catch {
    return 0;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [wlCount, setWlCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [msgUnread, setMsgUnread] = useState(0);

  // Poll for unread message notifications
  useEffect(() => {
    if (!token) return;
    const fetchMsgCount = () => {
      notificationsApi.list(token, 0, 50)
        .then((res) => {
          const unread = res.notifications.filter((n) => n.type === "new_message" && !n.is_read).length;
          setMsgUnread(unread);
        })
        .catch(() => {});
    };
    fetchMsgCount();
    const interval = setInterval(fetchMsgCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/signin");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setWlCount(getWishlistCount());
    const handler = () => setWlCount(getWishlistCount());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const NAV_ITEMS = [
    { href: "/dashboard",          label: "Browse Market", icon: <ShoppingBag size={17} />, count: 0 },
    { href: "/dashboard/orders",   label: "My Orders",     icon: <Package size={17} />,     count: 0 },
    { href: "/dashboard/wishlist", label: "Wishlist",      icon: <Heart size={17} />,       count: wlCount },
    { href: "/dashboard/messages", label: "Messages",      icon: <MessageCircle size={17} />, count: msgUnread },
    { href: "/dashboard/alerts",   label: "Price Alerts",  icon: <Bell size={17} />,        count: 0 },
    { href: "/dashboard/settings", label: "Settings",      icon: <Settings size={17} />,    count: 0 },
  ];

  const initials = (user?.display_name || user?.username || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const karmaPoints = user?.balance ?? 0;
  const karmaMax    = 500;
  const karmaPct    = Math.min(Math.round((karmaPoints / karmaMax) * 100), 100);
  const karmaLabel  = karmaPoints >= 400 ? "Gold" : karmaPoints >= 200 ? "Silver" : "Bronze";
  const karmaColor  = karmaPoints >= 400 ? "bg-warning-400" : karmaPoints >= 200 ? "bg-gray-400" : "bg-[#cd7f32]";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* Profile mini card */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-[#06b6d4] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[13px] text-gray-800 dark:text-white truncate">
              {user?.display_name || user?.username}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">
              {user?.role ?? "Student"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className={active ? "text-brand-500" : "text-gray-400 dark:text-gray-500"}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.count > 0 && (
                <span className="bg-brand-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Karma widget */}
      <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-brand-500 to-[#06b6d4] p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white text-[12px] font-bold">Karma Points</p>
          <span className="text-white text-[11px] font-semibold opacity-80">{karmaLabel}</span>
        </div>
        <p className="text-white font-black text-xl mb-2">{karmaPoints.toLocaleString()}</p>
        <div className="h-1.5 bg-white/30 rounded-full">
          <div
            className={`h-full rounded-full ${karmaColor}`}
            style={{ width: `${karmaPct}%` }}
          />
        </div>
        <p className="text-white/70 text-[10px] mt-1.5">{karmaPoints} / {karmaMax} to next tier</p>
      </div>

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={() => { logout(); router.replace("/signin"); }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 xl:px-8">

      {/* Top bar (mobile: hamburger; desktop: title + theme toggle) */}
      <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-800 mb-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          title="Open menu"
          className="lg:hidden w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center"
        >
          <svg className="size-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <p className="font-bold text-gray-800 dark:text-white text-sm flex-1">Dashboard</p>
        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle theme"
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-white dark:bg-gray-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <span className="font-black text-gray-800 dark:text-white text-base">Menu</span>
              <button type="button" onClick={() => setMobileOpen(false)} title="Close menu" className="text-gray-500">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}

      <div className="flex gap-6">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 self-start sticky top-[90px] sm:top-[76px] lg:top-[72px] xl:top-[90px] max-h-[calc(100vh-90px)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03]">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-10">
          {children}
        </main>

      </div>
    </div>
  );
}
