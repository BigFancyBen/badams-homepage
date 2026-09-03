import type { DiscordMessage, DiscordRole, Env } from "./types.ts";

const DISCORD_API = "https://discord.com/api/v10";

/** The colour the bot's embeds are edged in. */
export const ACCENT = 0xc9a227;
export const GREEN = 0x7fb347;
export const RED = 0xb02020;

/**
 * Overridable only so the local harness can point at a mock and exercise the
 * post/edit cycle end to end. Unset everywhere except local testing.
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

/** Posts to the game's channel, or to one of its threads when a channel id is given. */
export async function postMessage(
  env: Env,
  payload: unknown,
  channelId: string = env.DISCORD_CHANNEL_ID
): Promise<DiscordMessage> {
  const response = await botFetch(env, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return (await response.json()) as DiscordMessage;
}

export async function editMessage(
  env: Env,
  messageId: string,
  payload: unknown,
  channelId: string = env.DISCORD_CHANNEL_ID
): Promise<void> {
  await botFetch(env, `/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getMessage(
  env: Env,
  messageId: string,
  channelId: string = env.DISCORD_CHANNEL_ID
): Promise<{ id: string; content: string }> {
  const response = await botFetch(env, `/channels/${channelId}/messages/${messageId}`);
  return (await response.json()) as { id: string; content: string };
}

export async function deleteMessage(
  env: Env,
  messageId: string,
  channelId: string = env.DISCORD_CHANNEL_ID
): Promise<void> {
  await botFetch(env, `/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });
}

/**
 * Starts a public thread on one of the channel's messages and returns the
 * thread's id, which is a channel id as far as the rest of the API cares.
 * Needs Create Public Threads and Send Messages in Threads on the channel.
 */
export async function startThread(
  env: Env,
  messageId: string,
  name: string,
  autoArchiveMinutes = 1440
): Promise<string> {
  const response = await botFetch(
    env,
    `/channels/${env.DISCORD_CHANNEL_ID}/messages/${messageId}/threads`,
    {
      method: "POST",
      body: JSON.stringify({ name: name.slice(0, 100), auto_archive_duration: autoArchiveMinutes }),
    }
  );
  return ((await response.json()) as { id: string }).id;
}

export async function pinMessage(env: Env, messageId: string): Promise<void> {
  await botFetch(env, `/channels/${env.DISCORD_CHANNEL_ID}/pins/${messageId}`, {
    method: "PUT",
  });
}

/**
 * Edits the reply already showing for an earlier interaction, or the
 * placeholder a deferred response put up. The interaction's token is the
 * address; Discord honours it for fifteen minutes. Answers false rather than
 * throwing — every way this fails, the caller's answer is a fresh message.
 */
export async function editInteractionReply(
  env: Env,
  applicationId: string,
  token: string,
  payload: unknown
): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiBase(env)}/webhooks/${applicationId}/${token}/messages/@original`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/** A second message under a deferred reply. Same token, same fifteen minutes. */
export async function followUp(
  env: Env,
  applicationId: string,
  token: string,
  payload: unknown
): Promise<boolean> {
  try {
    const response = await fetch(`${apiBase(env)}/webhooks/${applicationId}/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Takes down a deferred placeholder that nothing is going to fill. */
export async function deleteInteractionReply(
  env: Env,
  applicationId: string,
  token: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiBase(env)}/webhooks/${applicationId}/${token}/messages/@original`,
      { method: "DELETE" }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Nothing the bot writes ever mentions anyone, with one exception: the
 * opt-in Players role, and only on the messages that ask for it. `replied_user`
 * is off because check-in lines reply to the morning post, which is the bot
 * replying to itself.
 */
export function allowedMentions(roleId?: string | null) {
  return roleId
    ? { parse: [], roles: [roleId], replied_user: false }
    : { parse: [], replied_user: false };
}

export function messageUrl(env: Env, messageId: string): string {
  return `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${env.DISCORD_CHANNEL_ID}/${messageId}`;
}

export function replyTo(messageId: string | null | undefined) {
  return messageId
    ? { message_reference: { message_id: messageId, fail_if_not_exists: false } }
    : {};
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([*_~`|\\])/g, "\\$1");
}

// ── Application commands ───────────────────────────────────────────

/** PUT is idempotent: the list replaces whatever was registered before. */
export async function registerGuildCommands(
  env: Env,
  commands: unknown[]
): Promise<unknown> {
  const response = await botFetch(
    env,
    `/applications/${env.DISCORD_APPLICATION_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`,
    { method: "PUT", body: JSON.stringify(commands) }
  );
  return response.json();
}

// ── Roles ──────────────────────────────────────────────────────────

export async function listRoles(env: Env): Promise<DiscordRole[]> {
  const response = await botFetch(env, `/guilds/${env.DISCORD_GUILD_ID}/roles`);
  return (await response.json()) as DiscordRole[];
}

export async function createRole(env: Env, name: string): Promise<DiscordRole> {
  const response = await botFetch(env, `/guilds/${env.DISCORD_GUILD_ID}/roles`, {
    method: "POST",
    body: JSON.stringify({ name, mentionable: true, color: ACCENT }),
  });
  return (await response.json()) as DiscordRole;
}

export async function addMemberRole(
  env: Env,
  userId: string,
  roleId: string
): Promise<void> {
  await botFetch(
    env,
    `/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`,
    { method: "PUT" }
  );
}

export async function removeMemberRole(
  env: Env,
  userId: string,
  roleId: string
): Promise<void> {
  await botFetch(
    env,
    `/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${roleId}`,
    { method: "DELETE" }
  );
}

// ── Attachments ────────────────────────────────────────────────────

/** Fetches an attachment from Discord's CDN. Those URLs expire within a day. */
export async function downloadAttachment(
  url: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
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
