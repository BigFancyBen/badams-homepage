import type { NextConfig } from "next";

/**
 * Sent with every response. None of these change what the site does; each
 * closes off something a page here never needs.
 *
 * There is no script or style policy: the apps lean on inline styles and
 * motion's injected ones, and a policy loose enough to allow those protects
 * very little. `frame-ancestors` is the part of CSP that is free.
 */
const SECURITY_HEADERS = [
  // Vercel sets this on its own; stated so it survives a move off Vercel.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // A response is what its content type says it is, never sniffed.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nobody else's page gets to put this one in a frame and draw over it.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Other sites learn the origin, not the path — room codes and trip codes
  // live in paths.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // What is switched off is what nothing here uses. Geolocation, the motion
  // sensors and the clipboard are left alone: floatwise, the homepage tilt
  // and the copy buttons use them.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  /**
   * No `images.remotePatterns`, on purpose. The optimizer answers anybody who
   * asks `/_next/image?url=…` for any address the patterns allow, and every
   * answer is one of the 5,000 transformations a month the whole site shares —
   * an allowlist of "every Scryfall card" is one a stranger
   * can spend in an afternoon. Remote images are rendered `unoptimized`
   * instead, straight from a source that already serves them sized, which
   * leaves the optimizer with the finite set of files in /public.
   */
  /**
   * The Yut Hut render routes read RuneScape fonts and skill icons off disk.
   * The paths are literal strings so the tracer should find them on its own;
   * this keeps the whole folder in the bundle even if that stops being true.
   */
  outputFileTracingIncludes: {
    '/api/yut/**': ['./app/api/yut/_assets/**'],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
