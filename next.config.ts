import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow Binance image domains through Next.js image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.binance.com' },
      { protocol: 'https', hostname: '**.bnbstatic.com' },
    ],
  },
};

export default nextConfig;
