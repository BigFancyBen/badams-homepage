#!/usr/bin/env node
/**
 * Mints a signed Scrandle render URL for local testing.
 *
 *   node scripts/scrandle-sign.mjs matchup/1 '{"a":"https://...","b":"https://...","n":1}'
 *
 * Reads SCRANDLE_IMAGE_SECRET from the environment (or .env.local) and
 * BASE_URL, defaulting to http://localhost:3000.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

function loadLocalEnv() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local, fall back to the real environment.
  }
}

function base64Url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

loadLocalEnv();

const [route, json] = process.argv.slice(2);
if (!route || !json) {
  console.error(
    "usage: node scripts/scrandle-sign.mjs <route> <json-payload>\n" +
      '  e.g. node scripts/scrandle-sign.mjs standings/7 \'{"t":"Week 7","rows":[]}\''
  );
  process.exit(1);
}

const secret = process.env.SCRANDLE_IMAGE_SECRET;
if (!secret) {
  console.error("SCRANDLE_IMAGE_SECRET is not set (put it in .env.local)");
  process.exit(1);
}

const base = process.env.BASE_URL || "http://localhost:3000";
const data = base64Url(Buffer.from(JSON.stringify(JSON.parse(json)), "utf-8"));
const sig = base64Url(createHmac("sha256", secret).update(data).digest());

console.log(`${base}/api/scrandle/${route}?d=${data}&s=${sig}`);
