"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  GraduationCap,
  PackageOpen,
  Wallet,
  Zap,
  ShieldCheck,
  MapPin,
  Star,
} from "lucide-react";

function useSmartCTA() {
  const { isAuthenticated, user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  if (!isAuthenticated) {
    return { label: "Create Seller Account", href: "/signup?role=seller" };
  }
  if (role === "seller" || role === "admin") {
    return { label: "Go to Dashboard", href: "/seller" };
  }
  return { label: "Start Verification", href: "/seller/verification" };
}

function SmartCTAButton({ size = "lg" }: { size?: "lg" | "md" }) {
  const cta = useSmartCTA();
  const sizeClass =
    size === "lg"
      ? "px-7 py-3.5 text-base"
      : "px-5 py-2.5 text-sm";
  return (
    <Link
      href={cta.href}
      className={
        "inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-semibold shadow-md shadow-blue-500/25 hover:opacity-95 transition-opacity " +
        sizeClass
      }
    >
      {cta.label}
      <ArrowRight size={size === "lg" ? 18 : 16} />
    </Link>
  );
}

export default function StartSellingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Hero */}
      <section className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-5">
          <GraduationCap size={14} />
          UNILAG Students Only
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 leading-tight">
          Turn Your Campus Hustle
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-br from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            Into a Business
          </span>
        </h1>
        <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-7">
          Join hundreds of UNILAG students selling everything from gadgets to
          food — right on campus.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <SmartCTAButton />
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            How It Works
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white text-center mb-10">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StepCard
            n={1}
            Icon={GraduationCap}
            title="Verify Your Student Status"
            desc="Submit your UNILAG ID and portal screenshot. Approval typically within 24-48 hours."
          />
          <StepCard
            n={2}
            Icon={PackageOpen}
            title="List Your Products"
            desc="Add photos, set prices, choose a pickup location. Up to 5 photos per listing."
          />
          <StepCard
            n={3}
            Icon={Wallet}
            title="Start Earning"
            desc="Buyers find you, message you, and collect on campus. No commissions, no fees."
          />
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white text-center mb-10">
          Why Sell on Campify
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <BenefitCard
            Icon={Zap}
            title="Zero Fees"
            desc="List and sell for free. No commissions, no hidden charges."
          />
          <BenefitCard
            Icon={ShieldCheck}
            title="Verified Community"
            desc="Only verified UNILAG students can sell on Campify."
          />
          <BenefitCard
            Icon={MapPin}
            title="On-Campus Pickup"
            desc="Buyers collect directly from your chosen campus location."
          />
          <BenefitCard
            Icon={Star}
            title="Build Your Reputation"
            desc="Earn reviews, karma points, and a verified seller badge."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center p-8 md:p-12 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
        <h2 className="text-2xl md:text-3xl font-black mb-3">Ready to start?</h2>
        <p className="text-white/90 mb-6 max-w-md mx-auto">
          Join hundreds of student sellers already growing their hustle on campus.
        </p>
        <div className="inline-block">
          <FinalCTAButton />
        </div>
      </section>
    </div>
  );
}

function FinalCTAButton() {
  const cta = useSmartCTA();
  return (
    <Link
      href={cta.href}
      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-blue-600 font-semibold shadow-md hover:bg-blue-50 transition-colors"
    >
      {cta.label}
      <ArrowRight size={18} />
    </Link>
  );
}

function StepCard({
  n,
  Icon,
  title,
  desc,
}: {
  n: number;
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 relative">
      <span className="absolute top-5 right-5 text-3xl font-black text-gray-100 dark:text-gray-800">
        0{n}
      </span>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 mb-4">
        <Icon size={22} className="text-white" strokeWidth={2} />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

function BenefitCard({
  Icon,
  title,
  desc,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex items-start gap-4 hover:border-blue-500 transition-colors">
      <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-blue-600 dark:text-blue-400" strokeWidth={2} />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}
