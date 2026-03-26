"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/layout/AppSidebar";

/**
 * Seller Layout
 * Mini-business tools and analytics for sellers
 * Protected: Only accessible to sellers
 */

interface SellerLayoutProps {
  children: React.ReactNode;
  params: {
    userId: string;
  };
}

export default function SellerLayout({ children, params }: SellerLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const userId = params.userId;

  // Validate user owns this seller profile
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
      return;
    }

    if (!isLoading && user && user.id.toString() !== userId) {
      // User trying to access another seller's profile - redirect
      router.push(`/seller/${user.id.toString()}/dashboard`);
    }
  }, [user, userId, isLoading, router]);

  if (isLoading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Seller Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
        <SellerMenu userId={userId} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function SellerMenu({ userId }: { userId: string }) {
  const router = useRouter();
  
  const menuItems = [
    { label: "Dashboard", href: `/seller/${userId}/dashboard` },
    { label: "Inventory", href: `/seller/${userId}/inventory` },
    { label: "Analytics", href: `/seller/${userId}/analytics` },
    { label: "Orders", href: `/seller/${userId}/orders` },
    { label: "Payouts", href: `/seller/${userId}/payouts` },
    { label: "Settings", href: `/seller/${userId}/settings` },
  ];

  return (
    <nav className="p-4">
      <h2 className="text-lg font-bold mb-6 px-4">Business Tools</h2>
      <ul className="space-y-2">
        {menuItems.map((item) => (
          <li key={item.href}>
            <button
              onClick={() => router.push(item.href)}
              className="w-full text-left px-4 py-2 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
