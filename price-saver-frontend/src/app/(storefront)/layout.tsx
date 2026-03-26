import React from "react";
import Link from "next/link";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Interactive header (client component) ── */}
      <StorefrontHeader />

      {/* ── Main content (offset for fixed header) ── */}
      <main className="pt-[90px] sm:pt-[76px] lg:pt-[72px] xl:pt-[90px]">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 bg-white border-t border-gray-200 dark:bg-gray-dark dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-[#06b6d4] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">Campify</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Compare prices across campus hostels, cafeterias, and stores — all in one place.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">Quick Links</h4>
              <ul className="space-y-2.5">
                {[["Home", "/"], ["Browse Products", "/search"], ["Categories", "/search"], ["Top Deals", "/deals"]].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">Account</h4>
              <ul className="space-y-2.5">
                {[["Sign In", "/signin"], ["Create Account", "/signup"], ["Sell on Campus", "/signup"], ["Dashboard", "/dashboard"]].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li className="text-sm text-gray-500 dark:text-gray-400">UNILAG Campus, Lagos</li>
                <li><a href="mailto:hello@campify.app" className="text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400 transition-colors">hello@campify.app</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© {new Date().getFullYear()} Campify · Campus Marketplace</p>
            <div className="flex gap-4">
              <Link href="/terms" className="text-xs text-gray-400 hover:text-brand-500 transition-colors">Terms</Link>
              <Link href="/privacy" className="text-xs text-gray-400 hover:text-brand-500 transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
