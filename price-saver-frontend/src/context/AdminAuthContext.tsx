"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Block 2 — Zero client-side storage.
 * The admin access token lives in memory only. Session is restored on boot
 * via the backend's HttpOnly refresh cookie + POST /api/auth/refresh.
 * The legacy `admin_token` client cookie (readable to JS, vulnerable to XSS)
 * has been removed; no middleware depended on it.
 */

export type AdminUser = {
  id: number;
  username: string;
  display_name?: string;
  role: string;
};

type AdminAuthContextType = {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, adminKey: string) => Promise<void>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]           = useState<AdminUser | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // SEC-002: restore session via HttpOnly refresh cookie — no localStorage
    (async () => {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!refreshRes.ok) throw new Error("No session");
        const refreshData = await refreshRes.json();

        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${refreshData.access_token}` },
          credentials: "include",
        });
        if (!meRes.ok) throw new Error("No session");
        const me = await meRes.json();
        if (me.role !== "admin") throw new Error("Not admin");

        const adminUser: AdminUser = {
          id: me.id ?? me.numeric_id,
          username: me.username,
          display_name: me.display_name ?? me.username,
          role: "admin",
        };
        setToken(refreshData.access_token);
        setUser(adminUser);
      } catch {
        // No valid admin session
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, adminKey: string) => {
    const res = await fetch(`${API_BASE}/api/auth/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, admin_key: adminKey }),
      credentials: "include",  // receive the campify_refresh HttpOnly cookie
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();

    if (data.user_role !== "admin") {
      throw new Error("Access denied — admin credentials only.");
    }

    const adminUser: AdminUser = {
      id: data.admin_id,
      username: data.admin_name ?? username,
      display_name: data.admin_name,
      role: "admin",
    };

    setToken(data.access_token);
    setUser(adminUser);
  }, []);

  const logout = useCallback(() => {
    // Revoke server-side refresh token (fire-and-forget — navigates away immediately after)
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AdminAuthContext.Provider value={{
      user, token, isLoading,
      isAuthenticated: !!token && user?.role === "admin",
      login, logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
