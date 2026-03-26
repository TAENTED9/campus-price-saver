"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/**
 * Buyer Layout
 * Shopping tools and personal dashboard for buyers
 * Protected: Accessible to all authenticated users
 */

interface BuyerLayoutProps {
  children: React.ReactNode;
  params: {
    userId: string;
  };
}

export default function BuyerLayout({ children, params }: BuyerLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const userId = params.userId;

  // Validate user owns this buyer profile
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
      return;
    }

    if (!isLoading && user && user.id.toString() !== userId) {
      // User trying to access another buyer's profile - redirect
      router.push(`/buyer/${user.id.toString()}/dashboard`);
    }
  }, [user, userId, isLoading, router]);

  if (isLoading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Buyer Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
        <BuyerMenu userId={userId} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function BuyerMenu({ userId }: { userId: string }) {
  const router = useRouter();

  const menuItems = [
    { label: "Dashboard", href: `/buyer/${userId}/dashboard` },
    { label: "Wishlist", href: `/buyer/${userId}/wishlist` },
    { label: "Orders", href: `/buyer/${userId}/orders` },
    { label: "Messages", href: `/messages` },
    { label: "Saved Locations", href: `/buyer/${userId}/locations` },
    { label: "Settings", href: `/buyer/${userId}/settings` },
  ];

  return (
    <nav className="p-4">
      <h2 className="text-lg font-bold mb-6 px-4">Shopping Tools</h2>
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
