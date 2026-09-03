import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
  /**
   * The Yut Hut render routes read RuneScape fonts and skill icons off disk.
   * The paths are literal strings so the tracer should find them on its own;
   * this keeps the whole folder in the bundle even if that stops being true.
   */
  outputFileTracingIncludes: {
    '/api/yut/**': ['./app/api/yut/_assets/**'],
  },
  async rewrites() {
    return [
      /**
       * Discord builds the invite URL itself: it takes the Deep Link URL from
       * the application's General Information page and appends
       * `/_discord/join?secret=...`. The path is not ours to choose, and a
       * folder named `_discord` in the app directory would be a PRIVATE folder
       * — Next excludes those from routing entirely — so the segment is served
       * by rewriting it onto a route with an ordinary name.
       */
      { source: '/river/_discord/join', destination: '/river/discord-join' },
    ];
  },
};

export default nextConfig;
