"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, X, ChevronDown,
  PackageSearch, ArrowUpDown, RefreshCw,
} from "lucide-react";
import { itemsApi, type Price, type Category } from "@/lib/api";
import ListingCard from "@/components/marketplace/ListingCard";
import ListingCardSkeleton from "@/components/marketplace/ListingCardSkeleton";
import { formatPrice } from "@/lib/formatPrice";
import NumberInput from "@/components/ui/NumberInput";

// ─── extended type ─────────────────────────────────────────────────────────────

type ListingPrice = Price & {
  condition?: string | null;
  photos?: string[] | null;
  listing_status?: string | null;
  view_count?: number | null;
  submitted_at?: string | null;
  seller?: {
    username?: string;
    display_name?: string;
    is_verified?: boolean;
    verified?: boolean;
  } | null;
};

// ─── constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ["new", "fairly_used", "used"] as const;
type Condition = (typeof CONDITIONS)[number];
const CONDITION_LABELS: Record<Condition, string> = {
  new: "New",
  fairly_used: "Fairly Used",
  used: "Used",
};
const SORTS = [
  { value: "newest",      label: "Newest"        },
  { value: "price_asc",   label: "Price: Low–High" },
  { value: "price_desc",  label: "Price: High–Low" },
  { value: "most_viewed", label: "Most Viewed"   },
] as const;
type SortValue = (typeof SORTS)[number]["value"];

const PAGE_SIZE = 20;

// ─── helpers ──────────────────────────────────────────────────────────────────

function normaliseCondition(raw?: string | null): "new" | "fairly_used" | "used" {
  switch ((raw ?? "").toLowerCase()) {
    case "new":         return "new";
    case "fairly used":
    case "fairly_used": return "fairly_used";
    default:            return "used";
  }
}

function toCardProps(item: ListingPrice) {
  return {
    id:             item.id,
    uuid:           item.uuid,
    title:          item.name,
    price:          item.price,
    condition:      normaliseCondition(item.condition),
    imageUrl:       item.photos?.[0] ?? "",
    sellerName:     item.seller?.display_name ?? item.seller?.username ?? item.retailer ?? "Campus Seller",
    sellerVerified: item.seller?.is_verified ?? item.seller?.verified ?? false,
    category:       String(item.category_id ?? ""),
    createdAt:      item.submitted_at ?? new Date().toISOString(),
    viewsCount:     item.view_count ?? 0,
  };
}

// ─── FilterPanel (shared: sidebar + mobile drawer) ────────────────────────────

interface FPProps {
  categories:          Category[];
  categoriesLoading:   boolean;
  categoriesError:     boolean;
  onCategoriesRetry:   () => void;
  categoryId?:         number;
  conditions:          Condition[];
  minPrice:            string;
  maxPrice:            string;
  hasFilters:          boolean;
  onCategory:          (id?: number) => void;
  onConditionToggle:   (c: Condition) => void;
  onMinPrice:          (v: string) => void;
  onMaxPrice:          (v: string) => void;
  onReset:             () => void;
}

function FilterPanel({
  categories, categoriesLoading, categoriesError, onCategoriesRetry,
  categoryId, conditions, minPrice, maxPrice, hasFilters,
  onCategory, onConditionToggle, onMinPrice, onMaxPrice, onReset,
}: FPProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Filters</h3>
        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</p>
        <div className="relative">
          {categoriesLoading ? (
            <div className="w-full h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : categoriesError ? (
            <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
              <span className="text-xs text-red-500 dark:text-red-400">Failed to load</span>
              <button
                type="button"
                onClick={onCategoriesRetry}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                <RefreshCw size={11} />
                Retry
              </button>
            </div>
          ) : (
            <>
              <select
                value={categoryId ?? ""}
                onChange={(e) => onCategory(e.target.value ? Number(e.target.value) : undefined)}
                title="Category filter"
                className="w-full appearance-none bg-gray-50 dark:bg-gray-800 dark:[color-scheme:dark] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm pr-8 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </>
          )}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Price Range (₦)</p>
        <div className="flex items-center gap-2">
          <NumberInput
            placeholder="Min"
            value={minPrice === "" ? "" : Number(minPrice)}
            onValueChange={(v) => onMinPrice(v === "" ? "" : String(v))}
            title="Minimum price"
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-white"
          />
          <span className="text-gray-300 dark:text-gray-600 text-xs shrink-0">–</span>
          <NumberInput
            placeholder="Max"
            value={maxPrice === "" ? "" : Number(maxPrice)}
            onValueChange={(v) => onMaxPrice(v === "" ? "" : String(v))}
            title="Maximum price"
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-white"
          />
        </div>
      </div>

      {/* Condition */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Condition</p>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onConditionToggle(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                conditions.includes(c)
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
              }`}
            >
              {CONDITION_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // ── filter state (seeded from URL) ──
  const [q,          setQ]          = useState(searchParams?.get("q")          ?? "");
  const [sort,       setSort]       = useState<SortValue>((searchParams?.get("sort") as SortValue) ?? "newest");
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams?.get("category_id") ? Number(searchParams.get("category_id")) : undefined
  );
  const [minPrice,    setMinPrice]    = useState(searchParams?.get("min_price") ?? "");
  const [maxPrice,    setMaxPrice]    = useState(searchParams?.get("max_price") ?? "");
  const [conditions,  setConditions]  = useState<Condition[]>([]);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  // ── data state ──
  const [items,             setItems]             = useState<ListingPrice[]>([]);
  const [skip,              setSkip]              = useState(0);
  const [hasMore,           setHasMore]           = useState(true);
  const [loading,           setLoading]           = useState(false);
  const [loadingMore,       setLoadingMore]       = useState(false);
  const [categories,        setCategories]        = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError,   setCategoriesError]   = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── load categories (with retry support) ──
  const loadCategories = useCallback(() => {
    setCategoriesLoading(true);
    setCategoriesError(false);
    itemsApi
      .getCategories()
      .then(setCategories)
      .catch(() => setCategoriesError(true))
      .finally(() => setCategoriesLoading(false));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ── URL sync (debounced 400 ms) ──
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q)               p.set("q",           q);
      if (sort !== "newest") p.set("sort",       sort);
      if (categoryId != null) p.set("category_id", String(categoryId));
      if (minPrice)        p.set("min_price",   minPrice);
      if (maxPrice)        p.set("max_price",   maxPrice);
      router.replace(`/search${p.toString() ? `?${p}` : ""}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [q, sort, categoryId, minPrice, maxPrice, router]);

  // ── search ──
  const doSearch = useCallback(
    (newSkip = 0, append = false) => {
      if (append) setLoadingMore(true); else setLoading(true);
      const cond = conditions.length === 1 ? conditions[0] : undefined;
      itemsApi
        .searchPrices({
          q:           q || undefined,
          category_id: categoryId,
          min_price:   minPrice ? Number(minPrice) : undefined,
          max_price:   maxPrice ? Number(maxPrice) : undefined,
          condition:   cond,
          sort,
          skip:        newSkip,
          limit:       PAGE_SIZE,
        })
        .then((data) => {
          const list = data as ListingPrice[];
          if (append) setItems((prev) => [...prev, ...list]);
          else        setItems(list);
          setHasMore(list.length === PAGE_SIZE);
          setSkip(newSkip);
        })
        .catch(() => { if (!append) setItems([]); })
        .finally(() => { setLoading(false); setLoadingMore(false); });
    },
    [q, categoryId, minPrice, maxPrice, conditions, sort]
  );

  // ── debounced re-search on filter change ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(0), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [doSearch]);

  // ── infinite scroll ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          doSearch(skip + PAGE_SIZE, true);
        }
      },
      { rootMargin: "240px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, doSearch, skip]);

  // ── helpers ──
  function toggleCondition(c: Condition) {
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function clearFilters() {
    setQ(""); setCategoryId(undefined);
    setMinPrice(""); setMaxPrice("");
    setConditions([]); setSort("newest");
  }

  const hasFilters = !!q || categoryId != null || !!minPrice || !!maxPrice || conditions.length > 0 || sort !== "newest";

  const activeChips = [
    q && { key: "q",  label: `"${q}"`,  clear: () => setQ("") },
    categoryId != null && {
      key: "cat",
      label: categories.find((c) => c.id === categoryId)?.name ?? "Category",
      clear: () => setCategoryId(undefined),
    },
    minPrice && { key: "min", label: `Min ${formatPrice(Number(minPrice))}`, clear: () => setMinPrice("") },
    maxPrice && { key: "max", label: `Max ${formatPrice(Number(maxPrice))}`, clear: () => setMaxPrice("") },
    ...conditions.map((c) => ({
      key: c, label: CONDITION_LABELS[c], clear: () => toggleCondition(c),
    })),
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const filterPanelProps: FPProps = {
    categories, categoriesLoading, categoriesError, onCategoriesRetry: loadCategories,
    categoryId, conditions, minPrice, maxPrice, hasFilters,
    onCategory: setCategoryId, onConditionToggle: toggleCondition,
    onMinPrice: setMinPrice,   onMaxPrice: setMaxPrice,
    onReset: clearFilters,
  };

  const nonQActiveCount = activeChips.filter((c) => c.key !== "q").length;

  // ─── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 xl:px-0 py-6">

        {/* ── Top search bar ── */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search listings…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Mobile filter button (hidden on lg+) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${
              nonQActiveCount > 0
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            }`}
          >
            <SlidersHorizontal size={15} />
            Filters
            {nonQActiveCount > 0 && (
              <span className="w-4 h-4 bg-white text-blue-600 text-[9px] font-black rounded-full flex items-center justify-center">
                {nonQActiveCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Two-column layout ── */}
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6 lg:items-start">

          {/* ── Desktop sticky sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <FilterPanel {...filterPanelProps} />
            </div>
          </aside>

          {/* ── Main content area ── */}
          <div className="min-w-0">

            {/* Sort pills */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              <ArrowUpDown size={14} className="text-gray-400 shrink-0" />
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSort(s.value)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    sort === s.value
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {activeChips.map(({ key, label, clear }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold text-blue-700 dark:text-blue-300"
                  >
                    {label}
                    <button
                      type="button"
                      aria-label={`Remove ${label} filter`}
                      onClick={clear}
                      className="w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {activeChips.length > 1 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Results count */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 h-4">
              {loading ? (
                <span className="inline-block w-32 h-3.5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : items.length > 0 ? (
                <>{items.length}{hasMore ? "+" : ""} listing{items.length !== 1 ? "s" : ""}
                  {q && <> for &ldquo;{q}&rdquo;</>}
                </>
              ) : null}
            </p>

            {/* Loading skeleton grid */}
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Results grid */}
            {!loading && items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {items.map((item) => (
                  <ListingCard key={item.id} {...toCardProps(item)} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <PackageSearch
                    size={30}
                    strokeWidth={1.25}
                    className="text-gray-300 dark:text-gray-600"
                  />
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-white">No listings found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                    {q
                      ? `Nothing matched "${q}".`
                      : "No listings match the selected filters."}
                  </p>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-1 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4 mt-4" />

            {/* Load-more spinner */}
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter drawer (slide up from bottom) ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
            <div className="overflow-y-auto flex-1 px-5 pb-4">
              <FilterPanel {...filterPanelProps} />
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors min-h-[44px]"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
