import type { NextConfig } from "next";

// Single source of truth for the CSP connect-src allowlist: whatever backend
// NEXT_PUBLIC_API_URL points to (plus its WebSocket origin) is allowed. This
// avoids hardcoding a domain that drifts from the real deployment — set the
// env var on Vercel and the CSP follows automatically. Baked at build time.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const WS_ORIGIN = API_ORIGIN.replace(/^http/, "ws"); // https→wss, http→ws
const PROD_CONNECT_SRC = ["'self'", API_ORIGIN, WS_ORIGIN]
  .filter(Boolean)
  .join(" ");

const nextConfig: NextConfig = {
  output: "standalone",

  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  allowedDevOrigins: ["192.168.0.195"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  async redirects() {
    return [
      // Canonical host: force www → bare domain so there is a single origin.
      // Keeps CORS (ALLOWED_ORIGINS), cookies, and emailed links consistent on
      // https://campify.digital. Matched by Host header, preserves the path.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.campify.digital" }],
        destination: "https://campify.digital/:path*",
        permanent: true,
      },
      // The legacy /admin/verification* routes were consolidated into the
      // /admin/seller page (Pending/Approved/Rejected tabs). Redirect old
      // bookmarks and email links so they never hit a 404.
      { source: "/admin/verification", destination: "/admin/seller", permanent: true },
      { source: "/admin/verification/:path*", destination: "/admin/seller", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://res.cloudinary.com",
              // <video>/<source> use media-src, NOT img-src. Without this, the
              // Cloudinary video URL falls back to default-src 'self' and is
              // blocked (blank player). blob: covers any future client-side
              // object URLs.
              "media-src 'self' blob: https://res.cloudinary.com",
              process.env.NODE_ENV === "production"
                ? `connect-src ${PROD_CONNECT_SRC}`
                : "connect-src 'self' http://localhost:* ws://localhost:* http://192.168.0.195:* ws://192.168.0.195:*",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
