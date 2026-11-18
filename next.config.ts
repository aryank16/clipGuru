import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The render job copies the video bundle (npm run bundle:video) into a Vercel Sandbox.
  outputFileTracingIncludes: {
    "/api/inngest": ["./.remotion-bundle/**/*"],
  },
  partialPrefetching: true,
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
