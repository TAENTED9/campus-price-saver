"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { itemsApi, storesApi, type Category, type Price, type SearchFilters } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Search, X, User, ChevronDown, Menu, Loader2, SlidersHorizontal, UtensilsCrossed, Shirt, Monitor, BookOpen, Sparkles, Wrench, Palette, ShoppingBag, Package } from "lucide-react";
import type { ReactNode } from "react";

// ─── Default categories (fallback while API loads) ────────────────────────────

const DEFAULT_CATEGORIES: { id: number; name: string; href: string; icon: ReactNode }[] = [
  { id: 0, name: "Food & Drinks",  href: "/categories/food",     icon: <UtensilsCrossed size={15} /> },
  { id: 0, name: "Fashion",        href: "/categories/fashion",  icon: <Shirt size={15} /> },
  { id: 0, name: "Tech & Gadgets", href: "/categories/tech",     icon: <Monitor size={15} /> },
  { id: 0, name: "Books & Notes",  href: "/categories/books",    icon: <BookOpen size={15} /> },
  { id: 0, name: "Beauty",         href: "/categories/beauty",   icon: <Sparkles size={15} /> },
  { id: 0, name: "Services",       href: "/categories/services", icon: <Wrench size={15} /> },
  { id: 0, name: "Crafts & Art",   href: "/categories/crafts",   icon: <Palette size={15} /> },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatPrice(p: number) {
  return `₦${p.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StorefrontHeader() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // ── Category dropdown ──
  const [catOpen, setCatOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  // ── Search modal ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Price[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "products" | "categories">("all");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchModalRef = useRef<HTMLDivElement>(null);

  // ── Mobile menu ──
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Fetch categories on first open ──
  const openCatDropdown = useCallback(async () => {
    setCatOpen(true);
    if (!catsLoaded) {
      try {
        const data = await itemsApi.getCategories();
        setCategories(data);
        setCatsLoaded(true);
      } catch {
        // keep defaults
      }
    }
  }, [catsLoaded]);

  // ── Close category dropdown on outside click ──
  useEffect(() => {
    if (!catOpen) return;
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [catOpen]);

  // ── Close search modal on outside click / Escape ──
  useEffect(() => {
    if (!searchOpen) return;
    const clickHandler = (e: MouseEvent) => {
      if (searchModalRef.current && !searchModalRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [searchOpen]);

  // ── Focus search input when modal opens ──
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [searchOpen]);

  // ── Debounced search ──
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await itemsApi.searchPrices({ q: term, ...filters, limit: 12 });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => clearTimeout(id);
  }, [query, filters]);

  // ── Handle header search form (go to search page) ──
  const handleHeaderSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // ── Handle modal navigate to search page ──
  const handleModalSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  };

  // ── Filter results by tab ──
  const filteredResults = activeTab === "categories"
    ? []
    : results;

  const matchedCategories = (activeTab === "all" || activeTab === "categories") && query.trim()
    ? (catsLoaded ? categories : DEFAULT_CATEGORIES).filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 4)
    : [];

  return (
    <>
      {/* ════════════════════ HEADER ════════════════════ */}
      <header className="fixed left-0 top-0 w-full z-50 bg-white shadow-sm transition-all ease-in-out duration-300 dark:bg-gray-dark dark:border-b dark:border-gray-700">
        <div className="w-full px-4 mx-auto max-w-7xl sm:px-6 xl:px-0">
          <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center xl:justify-between py-4">

            {/* ── Logo + Search row ── */}
            <div className="flex flex-col w-full gap-4 xl:w-auto sm:flex-row sm:items-center sm:gap-8">
              {/* Logo */}
              <Link href="/" className="shrink-0 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-[#06b6d4] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">Campify</p>
                  <p className="text-gray-400 text-xs leading-tight">Campus Marketplace</p>
                </div>
              </Link>

              {/* Search bar */}
              <div className="max-w-[475px] w-full">
                <form onSubmit={handleHeaderSearch}>
                  <div className="flex gap-2 items-center">
                    {/* Categories pill (dropdown trigger) */}
                    <div ref={catRef} className="relative hidden sm:block shrink-0">
                      <button
                        type="button"
                        onClick={catOpen ? () => setCatOpen(false) : openCatDropdown}
                        className="flex items-center gap-1.5 px-4 h-[42px] rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 whitespace-nowrap transition-colors"
                      >
                        <Menu size={20} />
                        <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">All</span>
                        <ChevronDown size={14} />
                      </button>

                      {/* Dropdown */}
                      {catOpen && (
                        <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50 animate-fade-in">
                          <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categories</p>
                          {(catsLoaded
                            ? categories.map((c) => ({ ...c, href: `/categories/${c.id}` }))
                            : DEFAULT_CATEGORIES
                          ).map((cat, i) => (
                            <Link
                              key={cat.id || i}
                              href={cat.href || `/categories/${cat.id}`}
                              onClick={() => setCatOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{('icon' in cat) ? (cat as { icon?: ReactNode }).icon : <Package size={15} />}</span>
                              {cat.name}
                            </Link>
                          ))}
                          <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                            <Link
                              href="/categories"
                              onClick={() => setCatOpen(false)}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                            >
                              View all categories →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Search input (opens modal on focus) */}
                    <div className="relative w-full">
                      <input
                        name="q"
                        type="search"
                        placeholder="Search for products, stores..."
                        autoComplete="off"
                        onFocus={() => setSearchOpen(true)}
                        className="w-full rounded-full bg-gray-50 border border-gray-200 h-[42px] py-2.5 pl-5 pr-12 outline-none text-sm ease-in duration-200 cursor-pointer hover:border-brand-300 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                      />
                      <button
                        type="submit"
                        aria-label="Search"
                        className="absolute flex items-center justify-center h-[42px] -translate-y-1/2 right-4 top-1/2 text-gray-500 hover:text-brand-500 transition-colors"
                      >
                        <Search size={18} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Nav + Account row ── */}
            <div className="flex w-full lg:w-auto items-center justify-between gap-6">
              <nav className="hidden xl:flex items-center gap-6">
                <Link href="/" className="text-sm font-medium text-gray-700 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400 transition-colors">Home</Link>
                <Link href="/search" className="text-sm font-medium text-gray-700 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400 transition-colors">Browse</Link>
                <Link href="/categories" className="text-sm font-medium text-gray-700 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400 transition-colors">Categories</Link>
              </nav>

              <div className="flex items-center gap-5">
                {isAuthenticated ? (
                  <>
                    <Link href={user?.role === "seller" ? "/seller" : "/dashboard"} className="hidden xl:flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-9 h-9 border border-brand-300 rounded-full bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10 text-brand-500 font-bold text-sm">
                        {user?.username?.charAt(0).toUpperCase() ?? "U"}
                      </div>
                      <div>
                        <span className="block uppercase font-medium text-[10px] text-gray-400 leading-tight">{user?.role === "seller" ? "seller" : "my account"}</span>
                        <p className="font-medium text-xs text-gray-900 hover:text-brand-500 dark:text-white dark:hover:text-brand-400 transition-colors truncate max-w-[120px]">{user?.username}</p>
                      </div>
                    </Link>
                    <Link href={user?.role === "seller" ? "/seller" : "/dashboard"} className="xl:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors">
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/signin" className="hidden xl:flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-9 h-9 border border-gray-200 rounded-full dark:border-gray-700">
                        <User size={18} />
                      </div>
                      <div>
                        <span className="block uppercase font-medium text-[10px] text-gray-400 leading-tight">account</span>
                        <p className="font-medium text-xs text-gray-900 hover:text-brand-500 dark:text-white dark:hover:text-brand-400 transition-colors">Sign In / Register</p>
                      </div>
                    </Link>
                    <Link href="/signin" className="xl:hidden inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors">
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════ SEARCH MODAL ════════════════════ */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal panel */}
          <div ref={searchModalRef} className="relative w-full bg-white dark:bg-gray-dark shadow-2xl">
            {/* Search input row */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
              <form onSubmit={handleModalSearch} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500">
                    <Search size={18} />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products, brands, stores…"
                    autoComplete="off"
                    className="w-full rounded-full bg-gray-50 border border-gray-200 h-12 pl-11 pr-5 outline-none text-base transition-all duration-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
                  />
                  {searching && (
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close search"
                >
                  <X size={18} />
                </button>
              </form>

              {/* Tabs + Filters toggle */}
              {(results.length > 0 || matchedCategories.length > 0 || query.trim()) && (
                <div className="flex gap-1 mt-4 items-center">
                  {(["all", "products", "categories"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${showFilters ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"}`}
                  >
                    <SlidersHorizontal size={14} />
                    Filters
                  </button>
                </div>
              )}

              {/* Filter panel */}
              {showFilters && (
                <div className="mt-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Price range */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Price Range (₦)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.min_price ?? ""}
                        onChange={(e) => setFilters(f => ({ ...f, min_price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                      />
                      <span className="text-gray-400 shrink-0">–</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.max_price ?? ""}
                        onChange={(e) => setFilters(f => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label htmlFor="filter-category" className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Category</label>
                    <select
                      id="filter-category"
                      value={filters.category_id ?? ""}
                      onChange={(e) => setFilters(f => ({ ...f, category_id: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    >
                      <option value="">All Categories</option>
                      {(catsLoaded ? categories : []).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Moremi Hall"
                      value={filters.location ?? ""}
                      onChange={(e) => setFilters(f => ({ ...f, location: e.target.value || undefined }))}
                      className="w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-white"
                    />
                  </div>

                  {/* Clear filters */}
                  {(filters.min_price != null || filters.max_price != null || filters.category_id != null || filters.location) && (
                    <div className="sm:col-span-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setFilters({})}
                        className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-6 max-h-[60vh] overflow-y-auto">
              {/* Empty state */}
              {!query.trim() && (
                <div className="py-6">
                  <p className="text-sm font-medium text-gray-500 mb-3">Quick links</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <Link
                        key={c.name}
                        href={c.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400 transition-colors"
                      >
                        <span>{c.icon}</span>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched categories */}
              {matchedCategories.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {matchedCategories.map((c, i) => (
                      <Link
                        key={c.id || i}
                        href={('href' in c) ? (c as { href: string }).href : `/categories/${c.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 text-sm font-medium hover:bg-brand-100 transition-colors"
                      >
                        <span>{('icon' in c) ? (c as { icon?: string }).icon : "📦"}</span>
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Product results */}
              {query.trim() && !searching && filteredResults.length === 0 && activeTab !== "categories" && (
                <div className="py-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No products found for &quot;{query}&quot;</p>
                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => setSearchOpen(false)}
                    className="inline-flex mt-3 text-sm text-brand-500 hover:text-brand-600 font-medium"
                  >
                    Browse all results →
                  </Link>
                </div>
              )}

              {filteredResults.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Products</p>
                  <div className="space-y-1">
                    {filteredResults.map((item) => (
                      <Link
                        key={item.id}
                        href={`/products/${item.id}`}
                        onClick={() => setSearchOpen(false)}
                        className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        {/* Icon placeholder */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                          <ShoppingBag size={18} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-brand-500 transition-colors">
                            {item.name}
                            {item.brand ? <span className="text-gray-400 font-normal"> · {item.brand}</span> : null}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.retailer ?? "Campus Store"}
                            {item.location ? ` · ${item.location}` : ""}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                            {formatPrice(item.price)}
                          </p>
                          {item.pack_size && (
                            <p className="text-xs text-gray-400">{item.pack_size}{item.pack_unit}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* View all link */}
                  <div className="mt-4 text-center">
                    <Link
                      href={`/search?q=${encodeURIComponent(query.trim())}`}
                      onClick={() => setSearchOpen(false)}
                      className="inline-flex items-center text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                    >
                      View all results for &quot;{query}&quot; →
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Click outside the panel closes modal */}
        </div>
      )}
    </>
  );
}
