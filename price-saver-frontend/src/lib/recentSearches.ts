/**
 * Recent searches — bounded, deduplicated, SSR-safe localStorage list.
 *
 * Stored under one key, JSON-serialised as `{ q, at }[]`. Most-recent first.
 * Safe to call in any environment — silently no-ops when `window` is undefined
 * (SSR, build-time pre-render) or when localStorage is unavailable (Safari
 * private mode, quota exceeded, disabled cookies).
 */

const KEY = "campify:recent_searches";
const MAX = 8;

export interface RecentSearch {
  q: string;
  at: number; // ms epoch
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRaw(): RecentSearch[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentSearch =>
          r &&
          typeof r === "object" &&
          typeof r.q === "string" &&
          typeof r.at === "number",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function writeRaw(items: RecentSearch[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // Quota / private mode — silently drop.
  }
}

export function getRecentSearches(): RecentSearch[] {
  return readRaw();
}

export function addRecentSearch(q: string): RecentSearch[] {
  const trimmed = q.trim();
  if (trimmed.length < 2) return readRaw();
  const existing = readRaw().filter(
    (r) => r.q.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next: RecentSearch[] = [{ q: trimmed, at: Date.now() }, ...existing].slice(0, MAX);
  writeRaw(next);
  return next;
}

export function removeRecentSearch(q: string): RecentSearch[] {
  const next = readRaw().filter(
    (r) => r.q.toLowerCase() !== q.trim().toLowerCase(),
  );
  writeRaw(next);
  return next;
}

export function clearRecentSearches(): RecentSearch[] {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
  return [];
}
