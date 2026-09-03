import { downloadAttachment } from "./discord.ts";
import type { DiscordAttachment } from "./types.ts";

/**
 * A check-in's photo or video is Discord's to keep. The slash option hands
 * the bot a CDN link that dies within about a day, so the bot downloads the
 * bytes once and re-uploads them as a real attachment on its own channel
 * post; that attachment lives as long as the message does, shows inline, and
 * plays inline. Nothing is copied anywhere else.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export interface AttachmentFile {
  filename: string;
  bytes: ArrayBuffer;
  contentType: string;
}

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
 * Fetches the attachment's bytes from Discord's CDN while the link is live.
 * Returns null if the download failed, in which case the check-in still
 * counts and still carries proof — there is just nothing to re-post.
 */
export async function fetchAttachment(
  playerId: string,
  day: string,
  attachment: DiscordAttachment
): Promise<AttachmentFile | null> {
  const downloaded = await downloadAttachment(attachment.url);
  if (!downloaded || downloaded.bytes.byteLength === 0) return null;
  const contentType = attachment.content_type ?? downloaded.contentType;
  return {
    filename: `${playerId}-${day}.${extensionFor(contentType, attachment.filename)}`,
    bytes: downloaded.bytes,
    contentType,
  };
}
