import type { Metadata } from "next";
import Link from "next/link";
import HeroCarousel from "@/components/storefront/HeroCarousel";
import FlashSalesSection from "@/components/storefront/FlashSalesSection";
import FeaturedSection from "@/components/storefront/FeaturedSection";
import TrendingSection from "@/components/storefront/TrendingSection";
import NewArrivalsSection from "@/components/storefront/NewArrivalsSection";
import NearbySellersSection from "@/components/storefront/NearbySellersSection";
import StatsStrip from "@/components/storefront/StatsStrip";
import CategoriesSection from "@/components/storefront/CategoriesSection";

export const metadata: Metadata = {
  title: "Campify — Campus Marketplace",
  description: "Find the best prices across campus. Compare products, discover deals, and shop smart.",
};

// ─── Trust / Features strip ───────────────────────────────────────────────────

const features = [
  {
    title: "Free Price Comparison",
    sub: "Always 100% free to browse",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" stroke="#2563eb" strokeWidth="1.5"/>
        <path d="M12 18l4 4 8-8" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Verified Campus Sellers",
    sub: "UNILAG student-verified stores",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" stroke="#2563eb" strokeWidth="1.5"/>
        <path d="M18 8l2.5 7.5H28l-6.5 4.5 2.5 7.5L18 23l-6 4.5 2.5-7.5L8 15.5h7.5L18 8z" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Real-Time Prices",
    sub: "Updated by sellers daily",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" stroke="#2563eb" strokeWidth="1.5"/>
        <path d="M18 11v7l4 4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "24/7 Available",
    sub: "Browse anytime, anywhere",
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="17" stroke="#2563eb" strokeWidth="1.5"/>
        <path d="M13 18a5 5 0 1010 0 5 5 0 00-10 0zM18 10v2M18 26v2M10 18H8M28 18h-2" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="pb-10 lg:pb-12 xl:pb-15">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
          <HeroCarousel />

          {/* Stats strip — real data from API */}
          <StatsStrip />
        </div>
      </section>

      {/* Features / Trust strip */}
      <section className="bg-white dark:bg-gray-dark border-y border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="flex items-center gap-4">
                {f.icon}
                <div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories — real from API */}
      <CategoriesSection />

      {/* Flash Sales */}
      <FlashSalesSection />

      {/* Featured / Promoted */}
      <FeaturedSection />

      {/* Trending on Campus */}
      <TrendingSection />

      {/* New Arrivals */}
      <NewArrivalsSection />

      {/* Nearby Sellers */}
      <NearbySellersSection />

      {/* CTA Banner */}
      <section className="pb-12 xl:pb-15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
          <div className="relative rounded-[10px] bg-gradient-to-br from-brand-600 to-brand-800 overflow-hidden p-10 sm:p-14 text-center">
            <div className="absolute inset-0 opacity-10 dot-pattern" />
            <div className="relative z-10">
              <h2 className="font-bold text-white text-2xl sm:text-3xl mb-3">
                Ready to save money on campus?
              </h2>
              <p className="text-white/70 text-sm sm:text-base mb-8 max-w-md mx-auto">
                Join 5,000+ students already comparing prices and getting the best deals.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-brand-700 bg-white rounded-full hover:bg-gray-100 transition-colors"
                >
                  Get Started — It&apos;s Free
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors"
                >
                  Browse Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
