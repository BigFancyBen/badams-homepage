#!/usr/bin/env node
/**
 * Makes sure the Worker's Cloudflare resources exist and that wrangler.toml
 * names them: the D1 database (`database_id`) and the R2 bucket with its
 * public r2.dev URL (`R2_PUBLIC_BASE`). Idempotent, so the deploy workflow
 * runs it on every push and it is a no-op once the file is filled in.
 *
 *   node scripts/provision.mjs          fill in whatever is blank
 *   node scripts/provision.mjs --check  also confirm the named resources exist
 *
 * Needs a logged-in wrangler (`npx wrangler login`) or CLOUDFLARE_API_TOKEN.
 * When it changes wrangler.toml, commit the result: the ids are not secrets.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

// Wrangler by its JS entry rather than npx, which needs a shell on Windows.
const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const TOML = "wrangler.toml";
const DB_NAME = "yut-hut";
const BUCKET = "yut-hut-images";
const check = process.argv.includes("--check");

function wrangler(...args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

let toml = readFileSync(TOML, "utf-8");
const get = (key) => toml.match(new RegExp(`^${key} = "([^"]*)"`, "m"))?.[1] ?? "";
function set(key, value) {
  const next = toml.replace(new RegExp(`^(${key} = )"[^"]*"`, "m"), `$1"${value}"`);
  if (next === toml) throw new Error(`${TOML} has no ${key} line to fill in`);
  toml = next;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const DEV_URL = /https:\/\/pub-[0-9a-f]+\.r2\.dev/;

// ── D1 ────────────────────────────────────────────────────────────
if (!get("database_id") || check) {
  const databases = JSON.parse(wrangler("d1", "list", "--json"));
  let db = databases.find((d) => d.name === DB_NAME);
  if (!db) {
    console.log(`creating D1 database ${DB_NAME}`);
    const out = wrangler("d1", "create", DB_NAME);
    const id = out.match(/database_id\s*=\s*"(?<id>[0-9a-f-]{36})"/)?.groups?.id ?? out.match(UUID)?.[0];
    if (!id) throw new Error(`could not read the new database id from wrangler:\n${out}`);
    db = { name: DB_NAME, uuid: id };
  }
  if (get("database_id") !== db.uuid) {
    set("database_id", db.uuid);
    console.log(`database_id = ${db.uuid}`);
  } else {
    console.log(`D1 ${DB_NAME} present (${db.uuid})`);
  }
} else {
  console.log(`database_id already set (${get("database_id")})`);
}

// ── R2 ────────────────────────────────────────────────────────────
if (!get("R2_PUBLIC_BASE") || check) {
  const buckets = wrangler("r2", "bucket", "list");
  if (!new RegExp(`^name:\\s+${BUCKET}\\s*$`, "m").test(buckets)) {
    console.log(`creating R2 bucket ${BUCKET}`);
    wrangler("r2", "bucket", "create", BUCKET);
  }
  let status = wrangler("r2", "bucket", "dev-url", "get", BUCKET);
  if (!/enabled/i.test(status) || !DEV_URL.test(status)) {
    console.log(`enabling the public r2.dev URL on ${BUCKET}`);
    status = wrangler("r2", "bucket", "dev-url", "enable", BUCKET, "--force");
    if (!DEV_URL.test(status)) status = wrangler("r2", "bucket", "dev-url", "get", BUCKET);
  }
  const base = status.match(DEV_URL)?.[0];
  if (!base) throw new Error(`could not read the r2.dev URL from wrangler:\n${status}`);
  if (get("R2_PUBLIC_BASE") !== base) {
    set("R2_PUBLIC_BASE", base);
    console.log(`R2_PUBLIC_BASE = ${base}`);
  } else {
    console.log(`R2 ${BUCKET} public at ${base}`);
  }
} else {
  console.log(`R2_PUBLIC_BASE already set (${get("R2_PUBLIC_BASE")})`);
}

if (toml !== readFileSync(TOML, "utf-8")) {
  writeFileSync(TOML, toml);
  console.log(`${TOML} updated — commit it.`);
}
