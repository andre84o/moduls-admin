import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Media uploads (images + documents) flow through Server Actions, whose
    // request body defaults to a 1MB cap. Raise it so real files go through.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
