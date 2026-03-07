"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { itemsApi, type Category } from "@/lib/api";
import { getCategoryConfig } from "@/lib/categoryIcons";

function SkeletonPill() {
  return (
    <div className="flex flex-col items-center animate-pulse">
      <div className="w-[90px] h-[90px] rounded-full bg-gray-100 dark:bg-gray-800 mb-3" />
      <div className="h-3.5 w-20 rounded bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsApi.getCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="py-12 xl:py-15">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 xl:px-0">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white xl:text-2xl">
            Browse by Category
          </h2>
          <Link
            href="/search"
            className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => <SkeletonPill key={i} />)
            : categories.map((cat) => {
                const { icon: Icon, bg, color } = getCategoryConfig(cat.id);
                return (
                  <Link
                    key={cat.id}
                    href={`/search?category_id=${cat.id}`}
                    className="group flex flex-col items-center"
                  >
                    <div
                      className={`w-full aspect-square max-w-[90px] ${bg} rounded-full flex items-center justify-center mb-3 mx-auto group-hover:scale-105 transition-transform duration-200`}
                    >
                      <Icon size={28} className={color} strokeWidth={1.5} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center group-hover:text-brand-500 transition-colors leading-snug">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
