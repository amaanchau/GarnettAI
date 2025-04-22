import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disables ESLint during production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;