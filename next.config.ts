import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['cards.scryfall.io'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['ably'],
};

export default nextConfig;
