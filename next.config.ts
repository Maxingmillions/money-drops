import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Money Drops is a mostly client-driven PWA (map, geolocation, camera).
  // Keep the classic rendering model: pages that read the session render
  // dynamically, API routes are never cached.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
