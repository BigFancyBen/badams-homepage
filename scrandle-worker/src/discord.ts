import type { DiscordMessage, Env } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

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
