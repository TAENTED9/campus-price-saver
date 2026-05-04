"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";
import Footer from "@/components/storefront/Footer";

/**
 * Renders the homepage Navbar / BottomNav / Footer only when
 * the current route is NOT under /dashboard.
 * This prevents the homepage nav from showing alongside the
 * dashboard's own top-bar when navigating to /dashboard/*.
 */
export function ConditionalStorefrontWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="pb-[70px] md:pb-0">{children}</main>
      <BottomNav />
      <Footer />
    </div>
  );
}
