"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, setAccessToken, setTokenRefreshCallback, type LoginResponse, type RegisterResponse, type UserInfo } from "@/lib/api";
import { useSettingsStore, type UserSettingsState } from "@/stores/settingsStore";

const AVATAR_CACHE_KEY = "campify_avatar_url";

type AuthContextType = {
  user: UserInfo | null;
  /** In-memory access token — kept for backward compat with components that read useAuth().token */
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Resolved avatar URL: user.avatar_url ?? localStorage cache — instant on reload */
  avatarUrl: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  register: (username: string, password: string, email?: string) => Promise<RegisterResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Call after a successful MFA verify step to complete the login flow */
  completeLogin: (accessToken: string, userId: number, userName: string, userRole: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]   = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Cached avatar — read from localStorage immediately so avatar shows before refresh completes
  const [cachedAvatar, setCachedAvatar] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AVATAR_CACHE_KEY) || null;
  });

  // Keep localStorage in sync whenever user changes
  useEffect(() => {
    if (!user) return;
    if (user.avatar_url) {
      localStorage.setItem(AVATAR_CACHE_KEY, user.avatar_url);
      setCachedAvatar(user.avatar_url);
    } else {
      localStorage.removeItem(AVATAR_CACHE_KEY);
      setCachedAvatar(null);
    }
  }, [user]);

  // Keep _silentRefresh in sync with React token state
  useEffect(() => {
    setTokenRefreshCallback((newToken) => {
      setToken(newToken);
      setAccessToken(newToken);
    });
    return () => setTokenRefreshCallback(null);
  }, []);

  // Block 13B — restore session via HttpOnly refresh cookie (no localStorage)
  // Block 6B  — hydrate settings from server on every page load
  useEffect(() => {
    (async () => {
      let accessToken: string | null = null;
      try {
        const data = await authApi.refresh();
        accessToken = data.access_token;
        setToken(accessToken);
        setAccessToken(accessToken);
        // Hydrate settings immediately from refresh response if available
        if (data.settings) {
          useSettingsStore.getState().hydrate(data.settings as UserSettingsState);
        }
      } catch {
        // No valid refresh cookie — start unauthenticated
        useSettingsStore.getState().clearSettings();
        setIsLoading(false);
        return;
      }

      // Refresh succeeded — fetch full profile; failure here keeps the session alive
      try {
        const fresh = await authApi.me(accessToken);
        setUser(fresh);
        // Authoritative hydration from /me (overwrites refresh snapshot)
        if (fresh.settings) {
          useSettingsStore.getState().hydrate(fresh.settings as UserSettingsState);
        }
      } catch {
        // /me failed transiently — decode minimal user from JWT so session survives
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          setUser({ id: payload.uid, username: payload.sub ?? "", role: payload.role ?? "user" } as UserInfo);
        } catch { /* JWT decode failed — user stays null but token is valid */ }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const _setSession = useCallback((accessToken: string, userInfo: UserInfo) => {
    setToken(accessToken);
    setAccessToken(accessToken);
    setUser(userInfo);
    // Fetch full profile in background; hydrate settings when it returns
    authApi.me(accessToken).then(full => {
      setUser(full);
      if (full.settings) useSettingsStore.getState().hydrate(full.settings as UserSettingsState);
    }).catch(() => {});
  }, []);

  const completeLogin = useCallback((
    accessToken: string,
    userId: number,
    userName: string,
    userRole: string,
  ) => {
    _setSession(accessToken, { id: userId, username: userName, role: userRole });
  }, [_setSession]);

  const login = useCallback(async (username: string, password: string, rememberMe = false): Promise<LoginResponse> => {
    const res = await authApi.login(username, password, rememberMe);
    if (res.mfa_required) {
      return res; // Caller renders MFA step; completeLogin() called after verify
    }
    // Hydrate settings immediately from login response (before /me background fetch)
    if (res.settings) {
      useSettingsStore.getState().hydrate(res.settings as UserSettingsState);
    }
    // _setSession fetches full profile (avatar_url, display_name) in background
    _setSession(res.access_token!, { id: res.user_id!, username: res.user_name!, role: res.user_role! });
    return res;
  }, [_setSession]);

  const register = useCallback(async (username: string, password: string, email?: string): Promise<RegisterResponse> => {
    const res = await authApi.register(username, password, email);
    if (res.access_token) {
      _setSession(res.access_token, { id: res.user_id!, username: res.user_name!, role: res.user_role! });
    }
    return res;
  }, [_setSession]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore network errors */ }
    setToken(null);
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(AVATAR_CACHE_KEY);
    setCachedAvatar(null);
    useSettingsStore.getState().clearSettings();
  }, []);  

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await authApi.me(token);
      setUser(fresh);
    } catch { /* silently ignore */ }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        avatarUrl: user?.avatar_url ?? cachedAvatar,
        login,
        register,
        logout,
        refreshUser,
        completeLogin,
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
