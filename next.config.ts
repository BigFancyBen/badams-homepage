import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * The Hobby plan allows 5,000 image transformations a month, site-wide,
     * and every (image, width) pair the optimizer serves is one. Fewer widths
     * and a month-long cache keep the pages that still use it (/river, the
     * card tools) well inside that. The homepage screenshots skip the
     * optimizer altogether: they are committed at display size.
     */
    deviceSizes: [640, 828, 1200, 1920],
    minimumCacheTTL: 2678400,
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
  async headers() {
    return [
      {
        /* The homepage loops. Not fingerprinted, so a day and no longer. */
        source: '/:path*/loop.mp4',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
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
