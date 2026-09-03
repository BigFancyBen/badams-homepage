#!/usr/bin/env node
/**
 * Mints a signed Yut Hut render URL for local testing.
 *
 *   node scripts/yut-sign.mjs levelup/1 '{"n":"Ben","k":"attack","l":42,"d":"2 Sep 2026"}'
 *   node scripts/yut-sign.mjs standings/1 '{"t":"Week 1","rows":[]}' --base https://benadams.dev
 *
 * Reads YUT_IMAGE_SECRET from the environment (or .env.local). The base
 * URL comes from --base or BASE_URL, defaulting to http://localhost:3000.
 * Use --base rather than a BASE_URL= prefix, which PowerShell cannot parse.
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

const argv = process.argv.slice(2);
const baseFlag = argv.indexOf("--base");
const baseOverride = baseFlag === -1 ? null : argv[baseFlag + 1];
const [route, json] = argv.filter(
  (arg, i) => arg !== "--base" && (baseFlag === -1 || i !== baseFlag + 1)
);
if (!route || !json) {
  console.error(
    "usage: node scripts/yut-sign.mjs <route> <json-payload>\n" +
      '  e.g. node scripts/yut-sign.mjs standings/7 \'{"t":"Week 7","rows":[]}\''
  );
  process.exit(1);
}

const secret = process.env.YUT_IMAGE_SECRET;
if (!secret) {
  console.error("YUT_IMAGE_SECRET is not set (put it in .env.local)");
  process.exit(1);
}

const base = baseOverride || process.env.BASE_URL || "http://localhost:3000";
const data = base64Url(Buffer.from(JSON.stringify(JSON.parse(json)), "utf-8"));
const sig = base64Url(createHmac("sha256", secret).update(data).digest());

console.log(`${base}/api/yut/${route}?d=${data}&s=${sig}`);
