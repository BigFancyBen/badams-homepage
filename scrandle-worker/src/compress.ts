import { compressImageUrl } from "./images";
import type { Dish, Env } from "./types";

/**
 * Shrinks the photographs in the bucket to a web-sized copy, in place.
 *
 * Ingest stores a photograph exactly as it arrived, because the hash it is
 * deduplicated on has to be the hash of what was posted. That is about four
 * megabytes a photograph, and nothing in the game shows one at that size — the
 * original stays on Discord, a jump link away. So this pass comes round
 * afterwards and writes a smaller copy over it, under the same key. The same
 * key is the point: the cards, the weekly puzzle's frozen file and every URL
 * already handed out keep working without knowing anything happened.
 *
 * The Worker cannot do the shrinking — ten milliseconds of CPU does not decode
 * a JPEG — so, like the cards, it asks the site, which fetches the photograph
 * from the bucket and hands back the smaller one.
 *
 * It runs after ingest on every tick, newest first, so a photograph posted
 * this hour is small by the end of the tick and the backlog drains behind it.
 */

/** How many a tick shrinks. Each is one outside fetch and a few seconds. */
const PER_TICK = 6;
/** The most one call will take, whoever asks. */
const MAX_PER_RUN = 25;
/** Tries before a photograph is left as it is. */
const MAX_ATTEMPTS = 3;
/** Nothing that is really a photograph is smaller than this. */
const MIN_BYTES = 512;

export interface CompressReport {
  /** Written over with a smaller copy */
  compressed: number;
  /** Already as small as the copy would be, and left alone */
  kept: number;
  failed: number;
  /** Bytes the bucket is lighter by after this run */
  savedBytes: number;
  /** Still stored as they arrived, with tries left */
  remaining: number;
  firstFailure: string | null;
}

function isJpeg(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes, 0, 2);
  return head[0] === 0xff && head[1] === 0xd8;
}

/**
 * The render's own answer for "I fetched it and could not shrink it" — the
 * photograph's fault. Anything else that is not a 200 is the render's: the
 * route not deployed yet, the secret not set, the site down.
 */
const PHOTOGRAPH_FAILED = 502;

/**
 * The smaller copy, or a reason there is not one. Everything that could put
 * something other than the photograph into the bucket is checked here, because
 * the write that follows cannot be taken back: the original is gone from R2
 * the moment it lands.
 *
 * `outage` marks a failure that says nothing about this photograph. Those are
 * not counted against it — the Worker deploys before the site does, and three
 * ticks of a route that does not exist yet would otherwise write off the
 * newest photographs in the catalog for good.
 */
async function smallerCopy(
  env: Env,
  dish: Dish
): Promise<{ bytes: ArrayBuffer } | { error: string; outage?: true }> {
  let response: Response;
  try {
    response = await fetch(await compressImageUrl(env, dish));
  } catch (caught) {
    return { error: `render unreachable: ${String(caught)}`, outage: true };
  }
  if (!response.ok) {
    return response.status === PHOTOGRAPH_FAILED
      ? { error: `render could not shrink it: ${await response.text()}` }
      : { error: `render answered ${response.status}`, outage: true };
  }
  if (response.headers.get("content-type") !== "image/jpeg") {
    return { error: "render did not answer with a JPEG" };
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < MIN_BYTES || !isJpeg(bytes)) {
    return { error: "render answered with something that is not a photograph" };
  }
  return { bytes };
}

export async function compress(
  env: Env,
  limit = PER_TICK
): Promise<CompressReport> {
  const report: CompressReport = {
    compressed: 0,
    kept: 0,
    failed: 0,
    savedBytes: 0,
    remaining: 0,
    firstFailure: null,
  };

  const pending = await env.DB.prepare(
    "SELECT * FROM dishes WHERE compressed_at IS NULL AND compress_attempts < ? " +
      // Fresh tries before retries, so one photograph that keeps failing
      // cannot stand in front of the rest; then newest first, so this hour's
      // photographs are done this hour.
      "ORDER BY compress_attempts ASC, id DESC LIMIT ?"
  )
    .bind(MAX_ATTEMPTS, Math.min(Math.max(limit, 0), MAX_PER_RUN))
    .all<Dish>();

  for (const dish of pending.results ?? []) {
    let error: string | null = null;
    try {
      const stored = await env.BUCKET.head(dish.r2_key);
      if (!stored) {
        error = "not in the bucket";
      } else {
        const copy = await smallerCopy(env, dish);
        if ("error" in copy) {
          if (copy.outage) {
            // Nothing after this one would fare any better.
            report.failed++;
            report.firstFailure ??= copy.error;
            break;
          }
          error = copy.error;
        } else if (copy.bytes.byteLength < stored.size) {
          await env.BUCKET.put(dish.r2_key, copy.bytes, {
            httpMetadata: {
              // A JPEG whatever it was. A PNG keeps its `.png` key, because
              // the key is what everything already points at; what the object
              // says it is, is what readers go by.
              contentType: "image/jpeg",
              cacheControl: "public, max-age=31536000, immutable",
            },
          });
          report.compressed++;
          report.savedBytes += stored.size - copy.bytes.byteLength;
        } else {
          // Somebody posted something small. Leave it, and mark it done.
          report.kept++;
        }
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    if (error) {
      report.failed++;
      report.firstFailure ??= `dish ${dish.id}: ${error}`;
      await env.DB.prepare(
        "UPDATE dishes SET compress_attempts = compress_attempts + 1 WHERE id = ?"
      )
        .bind(dish.id)
        .run();
    } else {
      await env.DB.prepare("UPDATE dishes SET compressed_at = ? WHERE id = ?")
        .bind(Date.now(), dish.id)
        .run();
    }
  }

  const left = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dishes WHERE compressed_at IS NULL AND compress_attempts < ?"
  )
    .bind(MAX_ATTEMPTS)
    .first<{ n: number }>();
  report.remaining = left?.n ?? 0;

  return report;
}
