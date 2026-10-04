import { base64UrlFromString, hmacBase64Url } from "./encoding.ts";
import type { Env } from "./types.ts";

/**
 * The render endpoints live in the Next app on Vercel — Workers Free gives
 * 10ms of CPU, nowhere near enough to rasterize anything. We hand the render
 * a signed URL carrying everything it needs and it returns a PNG.
 */
export async function signedUrl(env: Env, route: string, payload: unknown): Promise<string> {
  const data = base64UrlFromString(JSON.stringify(payload));
  const sig = await hmacBase64Url(env.YUT_IMAGE_SECRET, data);
  return `${env.IMAGE_BASE_URL}/api/yut/${route}?d=${data}&s=${sig}`;
}

export function retryField(attempt: number): { r?: number } {
  return attempt > 0 ? { r: attempt } : {};
}

const RENDER_ATTEMPTS = 3;

/**
 * Fetches a card from the render endpoint and keeps it in R2, so Discord is
 * handed a file that is already there rather than a URL that renders when its
 * proxy gets round to asking. A retry mints a new URL, because a failed
 * render is cached at the edge under the old one.
 */
export async function renderCard(
  env: Env,
  key: string,
  mint: (attempt: number) => Promise<string>
): Promise<string | null> {
  for (let attempt = 0; attempt < RENDER_ATTEMPTS; attempt++) {
    const url = await mint(attempt);
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) continue;
      bytes = await response.arrayBuffer();
    } catch {
      continue;
    }
    if (bytes.byteLength === 0) continue;

    try {
      await env.BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return `${env.R2_PUBLIC_BASE}/${key}`;
    } catch {
      return url;
    }
  }
  return null;
}

/**
 * A card for a view a player opens with a button. The view answers in text at
 * once; the picture follows. `cached` is the quick look (is this exact card
 * already drawn?) that lets it ride on the answer itself; `render` draws it.
 */
export interface ViewCard {
  cached: () => Promise<string | null>;
  render: () => Promise<string | null>;
}

/**
 * A card kept under the hash of what is on it: the same bank, farm or boss
 * bar is drawn once, however many times it is opened.
 */
export function viewCard(env: Env, route: string, payload: object): ViewCard {
  const key = async () => `views/${route}/${await hmacBase64Url(env.YUT_IMAGE_SECRET, JSON.stringify(payload))}.png`;
  return {
    cached: async () => {
      try {
        const name = await key();
        return (await env.BUCKET.head(name)) ? `${env.R2_PUBLIC_BASE}/${name}` : null;
      } catch {
        return null;
      }
    },
    render: async () => renderCard(env, await key(), (attempt) => signedUrl(env, route, { ...payload, ...retryField(attempt) })),
  };
}

export type PanelTone = "good" | "warn" | "bad" | "dim";

/** The sections a panel card stacks under its headline. Mirrors app/api/yut/_lib/panel.tsx. */
export type PanelSection =
  | { s: "bar"; l: string; h: number; g: number; r?: string; c?: PanelTone }
  | { s: "grid"; l?: string; items: { k: string; c: number }[]; m?: number }
  | { s: "rows"; l?: string; rows: { k?: string; l: string; r?: string; c?: PanelTone }[] }
  | { s: "stats"; items: { l: string; v: string }[] };

export interface PanelPayload {
  t: string;
  sub?: string;
  /** The sprite beside the headline: an item key or a skill. */
  big?: string;
  sections: PanelSection[];
  d: string;
}

export type PanelKind = "bank" | "boss" | "farm" | "kingdom" | "task" | "menu" | "tears";

/** One of the view cards: /api/yut/panel/<kind>. Empty sections are dropped here, so a view can list them all. */
export function panelCard(env: Env, kind: PanelKind, payload: PanelPayload): ViewCard {
  const sections = payload.sections.filter(
    (section) => (section.s === "grid" ? section.items.length > 0 : section.s === "rows" ? section.rows.length > 0 : true)
  );
  return viewCard(env, `panel/${kind}`, { ...payload, sections });
}

/** The fonts have no glyphs outside Latin-1: names keep what the card can draw. */
export function cardText(text: string): string {
  return text.replace(/[^\x20-\x7e\xa0-\xff]/g, "").trim();
}
