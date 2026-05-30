"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  HelpCircle,
  ChevronDown,
  ShoppingBag,
  Store,
  User,
  Wallet,
  Shield,
  Sparkles,
} from "lucide-react";
import { SUPPORT_EMAIL, APP_DOMAIN } from "@/lib/siteConfig";

// FAQ copy reads these from env so the answers track the live support address /
// public domain. The fallback strings stay generic to avoid leaking a stale value.
const SUPPORT_LABEL = SUPPORT_EMAIL || "our support team";
const PRIVACY_LINK_LABEL = APP_DOMAIN ? `${APP_DOMAIN}/privacy` : "our Privacy Policy";

type FAQCategory = "All" | "Buying" | "Selling" | "Account" | "Payments" | "Safety";

type FAQ = {
  category: Exclude<FAQCategory, "All">;
  q: string;
  a: string;
};

const FAQS: FAQ[] = [
  // BUYING
  {
    category: "Buying",
    q: "How do I find what I'm looking for?",
    a: "Use the search bar on the homepage or browse by category. You can filter results by price, condition (New/Fairly Used/Used), and pickup location to narrow down exactly what you need.",
  },
  {
    category: "Buying",
    q: "How do I contact a seller?",
    a: "Click the \"Message\" button on any listing to open a conversation in your Campify inbox. You must be logged in to send messages.",
  },
  {
    category: "Buying",
    q: "Is it safe to buy on Campify?",
    a: "All sellers on Campify are verified UNILAG students. We recommend always collecting items on campus in a public location, and checking a seller's reviews and verified badge before purchasing.",
  },
  {
    category: "Buying",
    q: "What if the item isn't as described?",
    a: "If a listing is misleading or the seller is unresponsive, use the \"Report\" button on the listing page. Our admin team reviews all reports within 24 hours.",
  },
  {
    category: "Buying",
    q: "Can I return an item?",
    a: "Campify facilitates connections between buyers and sellers but does not manage transactions directly. Returns are agreed between the buyer and seller. We recommend confirming item condition before collecting.",
  },
  {
    category: "Buying",
    q: "What does \"Fairly Used\" mean?",
    a: "Fairly Used means the item has been used but is in good working condition with minor signs of wear. Always check the listing photos and ask the seller if you need more details.",
  },

  // SELLING
  {
    category: "Selling",
    q: "Who can sell on Campify?",
    a: "Any currently enrolled UNILAG student can sell on Campify. You must complete our verification process before listing products.",
  },
  {
    category: "Selling",
    q: "How do I get verified?",
    a: "Go to Seller Settings → Verification tab, or visit campify.digital/seller/verification. You'll need your student ID card and a screenshot of your UNILAG student portal.",
  },
  {
    category: "Selling",
    q: "How long does verification take?",
    a: "Our team reviews verification submissions within 24–48 hours. You'll receive an email notification when approved or rejected.",
  },
  {
    category: "Selling",
    q: "How do I create a listing?",
    a: "Once verified, go to your Seller Dashboard → Listings → Add New Listing. Fill in the title, description, price, condition, category, pickup location, and add up to 5 photos.",
  },
  {
    category: "Selling",
    q: "Why isn't my listing showing on the homepage?",
    a: "New listings are reviewed by our admin team before going live. This usually takes a few hours. You'll be notified once approved.",
  },
  {
    category: "Selling",
    q: "What are Karma Points?",
    a: "Karma Points are earned by being an active, reliable seller — getting verified, completing your profile, receiving 5-star reviews, and responding to inquiries quickly. Use them to boost your listing visibility. See /seller-docs for the full breakdown.",
  },
  {
    category: "Selling",
    q: "Can I edit a listing after posting?",
    a: "Yes. Go to Seller Dashboard → Listings and click Edit on any of your listings.",
  },
  {
    category: "Selling",
    q: "What items can't I sell?",
    a: "Illegal items, counterfeit goods, stolen property, prescription drugs, adult content, and anything that violates UNILAG campus rules are strictly prohibited. Violating listings will be removed and your account may be suspended.",
  },

  // ACCOUNT
  {
    category: "Account",
    q: "How do I reset my password?",
    a: "Click \"Forgot Password\" on the login page and enter your email. You'll receive a reset link within a few minutes.",
  },
  {
    category: "Account",
    q: "How do I change my profile picture?",
    a: "Go to your dashboard → Settings → Profile. You can upload a new profile photo there.",
  },
  {
    category: "Account",
    q: "Can I be both a buyer and a seller?",
    a: "Yes. All Campify users can browse and buy. To sell, you just need to complete seller verification.",
  },
  {
    category: "Account",
    q: "How do I delete my account?",
    a: `Contact ${SUPPORT_LABEL} with your account email and the subject "Account Deletion Request". We'll process it within 7 business days.`,
  },
  {
    category: "Account",
    q: "Why was my account suspended?",
    a: `Accounts are suspended for violating our Terms of Use. You should have received an email with the reason. Contact ${SUPPORT_LABEL} if you believe it was a mistake.`,
  },

  // SAFETY
  {
    category: "Safety",
    q: "How does Campify keep me safe?",
    a: "All sellers are verified UNILAG students. We recommend meeting in public campus locations (faculty quads, library, cafeteria) and never sharing personal financial information. Never pay in advance for items — collect and inspect first.",
  },
  {
    category: "Safety",
    q: "What should I do if I feel unsafe during a transaction?",
    a: `Trust your instincts. Cancel the transaction and report the user via the listing page or contact ${SUPPORT_LABEL}.`,
  },
  {
    category: "Safety",
    q: "How do I report a suspicious listing or user?",
    a: `Click the "Report" button on any listing. You can also email ${SUPPORT_LABEL} with details.`,
  },
  {
    category: "Safety",
    q: "Is my personal data safe?",
    a: `Yes. See our Privacy Policy at ${PRIVACY_LINK_LABEL} for full details on how we handle your data.`,
  },
];

const CATEGORIES: { key: FAQCategory; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "All", icon: Sparkles },
  { key: "Buying", icon: ShoppingBag },
  { key: "Selling", icon: Store },
  { key: "Account", icon: User },
  { key: "Payments", icon: Wallet },
  { key: "Safety", icon: Shield },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FAQCategory>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      const matchesCat = activeCategory === "All" || f.category === activeCategory;
      const matchesQuery =
        !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [query, activeCategory]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-500/20 mb-4">
          <HelpCircle size={28} className="text-white" strokeWidth={2} />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Help Centre
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Answers to common questions about buying, selling, and staying safe on Campify
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for help..."
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(({ key, icon: Icon }) => {
          const active = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all " +
                (active
                  ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-500/20"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400")
              }
            >
              <Icon size={14} />
              {key}
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-gray-500 dark:text-gray-400">
            No results for &quot;{query}&quot;.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Try a different keyword or browse all categories.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div
                key={`${faq.category}-${i}`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full text-left flex items-start justify-between gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-1">
                      {faq.category}
                    </span>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {faq.q}
                    </p>
                  </div>
                  <ChevronDown
                    size={20}
                    className={
                      "shrink-0 text-gray-400 transition-transform " +
                      (open ? "rotate-180" : "")
                    }
                  />
                </button>
                {open && (
                  <div className="px-5 pb-5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Still need help */}
      <div className="mt-10 p-8 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-center">
        <h2 className="text-xl md:text-2xl font-bold mb-2">
          Can&apos;t find your answer?
        </h2>
        <p className="text-white/90 mb-5">Contact our support team.</p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-blue-600 text-sm font-semibold shadow-md hover:bg-blue-50 transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
