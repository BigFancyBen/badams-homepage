#!/usr/bin/env node
/**
 * Registers the slash commands with Discord, for the one guild.
 *
 * Reads DISCORD_BOT_TOKEN from .dev.vars (or the environment) and the
 * application and guild ids from wrangler.toml. PUT replaces the whole list,
 * so removing a command from src/register.ts and running this removes it
 * from Discord too. Guild commands appear immediately.
 *
 * The command list lives in TypeScript; Node 22 strips types on import, so
 * this loads it straight from the source.
 */
import { readFileSync, existsSync } from "node:fs";

const toml = readFileSync("wrangler.toml", "utf-8");
const read = (key) => toml.match(new RegExp(`^${key} = "([^"]*)"`, "m"))?.[1];
const appId = process.env.DISCORD_APPLICATION_ID ?? read("DISCORD_APPLICATION_ID");
const guildId = process.env.DISCORD_GUILD_ID ?? read("DISCORD_GUILD_ID");

let token = process.env.DISCORD_BOT_TOKEN;
if (!token && existsSync(".dev.vars")) {
  token = readFileSync(".dev.vars", "utf-8").match(/^DISCORD_BOT_TOKEN=(.+)$/m)?.[1]?.trim();
}
if (!token || !appId || !guildId) {
  console.error("Need DISCORD_BOT_TOKEN (env or .dev.vars), DISCORD_APPLICATION_ID and DISCORD_GUILD_ID (wrangler.toml).");
  process.exit(1);
}

const { COMMANDS } = await import("../src/register.ts");

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`,
  {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDS),
  }
);
const text = await response.text();
if (!response.ok) {
  console.error(`Discord answered ${response.status}: ${text.slice(0, 1000)}`);
  process.exit(1);
}
const registered = JSON.parse(text);
console.log(`Registered ${registered.length} commands: ${registered.map((c) => `/${c.name}`).join(" ")}`);
