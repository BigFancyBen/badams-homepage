import { fetchMessages, fetchMessagesBefore } from "./discord";
import { getState, setState } from "./db";
import { sha256Hex } from "./encoding";
import type { DiscordAttachment, DiscordMessage, Env } from "./types";

/**
 * Workers Free allows 50 subrequests per invocation, and D1 and R2 binding
 * calls count towards it — confirmed the hard way, by a backfill dying on
 * "Too many subrequests by single Worker invocation".
 *
 * Storing one image costs three: download, R2 put, D1 insert. Everything else
 * (paging, the dedupe lookup, cursor reads and writes, the player upsert) is
 * per-page or per-run, so ten images leaves comfortable headroom.
 *
 * Nothing here needs to finish in one pass. Both the hourly tick and the
 * backfill route keep a cursor, so whatever is left drains on the next call.
 */
const MAX_IMAGES_PER_RUN = 10;
const MAX_PAGES_PER_RUN = 3;
/** Six simultaneous outgoing connections, so download in small batches. */
const BATCH_SIZE = 5;

/**
 * satori (the renderer behind the image endpoints) rasterizes JPEG and PNG.
 * Anything else would ingest fine and then fail to render, so skip it loudly
 * rather than discovering it mid-matchup.
 */
const RENDERABLE = new Set(["image/jpeg", "image/jpg", "image/png"]);

export interface IngestReport {
  scanned: number;
  stored: number;
  duplicates: number;
  skippedFormat: number;
  failed: number;
  /** True when the run stopped on its own cap rather than running out of history. */
  more: boolean;
}

interface Candidate {
  message: DiscordMessage;
  attachment: DiscordAttachment;
}

function emptyReport(): IngestReport {
  return {
    scanned: 0,
    stored: 0,
    duplicates: 0,
    skippedFormat: 0,
    failed: 0,
    more: false,
  };
}

function imageAttachments(message: DiscordMessage): Candidate[] {
  if (message.author.bot) return [];
  return (message.attachments ?? [])
    .filter((a) => (a.content_type ?? "").startsWith("image/"))
    .map((attachment) => ({ message, attachment }));
}

/**
 * Drops anything already ingested, in one query, *before* downloading a byte.
 * Re-running a backfill over covered ground therefore costs almost nothing.
 */
async function withoutAlreadyStored(
  env: Env,
  candidates: Candidate[]
): Promise<Candidate[]> {
  if (candidates.length === 0) return [];

  const ids = [...new Set(candidates.map((c) => c.message.id))];
  const placeholders = ids.map(() => "?").join(",");
  const existing = await env.DB.prepare(
    `SELECT discord_message_id, attachment_id FROM dishes WHERE discord_message_id IN (${placeholders})`
  )
    .bind(...ids)
    .all<{ discord_message_id: string; attachment_id: string }>();

  const seen = new Set(
    (existing.results ?? []).map((r) => `${r.discord_message_id}:${r.attachment_id}`)
  );

  return candidates.filter(
    (c) => !seen.has(`${c.message.id}:${c.attachment.id}`)
  );
}

/** Download, hash, store. Three subrequests. Returns the poster to record. */
async function storeOne(
  env: Env,
  candidate: Candidate,
  report: IngestReport
): Promise<{ id: string; username: string } | null> {
  const { message, attachment } = candidate;
  const contentType = (attachment.content_type ?? "").split(";")[0].trim();

  if (!RENDERABLE.has(contentType)) {
    report.skippedFormat++;
    return null;
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    report.failed++;
    return null;
  }

  const bytes = await response.arrayBuffer();
  const hash = await sha256Hex(bytes);
  const extension = contentType === "image/png" ? "png" : "jpg";
  const key = `dishes/${hash}.${extension}`;

  await env.BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  // The UNIQUE on sha256 catches reposts of the same bytes under a different
  // message, so no separate existence check is needed.
  const result = await env.DB.prepare(
    "INSERT INTO dishes (discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, caption, posted_at, ingested_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING"
  )
    .bind(
      message.id,
      attachment.id,
      message.author.id,
      key,
      hash,
      message.content?.slice(0, 500) || null,
      Date.parse(message.timestamp),
      Date.now()
    )
    .run();

  if (result.meta.changes === 0) {
    report.duplicates++;
    return null;
  }

  report.stored++;
  return { id: message.author.id, username: message.author.username };
}

async function storeAll(
  env: Env,
  candidates: Candidate[],
  report: IngestReport
): Promise<void> {
  const posters = new Map<string, string>();

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((candidate) =>
        storeOne(env, candidate, report).catch(() => {
          report.failed++;
          return null;
        })
      )
    );
    for (const poster of results) {
      if (poster) posters.set(poster.id, poster.username);
    }
  }

  // One write for every chef seen this run, rather than one per photo.
  if (posters.size > 0) {
    const now = Date.now();
    await env.DB.batch(
      [...posters].map(([id, username]) =>
        env.DB.prepare(
          "INSERT INTO players (discord_id, username, first_seen) VALUES (?, ?, ?) " +
            "ON CONFLICT (discord_id) DO UPDATE SET username = excluded.username"
        ).bind(id, username, now)
      )
    );
  }
}

/**
 * Hourly forward ingest. The cursor only advances past messages that were
 * fully handled, so a run cut short by the cap resumes cleanly next hour.
 */
export async function ingest(env: Env): Promise<IngestReport> {
  const report = emptyReport();

  const cursor = await getState(env, "last_message_id");
  const messages = await fetchMessages(env, cursor);
  report.scanned = messages.length;
  if (messages.length === 0) return report;

  const candidates = await withoutAlreadyStored(
    env,
    messages.flatMap(imageAttachments)
  );

  const batch = candidates.slice(0, MAX_IMAGES_PER_RUN);
  report.more = batch.length < candidates.length;
  await storeAll(env, batch, report);

  await setState(
    env,
    "last_message_id",
    report.more
      ? batch[batch.length - 1].message.id
      : messages[messages.length - 1].id
  );

  return report;
}

/**
 * History walk, run by hand. Pages backwards from wherever it left off, so
 * calling it repeatedly drains the channel — it does not need to finish in
 * one request, and cannot.
 */
export async function backfill(env: Env, pages: number): Promise<IngestReport> {
  const report = emptyReport();
  let before = await getState(env, "backfill_cursor");
  let budget = MAX_IMAGES_PER_RUN;

  const limit = Math.min(pages, MAX_PAGES_PER_RUN);

  for (let page = 0; page < limit && budget > 0; page++) {
    const messages = await fetchMessagesBefore(env, before);
    if (messages.length === 0) break;

    report.scanned += messages.length;
    const candidates = await withoutAlreadyStored(
      env,
      messages.flatMap(imageAttachments)
    );

    const batch = candidates.slice(0, budget);
    budget -= batch.length;
    await storeAll(env, batch, report);

    // Messages come back newest-first. If the budget truncated this page,
    // resume from the last image actually handled — otherwise everything past
    // the cap is skipped permanently, which is the opposite of a backfill.
    const truncated = batch.length < candidates.length;
    if (truncated) report.more = true;

    before = truncated
      ? batch[batch.length - 1].message.id
      : messages[messages.length - 1].id;
    await setState(env, "backfill_cursor", before);
  }

  return report;
}
