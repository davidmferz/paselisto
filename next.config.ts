import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything here is live data (payments, capacity, check-in), so caching is
  // disabled on purpose; routes opt into dynamic rendering explicitly.
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
