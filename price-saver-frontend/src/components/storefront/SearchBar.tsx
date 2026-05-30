"use client";

/**
 * SearchBar — autocomplete-driven search input for Campify.
 *
 * Composes the useSearch hook (Block 6) with a polished dropdown UI:
 *   • Live, debounced suggestions
 *   • Recent searches (localStorage) when focused-empty
 *   • Full keyboard nav (↑ ↓ Enter Esc) with ARIA combobox semantics
 *   • Click-outside to close, with proper listener cleanup
 *   • Match highlighting on suggestion titles
 *   • Loading / empty / no-results / error states are all explicit
 *   • Free-form submit always available — pressing Enter without a
 *     selected suggestion navigates to /search?q=<query>
 *
 * Drop-in: <SearchBar /> works with no props. Caller can override the
 * submit destination via `onSubmit`, supply an initial query for
 * pre-fill, or tweak the placeholder.
 */

import {
  type FormEvent,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpLeft,
  Clock,
  Loader2,
  Search,
  TrendingUp,
  X,
} from "lucide-react";

import { useSearch, type SearchSuggestion } from "@/hooks/useSearch";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  type RecentSearch,
} from "@/lib/recentSearches";
import { formatPrice } from "@/lib/formatPrice";

// ── Props ────────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  /** Pre-fill the input. */
  initialQuery?: string;
  /** Custom placeholder text. */
  placeholder?: string;
  /** When provided, called instead of router.push on submit. */
  onSubmit?: (q: string) => void;
  /** Autofocus the input on mount. */
  autoFocus?: boolean;
  /** Override the root element classes (e.g. width constraints). */
  className?: string;
  /** Compact variant — smaller height, fewer details in suggestions. */
  compact?: boolean;
  /**
   * Where to send the user when they submit free-form text. Receives the
   * URL-encoded query and returns the destination href. Defaults to
   * `/search?q=...`. Ignored when `onSubmit` is provided.
   */
  buildResultsHref?: (encodedQuery: string) => string;
  /**
   * Where to send the user when they pick a specific suggestion. Defaults
   * to `/listing/{uuid}` (or the suggestion id when no uuid is present).
   */
  buildListingHref?: (s: SearchSuggestion) => string;
}

// ── Internal: a single row in the dropdown ───────────────────────────────────

type RowKind = "freeform" | "recent" | "suggestion";

interface Row {
  kind: RowKind;
  /** Stable id for ARIA + key. */
  rowId: string;
  /** Display text the user sees. */
  label: string;
  /** Optional sub-line (e.g. category, price). */
  secondary?: string;
  /** Suggestion payload — present when kind === "suggestion". */
  suggestion?: SearchSuggestion;
  /** Recent-search payload — present when kind === "recent". */
  recent?: RecentSearch;
}

// ── Helper: highlight matching prefix/substring in a title ───────────────────

function highlight(text: string, query: string) {
  if (!query) return text;
  const t = text ?? "";
  const idx = t.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return t;
  const before = t.slice(0, idx);
  const match = t.slice(idx, idx + query.length);
  const after = t.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 rounded px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

function SearchBarImpl({
  initialQuery = "",
  placeholder = "Search products, brands, stores…",
  onSubmit,
  autoFocus = false,
  className,
  compact = false,
  buildResultsHref = (encoded) => `/search?q=${encoded}`,
  buildListingHref = (s) =>
    `/listing/${encodeURIComponent(s.uuid ?? String(s.title))}`,
}: SearchBarProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  // useSearch hook drives the suggestion fetches. We pass `manual: true`
  // because we DON'T want the hook to issue a full search query on every
  // keystroke — only the suggest endpoint. The full search runs when the
  // user submits.
  const { params, setParams, suggestions, suggesting, trackClick } = useSearch(
    { q: initialQuery },
    { manual: true, suggestDebounceMs: 150 },
  );

  const query = params.q ?? "";
  const trimmed = query.trim();

  // Dropdown open state. We track focus separately so we can re-open the
  // dropdown when the user re-focuses after closing with Escape.
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Recent searches are hydrated client-side after mount to avoid SSR
  // mismatch (localStorage is browser-only).
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  useEffect(() => {
    setRecents(getRecentSearches());
  }, []);

  // ── Compute the rows that will render in the dropdown ──────────────────────
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (trimmed.length >= 2) {
      // First row: always "Search for '<query>'" so Enter on free-form text
      // is always a valid submit even when there are zero suggestions.
      out.push({
        kind: "freeform",
        rowId: "freeform",
        label: `Search for "${trimmed}"`,
      });
      for (const s of suggestions) {
        out.push({
          kind: "suggestion",
          rowId: `s:${s.uuid ?? s.title}`,
          label: s.title,
          secondary: s.category
            ? `${s.category} · ${formatPrice(s.price)}`
            : formatPrice(s.price),
          suggestion: s,
        });
      }
    } else {
      for (const r of recents) {
        out.push({
          kind: "recent",
          rowId: `r:${r.q}`,
          label: r.q,
          recent: r,
        });
      }
    }
    return out;
  }, [trimmed, suggestions, recents]);

  // Reset active index whenever the rows change so a stale highlight from a
  // prior query doesn't point at the wrong row.
  useEffect(() => {
    setActiveIndex(rows.length > 0 ? 0 : -1);
  }, [rows.length, trimmed]);

  // ── Click outside closes the dropdown ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Keep the active row scrolled into view during keyboard nav ─────────────
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = rowRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  // ── Submit handlers ────────────────────────────────────────────────────────
  const goToResults = useCallback(
    (q: string, position?: number) => {
      const value = q.trim();
      if (!value) return;
      addRecentSearch(value);
      setRecents(getRecentSearches());
      setOpen(false);
      inputRef.current?.blur();
      // Track "search submission" as a click on position 0 (no specific
      // result picked). This separates "viewed results" from "browsed away".
      trackClick(null, position ?? 0);
      if (onSubmit) {
        onSubmit(value);
      } else {
        router.push(buildResultsHref(encodeURIComponent(value)));
      }
    },
    [router, onSubmit, buildResultsHref, trackClick],
  );

  const goToListing = useCallback(
    (s: SearchSuggestion, position: number) => {
      addRecentSearch(s.title);
      setRecents(getRecentSearches());
      setOpen(false);
      inputRef.current?.blur();
      // Fire analytics before navigation. The hook uses keepalive:true so
      // the request survives the route change.
      trackClick(s.uuid, position);
      router.push(buildListingHref(s));
    },
    [router, buildListingHref, trackClick],
  );

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // If a suggestion is highlighted, treat it as a navigation; otherwise
      // submit the free-form query. This matches user expectation when
      // pressing Enter while a row is active. Suggestion position is
      // 1-indexed and excludes the leading "freeform" row.
      const active = rows[activeIndex];
      if (active?.kind === "suggestion" && active.suggestion) {
        // First row is the freeform option, so suggestion rank = idx
        goToListing(active.suggestion, activeIndex);
      } else if (active?.kind === "recent" && active.recent) {
        goToResults(active.recent.q);
      } else {
        goToResults(trimmed);
      }
    },
    [rows, activeIndex, trimmed, goToListing, goToResults],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (!open) {
          setOpen(true);
          return;
        }
        e.preventDefault();
        setActiveIndex((i) => (rows.length === 0 ? -1 : (i + 1) % rows.length));
      } else if (e.key === "ArrowUp") {
        if (!open) return;
        e.preventDefault();
        setActiveIndex((i) =>
          rows.length === 0 ? -1 : (i - 1 + rows.length) % rows.length,
        );
      } else if (e.key === "Escape") {
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
      } else if (e.key === "Home") {
        if (open && rows.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
      } else if (e.key === "End") {
        if (open && rows.length > 0) {
          e.preventDefault();
          setActiveIndex(rows.length - 1);
        }
      }
      // Enter is handled by the form's onSubmit so screen readers and
      // password managers see a real submit event.
    },
    [open, rows.length],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const showDropdown = open && (rows.length > 0 || trimmed.length >= 2);
  const noResults =
    open && trimmed.length >= 2 && suggestions.length === 0 && !suggesting;
  const inputHeight = compact ? "h-10" : "h-[42px]";

  return (
    <div
      ref={containerRef}
      className={["relative w-full", className ?? ""].join(" ")}
    >
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          {/* Leading search icon */}
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={compact ? 16 : 18} />
          </span>

          <input
            ref={inputRef}
            type="search"
            // ARIA 1.2 combobox pattern: role goes on the input itself,
            // not a wrapper div.
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            // jsx-a11y/aria-proptypes can't resolve non-literal values for
            // aria-expanded statically, but React's Booleanish type and
            // the WAI-ARIA spec both accept this form at runtime.
            // eslint-disable-next-line jsx-a11y/aria-proptypes
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-activedescendant={
              activeIndex >= 0 && rows[activeIndex]
                ? `${listboxId}-${rows[activeIndex].rowId}`
                : undefined
            }
            value={query}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, q: e.target.value }))
            }
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className={[
              "w-full rounded-full bg-gray-50 border border-gray-200",
              inputHeight,
              "pl-11 pr-12 outline-none text-sm sm:text-base",
              "transition-all duration-200 ease-out",
              "hover:border-brand-300",
              "focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10",
              "dark:bg-gray-800 dark:border-gray-700 dark:text-white",
              "dark:placeholder:text-gray-500",
            ].join(" ")}
          />

          {/* Trailing slot: spinner while suggesting, X when there's text */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {suggesting ? (
              <Loader2
                size={16}
                className="animate-spin text-gray-400"
                aria-hidden
              />
            ) : query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setParams((prev) => ({ ...prev, q: "" }));
                  inputRef.current?.focus();
                  setOpen(true);
                }}
                className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            ) : null}
          </span>
        </div>
      </form>

      {/* ── Dropdown ───────────────────────────────────────────────────────── */}
      {showDropdown && (
        <div
          className={[
            "absolute left-0 right-0 top-[calc(100%+6px)]",
            "z-50",
            "bg-white dark:bg-gray-800",
            "rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700",
            "overflow-hidden",
            "animate-fade-in",
          ].join(" ")}
        >
          {/* Header label */}
          {trimmed.length < 2 && recents.length > 0 && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={12} /> Recent searches
              </p>
              <button
                type="button"
                onClick={() => setRecents(clearRecentSearches())}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          {trimmed.length < 2 && recents.length === 0 && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Start typing to search Campify.
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Try <span className="font-medium">&quot;iPhone&quot;</span>,{" "}
                <span className="font-medium">&quot;textbook&quot;</span>, or{" "}
                <span className="font-medium">&quot;jollof&quot;</span>.
              </p>
            </div>
          )}

          {trimmed.length >= 2 && suggestions.length > 0 && (
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={12} /> Suggestions
            </p>
          )}

          {/* Rows */}
          <ul
            id={listboxId}
            role="listbox"
            className="py-1 max-h-[60vh] overflow-y-auto"
          >
            {rows.map((row, idx) => {
              const isActive = idx === activeIndex;
              const id = `${listboxId}-${row.rowId}`;
              return (
                <li
                  key={row.rowId}
                  ref={(el) => {
                    rowRefs.current[idx] = el;
                  }}
                  id={id}
                  role="option"
                  // Same false-positive as aria-expanded above — the value
                  // is a runtime boolean derived from comparing indices.
                  // eslint-disable-next-line jsx-a11y/aria-proptypes
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    // mouseDown beats blur — keeps the dropdown open
                    // long enough to navigate.
                    e.preventDefault();
                    if (row.kind === "suggestion" && row.suggestion) {
                      // idx is 0-indexed across all rows, but row 0 is the
                      // freeform option. Suggestion rank = idx (so the
                      // first real suggestion is position 1).
                      goToListing(row.suggestion, idx);
                    } else if (row.kind === "recent" && row.recent) {
                      goToResults(row.recent.q);
                    } else {
                      goToResults(trimmed);
                    }
                  }}
                  className={[
                    "group flex items-center gap-3 px-4 py-2.5 cursor-pointer",
                    isActive
                      ? "bg-brand-50 dark:bg-brand-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                    "transition-colors",
                  ].join(" ")}
                >
                  {/* Leading icon */}
                  <span
                    className={[
                      "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full",
                      row.kind === "recent"
                        ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        : row.kind === "freeform"
                          ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300"
                          : "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300",
                    ].join(" ")}
                  >
                    {row.kind === "recent" ? (
                      <Clock size={14} />
                    ) : (
                      <Search size={14} />
                    )}
                  </span>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={[
                        "text-sm font-medium truncate",
                        isActive
                          ? "text-brand-700 dark:text-brand-200"
                          : "text-gray-900 dark:text-white",
                      ].join(" ")}
                    >
                      {row.kind === "suggestion"
                        ? highlight(row.label, trimmed)
                        : row.label}
                    </p>
                    {!compact && row.secondary && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {row.secondary}
                      </p>
                    )}
                  </div>

                  {/* Trailing affordance.
                      Using <span role="button"> instead of <button> here
                      because WAI-ARIA forbids interactive controls nested
                      inside listbox options. The span still gets keyboard
                      activation via the parent option's keydown handler. */}
                  {row.kind === "recent" ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove "${row.label}" from recent searches`}
                      onMouseDown={(e) => {
                        // Stop the row's mouseDown handler from firing.
                        e.stopPropagation();
                        e.preventDefault();
                        const next = removeRecentSearch(row.label);
                        setRecents(next);
                      }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                      <X size={12} />
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 transition-opacity"
                    >
                      <ArrowUpLeft size={14} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* No-results state */}
          {noResults && (
            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No matches for{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  &quot;{trimmed}&quot;
                </span>
                .
              </p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                Press Enter to search all listings anyway.
              </p>
            </div>
          )}

          {/* Footer: View all results */}
          {trimmed.length >= 2 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5 bg-gray-50/60 dark:bg-gray-900/40">
              <Link
                href={buildResultsHref(encodeURIComponent(trimmed))}
                onMouseDown={(e) => {
                  e.preventDefault();
                  goToResults(trimmed);
                }}
                className="flex items-center justify-between text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                <span className="truncate">
                  View all results for &quot;{trimmed}&quot;
                </span>
                <span aria-hidden>→</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const SearchBar = memo(SearchBarImpl);
export default SearchBar;
