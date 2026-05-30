import type { MetadataRoute } from "next";

const API  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = "https://campify.digital";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,               lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/search`,   lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE}/deals`,    lastModified: now, changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE}/signin`,   lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/signup`,   lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  // Seller storefronts — pulled from /api/storefront/slugs (returns {slugs: string[]})
  let storeRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/api/storefront/slugs`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: { slugs?: string[] } = await res.json();
      storeRoutes = (data.slugs ?? []).map((slug) => ({
        url: `${BASE}/store/${slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch {
    /* non-fatal — sitemap still renders without storefronts */
  }

  // Active listings — pulled from /api/items/listings/sitemap
  let listingRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/api/items/listings/sitemap`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const rows: { uuid: string; updated_at: string | null }[] = await res.json();
      listingRoutes = rows
        .filter((r) => r.uuid)
        .map((r) => ({
          url: `${BASE}/listing/${r.uuid}`,
          lastModified: r.updated_at ? new Date(r.updated_at) : now,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }));
    }
  } catch {
    /* non-fatal */
  }

  return [...staticRoutes, ...storeRoutes, ...listingRoutes];
}
