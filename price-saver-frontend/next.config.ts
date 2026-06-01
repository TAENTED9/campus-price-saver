import type { NextConfig } from "next";

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
    // The legacy /admin/verification* routes were consolidated into the
    // /admin/seller page (Pending/Approved/Rejected tabs). Redirect old
    // bookmarks and email links so they never hit a 404.
    return [
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
                ? "connect-src 'self' https://campify.digital https://api.campify.digital wss://campify.digital"
                : "connect-src 'self' http://localhost:* ws://localhost:* http://192.168.0.195:* ws://192.168.0.195:*",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
