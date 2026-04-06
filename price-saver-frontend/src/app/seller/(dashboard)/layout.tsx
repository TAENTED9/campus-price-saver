"use client";

import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/layout/AppHeader";
import SellerSidebar from "@/components/seller/SellerSidebar";
import Backdrop from "@/layout/Backdrop";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import React, { useEffect } from "react";
import BottomNav from "@/components/layout/BottomNav";

export default function SellerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobileOpen } = useSidebar();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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
    <div className="min-h-screen xl:flex">
      <SellerSidebar />
      <Backdrop />
      <div className="flex-1 lg:ml-[220px]">
        <AppHeader notificationScope="seller" />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6 pb-20 md:pb-6">{children}</div>
      </div>

      {/* Floating "View Marketplace" button (desktop only) */}
      <Link
        href="/"
        className="hidden md:flex fixed bottom-6 right-6 z-40 bg-blue-600 text-white rounded-full px-5 py-3 font-bold text-sm shadow-lg shadow-blue-200 dark:shadow-blue-900/30 hover:bg-blue-700 hover:scale-105 transition-all items-center gap-2 min-h-[44px]"
      >
        <Store size={16} />
        View Marketplace
      </Link>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
