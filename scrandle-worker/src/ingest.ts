import { takeWholeMessages } from "./batching";
import { fetchMessages, fetchMessagesBefore } from "./discord";
import { getState, retryWrite, setState } from "./db";
import { sha256Hex } from "./encoding";
import type { DiscordAttachment, DiscordMessage, Env } from "./types";

/**
 * Workers Free allows 50 subrequests per invocation, and D1 and R2 binding
 * calls count towards it — confirmed the hard way, by a backfill dying on
 * "Too many subrequests by single Worker invocation".
 *
 * Storing one image costs three: download, R2 put, D1 insert. Everything else
 * (paging, the dedupe lookup, cursor reads and writes, the chef upsert) is
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
 * Anything else would ingest fine and then fail to render, so it is dropped
 * while the page is being read, before it can take up a slot in the budget —
 * a burst of reaction GIFs used to fill all ten and store nothing.
 */
const RENDERABLE = new Set(["image/jpeg", "image/jpg", "image/png"]);

export interface IngestReport {
  scanned: number;
  stored: number;
  duplicates: number;
  skippedFormat: number;
  failed: number;
  /**
   * Why the first failure failed. A bare count cannot tell a transient D1 blip
   * from a dead attachment URL, and those want very different responses.
   */
  firstFailure: string | null;
  /** True when the run stopped on its own cap rather than running out of history. */
  more: boolean;
}

interface Candidate {
  message: DiscordMessage;
  attachment: DiscordAttachment;
  contentType: string;
}

function emptyReport(): IngestReport {
  return {
    scanned: 0,
    stored: 0,
    duplicates: 0,
    skippedFormat: 0,
    failed: 0,
    firstFailure: null,
    more: false,
  };
}

function recordFailure(report: IngestReport, reason: unknown): void {
  report.failed++;
  report.firstFailure ??= (
    reason instanceof Error ? reason.message : String(reason)
  ).slice(0, 200);
}

function imageAttachments(
  message: DiscordMessage,
  report: IngestReport
): Candidate[] {
  if (message.author.bot) return [];

  const candidates: Candidate[] = [];
  for (const attachment of message.attachments ?? []) {
    const contentType = (attachment.content_type ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) continue;
    if (!RENDERABLE.has(contentType)) {
      report.skippedFormat++;
      continue;
    }
    candidates.push({ message, attachment, contentType });
  }
  return candidates;
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

/**
 * One write for every chef in this batch, rather than one per photo.
 *
 * Runs *before* any dish is stored, and that ordering is the whole point. A
 * dish row whose poster never made it into `players` reads as "unknown chef"
 * for good: the dedupe check skips that message on every later run, so the
 * upsert it missed never gets a second chance. Writing the chefs first means a
 * failure here leaves nothing committed and the batch simply runs again.
 *
 * The cost is a `players` row for a chef whose only photo then failed to
 * download. That row is invisible — standings require `matches_played > 0` —
 * and correct anyway, since they did post.
 */
async function upsertPosters(
  env: Env,
  candidates: Candidate[]
): Promise<void> {
  const posters = new Map<string, string>();
  for (const { message } of candidates) {
    posters.set(message.author.id, message.author.username);
  }
  if (posters.size === 0) return;

  const now = Date.now();
  await retryWrite(() =>
    env.DB.batch(
      [...posters].map(([id, username]) =>
        env.DB.prepare(
          "INSERT INTO players (discord_id, username, first_seen) VALUES (?, ?, ?) " +
            "ON CONFLICT (discord_id) DO UPDATE SET username = excluded.username"
        ).bind(id, username, now)
      )
    )
  );
}

/** Download, hash, store. Three subrequests. */
async function storeOne(
  env: Env,
  candidate: Candidate,
  report: IngestReport
): Promise<void> {
  const { message, attachment, contentType } = candidate;

  const response = await fetch(attachment.url);
  if (!response.ok) {
    recordFailure(report, `download ${attachment.id} → ${response.status}`);
    return;
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
  // message, so no separate existence check is needed — and that same clause
  // is what makes this safe to retry. A retry after a reply went missing sees
  // its own committed row and reports zero changes, so the run counts it a
  // duplicate rather than a store. The row and the object are both correct;
  // only the tally in the report is off by one, on a path that only runs when
  // D1 is already misbehaving.
  const result = await retryWrite(() =>
    env.DB.prepare(
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
      .run()
  );

  if (result.meta.changes === 0) {
    report.duplicates++;
    return;
  }

  report.stored++;
}

async function storeAll(
  env: Env,
  candidates: Candidate[],
  report: IngestReport
): Promise<void> {
  if (candidates.length === 0) return;

  await upsertPosters(env, candidates);

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((candidate) =>
        storeOne(env, candidate, report).catch((error) =>
          recordFailure(report, error)
        )
      )
    );
  }
}

/**
 * Hourly forward ingest. The cursor only advances to a message boundary, so a
 * run cut short by the cap resumes cleanly next hour.
 */
export async function ingest(env: Env): Promise<IngestReport> {
  const report = emptyReport();

  const cursor = await getState(env, "last_message_id");
  const messages = await fetchMessages(env, cursor);
  report.scanned = messages.length;
  if (messages.length === 0) return report;

  const candidates = await withoutAlreadyStored(
    env,
    messages.flatMap((message) => imageAttachments(message, report))
  );

  const batch = takeWholeMessages(candidates, MAX_IMAGES_PER_RUN);
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
      messages.flatMap((message) => imageAttachments(message, report))
    );

    const batch = takeWholeMessages(candidates, budget);
    budget -= batch.length;
    await storeAll(env, batch, report);

    // Messages come back newest-first. If the budget truncated this page,
    // resume from the last message actually handled — otherwise everything
    // past the cap is skipped permanently, which is the opposite of a
    // backfill. `batch` always ends on a message boundary, so excluding that
    // message from the next page leaves nothing behind on it.
    const truncated = batch.length < candidates.length;
    if (truncated) report.more = true;

    before = truncated
      ? batch[batch.length - 1].message.id
      : messages[messages.length - 1].id;
    await setState(env, "backfill_cursor", before);
  }

  return report;
}
