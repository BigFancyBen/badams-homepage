#!/usr/bin/env node
/**
 * Pushes the Worker's secrets to Cloudflare in one `wrangler secret bulk`
 * call, from whichever of these the environment provides:
 *
 *   YUT_DISCORD_BOT_TOKEN        → DISCORD_BOT_TOKEN
 *   YUT_IMAGE_SECRET             → YUT_IMAGE_SECRET
 *   YUT_ADMIN_SECRET             → ADMIN_SECRET
 *   YUT_DISCORD_LOG_WEBHOOK_URL  → DISCORD_LOG_WEBHOOK_URL
 *
 * The YUT_ prefix is what the GitHub repository secrets are called, so the
 * deploy workflow can pass every secret it has and this script sends the
 * ones that are set. Locally, the unprefixed names are read from the
 * environment and then from .dev.vars, so `npm run secrets` after filling in
 * .dev.vars does the same job by hand. Nothing is ever deleted: a secret that
 * is not provided is left as it is on Cloudflare.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const MAP = {
  DISCORD_BOT_TOKEN: "YUT_DISCORD_BOT_TOKEN",
  YUT_IMAGE_SECRET: "YUT_IMAGE_SECRET",
  ADMIN_SECRET: "YUT_ADMIN_SECRET",
  DISCORD_LOG_WEBHOOK_URL: "YUT_DISCORD_LOG_WEBHOOK_URL",
};

const devVars = {};
if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) devVars[m[1]] = m[2].trim();
  }
}

const secrets = {};
for (const [name, ci] of Object.entries(MAP)) {
  const value = process.env[ci] || process.env[name] || (process.env.CI ? "" : devVars[name]);
  if (value) secrets[name] = value;
}

const names = Object.keys(secrets);
if (names.length === 0) {
  console.log("no secrets provided; nothing pushed");
  process.exit(0);
}

console.log(`pushing ${names.join(", ")}`);
execFileSync(process.execPath, [WRANGLER, "secret", "bulk"], {
  input: JSON.stringify(secrets),
  stdio: ["pipe", "inherit", "inherit"],
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
});
