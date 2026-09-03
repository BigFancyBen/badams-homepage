import { downloadAttachment } from "./discord.ts";
import type { DiscordAttachment, Env } from "./types.ts";

/**
 * Discord's CDN URLs carry an expiry and die within about a day, so a
 * photo that has to be shown again — on a verify, in a digest — is mirrored
 * into R2 first and only the key is kept.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function attachmentKind(
  attachment: DiscordAttachment
): "image" | "video" | null {
  const type = (attachment.content_type ?? "").split(";")[0].trim();
  if (IMAGE_TYPES.includes(type)) return "image";
  if (VIDEO_TYPES.includes(type)) return "video";
  return null;
}

function extensionFor(contentType: string, filename: string): string {
  const fromName = filename.includes(".") ? filename.split(".").pop()! : "";
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[contentType.split(";")[0].trim()] ?? "bin";
}

/**
 * Copies an attachment into R2 under `checkins/<player>/<day>-<id>.<ext>`.
 * Returns the key and public URL, or null if the download or the put failed —
 * in which case the check-in still counts, it just carries no proof.
 */
export async function mirrorAttachment(
  env: Env,
  playerId: string,
  day: string,
  attachment: DiscordAttachment
): Promise<{ key: string; url: string } | null> {
  const downloaded = await downloadAttachment(attachment.url);
  if (!downloaded || downloaded.bytes.byteLength === 0) return null;

  const contentType = attachment.content_type ?? downloaded.contentType;
  const key = `checkins/${playerId}/${day}-${attachment.id}.${extensionFor(contentType, attachment.filename)}`;
  try {
    await env.BUCKET.put(key, downloaded.bytes, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
  return { key, url: `${env.R2_PUBLIC_BASE}/${key}` };
}
