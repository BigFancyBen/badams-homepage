#!/usr/bin/env node
/**
 * Points the Discord application at the deployed Worker and reports what is
 * left for a human. Run after `wrangler deploy` with the bot token:
 *
 *   WORKER_URL=https://yut-hut.<account>.workers.dev node scripts/discord-setup.mjs
 *
 * - Sets the Interactions Endpoint URL on the application (Discord validates
 *   it by sending a PING as it saves, so the Worker must already be live).
 * - Checks whether the bot is in the guild and can see the channel. Adding a
 *   bot to a server is the one thing only a server admin can do, so when it
 *   is missing this prints the invite link (and writes it to the GitHub job
 *   summary when running in Actions).
 *
 * Reads DISCORD_BOT_TOKEN from the environment or .dev.vars, and the ids from
 * wrangler.toml. Idempotent.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const toml = readFileSync("wrangler.toml", "utf-8");
const read = (key) => toml.match(new RegExp(`^${key} = "([^"]*)"`, "m"))?.[1];
const appId = process.env.DISCORD_APPLICATION_ID ?? read("DISCORD_APPLICATION_ID");
const guildId = process.env.DISCORD_GUILD_ID ?? read("DISCORD_GUILD_ID");
const channelId = process.env.DISCORD_CHANNEL_ID ?? read("DISCORD_CHANNEL_ID");

let token = process.env.DISCORD_BOT_TOKEN;
if (!token && existsSync(".dev.vars")) {
  token = readFileSync(".dev.vars", "utf-8").match(/^DISCORD_BOT_TOKEN=(.+)$/m)?.[1]?.trim();
}
const workerUrl = process.env.WORKER_URL?.replace(/\/+$/, "");

// View Channel, Send Messages, Manage Messages (pinning the board), Embed
// Links, Attach Files, Read Message History, Manage Roles (the opt-in ping
// role; the bot's own role must sit above it).
const PERMISSIONS = 1024 + 2048 + 8192 + 16384 + 32768 + 65536 + 268435456;
const INVITE =
  `https://discord.com/oauth2/authorize?client_id=${appId}` +
  `&scope=bot%20applications.commands&permissions=${PERMISSIONS}&guild_id=${guildId}`;

const api = "https://discord.com/api/v10";
async function discord(method, path, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, ok: res.ok, json, text };
}

const notes = [];
function note(line) {
  notes.push(line);
  console.log(line);
}

function summary(invited) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Discord\n\n${notes.map((n) => `- ${n.replace(/\n/g, " ")}`).join("\n")}\n\n` +
      (invited ? "" : `Invite link: ${INVITE}\n\n`)
  );
}

async function main() {
  if (!token || !appId || !guildId || !channelId || !workerUrl) {
    console.error("Need DISCORD_BOT_TOKEN, WORKER_URL, and the ids in wrangler.toml.");
    return 1;
  }

  // ── Interactions endpoint ────────────────────────────────────────
  const endpoint = `${workerUrl}/interactions`;
  const app = await discord("GET", "/applications/@me");
  if (!app.ok) {
    console.error(`could not read the application (${app.status}): ${app.text}`);
    return 1;
  }
  if (app.json.interactions_endpoint_url === endpoint) {
    note(`✅ Interactions endpoint already ${endpoint}`);
  } else {
    const patched = await discord("PATCH", "/applications/@me", { interactions_endpoint_url: endpoint });
    if (patched.ok) {
      note(`✅ Interactions endpoint set to ${endpoint}`);
    } else {
      note(`❌ Discord refused the endpoint (${patched.status}): ${patched.text}`);
      console.error(
        "The Worker must answer Discord's PING with a valid signature — is it deployed with the right DISCORD_PUBLIC_KEY?"
      );
      summary(false);
      return 1;
    }
  }

  // ── Membership ───────────────────────────────────────────────────
  const guild = await discord("GET", `/guilds/${guildId}`);
  let invited = guild.ok;
  if (!guild.ok) {
    note(`⚠️ The bot is not in the server yet. A server admin needs to open, once:\n${INVITE}`);
  } else {
    const channel = await discord("GET", `/channels/${channelId}`);
    if (channel.ok) {
      note(`✅ In ${guild.json.name}, sees #${channel.json.name}`);
    } else {
      invited = false;
      note(
        `⚠️ In ${guild.json.name} but cannot see the channel (${channel.status}). Give the bot View Channel on it, or re-invite:\n${INVITE}`
      );
    }
  }
  summary(invited);
  return 0;
}

// Set the exit code rather than calling process.exit(): on Windows, exiting
// with a fetch still winding down trips a libuv assertion.
process.exitCode = await main();
