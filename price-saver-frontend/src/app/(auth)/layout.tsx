import React from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 shadow-sm dark:bg-gray-dark dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-accent-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Campify</p>
              <p className="text-gray-400 text-xs leading-tight">Campus Marketplace</p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
          >
            ← Back to Store
          </Link>
        </div>
      </header>

      {/* Page body */}
      <div className="py-16 px-4">
        {children}
      </div>
    </div>
  );
}
