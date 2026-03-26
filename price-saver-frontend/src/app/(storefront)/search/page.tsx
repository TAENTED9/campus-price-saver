"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, MapPin, X, ChevronDown } from "lucide-react";
import { itemsApi, type Price, type Category } from "@/lib/api";

// ─── types ────────────────────────────────────────────────────────────────────

type ListingPrice = Price & {
  condition?: string;
  photos?: string[];
  listing_status?: string;
  view_count?: number;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const EMOJIS: Record<number, string> = { 1: "🥗", 2: "🥤", 3: "🧴" };
function emoji(catId: number) { return EMOJIS[catId] ?? "📦"; }

function ConditionChip({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    New: "bg-green-100 text-green-700",
    "Fairly Used": "bg-yellow-100 text-yellow-700",
    Used: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[condition] ?? map.Used}`}>
      {condition}
    </span>
  );
}

// ─── listing card ─────────────────────────────────────────────────────────────

function ListingCard({ item }: { item: ListingPrice }) {
  const photo = item.photos?.[0];
  return (
    <Link href={`/listing/${item.id}`} className="group block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors">
      <div className="aspect-square bg-gray-50 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
        {photo ? (
          <img src={photo} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="text-5xl">{emoji(item.category_id)}</span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-gray-800 dark:text-white line-clamp-2 leading-snug">{item.name}</p>
        {item.condition && <ConditionChip condition={item.condition} />}
        <p className="text-base font-black text-brand-600 dark:text-brand-400">₦{item.price.toLocaleString()}</p>
        {item.location && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin size={10} /> {item.location}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── filter sidebar / row ──────────────────────────────────────────────────────

const CONDITIONS = ["New", "Fairly Used", "Used"] as const;
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "most_viewed", label: "Most Viewed" },
] as const;

// ─── main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 16;

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── URL state ──
  const initialQ = searchParams?.get("q") ?? "";
  const initialSort = (searchParams?.get("sort") as "newest" | "price_asc" | "price_desc" | "most_viewed") ?? "newest";
  const initialCat = searchParams?.get("category_id") ? Number(searchParams.get("category_id")) : undefined;

  // ── local state ──
  const [q, setQ] = useState(initialQ);
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "most_viewed">(initialSort);
  const [categoryId, setCategoryId] = useState<number | undefined>(initialCat);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState<ListingPrice[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load categories once ──
  useEffect(() => {
    itemsApi.getCategories().then(setCategories).catch(() => {});
  }, []);

  // ── search fn ──
  const doSearch = useCallback(
    (newSkip = 0, append = false) => {
      if (append) setLoadingMore(true); else setLoading(true);
      const cond = conditions.length === 1 ? conditions[0] : undefined;
      itemsApi
        .searchPrices({
          q: q || undefined,
          category_id: categoryId,
          min_price: minPrice ? Number(minPrice) : undefined,
          max_price: maxPrice ? Number(maxPrice) : undefined,
          condition: cond,
          sort,
          skip: newSkip,
          limit: PAGE_SIZE,
        })
        .then((data) => {
          const list = data as ListingPrice[];
          if (append) setItems((prev) => [...prev, ...list]);
          else setItems(list);
          // Estimate total: if we got a full page, there may be more
          if (!append) setTotal(list.length);
          else setTotal((t) => t + list.length);
          setSkip(newSkip);
        })
        .catch(() => { if (!append) setItems([]); })
        .finally(() => { setLoading(false); setLoadingMore(false); });
    },
    [q, categoryId, minPrice, maxPrice, conditions, sort]
  );

  // ── debounced search on filter change ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(0), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [doSearch]);

  function toggleCondition(c: string) {
    setConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }

  function clearFilters() {
    setQ("");
    setCategoryId(undefined);
    setMinPrice("");
    setMaxPrice("");
    setConditions([]);
    setSort("newest");
  }

  const hasFilters = !!q || categoryId != null || minPrice || maxPrice || conditions.length > 0 || sort !== "newest";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Top search bar ── */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search listings…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? "bg-brand-500 border-brand-500 text-white" : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        </div>

        {/* ── Expandable filters ── */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Category</label>
              <div className="relative">
                <select
                  value={categoryId ?? ""}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  title="Category"
                  className="w-full appearance-none bg-gray-50 dark:bg-gray-900 dark:[color-scheme:dark] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm pr-8 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Price range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Price (₦)</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                  title="Minimum price"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
                <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                  title="Maximum price"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Condition</label>
              <div className="flex flex-col gap-2">
                {CONDITIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conditions.includes(c)}
                      onChange={() => toggleCondition(c)}
                      title={c}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Sort by</label>
              <div className="flex flex-col gap-2">
                {SORTS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sort"
                      value={s.value}
                      checked={sort === s.value}
                      onChange={() => setSort(s.value)}
                      title={s.label}
                      className="text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Results header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loading ? (
                <span className="inline-block w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : q ? (
                <span><span className="font-semibold text-gray-800 dark:text-white">{items.length}</span> results for &ldquo;{q}&rdquo;</span>
              ) : (
                <span><span className="font-semibold text-gray-800 dark:text-white">{items.length}</span> listings</span>
              )}
            </p>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-500 transition-colors">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>

        {/* ── Loading skeleton grid ── */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
                <div className="p-3 space-y-2">
                  <div className="h-4 rounded bg-gray-100 dark:bg-gray-700 w-3/4" />
                  <div className="h-5 rounded bg-gray-100 dark:bg-gray-700 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Results grid ── */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => <ListingCard key={item.id} item={item} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="text-6xl">🔍</div>
            <p className="font-bold text-gray-800 dark:text-white text-lg">No results found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              {q ? `Nothing matched "${q}".` : "No listings match the selected filters."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Load More ── */}
        {!loading && items.length > 0 && items.length % PAGE_SIZE === 0 && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => doSearch(skip + PAGE_SIZE, true)}
              disabled={loadingMore}
              className="px-8 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-brand-300 dark:hover:border-brand-500/40 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
