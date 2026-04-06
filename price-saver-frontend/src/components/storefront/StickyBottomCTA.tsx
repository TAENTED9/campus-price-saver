"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function StickyBottomCTA() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 md:hidden">
      {isAuthenticated ? (
        <Link
          href="/search"
          className="flex-1 bg-blue-600 text-white font-bold text-sm py-3 rounded-xl text-center hover:bg-blue-700 transition-all min-h-[44px] flex items-center justify-center"
        >
          Browse Products
        </Link>
      ) : (
        <>
          <Link
            href="/signup"
            className="flex-1 bg-blue-600 text-white font-bold text-sm py-3 rounded-xl text-center hover:bg-blue-700 transition-all min-h-[44px] flex items-center justify-center"
          >
            Sign Up Free
          </Link>
          <Link
            href="/signin"
            className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm py-3 rounded-xl text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all min-h-[44px] flex items-center justify-center"
          >
            Log In
          </Link>
        </>
      )}
    </div>
  );
}
