/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: process.env.SITE_URL || "https://campify.ng",
  generateRobotsTxt: true,
  changefreq: "daily",
  priority: 0.7,
  sitemapSize: 5000,

  // Exclude internal/auth routes from the sitemap
  exclude: [
    "/auth/*",
    "/seller/*",
    "/buyer/*",
    "/admin/*",
    "/api/*",
  ],

  // Add dynamic seller storefront pages
  additionalPaths: async (config) => {
    const BASE = process.env.NEXT_PUBLIC_API_URL || "https://campify.ng";
    try {
      const res = await fetch(`${BASE}/api/storefront/slugs`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.slugs || []).map((username) => ({
        loc: `/store/${username}`,
        changefreq: "daily",
        priority: 0.8,
        lastmod: new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/admin/", "/seller/", "/buyer/"],
      },
    ],
  },
};

module.exports = config;
