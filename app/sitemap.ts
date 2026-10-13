import type { MetadataRoute } from "next";
import { INDEXED_PAGES, absoluteUrl } from "./site";

/**
 * No `lastModified`: the only date available here is the build's, and a
 * sitemap that says every page changed on every deploy teaches a crawler to
 * ignore the field.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PAGES.map((page) => ({ url: absoluteUrl(page.path) }));
}
