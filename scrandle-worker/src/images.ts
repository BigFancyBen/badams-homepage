import { base64UrlFromString, hmacBase64Url } from "./encoding";
import type { Dish, Env } from "./types";

/**
 * The render endpoints live in the Next app on Vercel — Workers Free gives
 * 10ms of CPU, which is nowhere near enough to rasterize anything. We hand
 * Discord a signed URL and Discord's proxy fetches the PNG itself, so the
 * Worker never touches image bytes at render time.
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

export function matchupImageUrl(
  env: Env,
  matchupId: number,
  a: Dish,
  b: Dish
): Promise<string> {
  // The id is in the path so Discord's cache sees a new URL per matchup.
  return signedUrl(env, `matchup/${matchupId}`, {
    a: dishUrl(env, a),
    b: dishUrl(env, b),
    n: matchupId,
    na: a.name ?? "",
    nb: b.name ?? "",
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
  chefB: string
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
  });
}

export function standingsImageUrl(
  env: Env,
  stamp: number,
  title: string,
  rows: { n: string; e: number; d: number }[]
): Promise<string> {
  return signedUrl(env, `standings/${stamp}`, { t: title, rows });
}
