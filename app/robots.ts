import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

/**
 * Everything is fetchable, by search crawlers and AI agents alike. Pages that
 * should stay out of an index say so themselves with `noindex`, and the render
 * endpoints under /api say it with an `X-Robots-Tag` header (next.config.ts) —
 * a `Disallow` here would stop a crawler from ever reading either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
