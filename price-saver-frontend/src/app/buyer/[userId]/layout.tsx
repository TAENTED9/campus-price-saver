"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { Menu, Search, X } from "lucide-react";

interface BuyerLayoutProps {
  children: React.ReactNode;
  params: { userId: string };
}

export default function BuyerLayout({ children, params }: BuyerLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const userId = params.userId;

  /* ── All hooks before any early return ── */
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  /* Ctrl/Cmd+K focuses the desktop search input */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
      return;
    }
    if (!isLoading && user && user.id.toString() !== userId) {
      router.push(`/buyer/${user.id.toString()}/dashboard`);
    }
  }, [user, userId, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">

      {/* ── Mobile header (hidden lg+) ── */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-2">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Search size={20} />
          </button>
          <ThemeToggleButton />
          <NotificationDropdown scope="buyer" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop sidebar (hidden below lg) ── */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 h-screen sticky top-0 overflow-y-auto">
          <BuyerMenu userId={userId} onNav={() => {}} />
        </aside>

        {/* ── Right column ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

          {/* Desktop header (hidden below lg) */}
          <header className="hidden lg:flex items-center h-14 px-6 bg-white dark:bg-gray-900 sticky top-0 z-20 relative flex-shrink-0">
            {/* Left spacer */}
            <div className="flex-1" />

            {/* Centred inline search */}
            <form onSubmit={handleSearch} className="w-full max-w-sm">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <Search size={16} />
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search products, stores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 pl-9 pr-4 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                />
              </div>
            </form>

            {/* Right icons */}
            <div className="flex-1 flex justify-end items-center gap-2">
              <ThemeToggleButton />
              <NotificationDropdown scope="buyer" />
              <UserDropdown />
            </div>

            {/* Curved bottom divider between header and content */}
            <div className="absolute -bottom-3 left-0 right-0 h-3 pointer-events-none overflow-hidden">
              <svg
                viewBox="0 0 1440 12"
                preserveAspectRatio="none"
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0,0 C240,12 480,0 720,8 C960,16 1200,4 1440,0 L1440,0 L0,0 Z"
                  className="fill-white dark:fill-gray-900"
                />
                <path
                  d="M0,0 C240,12 480,0 720,8 C960,16 1200,4 1440,0"
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-gray-200 dark:stroke-gray-700"
                />
              </svg>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 lg:pt-6">
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[240px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Buyer Dashboard</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <BuyerMenu userId={userId} onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Mobile search overlay ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <form className="flex-1 relative" onSubmit={handleSearch}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search size={18} />
              </span>
              <input
                autoFocus
                type="search"
                placeholder="Search products, stores..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-base pl-10 pr-4 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </form>
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close search"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BuyerMenu({ userId, onNav }: { userId: string; onNav: () => void }) {
  const pathname = usePathname();
  const { counts } = useNotifications();

  const menuItems = [
    { label: "Dashboard",  href: `/buyer/${userId}/dashboard` },
    { label: "Wishlist",   href: `/buyer/${userId}/wishlist` },
    { label: "Orders",     href: `/buyer/${userId}/orders` },
    { label: "Messages",   href: `/messages`, badge: counts.messages || undefined },
    { label: "Settings",   href: `/buyer/${userId}/settings` },
  ];

  return (
    <nav className="flex flex-col flex-1">
      <div className="hidden lg:block px-4 py-5 border-b border-gray-100 dark:border-gray-800">
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
                onClick={onNav}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
