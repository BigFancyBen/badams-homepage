#!/usr/bin/env node
/**
 * Writes the loot-card sprites for every item the game can drop, and the
 * registry the render route reads them through.
 *
 * Sprites come from the local OSRS item database (a read-only SQLite file,
 * ~29×28 inventory icons), never from the wiki. Each is centred on a 36px
 * square and scaled 4× with no smoothing — the format icons.ts documents —
 * and written to app/api/yut/_assets/items/<key>.png only when the bytes
 * change. The keys are the Worker's item keys (scripts/lib/item-key.mjs).
 *
 * Inputs: config/drops.json (every dropped item) and scripts/lib/icon-extras.json
 * (the keys icons.ts kept by hand: pulled from the DB, or "keep" for art the
 * DB has no sprite for). Output: the PNGs and app/api/yut/_lib/items.generated.ts.
 *
 *   node scripts/export-icons.mjs [--db <path to osrs.db>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import pngjs from "pngjs";
import { itemKey } from "./lib/item-key.mjs";

const { PNG } = pngjs;

const argv = process.argv.slice(2);
const DB_PATH = argv.includes("--db")
  ? argv[argv.indexOf("--db") + 1]
  : "C:/Users/Tango/Documents/projects/prog-to-img-endpoint/data/osrs.db";
const ASSETS_DIR = fileURLToPath(new URL("../../app/api/yut/_assets/items/", import.meta.url));
const REGISTRY = fileURLToPath(new URL("../../app/api/yut/_lib/items.generated.ts", import.meta.url));
/** The literal path prefix icons.ts uses, so Next's file tracer sees every PNG. */
const PATH_PREFIX = "app/api/yut/_assets/items/";

const CANVAS = 36;
const SCALE = 4;

// ── What to export ─────────────────────────────────────────────────

const drops = JSON.parse(readFileSync(new URL("../config/drops.json", import.meta.url), "utf8"));
const extras = JSON.parse(readFileSync(new URL("./lib/icon-extras.json", import.meta.url), "utf8"));

/** key → { db, name }; the hand-kept keys win over drops on both name and source. */
const wanted = new Map();
const kept = new Set();
for (const [key, spec] of Object.entries(extras)) {
  if (key.startsWith("_")) continue;
  if (spec === "keep") {
    kept.add(key);
    continue;
  }
  if (!spec || typeof spec.db !== "string") throw new Error(`icon-extras.json: ${key} needs "keep" or { db }`);
  wanted.set(key, { db: spec.db, name: spec.name ?? spec.db });
}
for (const item of drops.items) {
  if (kept.has(item.k) || wanted.has(item.k)) continue;
  if (itemKey(item.n) !== item.k) throw new Error(`drops.json: key ${item.k} does not match itemKey(${JSON.stringify(item.n)})`);
  wanted.set(item.k, { db: item.n, name: item.n });
}

// ── Sprites ────────────────────────────────────────────────────────

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const byName = db.prepare("SELECT id, icon_data FROM items WHERE name = ? ORDER BY duplicate, noted, id");

/**
 * The DB names some items only by variant: a dagger is "Iron dagger(unp)",
 * a javelin "Rune javelin (unpoisoned)", a cake "Chocolate cake (full)".
 * The plain variant is the sprite the loot card wants.
 */
const VARIANT_SUFFIXES = ["", "(unp)", " (unpoisoned)", " (unpolished)", "(unpolished)", " (full)", " (unlit)"];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** Is this an inventory sprite (a PNG no larger than the canvas)? Some rows hold WebP or a large detail image. */
function isSprite(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 4).equals(PNG_SIGNATURE)) return false;
  return bytes.readUInt32BE(16) <= CANVAS && bytes.readUInt32BE(20) <= CANVAS;
}

/** The first sprite-sized PNG for the item, trying the plain-variant names in order; null when the DB has none. */
function sprite(name) {
  let seen = 0;
  for (const suffix of VARIANT_SUFFIXES) {
    for (const row of byName.all(`${name}${suffix}`)) {
      seen++;
      const bytes = Buffer.from(row.icon_data ?? []);
      if (isSprite(bytes)) return bytes;
    }
  }
  return seen ? { unusable: seen } : null;
}

/** The sprite centred on a transparent 36px square, scaled 4× nearest-neighbour: 144×144 RGBA. */
function upscale(pngBytes, name) {
  const src = PNG.sync.read(pngBytes);
  if (src.width > CANVAS || src.height > CANVAS) throw new Error(`${name}: ${src.width}×${src.height} is larger than the ${CANVAS}px canvas`);
  const size = CANVAS * SCALE;
  const out = new PNG({ width: size, height: size, colorType: 6 });
  out.data.fill(0);
  const offsetX = Math.floor((CANVAS - src.width) / 2);
  const offsetY = Math.floor((CANVAS - src.height) / 2);
  for (let y = 0; y < size; y++) {
    const sy = Math.floor(y / SCALE) - offsetY;
    if (sy < 0 || sy >= src.height) continue;
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(x / SCALE) - offsetX;
      if (sx < 0 || sx >= src.width) continue;
      const from = (sy * src.width + sx) * 4;
      const to = (y * size + x) * 4;
      out.data[to] = src.data[from];
      out.data[to + 1] = src.data[from + 1];
      out.data[to + 2] = src.data[from + 2];
      out.data[to + 3] = src.data[from + 3];
    }
  }
  return PNG.sync.write(out, { colorType: 6, deflateLevel: 9 });
}

mkdirSync(ASSETS_DIR, { recursive: true });
const generated = [];
const missing = [];
let written = 0;
let unchanged = 0;
for (const [key, { db: dbName, name }] of [...wanted.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const bytes = sprite(dbName);
  if (!bytes || !Buffer.isBuffer(bytes)) {
    missing.push(`${key} (${dbName})${bytes ? ` — ${bytes.unusable} row(s) but none a PNG sprite (WebP or a large detail image)` : ""}`);
    continue;
  }
  let png;
  try {
    png = upscale(bytes, dbName);
  } catch (error) {
    missing.push(`${key} (${dbName}) — PNG did not decode: ${error.message}`);
    continue;
  }
  const file = `${ASSETS_DIR}${key}.png`;
  if (existsSync(file) && readFileSync(file).equals(png)) unchanged++;
  else {
    writeFileSync(file, png);
    written++;
  }
  generated.push({ key, name });
}

// ── Registry ───────────────────────────────────────────────────────

const identifier = /^[a-z_][a-z0-9_]*$/;
const lines = generated.map(
  ({ key, name }) =>
    `  ${identifier.test(key) ? key : JSON.stringify(key)}: { path: "${PATH_PREFIX}${key}.png", name: ${JSON.stringify(name)} },`,
);
const registry = `/**
 * Generated by yut-worker/scripts/export-icons.mjs from config/drops.json and
 * scripts/lib/icon-extras.json — do not edit by hand. Paths are literal so
 * Next's file tracer bundles every PNG; icons.ts layers its hand-kept art on
 * top of this table.
 */
export const GENERATED_ITEMS: Record<string, { path: string; name: string }> = {
${lines.join("\n")}
};
`;
const before = existsSync(REGISTRY) ? readFileSync(REGISTRY, "utf8") : null;
if (before !== registry) writeFileSync(REGISTRY, registry);

console.log(
  `${generated.length} sprites: ${written} written, ${unchanged} unchanged; ${kept.size} hand-kept keys left alone; ` +
    `registry ${before === registry ? "unchanged" : "updated"} (${REGISTRY})`,
);
if (missing.length) console.log(`Not in the item DB (${missing.length}):\n  ${missing.join("\n  ")}`);
