import { fetchMessages, fetchMessagesBefore } from "./discord";
import { getState, setState, upsertPlayer } from "./db";
import { sha256Hex } from "./encoding";
import type { DiscordAttachment, DiscordMessage, Env } from "./types";

/** The 50-subrequest ceiling is the real limit here, not CPU. */
const MAX_IMAGES_PER_TICK = 15;
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
}

function imageAttachments(
  message: DiscordMessage
): { message: DiscordMessage; attachment: DiscordAttachment }[] {
  if (message.author.bot) return [];
  return (message.attachments ?? [])
    .filter((a) => (a.content_type ?? "").startsWith("image/"))
    .map((attachment) => ({ message, attachment }));
}

async function storeOne(
  env: Env,
  message: DiscordMessage,
  attachment: DiscordAttachment,
  report: IngestReport
): Promise<void> {
  const contentType = (attachment.content_type ?? "").split(";")[0].trim();
  if (!RENDERABLE.has(contentType)) {
    report.skippedFormat++;
    return;
  }

  const response = await fetch(attachment.url);
  if (!response.ok) {
    report.failed++;
    return;
  }

  const bytes = await response.arrayBuffer();
  const hash = await sha256Hex(bytes);

  const existing = await env.DB.prepare("SELECT id FROM dishes WHERE sha256 = ?")
    .bind(hash)
    .first<{ id: number }>();
  if (existing) {
    report.duplicates++;
    return;
  }

  const extension = contentType === "image/png" ? "png" : "jpg";
  const key = `dishes/${hash}.${extension}`;
  await env.BUCKET.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
  });

  const now = Date.now();
  await env.DB.prepare(
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
      now
    )
    .run();

  await upsertPlayer(env, message.author.id, message.author.username, now);
  report.stored++;
}

async function storeAll(
  env: Env,
  items: { message: DiscordMessage; attachment: DiscordAttachment }[],
  report: IngestReport
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((item) =>
        storeOne(env, item.message, item.attachment, report).catch(() => {
          report.failed++;
        })
      )
    );
  }
}

/**
 * Hourly forward ingest. The cursor only advances after the batch commits, so
 * a failed tick replays cleanly on the next one — cron does not retry.
 */
export async function ingest(env: Env): Promise<IngestReport> {
  const report: IngestReport = {
    scanned: 0,
    stored: 0,
    duplicates: 0,
    skippedFormat: 0,
    failed: 0,
  };

  const cursor = await getState(env, "last_message_id");
  const messages = await fetchMessages(env, cursor);
  report.scanned = messages.length;
  if (messages.length === 0) return report;

  const candidates = messages.flatMap(imageAttachments);
  const batch = candidates.slice(0, MAX_IMAGES_PER_TICK);
  await storeAll(env, batch, report);

  // If the cap truncated this run, resume from the last message we fully
  // handled. The leftovers drain on the next tick.
  const lastHandled =
    batch.length < candidates.length
      ? batch[batch.length - 1].message.id
      : messages[messages.length - 1].id;

  await setState(env, "last_message_id", lastHandled);
  return report;
}

/**
 * One-time history walk, run by hand through /backfill. Pages backwards from
 * the oldest message seen so far.
 */
export async function backfill(
  env: Env,
  pages: number
): Promise<IngestReport> {
  const report: IngestReport = {
    scanned: 0,
    stored: 0,
    duplicates: 0,
    skippedFormat: 0,
    failed: 0,
  };

  let before = await getState(env, "backfill_cursor");

  for (let page = 0; page < pages; page++) {
    const messages = await fetchMessagesBefore(env, before);
    if (messages.length === 0) break;

    report.scanned += messages.length;
    const candidates = messages.flatMap(imageAttachments);
    await storeAll(env, candidates.slice(0, MAX_IMAGES_PER_TICK), report);

    before = messages[messages.length - 1].id;
    await setState(env, "backfill_cursor", before);
  }

  return report;
}
