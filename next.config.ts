import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const convexBaseUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexBaseUrl) {
      return [];
    }

    return [
      {
        source: "/convex/:path*",
        destination: `${convexBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
