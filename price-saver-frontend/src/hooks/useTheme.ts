"use client";
import { useTheme as useThemeContext } from "@/context/ThemeContext";

/**
 * Centralised theme hook.
 * Wraps ThemeContext to expose a consistent API:
 *   const { theme, toggle, isDark } = useTheme();
 *
 * `toggle`  — toggles dark/light and persists via settingsStore (server-synced)
 * `isDark`  — boolean convenience flag
 * `theme`   — "light" | "dark" | "system"
 */
export function useTheme() {
  const { theme, toggleTheme } = useThemeContext();
  return {
    theme,
    toggle: toggleTheme,
    toggleTheme,
    isDark: theme === "dark",
  };
}
