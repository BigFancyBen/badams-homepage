import { base64UrlFromString, hmacBase64Url } from "./encoding";
import type { Upload } from "./discord";
import type { StandingsRow } from "./standings";
import type { Dish, Env } from "./types";

/**
 * The render endpoints live in the Next app on Vercel — Workers Free gives
 * 10ms of CPU, which is nowhere near enough to rasterize anything. We hand
 * the render a signed URL and it returns a PNG.
 *
 * The signature stops the endpoint from being an open image proxy.
 */
async function signedUrl(
  env: Env,
  route: string,
  payload: unknown
): Promise<string> {
  const data = base64UrlFromString(JSON.stringify(payload));
  const sig = await hmacBase64Url(env.SCRANDLE_IMAGE_SECRET, data);
  return `${env.IMAGE_BASE_URL}/api/scrandle/${route}?d=${data}&s=${sig}`;
}

export function dishUrl(env: Env, dish: Dish): string {
  return `${env.R2_PUBLIC_BASE}/${dish.r2_key}`;
}

/**
 * The classifier's focal point for a photograph, for the render to centre
 * its crop on. Undefined — and so absent from the payload, since JSON drops
 * it — until the classifier has been round, which leaves every URL minted
 * before this existed byte-identical to what it was.
 */
export function dishFocus(dish: Dish): [number, number] | undefined {
  if (dish.focus_x == null || dish.focus_y == null) return undefined;
  // Two decimals is a hundredth of the frame, which is finer than the
  // classifier can see and keeps the URL short.
  return [
    Math.round(dish.focus_x * 100) / 100,
    Math.round(dish.focus_y * 100) / 100,
  ];
}

/**
 * `attempt` only appears in the payload from the second try onwards, so the
 * ordinary path mints exactly the URL it always did. It exists to make a retry
 * a different URL: a slow or failed render can be cached against the one that
 * produced it, and asking again for the same URL can hand back the same
 * failure.
 */
function retryField(attempt: number): { r?: number } {
  return attempt > 0 ? { r: attempt } : {};
}

export function matchupImageUrl(
  env: Env,
  matchupId: number,
  a: Dish,
  b: Dish,
  attempt = 0
): Promise<string> {
  // The id is in the path so a render is traceable to its matchup.
  return signedUrl(env, `matchup/${matchupId}`, {
    a: dishUrl(env, a),
    b: dishUrl(env, b),
    n: matchupId,
    na: a.name ?? "",
    nb: b.name ?? "",
    fa: dishFocus(a),
    fb: dishFocus(b),
    ...retryField(attempt),
  });
}

export function resultImageUrl(
  env: Env,
  matchupId: number,
  a: Dish,
  b: Dish,
  votesA: number,
  votesB: number,
  chefA: string,
  chefB: string,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `result/${matchupId}`, {
    a: dishUrl(env, a),
    b: dishUrl(env, b),
    va: votesA,
    vb: votesB,
    ca: chefA,
    cb: chefB,
    n: matchupId,
    na: a.name ?? "",
    nb: b.name ?? "",
    fa: dishFocus(a),
    fb: dishFocus(b),
    ...retryField(attempt),
  });
}

/**
 * The ranking card: up to five photographs, numbered to match the buttons.
 * `t` is the classifier's name for each, and may be blank; `f` is its focal
 * point, and may be missing.
 *
 * `h` is the header — "Rank the pasta" on a themed round, "Rank the places" on
 * a mixed one. Optional in the payload rather than required, so the render
 * endpoint can ship before or after this does: an older endpoint ignores it
 * and draws the header it always drew.
 */
export function ballotImageUrl(
  env: Env,
  roundId: number,
  entries: Dish[],
  title: string,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `ballot/${roundId}`, {
    n: roundId,
    h: title,
    items: entries.map((dish) => ({
      u: dishUrl(env, dish),
      t: dish.name ?? "",
      f: dishFocus(dish),
    })),
    ...retryField(attempt),
  });
}

/**
 * The reveal: the same photographs in finishing order, with each one's rating
 * movement. `p` is the position label, `d` the rounded Elo delta, `f` the
 * focal point for the crop.
 */
export function ballotResultImageUrl(
  env: Env,
  roundId: number,
  rows: { u: string; t: string; p: string; d: number; f?: [number, number] }[],
  ballots: number,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `ballot-result/${roundId}`, {
    n: roundId,
    b: ballots,
    items: rows,
    ...retryField(attempt),
  });
}

export function standingsImageUrl(
  env: Env,
  stamp: number,
  title: string,
  rows: StandingsRow[],
  attempt = 0
): Promise<string> {
  return signedUrl(env, `standings/${stamp}`, {
    t: title,
    rows,
    ...retryField(attempt),
  });
}

/**
 * A web-sized copy of a photograph, to be written over the original in the
 * bucket — see compress.ts. No retry field: the pass that asks comes round
 * again next tick, and the answer is never cached.
 */
export function compressImageUrl(env: Env, dish: Dish): Promise<string> {
  return signedUrl(env, "compress", { u: dishUrl(env, dish) });
}

/** How many times to ask for a card before posting without one. */
const RENDER_ATTEMPTS = 3;

/**
 * Discord's upload cap for a bot on an unboosted server. A card is a megabyte
 * or two; a raw photograph is whatever the phone made, and one over this goes
 * out as a link instead.
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The filename a card is uploaded under, and so what its embed points at. */
export function cardName(
  kind: "matchup" | "result" | "standings" | "ballot" | "ballot-result",
  id: number
): string {
  return `${kind}-${id}.png`;
}

/**
 * Renders a card and returns its bytes, to be uploaded with the message that
 * shows it. Returns null if the card never rendered at all.
 *
 * Uploaded rather than linked because a link is a fetch Discord makes later,
 * and that fetch is the part that fails. Discord pulls an embed image through
 * its media proxy once, at post time, and caches whatever it gets against the
 * URL for good — and the proxy drops perfectly good files now and then. Cards
 * used to be mirrored into R2 and linked from there, which fixed a slow render
 * but not the proxy: on 14 September two of a five-card batch went out blank,
 * and on 28 September four of five did, every one of them a valid PNG sitting
 * in R2. An upload is on Discord's CDN before the message exists, so there is
 * nothing left for the proxy to fetch.
 *
 * The retries are still here for the render itself, which can be slow or
 * briefly failing: two large photographs take seconds to rasterize. `attempt`
 * makes each retry a different URL, so a failure cached against the first
 * cannot be handed back for the second.
 */
export async function renderCard(
  name: string,
  mint: (attempt: number) => Promise<string>
): Promise<Upload | null> {
  for (let attempt = 0; attempt < RENDER_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(await mint(attempt));
      if (!response.ok) continue;
      // A signature failure or a crashed render answers with text, and an
      // upload of text is a card with nothing in it.
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) {
        continue;
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
        continue;
      }
      return { name, type: "image/png", bytes };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * A dish's own photograph, read out of R2 for uploading — the caption contest
 * shows one photograph as itself rather than a card, and it is exposed to the
 * proxy in exactly the way a card was. Null when the object is gone or too
 * big to upload, and the caller links it instead.
 */
export async function photoUpload(env: Env, dish: Dish): Promise<Upload | null> {
  try {
    const object = await env.BUCKET.get(dish.r2_key);
    if (!object || object.size === 0 || object.size > MAX_UPLOAD_BYTES) {
      return null;
    }
    const type = object.httpMetadata?.contentType ?? "image/jpeg";
    const extension = type.split("/")[1]?.split(/[;+]/)[0] || "jpg";
    return {
      name: `photo-${dish.id}.${extension}`,
      type,
      bytes: await object.arrayBuffer(),
    };
  } catch {
    return null;
  }
}
