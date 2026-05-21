import type { Metadata } from "next";
import Link from "next/link";
import HeroCarousel from "@/components/storefront/HeroCarousel";
import StatsStrip from "@/components/storefront/StatsStrip";
import AnnouncementBanner from "@/components/storefront/AnnouncementBanner";
import CategoriesSection from "@/components/storefront/CategoriesSection";
import FlashSalesSection from "@/components/storefront/FlashSalesSection";
import FeaturedSection from "@/components/storefront/FeaturedSection";
import TrendingSection from "@/components/storefront/TrendingSection";
import NewArrivalsSection from "@/components/storefront/NewArrivalsSection";
import NearbySellersSection from "@/components/storefront/NearbySellersSection";
import FeaturedSellersSection from "@/components/storefront/FeaturedSellersSection";
import RecentlyViewedSection from "@/components/storefront/RecentlyViewedSection";
import HowItWorks from "@/components/marketplace/HowItWorks";
import HomepageAnnouncements from "@/components/storefront/HomepageAnnouncements";
import StickyBottomCTA from "@/components/storefront/StickyBottomCTA";
import GuestOnlyBlock from "@/components/storefront/GuestOnlyBlock";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Campify — UNILAG Campus Marketplace",
  description:
    "Buy and sell within the UNILAG community. Find phones, clothes, textbooks, food, and more from verified student sellers.",
  keywords: [
    "UNILAG marketplace",
    "campus market",
    "student selling",
    "buy sell UNILAG",
    "Campify Nigeria",
  ],
  openGraph: {
    title: "Campify — UNILAG Campus Marketplace",
    description:
      "Buy and sell within the UNILAG community. Verified student sellers, fair prices, fast meetups.",
    url: "https://campify.ng",
    siteName: "Campify",
    images: [
      {
        url: "https://campify.ng/og-image.png",
        width: 1200,
        height: 630,
        alt: "Campify Campus Marketplace",
      },
    ],
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campify — UNILAG Campus Marketplace",
    description: "Buy and sell within the UNILAG community.",
    images: ["https://campify.ng/og-image.png"],
  },
  alternates: {
    canonical: "https://campify.ng",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function HomePage() {
  return (
    <>
      {/* Hero carousel — admin-controlled banner slides + side cards */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-2">
        <HeroCarousel />
      </div>

      {/* Admin announcement banner (dismissible, client-side fetch) */}
      <AnnouncementBanner />

      {/* Live Stats Bar */}
      <StatsStrip />

      {/* 1C - Category Grid */}
      <CategoriesSection />

      {/* 1D - Flash Sales (only shows if active) */}
      <FlashSalesSection />

      {/* 1E - Trending This Week */}
      <TrendingSection />

      {/* 1F - New Arrivals */}
      <NewArrivalsSection />

      {/* Homepage Announcement Posts */}
      <HomepageAnnouncements />

      {/* How It Works + CTA */}
      <HowItWorks />
      <GuestOnlyBlock>
        <section className="pb-12 xl:pb-15">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center">
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
      </GuestOnlyBlock>

      {/* 1H - Featured Sellers */}
      <FeaturedSellersSection />

      {/* Featured / Promoted */}
      <FeaturedSection />

      {/* Nearby Sellers */}
      <NearbySellersSection />

      {/* 1I - Recently Viewed (auth-gated) */}
      <RecentlyViewedSection />

      {/* CTA Banner */}
      <GuestOnlyBlock>
        <section className="pb-12 xl:pb-15">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
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
      </GuestOnlyBlock>

      {/* 1J - Sticky Bottom CTA (mobile only) */}
      <StickyBottomCTA />

      {/* Extra bottom padding on mobile so content isn't hidden behind sticky CTA */}
      <div className="h-16 md:hidden" />
    </>
  );
}
