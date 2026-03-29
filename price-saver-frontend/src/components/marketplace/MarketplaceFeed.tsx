"use client";

import { useState } from "react";
import Link from "next/link";
import CategoryBar from "./CategoryBar";
import ListingsGrid from "./ListingsGrid";

export default function MarketplaceFeed() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <div>
      {/* Category quick-links */}
      <section className="mt-8">
        <CategoryBar
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </section>

      {/* Listings grid */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
            Latest Listings
          </h2>
          <Link
            href="/search"
            className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            See all →
          </Link>
        </div>
        <ListingsGrid category={selectedCategory} />
      </section>
    </div>
  );
}
