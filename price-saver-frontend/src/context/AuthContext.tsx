"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, type LoginResponse, type UserInfo } from "@/lib/api";

type AuthContextType = {
  user: UserInfo | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  register: (username: string, password: string, email?: string) => Promise<LoginResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("ps_token");
    const savedUser = localStorage.getItem("ps_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    const res = await authApi.login(username, password);
    setToken(res.access_token);
    const userInfo: UserInfo = {
      id: res.user_id!,
      username: res.user_name!,
      role: res.user_role,
    };
    setUser(userInfo);
    localStorage.setItem("ps_token", res.access_token);
    localStorage.setItem("ps_user", JSON.stringify(userInfo));
    return res;
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string): Promise<LoginResponse> => {
    const res = await authApi.register(username, password, email);
    setToken(res.access_token);
    const userInfo: UserInfo = {
      id: res.user_id!,
      username: res.user_name!,
      role: res.user_role,
    };
    setUser(userInfo);
    localStorage.setItem("ps_token", res.access_token);
    localStorage.setItem("ps_user", JSON.stringify(userInfo));
    return res;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("ps_token");
    localStorage.removeItem("ps_user");
  }, []);

  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem("ps_token");
    if (!savedToken) return;
    try {
      const fresh = await authApi.me(savedToken);
      setUser(fresh);
      localStorage.setItem("ps_user", JSON.stringify(fresh));
    } catch {
      // silently ignore — stale data stays
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
