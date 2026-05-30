/**
 * Canonical UNILAG pickup-location data — fetched once from
 * GET /api/locations, cached in localStorage for 1 hour, and exposed
 * to the rest of the app via `useLocations()`.
 *
 * The backend (app/constants/locations.py) is the source of truth.
 * If the tree changes there, this hook re-fetches on the next mount
 * after the cache expires; user can also force a refresh by clearing
 * the `campify_locations_v1` localStorage entry.
 */
"use client";

import { useEffect, useState } from "react";

export type LocationGroup = {
  key: string;
  name: string;
  children: string[];
};

export type LocationsPayload = {
  groups: LocationGroup[];
};

const CACHE_KEY = "campify_locations_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CachedEnvelope = {
  fetchedAt: number;
  payload: LocationsPayload;
};

// ── In-memory layer ─ avoids hitting localStorage every component mount ──
let _memoryCache: CachedEnvelope | null = null;
let _inflightPromise: Promise<LocationsPayload> | null = null;

function readLocalStorage(): CachedEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope;
    if (!parsed?.payload?.groups) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalStorage(envelope: CachedEnvelope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    /* localStorage may be full or unavailable — non-fatal */
  }
}

function isFresh(envelope: CachedEnvelope | null): boolean {
  if (!envelope) return false;
  return Date.now() - envelope.fetchedAt < CACHE_TTL_MS;
}

async function fetchLocations(): Promise<LocationsPayload> {
  if (_inflightPromise) return _inflightPromise;
  _inflightPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/locations`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to load locations (${res.status})`);
    }
    const payload = (await res.json()) as LocationsPayload;
    const envelope: CachedEnvelope = { fetchedAt: Date.now(), payload };
    _memoryCache = envelope;
    writeLocalStorage(envelope);
    return payload;
  })();
  try {
    return await _inflightPromise;
  } finally {
    _inflightPromise = null;
  }
}

/**
 * Returns the cached + always-up-to-date list of zone groups.
 *
 * Behaviour:
 *  - First mount: returns cached payload synchronously if fresh, otherwise
 *    `groups: []` while the network fetch resolves.
 *  - Stale cache: returns the stale payload immediately (no flicker) and
 *    refetches in the background. New data arrives on the next render.
 */
export function useLocations(): {
  groups: LocationGroup[];
  loading: boolean;
  error: string | null;
} {
  // Initial state must match between SSR and the very first client render to
  // avoid hydration mismatches: server has no localStorage, but the client
  // does. Only seed from the in-memory cache (which is null on both sides at
  // first paint) and defer the localStorage read to the post-mount effect.
  const [groups, setGroups] = useState<LocationGroup[]>(
    _memoryCache?.payload.groups ?? [],
  );
  const [loading, setLoading] = useState<boolean>(!_memoryCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = _memoryCache ?? readLocalStorage();
    if (cached) {
      _memoryCache = cached;
      // Hydrate from cache on mount — server rendered the skeleton state,
      // now we can safely swap in the real chips on the client.
      setGroups(cached.payload.groups);
      setLoading(false);
      if (isFresh(cached)) return; // fresh — nothing more to do
    }

    fetchLocations()
      .then((payload) => {
        if (cancelled) return;
        setGroups(payload.groups);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load locations");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { groups, loading, error };
}

// ── Convenience helpers ─────────────────────────────────────────────────

/** Build a child → group-name lookup from a groups array. */
export function buildLocationToGroupName(groups: LocationGroup[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) {
    for (const child of g.children) {
      m.set(child, g.name);
    }
  }
  return m;
}

/**
 * Bucket a flat list of selected location names into their parent groups,
 * preserving the parent group order from `groups`. Children appear in
 * the same order they came in (e.g. canonical display order).
 *
 * Locations not found in `groups` (e.g. stale/legacy values from before
 * the migration) fall into a synthetic "Other" bucket so they're still
 * visible to the user.
 */
export function groupSelectedLocations(
  selected: string[],
  groups: LocationGroup[],
): Array<{ groupName: string; children: string[] }> {
  if (selected.length === 0) return [];
  const lookup = buildLocationToGroupName(groups);
  const bucketed = new Map<string, string[]>();
  const other: string[] = [];

  for (const name of selected) {
    const groupName = lookup.get(name);
    if (groupName) {
      if (!bucketed.has(groupName)) bucketed.set(groupName, []);
      bucketed.get(groupName)!.push(name);
    } else {
      other.push(name);
    }
  }

  // Preserve canonical group order
  const out: Array<{ groupName: string; children: string[] }> = [];
  for (const g of groups) {
    if (bucketed.has(g.name)) {
      out.push({ groupName: g.name, children: bucketed.get(g.name)! });
    }
  }
  if (other.length > 0) {
    out.push({ groupName: "Other", children: other });
  }
  return out;
}
