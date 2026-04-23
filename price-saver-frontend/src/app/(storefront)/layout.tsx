import React from "react";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import Footer from "@/components/storefront/Footer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Navigation ── */}
      <Navbar />

      {/* ── Main content (sticky navbar, no pt offset needed) ── */}
      <main className="pb-[70px] md:pb-0">
        {children}
      </main>

      {/* ── Mobile bottom navigation ── */}
      <BottomNav />

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
