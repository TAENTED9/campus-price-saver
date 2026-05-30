import type { Metadata } from "next";
import Link from "next/link";
import { Flag, User, ShieldAlert, ArrowRight, Mail } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Report a Problem | Campify",
  description:
    "Report a misleading listing or a problematic seller. Help us keep Campify safe for everyone.",
  alternates: { canonical: "https://campify.digital/report" },
};

export default function ReportPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/20 mb-4">
          <ShieldAlert size={28} className="text-white" strokeWidth={2} />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Report a Problem
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Help us keep Campify safe for everyone
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1 - Report a Listing */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-7 hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
            <Flag size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Report a Listing
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Found a listing that&apos;s misleading, prohibited, or suspicious?
          </p>
          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <Step n={1}>Open the listing page</Step>
            <Step n={2}>Click the &quot;⋯&quot; menu or &quot;Report&quot; button</Step>
            <Step n={3}>Select a reason and add details</Step>
            <Step n={4}>Submit — our team reviews within 24 hours</Step>
          </ol>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:opacity-95 transition-opacity"
          >
            Browse Listings
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Card 2 - Report a Seller */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-7 hover:border-blue-500 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center mb-4">
            <User size={22} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Report a Seller
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Having issues with a seller&apos;s behaviour or communication?
          </p>
          <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <Step n={1}>Visit the seller&apos;s storefront at /store/[username]</Step>
            <Step n={2}>Click the &quot;Report&quot; option in their profile menu</Step>
            <Step n={3}>Describe the issue</Step>
            <Step n={4}>Submit — we&apos;ll investigate promptly</Step>
          </ol>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Need more help?
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-100 dark:border-blue-900/50 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
          <Mail size={18} className="text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          For urgent safety concerns, contact us directly at{" "}
          <a
            href={SUPPORT_MAILTO}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {SUPPORT_EMAIL || "support"}
          </a>
        </p>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-xs font-bold shrink-0">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
