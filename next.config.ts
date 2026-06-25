import type { NextConfig } from "next";

// When CAPACITOR=1 we produce a static export (`out/`) for the Capacitor
// Android shell instead of the normal server build. The web deployment
// (with its API routes) is unaffected — this branch only runs for the
// `build:mobile` pipeline, which bundles FloatWise as an offline app.
const isCapacitor = process.env.CAPACITOR === "1";

const nextConfig: NextConfig = {
  ...(isCapacitor
    ? { output: "export" as const, distDir: "out", trailingSlash: true }
    : {}),
  images: {
    // Static export can't use the optimizing loader.
    unoptimized: isCapacitor,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/v1/create-qr-code/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cloudflare.steamstatic.com',
        pathname: '/apps/dota2/images/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/gh/devicons/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/pmndrs/**',
      },
    ],
  },
  serverExternalPackages: ['ably'],
};

export default nextConfig;
