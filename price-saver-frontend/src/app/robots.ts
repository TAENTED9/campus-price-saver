import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/store/", "/listing/", "/deals"],
        disallow: [
          "/dashboard/",
          "/seller/",
          "/admin/",
          "/api/",
          "/signin",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: "https://campify.ng/sitemap.xml",
    host: "https://campify.ng",
  };
}
