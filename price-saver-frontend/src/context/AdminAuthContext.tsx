"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function setCookie(name: string, value: string, days = 1) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]           = useState<AdminUser | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    const savedUser  = localStorage.getItem("admin_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, adminKey: string) => {
    const res = await fetch(`${API_BASE}/api/auth/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, admin_key: adminKey }),
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
    localStorage.setItem("admin_token", data.access_token);
    localStorage.setItem("admin_user", JSON.stringify(adminUser));
    setCookie("admin_token", data.access_token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    deleteCookie("admin_token");
  }, []);

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
