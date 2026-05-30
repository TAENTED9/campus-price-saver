"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchSeller {
  uuid: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  is_verified: boolean;
  karma_tier: string;
}

export interface SearchResult {
  uuid: string;
  id: number;
  title: string;
  description: string;
  price: number;
  sale_price: number | null;
  original_price: number | null;
  on_sale: boolean;
  discount_pct: number | null;
  flash_sale_ends_at: string | null;
  condition: string | null;
  category: string | null;
  category_id: number | null;
  subcategory: string | null;
  location: string | null;
  status: string;
  views_count: number;
  quantity: number;
  is_negotiable: boolean;
  is_featured: boolean;
  photos: string[];
  cover_photo: string | null;
  created_at: string | null;
  relevance_score: number;
  seller_id: number | null;
  seller: SearchSeller | null;
}

export interface SearchResponse {
  items: SearchResult[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
  query: string | null;
  engine: string;
}

export interface SearchSuggestion {
  uuid: string | null;
  title: string;
  category: string | null;
  price: number;
}

export interface SearchParams {
  q?: string;
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  location?: string;
  sort?: string;
  page?: number;
  limit?: number;
  featured_only?: boolean;
}

export interface UseSearchOptions {
  /** Skip the initial fetch (e.g. wait for user input). Default: false. */
  manual?: boolean;
  /** ms to wait before issuing a search after params change. Default: 300. */
  searchDebounceMs?: number;
  /** ms to wait before issuing an autocomplete query. Default: 150. */
  suggestDebounceMs?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildQueryString(p: SearchParams): string {
  const qs = new URLSearchParams();
  if (p.q && p.q.trim()) qs.set("q", p.q.trim());
  if (p.category && p.category !== "all") qs.set("category", p.category);
  if (p.condition) qs.set("condition", p.condition);
  if (p.min_price !== undefined && p.min_price !== null)
    qs.set("min_price", String(p.min_price));
  if (p.max_price !== undefined && p.max_price !== null)
    qs.set("max_price", String(p.max_price));
  if (p.location) qs.set("location", p.location);
  // When a query is present, default to relevance unless caller specified otherwise.
  const sort = p.sort ?? (p.q && p.q.trim() ? "relevance" : "newest");
  qs.set("sort", sort);
  qs.set("page", String(p.page ?? 1));
  qs.set("limit", String(p.limit ?? 20));
  if (p.featured_only) qs.set("featured_only", "true");
  return qs.toString();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSearch(
  initialParams: SearchParams = {},
  opts: UseSearchOptions = {},
) {
  const {
    manual = false,
    searchDebounceMs = 300,
    suggestDebounceMs = 150,
  } = opts;

  const [params, setParamsState] = useState<SearchParams>(initialParams);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs survive renders without re-triggering effects.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  // Track whether the consumer has triggered a search at least once. When
  // manual=true and they haven't yet, we won't auto-fetch on param changes.
  const hasTriggeredRef = useRef(!manual);

  // ── Run a search now (no debounce) ─────────────────────────────────────────
  const runSearch = useCallback(async (p: SearchParams) => {
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(p);
      const res = await fetch(`${API}/api/items/search?${qs}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }
      const data: SearchResponse = await res.json();
      setResults(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
    } finally {
      // Only clear loading if we are still the latest in-flight request.
      if (searchAbortRef.current === ctrl) setLoading(false);
    }
  }, []);

  // ── Run an autocomplete query (no debounce) ────────────────────────────────
  const runSuggest = useCallback(async (q: string) => {
    suggestAbortRef.current?.abort();
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }
    const ctrl = new AbortController();
    suggestAbortRef.current = ctrl;
    setSuggesting(true);
    try {
      const qs = new URLSearchParams({ q: term, limit: "8" });
      const res = await fetch(`${API}/api/items/search/suggest?${qs}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        setSuggestions([]);
        return;
      }
      const data: SearchSuggestion[] = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSuggestions([]);
    } finally {
      if (suggestAbortRef.current === ctrl) setSuggesting(false);
    }
  }, []);

  // ── Public setter: schedule a debounced search whenever params change ──────
  const setParams = useCallback(
    (next: SearchParams | ((prev: SearchParams) => SearchParams)) => {
      setParamsState((prev) => {
        const merged = typeof next === "function" ? next(prev) : { ...prev, ...next };
        hasTriggeredRef.current = true;
        return merged;
      });
    },
    [],
  );

  // ── Auto-search on params change (debounced) ───────────────────────────────
  useEffect(() => {
    if (manual && !hasTriggeredRef.current) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void runSearch(params);
    }, searchDebounceMs);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [params, manual, searchDebounceMs, runSearch]);

  // ── Auto-suggest on q change (separate, faster debounce) ───────────────────
  useEffect(() => {
    const q = params.q ?? "";
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => {
      void runSuggest(q);
    }, suggestDebounceMs);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [params.q, suggestDebounceMs, runSuggest]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      suggestAbortRef.current?.abort();
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, []);

  // ── Click tracking ─────────────────────────────────────────────────────────
  // Fires a POST /api/items/search/click using fetch with keepalive: true.
  // keepalive lets the request finish even after the user navigates away
  // (which is the entire point — clicks always trigger navigation).
  // Fully fire-and-forget — never blocks the caller, never raises.
  const trackClick = useCallback(
    (clickedUuid: string | null, position: number) => {
      const q = (params.q ?? "").trim();
      if (q.length < 2) return;
      try {
        void fetch(`${API}/api/items/search/click`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            clicked_uuid: clickedUuid,
            position,
          }),
          keepalive: true,
          cache: "no-store",
        }).catch(() => {
          // Analytics failures must be silent — never affect UX.
        });
      } catch {
        // Silent.
      }
    },
    [params.q],
  );

  // ── Convenience: clear everything ──────────────────────────────────────────
  const clearSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    suggestAbortRef.current?.abort();
    setResults(null);
    setSuggestions([]);
    setError(null);
    setShowSuggestions(false);
    setParamsState({});
    hasTriggeredRef.current = !manual;
  }, [manual]);

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const nextPage = useCallback(() => {
    if (!results?.has_more) return;
    setParams((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }));
  }, [results?.has_more, setParams]);

  const prevPage = useCallback(() => {
    setParams((prev) => {
      const current = prev.page ?? 1;
      return { ...prev, page: Math.max(1, current - 1) };
    });
  }, [setParams]);

  const goToPage = useCallback(
    (page: number) => {
      setParams((prev) => ({ ...prev, page: Math.max(1, page) }));
    },
    [setParams],
  );

  return {
    // state
    params,
    results,
    suggestions,
    loading,
    suggesting,
    error,
    showSuggestions,

    // setters
    setParams,
    setShowSuggestions,

    // actions
    search: runSearch,
    suggest: runSuggest,
    trackClick,
    clearSearch,
    nextPage,
    prevPage,
    goToPage,
  };
}
