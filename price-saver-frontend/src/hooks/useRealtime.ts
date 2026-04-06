"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useRealtime<T>(
  endpoint: string,
  token: string | null,
  intervalMs: number = 30_000,
  initialData?: T
): { data: T | undefined; isLoading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);

  const fetchData = useCallback(async () => {
    if (!endpoint) return;
    try {
      const res = await fetch(
        `${API_URL}${endpoint}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      if (res.ok) setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => {
    fetchData();
    let id = setInterval(fetchData, intervalMs);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        fetchData();
        id = setInterval(fetchData, intervalMs);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData, intervalMs]);

  return { data, isLoading, refresh: fetchData };
}
