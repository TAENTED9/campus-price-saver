"use client";

import { useSidebar } from "@/context/SidebarContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import UserDropdown from "@/components/header/UserDropdown";
import { ToastProvider } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/admin/signin");
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

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <ToastProvider>
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
          {/* Desktop top bar — hidden below lg, no logo (logo is in sidebar) */}
          <header className="hidden lg:flex items-center justify-end h-14 px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-[20]">
            <div className="flex items-center gap-2">
              <ThemeToggleButton />
              <UserDropdown />
            </div>
          </header>

          {/* Mobile header — hidden at lg and above via lg:hidden inside AppHeader */}
          <AppHeader notificationScope="admin" showSearch={false} />

          <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
