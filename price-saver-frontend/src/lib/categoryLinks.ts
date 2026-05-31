import type { Category } from "@/lib/api";

// The storefront uses friendly slugs (food, fashion, tech…) on the homepage,
// but /search filters by the backend's numeric category id (?category_id=).
// These keyword lists map each slug to whatever the admin named the category
// in the DB (case-insensitive substring match), so the links resolve to a real
// index instead of a dead word route like /categories/food.
const SLUG_MATCHES: Record<string, string[]> = {
  food: ["food", "grocer"],
  drinks: ["drink", "beverage"],
  fashion: ["fashion", "cloth", "wear"],
  tech: ["tech", "gadget", "electronic", "phone", "laptop"],
  electronics: ["electronic", "gadget", "tech"],
  books: ["book", "stationery", "stationary"],
  beauty: ["beauty", "personal care", "cosmetic"],
  services: ["service", "skill"],
  handmade: ["handmade", "craft", "art"],
  "hostel-items": ["hostel", "home", "kitchen"],
  other: ["other", "misc"],
};

/** Resolve a homepage category slug to a backend category id, or undefined. */
export function resolveCategoryId(cats: Category[], slug: string): number | undefined {
  const keys = SLUG_MATCHES[slug] ?? [slug.replace(/-/g, " ")];
  for (const c of cats) {
    const name = c.name.toLowerCase();
    if (keys.some((k) => name.includes(k))) return c.id;
  }
  return undefined;
}

/**
 * Build a search href for a category. Uses the numeric ?category_id= filter
 * when the slug maps to a real backend category, otherwise falls back to a
 * plain text search on the label so the link still goes somewhere useful.
 */
export function categoryHref(cats: Category[], slug: string, label: string): string {
  const id = resolveCategoryId(cats, slug);
  return id != null
    ? `/search?category_id=${id}`
    : `/search?q=${encodeURIComponent(label)}`;
}
