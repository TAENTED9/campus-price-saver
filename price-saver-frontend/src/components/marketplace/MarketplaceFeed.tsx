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
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            Latest Listings
          </h2>
          <Link
            href="/search"
            className="text-sm text-brand-400 font-medium hover:underline"
          >
            See all →
          </Link>
        </div>
        <ListingsGrid category={selectedCategory} />
      </section>
    </div>
  );
}
