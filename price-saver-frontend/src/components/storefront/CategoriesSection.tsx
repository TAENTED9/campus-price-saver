"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  UtensilsCrossed,
  Shirt,
  Smartphone,
  BookOpen,
  Sparkles,
  Palette,
  Wrench,
  Home,
  Settings2,
} from "lucide-react";
import { itemsApi, type Category } from "@/lib/api";
import { categoryHref } from "@/lib/categoryLinks";

const CATEGORIES = [
  { icon: UtensilsCrossed, label: "Food",         slug: "food" },
  { icon: Shirt,           label: "Fashion",      slug: "fashion" },
  { icon: Smartphone,      label: "Tech",         slug: "tech" },
  { icon: BookOpen,        label: "Books",        slug: "books" },
  { icon: Sparkles,        label: "Beauty",       slug: "beauty" },
  { icon: Palette,         label: "Services",     slug: "services" },
  { icon: Wrench,          label: "Handmade",     slug: "handmade" },
  { icon: Home,            label: "Hostel Items", slug: "hostel-items" },
  { icon: Settings2,       label: "Other",        slug: "other" },
];

// A swatch is a pair of FULL static Tailwind class strings (Tailwind can't see
// dynamically-built class names, so each must appear verbatim somewhere).
type Swatch = { icon: string; ring: string };

const PALETTE: Swatch[] = [
  { icon: "text-blue-600 dark:text-blue-400",       ring: "hover:border-blue-500 hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20" },
  { icon: "text-emerald-600 dark:text-emerald-400", ring: "hover:border-emerald-500 hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20" },
  { icon: "text-orange-500 dark:text-orange-400",   ring: "hover:border-orange-500 hover:shadow-orange-100/50 dark:hover:shadow-orange-900/20" },
  { icon: "text-violet-600 dark:text-violet-400",   ring: "hover:border-violet-500 hover:shadow-violet-100/50 dark:hover:shadow-violet-900/20" },
  { icon: "text-amber-500 dark:text-amber-400",     ring: "hover:border-amber-500 hover:shadow-amber-100/50 dark:hover:shadow-amber-900/20" },
  { icon: "text-sky-500 dark:text-sky-400",         ring: "hover:border-sky-500 hover:shadow-sky-100/50 dark:hover:shadow-sky-900/20" },
  { icon: "text-teal-600 dark:text-teal-400",       ring: "hover:border-teal-500 hover:shadow-teal-100/50 dark:hover:shadow-teal-900/20" },
  { icon: "text-indigo-600 dark:text-indigo-400",   ring: "hover:border-indigo-500 hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20" },
];

// Semantic locks — these categories keep a fixed identity and never shuffle.
const PINK:   Swatch = { icon: "text-pink-500 dark:text-pink-400",       ring: "hover:border-pink-500 hover:shadow-pink-100/50 dark:hover:shadow-pink-900/20" };
const PURPLE: Swatch = { icon: "text-fuchsia-500 dark:text-fuchsia-400", ring: "hover:border-fuchsia-500 hover:shadow-fuchsia-100/50 dark:hover:shadow-fuchsia-900/20" };
const LOCKED: Record<string, Swatch> = { fashion: PINK, beauty: PURPLE };

// Deterministic assignment used for SSR + first paint (avoids hydration
// mismatch). The shuffle happens client-side after mount.
function assign(pool: Swatch[]): Record<string, Swatch> {
  const out: Record<string, Swatch> = {};
  let i = 0;
  for (const cat of CATEGORIES) {
    out[cat.slug] = LOCKED[cat.slug] ?? pool[i++ % pool.length];
  }
  return out;
}

export default function CategoriesSection() {
  const [swatches, setSwatches] = useState<Record<string, Swatch>>(() => assign(PALETTE));
  const [cats, setCats] = useState<Category[]>([]);

  // Reshuffle the non-locked category colors on every load so the homepage
  // feels fresh each visit. Beauty & Fashion stay pink/purple.
  useEffect(() => {
    const shuffled = [...PALETTE].sort(() => Math.random() - 0.5);
    setSwatches(assign(shuffled));
  }, []);

  // Resolve homepage slugs → real backend category ids so each tile links to
  // /search?category_id=… instead of an unfiltered word query.
  useEffect(() => {
    itemsApi.getCategories().then(setCats).catch(() => setCats([]));
  }, []);

  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 xl:px-8 2xl:px-0">
        <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-6">
          Shop by Category
        </h2>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-3 md:gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const sw = swatches[cat.slug] ?? PALETTE[0];
            return (
              <Link
                key={cat.slug}
                href={categoryHref(cats, cat.slug, cat.label)}
                className={`flex flex-col items-center gap-2 p-3 md:p-4 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 active:scale-95 min-h-[44px] ${sw.ring}`}
              >
                <Icon size={24} className={`md:w-7 md:h-7 transition-colors ${sw.icon}`} strokeWidth={1.75} />
                <span className="text-[10px] md:text-xs font-bold text-gray-600 dark:text-gray-400 text-center leading-tight">
                  {cat.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
