"use client";

import React, { createContext, useContext, useMemo, useEffect } from "react";
import { useSettingsStore, applyTheme } from "@/stores/settingsStore";
import { getAccessToken } from "@/lib/api";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const rawTheme = useSettingsStore((s) => s.settings?.theme);
  const updateLocal = useSettingsStore((s) => s.updateLocal);
  const syncToServer = useSettingsStore((s) => s.syncToServer);

  // Resolve "system" to the actual OS preference
  const resolvedTheme: Theme = useMemo(() => {
    if (rawTheme === "dark") return "dark";
    if (rawTheme === "system" && typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }, [rawTheme]);

  // Keep DOM in sync when theme changes (covers persisted cache on initial mount)
  useEffect(() => {
    applyTheme(rawTheme ?? "light");
  }, [rawTheme]);

  const toggleTheme = () => {
    const next: Theme = resolvedTheme === "light" ? "dark" : "light";
    updateLocal({ theme: next });
    const token = getAccessToken();
    if (token) {
      syncToServer({ theme: next }, token).catch(() => {});
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
