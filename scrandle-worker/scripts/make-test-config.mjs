#!/usr/bin/env node
/**
 * Writes wrangler.test.toml — a throwaway copy of wrangler.toml with the
 * placeholders local mode needs.
 *
 * Wrangler refuses to resolve a D1 binding with an empty database_id, even in
 * --local mode where the id is meaningless. Rather than commit a fake id to
 * the real config (and risk someone deploying against it), generate a test
 * config on demand.
 *
 * Node rather than sed, because this has to run on PowerShell too.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "wrangler.toml";
const TARGET = "wrangler.test.toml";

const PLACEHOLDERS = [
  [/database_id = ""/, 'database_id = "00000000-0000-0000-0000-000000000000"'],
  [/R2_PUBLIC_BASE = ""/, 'R2_PUBLIC_BASE = "https://images.test.local"'],
];

let config;
try {
  config = readFileSync(SOURCE, "utf-8");
} catch {
  console.error(`Could not read ${SOURCE}. Run this from the scrandle-worker directory.`);
  process.exit(1);
}

for (const [pattern, replacement] of PLACEHOLDERS) {
  if (pattern.test(config)) config = config.replace(pattern, replacement);
}

writeFileSync(TARGET, config, "utf-8");
console.log(`Wrote ${TARGET} (gitignored). Local D1 and R2 only — never deployed.`);
