"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { notificationsApi } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type NotifCounts = {
  total: number;
  messages: number;
  orders: number;
  system: number;
};

type NotificationContextType = {
  counts: NotifCounts;
  markCategoryRead: (
    category: "messages" | "orders" | "system" | "all"
  ) => Promise<void>;
  refresh: () => void;
};

const ZERO: NotifCounts = { total: 0, messages: 0, orders: 0, system: 0 };

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { token } = useAuth();
  const [counts, setCounts] = useState<NotifCounts>(ZERO);

  const fetchCounts = useCallback(async () => {
    if (!token) return;
    try {
      // notificationsApi uses the shared request() helper with silent-refresh on 401
      const data = (await notificationsApi.unreadCount(token)) as {
        unread_count: number;
        total?: number;
        messages?: number;
        orders?: number;
        system?: number;
      };
      setCounts({
        total: data.total ?? data.unread_count ?? 0,
        messages: data.messages ?? 0,
        orders: data.orders ?? 0,
        system: data.system ?? 0,
      });
    } catch {
      /* silent */
    }
  }, [token]);

  const markCategoryRead = useCallback(
    async (category: "messages" | "orders" | "system" | "all") => {
      if (!token) return;
      const prev = counts;
      // Optimistic update
      setCounts((c) => {
        if (category === "all") return ZERO;
        const next = { ...c };
        next[category] = 0;
        next.total = next.messages + next.orders + next.system;
        return next;
      });
      try {
        await fetch(`${API_BASE}/api/notifications/mark-read`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ category }),
        });
        // Sync authoritative counts from server
        await fetchCounts();
      } catch {
        // Restore on failure
        setCounts(prev);
      }
    },
    [token, counts, fetchCounts]
  );

  const refresh = useCallback(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Fetch on mount and every 30 s
  useEffect(() => {
    if (!token) {
      setCounts(ZERO);
      return;
    }
    fetchCounts();
    const id = setInterval(fetchCounts, 30_000);
    return () => clearInterval(id);
  }, [token, fetchCounts]);

  return (
    <NotificationContext.Provider value={{ counts, markCategoryRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotifications must be within NotificationProvider");
  return ctx;
};
