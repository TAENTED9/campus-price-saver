import type { Metadata } from "next";
import Link from "next/link";
import HeroBanner from "@/components/storefront/HeroBanner";
import StatsStrip from "@/components/storefront/StatsStrip";
import CategoriesSection from "@/components/storefront/CategoriesSection";
import FlashSalesSection from "@/components/storefront/FlashSalesSection";
import FeaturedSection from "@/components/storefront/FeaturedSection";
import TrendingSection from "@/components/storefront/TrendingSection";
import NewArrivalsSection from "@/components/storefront/NewArrivalsSection";
import NearbySellersSection from "@/components/storefront/NearbySellersSection";
import FeaturedSellersSection from "@/components/storefront/FeaturedSellersSection";
import RecentlyViewedSection from "@/components/storefront/RecentlyViewedSection";
import HowItWorks from "@/components/marketplace/HowItWorks";
import StickyBottomCTA from "@/components/storefront/StickyBottomCTA";

export const metadata: Metadata = {
  title: "Campify -- Campus Marketplace",
  description:
    "Find the best prices across campus. Compare products, discover deals, and shop smart.",
};

export default function HomePage() {
  return (
    <>
      {/* 1A - Hero Banner */}
      <HeroBanner />

      {/* 1B - Live Stats Bar */}
      <StatsStrip />

      {/* 1C - Category Grid */}
      <CategoriesSection />

      {/* 1D - Flash Sales (only shows if active) */}
      <FlashSalesSection />

      {/* 1E - Trending This Week */}
      <TrendingSection />

      {/* 1F - New Arrivals */}
      <NewArrivalsSection />

      {/* 1G - How It Works + CTA */}
      <HowItWorks />
      <section className="pb-12 xl:pb-15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 text-center">
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mb-4">
            Join 1,200+ UNILAG students already buying &amp; selling
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all min-h-[44px]"
          >
            Create Free Account &rarr;
          </Link>
        </div>
      </section>

      {/* 1H - Featured Sellers */}
      <FeaturedSellersSection />

      {/* Featured / Promoted */}
      <FeaturedSection />

      {/* Nearby Sellers */}
      <NearbySellersSection />

      {/* 1I - Recently Viewed (auth-gated) */}
      <RecentlyViewedSection />

      {/* CTA Banner */}
      <section className="pb-12 xl:pb-15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0">
          <div className="relative rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 overflow-hidden p-10 sm:p-14 text-center">
            <div className="absolute inset-0 opacity-10 dot-pattern" />
            <div className="relative z-10">
              <h2 className="font-bold text-white text-xl md:text-2xl lg:text-3xl mb-3">
                Ready to save money on campus?
              </h2>
              <p className="text-white/70 text-xs md:text-sm mb-8 max-w-md mx-auto">
                Join 5,000+ students already comparing prices and getting the
                best deals.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-blue-700 bg-white rounded-full hover:bg-gray-100 transition-colors min-h-[44px]"
                >
                  Get Started -- It&apos;s Free
                </Link>
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white border border-white/30 rounded-full hover:bg-white/10 transition-colors min-h-[44px]"
                >
                  Browse Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 1J - Sticky Bottom CTA (mobile only) */}
      <StickyBottomCTA />

      {/* Extra bottom padding on mobile so content isn't hidden behind sticky CTA */}
      <div className="h-16 md:hidden" />
    </>
  );
}
