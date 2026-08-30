import type { Dish, DiscordMessage, Env } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

/** The colour an open round is edged in, and the one a closed one gets. */
export const ACCENT = 0x81a1c1;
export const WIN = 0xa3be8c;

/**
 * Overridable only so the local harness can point at a mock and exercise the
 * post/close cycle end to end. Unset everywhere except local testing.
 */
function apiBase(env: Env): string {
  return env.DISCORD_API_BASE || DISCORD_API;
}

async function botFetch(
  env: Env,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`${apiBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Discord ${init.method ?? "GET"} ${path} → ${response.status}: ${detail.slice(0, 300)}`
    );
  }
  return response;
}

/** Oldest-first page of messages after `afterId`. Omit to get the latest. */
export async function fetchMessages(
  env: Env,
  afterId: string | null,
  limit = 100
): Promise<DiscordMessage[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (afterId) query.set("after", afterId);
  const response = await botFetch(
    env,
    `/channels/${env.DISCORD_CHANNEL_ID}/messages?${query}`
  );
  const messages = (await response.json()) as DiscordMessage[];
  // Discord returns newest-first; process oldest-first so the cursor advances cleanly.
  return messages.reverse();
}

/** Page walking backwards through history, for the one-time backfill. */
export async function fetchMessagesBefore(
  env: Env,
  beforeId: string | null,
  limit = 100
): Promise<DiscordMessage[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (beforeId) query.set("before", beforeId);
  const response = await botFetch(
    env,
    `/channels/${env.DISCORD_CHANNEL_ID}/messages?${query}`
  );
  return (await response.json()) as DiscordMessage[];
}

export async function postMessage(
  env: Env,
  payload: unknown
): Promise<DiscordMessage> {
  const response = await botFetch(
    env,
    `/channels/${env.DISCORD_CHANNEL_ID}/messages`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return (await response.json()) as DiscordMessage;
}

export async function editMessage(
  env: Env,
  messageId: string,
  payload: unknown
): Promise<void> {
  await botFetch(
    env,
    `/channels/${env.DISCORD_CHANNEL_ID}/messages/${messageId}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

/**
 * Only ever allow the Tasters role to be pinged. A dish caption containing
 * `@everyone` gets carried into our own message text otherwise.
 */
export function allowedMentions(env: Env) {
  return env.TASTER_ROLE_ID
    ? { parse: [], roles: [env.TASTER_ROLE_ID] }
    : { parse: [] };
}

/**
 * Jump link to the message a dish came from, so people can read the original
 * context. Note this also reveals the poster — anyone who clicks sees who
 * cooked it.
 */
export function sourceLink(env: Env, dish: Dish, label: string): string {
  return `[${label}](https://discord.com/channels/${env.DISCORD_GUILD_ID}/${env.DISCORD_CHANNEL_ID}/${dish.discord_message_id})`;
}

/**
 * Usernames end up in message text, and Discord reads markdown in that. A name
 * with an underscore either side is a real thing people have, and it would
 * otherwise render as italics with the underscores eaten.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([*_~`|\\])/g, "\\$1");
}

/**
 * Discord's cap is 4096; the slack is for the "and N more" line and for the
 * fact that a description over the limit fails the whole edit, which would
 * take the result card down with it.
 */
const MAX_LOG_LENGTH = 3800;

/**
 * Who voted for what, as a second embed under the result card.
 *
 * It goes on the same message the close path already edits, which is why it is
 * an embed and not a follow-up post or a thread: no extra API call, no extra
 * permission, no second message in the channel, and it renders below the card
 * so the card stays the headline.
 *
 * This is a deliberate reversal of the secrecy the vote buttons were chosen
 * for. That was about the tally being invisible *while a round runs*, so
 * nobody can bandwagon — closing the round ends the reason for it, and who
 * voted for what is the part people actually want to argue about.
 */
export function ballotEmbed(title: string, lines: string[]) {
  const kept: string[] = [];
  let length = 0;

  for (const line of lines) {
    if (length + line.length + 1 > MAX_LOG_LENGTH) break;
    kept.push(line);
    length += line.length + 1;
  }

  const dropped = lines.length - kept.length;
  if (dropped > 0) kept.push(`…and ${dropped} more.`);

  return { color: WIN, title, description: kept.join("\n") };
}

export async function logToDiscord(env: Env, message: string): Promise<void> {
  if (!env.DISCORD_LOG_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message.slice(0, 1900),
        allowed_mentions: { parse: [] },
      }),
    });
  } catch {
    // Logging must never take the tick down with it.
  }
}
