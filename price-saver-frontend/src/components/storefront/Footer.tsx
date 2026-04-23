"use client";

import Link from "next/link";
import { GraduationCap, Mail, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const MARKETPLACE_LINKS = [
  { label: "Browse All",      href: "/search" },
  { label: "Flash Sales",     href: "/search?filter=flash" },
  { label: "New Arrivals",    href: "/search?sort=newest" },
  { label: "Categories",      href: "/search" },
  { label: "Top Deals",       href: "/search?sort=popular" },
];

const SELLER_LINKS_GUEST = [
  { label: "Start Selling",   href: "/signup?role=seller" },
  { label: "Seller Console",  href: "/seller" },
  { label: "How It Works",    href: "/#how-it-works" },
  { label: "Seller Docs",     href: "/help/sellers" },
];

const SELLER_LINKS_AUTH = [
  { label: "Seller Console",  href: "/seller" },
  { label: "How It Works",    href: "/#how-it-works" },
  { label: "Seller Docs",     href: "/help/sellers" },
];

const SUPPORT_LINKS = [
  { label: "Help Centre",     href: "/help" },
  { label: "Contact Us",      href: "/contact" },
  { label: "Report an Item",  href: "/report" },
  { label: "Privacy Policy",  href: "/privacy" },
  { label: "Terms of Use",    href: "/terms" },
];

export default function Footer() {
  const { isAuthenticated } = useAuth();
  const SELLER_LINKS = isAuthenticated ? SELLER_LINKS_AUTH : SELLER_LINKS_GUEST;
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

          {/* Col 1 — Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                <GraduationCap size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-gray-900 dark:text-white text-lg">Campify</span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-[220px]">
              UNILAG&apos;s trusted campus marketplace — buy, sell, and discover deals safely on campus.
            </p>
            <div className="mt-5 space-y-2">
              <p className="flex items-center gap-2 text-xs text-gray-400">
                <MapPin size={13} className="shrink-0" />
                UNILAG Campus, Yaba, Lagos
              </p>
              <a
                href="mailto:hello@campify.ng"
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Mail size={13} className="shrink-0" />
                hello@campify.ng
              </a>
            </div>
          </div>

          {/* Col 2 — Marketplace */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-4">Marketplace</h4>
            <ul className="space-y-3">
              {MARKETPLACE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Sellers */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-4">For Sellers</h4>
            <ul className="space-y-3">
              {SELLER_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Support */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-4">Support</h4>
            <ul className="space-y-3">
              {SUPPORT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Campify &middot; Campus Marketplace &middot; All rights reserved
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms"   className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Privacy</Link>
            <Link href="/contact" className="text-xs text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
