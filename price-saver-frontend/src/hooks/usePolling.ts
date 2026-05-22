"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Custom hook for polling data at regular intervals.
 * Provides real-time data updates without WebSocket complexity.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchFn);

  // Keep fetchFn ref up to date without triggering re-renders
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const refetch = useCallback(async () => {
    try {
      const result = await fetchRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Refetch immediately whenever fetchFn identity changes (e.g. filter state
    // changed upstream). Without fetchFn in this dep array, filter changes only
    // updated the ref and the user waited up to intervalMs for fresh data.
    refetch();

    const interval = setInterval(refetch, intervalMs);

    return () => clearInterval(interval);
  }, [refetch, intervalMs, enabled, fetchFn]);

  return { data, loading, error, refetch };
}
