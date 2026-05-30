"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Shirt,
  Smartphone,
  BookOpen,
  Sparkles,
  Home,
  HeartPulse,
  Wrench,
  Package,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { itemsApi, type Category } from "@/lib/api";

type StaticCategory = {
  name: string;
  slug: string;
  description: string;
  Icon: LucideIcon;
  // names that may match in the backend (case-insensitive substring)
  matches: string[];
};

const CATEGORY_DEFS: StaticCategory[] = [
  {
    name: "Food & Groceries",
    slug: "food",
    description: "Home-cooked meals, snacks, drinks and groceries from student vendors on campus.",
    Icon: UtensilsCrossed,
    matches: ["food", "grocer", "snack", "drink"],
  },
  {
    name: "Fashion & Clothing",
    slug: "fashion",
    description: "Thrift finds, sneakers, ankara, accessories and the latest campus styles.",
    Icon: Shirt,
    matches: ["fashion", "cloth", "wear", "shoe"],
  },
  {
    name: "Electronics & Gadgets",
    slug: "electronics",
    description: "Phones, laptops, chargers, headphones and all the tech you need for school.",
    Icon: Smartphone,
    matches: ["electronic", "gadget", "tech", "phone", "laptop"],
  },
  {
    name: "Books & Stationery",
    slug: "books",
    description: "Past questions, textbooks, study materials and stationery for every department.",
    Icon: BookOpen,
    matches: ["book", "stationery", "stationary"],
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty",
    description: "Skincare, hair, makeup and grooming essentials curated by fellow students.",
    Icon: Sparkles,
    matches: ["beauty", "personal care", "cosmetic"],
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Hostel essentials — kettles, fans, bedding, cookware and small appliances.",
    Icon: Home,
    matches: ["home", "kitchen", "hostel"],
  },
  {
    name: "Health & Wellness",
    slug: "health",
    description: "Supplements, fitness gear, hygiene products and wellness essentials.",
    Icon: HeartPulse,
    matches: ["health", "wellness", "fitness"],
  },
  {
    name: "Services",
    slug: "services",
    description: "Tutoring, hairdressing, repairs, design and other student-offered services.",
    Icon: Wrench,
    matches: ["service"],
  },
  {
    name: "Other",
    slug: "other",
    description: "Anything else you might need — if it&apos;s on campus, it&apos;s probably here.",
    Icon: Package,
    matches: ["other", "misc"],
  },
];

function findBackendId(cats: Category[], def: StaticCategory): number | undefined {
  const lower = (s: string) => s.toLowerCase();
  // exact match first
  const exact = cats.find((c) => lower(c.name) === lower(def.name));
  if (exact) return exact.id;
  // substring match
  for (const c of cats) {
    const nameLower = lower(c.name);
    if (def.matches.some((m) => nameLower.includes(m))) return c.id;
  }
  return undefined;
}

export default function CategoriesPage() {
  const [backendCats, setBackendCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsApi
      .getCategories()
      .then(setBackendCats)
      .catch(() => setBackendCats([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          Browse by Category
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Find exactly what you need from UNILAG students and vendors
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 animate-pulse h-[180px]"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mb-4" />
              <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded mb-1" />
              <div className="h-3 w-4/5 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORY_DEFS.map((def) => {
            const id = findBackendId(backendCats, def);
            const href = id != null ? `/search?category_id=${id}` : `/search?category=${def.slug}`;
            const Icon = def.Icon;
            return (
              <Link
                key={def.slug}
                href={href}
                className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-100/40 dark:hover:shadow-none transition-all relative"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 mb-4">
                  <Icon size={22} className="text-white" strokeWidth={2} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
                  {def.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {def.description}
                </p>
                <ArrowRight
                  size={18}
                  className="absolute top-6 right-6 text-gray-300 dark:text-gray-700 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
