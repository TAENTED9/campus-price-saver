"use client";

import Link from "next/link";
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

export default function CategoriesSection() {
  return (
    <section className="py-10 xl:py-14">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-6">
          Shop by Category
        </h2>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9 gap-3 md:gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                href={`/search?category=${cat.slug}`}
                className="flex flex-col items-center gap-2 p-3 md:p-4 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl cursor-pointer hover:border-blue-500 hover:shadow-md hover:shadow-blue-100/50 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 min-h-[44px]"
              >
                <Icon size={24} className="text-blue-600 dark:text-blue-400 md:w-7 md:h-7" strokeWidth={1.75} />
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
