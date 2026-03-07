"use client";
import { useEffect } from "react";

/**
 * Forces light mode on the storefront. Uses MutationObserver so it wins
 * even if ThemeContext's useEffect fires later and tries to re-add "dark".
 */
export default function ForceLightMode() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark");

    const observer = new MutationObserver(() => {
      if (html.classList.contains("dark")) {
        html.classList.remove("dark");
      }
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return null;
}
