"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  MessageCircle,
  MapPin,
  Star,
  CheckCircle2,
  PackageOpen,
  Mail,
  Rocket,
  ShoppingBag,
  Store,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

type Tab = "buyers" | "sellers";

export default function HowItWorksPage() {
  const [tab, setTab] = useState<Tab>("buyers");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white mb-3">
          How Campify Works
        </h1>
        <p className="text-base md:text-lg text-gray-500 dark:text-gray-400">
          The simplest way to buy and sell on campus
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          <TabButton
            active={tab === "buyers"}
            onClick={() => setTab("buyers")}
            Icon={ShoppingBag}
            label="Buyers"
          />
          <TabButton
            active={tab === "sellers"}
            onClick={() => setTab("sellers")}
            Icon={Store}
            label="Sellers"
          />
        </div>
      </div>

      {/* Steps */}
      {tab === "buyers" ? <BuyersSteps /> : <SellersSteps />}

      {/* FAQ Preview */}
      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white text-center mb-2">
          Frequently Asked
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Quick answers to common questions
        </p>

        <div className="space-y-3 max-w-2xl mx-auto">
          <FAQItem
            q="Is Campify free to use?"
            a="Yes, completely free for buyers and sellers."
          />
          <FAQItem
            q="Who can sell on Campify?"
            a="Any verified UNILAG student."
          />
          <FAQItem
            q="What if something goes wrong?"
            a="Visit our Help Centre for guidance, or contact our support team directly."
          />
        </div>

        <div className="text-center mt-8">
          <Link
            href="/help"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold text-sm hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <HelpCircle size={16} />
            Visit Help Centre
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all " +
        (active
          ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white")
      }
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function BuyersSteps() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Step
        n={1}
        Icon={Search}
        title="Browse Listings"
        desc="Search thousands of listings from verified UNILAG students. Filter by category, price, condition (New / Fairly Used / Used), and pickup location."
      />
      <Step
        n={2}
        Icon={MessageCircle}
        title="Message the Seller"
        desc="Found something you like? Send a message directly to the seller through Campify's built-in inbox. No WhatsApp needed."
      />
      <Step
        n={3}
        Icon={MapPin}
        title="Collect On Campus"
        desc="Agree on a pickup spot — Faculty quad, hostel, library — and collect safely on campus."
      />
      <Step
        n={4}
        Icon={Star}
        title="Leave a Review"
        desc="After your purchase, leave a review to help other buyers and reward great sellers."
      />
    </div>
  );
}

function SellersSteps() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Step
        n={1}
        Icon={CheckCircle2}
        title="Get Verified"
        desc="Submit your UNILAG student ID and portal screenshot. Our team reviews and approves within 24-48 hours."
      />
      <Step
        n={2}
        Icon={PackageOpen}
        title="List Your Product"
        desc="Add up to 5 photos, write a description, set your price, and choose your campus pickup location."
      />
      <Step
        n={3}
        Icon={Mail}
        title="Respond to Inquiries"
        desc="Buyers message you directly. Respond quickly to earn Karma Points and boost your listing visibility."
      />
      <Step
        n={4}
        Icon={Rocket}
        title="Grow With Karma"
        desc="Every sale, review, and fast response earns you Karma Points. Spend them to feature your listings and reach more buyers."
      />
    </div>
  );
}

function Step({
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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 relative hover:border-blue-500 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
          <Icon size={20} className="text-white" strokeWidth={2} />
        </div>
        <span className="text-xs font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
          Step {n}
        </span>
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

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <p className="font-semibold text-gray-900 dark:text-white mb-1.5">{q}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {a}
      </p>
    </div>
  );
}
