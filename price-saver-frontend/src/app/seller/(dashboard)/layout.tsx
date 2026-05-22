"use client";

import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/layout/AppHeader";
import SellerSidebar from "@/components/seller/SellerSidebar";
import Backdrop from "@/layout/Backdrop";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { ToastProvider } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import BottomNav from "@/components/layout/BottomNav";

export default function SellerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  /* ── Hooks must come before any early return ── */
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
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
    if (!isLoading && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
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
    <ToastProvider>
    <div className="min-h-screen xl:flex">
      <SellerSidebar />
      <Backdrop />

      <div className="flex-1 lg:ml-[220px] min-h-screen bg-gray-50 dark:bg-gray-950">

        {/* ── Desktop top bar (lg+) ── */}
        <header className="hidden lg:flex items-center h-14 px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-[20] gap-4">
          {/* Search bar — left side, takes available space */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <Search size={15} />
            </span>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search listings, stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </form>

          {/* Right actions — pushed to far right by flex */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <ThemeToggleButton />
            <NotificationDropdown scope="seller" />
            <UserDropdown />
          </div>
        </header>

        {/* Mobile header — lg:hidden is applied inside AppHeader */}
        <AppHeader notificationScope="seller" />

        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6 pb-20 md:pb-6 lg:pt-6">
          {children}
        </div>
      </div>

      {/* Floating "View Marketplace" button (desktop only) */}
      <Link
        href="/"
        className="hidden md:flex fixed bottom-6 right-6 z-[20] items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-lg transition-colors"
      >
        <Store size={16} />
        View Marketplace
      </Link>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
    </ToastProvider>
  );
}
