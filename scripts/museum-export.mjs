/**
 * Exports the Godot museum to public/museum/engine/ for the homepage.
 *
 *   node scripts/museum-export.mjs [--project <dir>]
 *
 * Imports, exports the "Web" preset, removes the HTML shell and icons the
 * page doesn't use, prints raw and brotli sizes (what a visitor downloads),
 * and writes app/components/museum/engineManifest.json (the version the page
 * requests the files under, and their sizes): run `next build` after it, as
 * the page bakes the manifest in. The plaque text masks are baked offline by
 * museum-bake.mjs, not here. Godot runs through the machine's queue (testq), as every engine
 * run on this box must. Pass --upload to then run museum-upload.mjs (R2 via the museum-cdn Worker).
 Uses the 4.7.1 console build under _tools (MUSEUM_GODOT_BIN overrides;
 * GODOT_BIN is ignored on purpose).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--project");
const PROJECT = resolve(at >= 0 ? argv[at + 1] : join(ROOT, "museum"));
const OUT = join(ROOT, "public", "museum", "engine");

/* The export templates installed here are 4.7.1, and an editor of another version
   exports a build whose engine banner and template do not match. GODOT_BIN in the
   environment points at plain 4.7, so it is deliberately ignored: give a 4.7.1 binary in
   MUSEUM_GODOT_BIN to override this default. */
const env = {
  ...process.env,
  GODOT_BIN: process.env.MUSEUM_GODOT_BIN ?? "C:/Users/Tango/Documents/projects/_tools/godot/Godot_v4.7.1-stable_win64_console.exe",
};
const QUEUED = process.env.GODOT_QUEUED ?? "C:/Users/Tango/Documents/projects/prognosticator/scripts/godot-queued.mjs";
const godot = (...args) => execFileSync("node", [QUEUED, "--headless", "--path", PROJECT, ...args], { env, stdio: "inherit" });

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
godot("--import");
godot("--export-release", "Web", join(OUT, "museum.html"));

for (const f of readdirSync(OUT)) {
  if (f.endsWith(".html") || f.endsWith(".png") || f.endsWith(".ico") || f.endsWith(".svg")) rmSync(join(OUT, f));
}

let total = 0;
const hash = createHash("sha1");
const bytes = {};
for (const f of readdirSync(OUT)) {
  const data = readFileSync(join(OUT, f));
  const raw = data.length;
  const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length;
  if (!f.includes("worklet")) total += br;
  if (/\.(js|wasm|pck)$/.test(f) && !f.includes("worklet")) hash.update(f).update(data);
  if (/\.(wasm|pck)$/.test(f)) bytes[f] = raw;
  console.log(`${f.padEnd(36)} ${(raw / 1e6).toFixed(2).padStart(7)} MB raw  ${(br / 1e6).toFixed(2).padStart(7)} MB br`);
}
console.log(`download (js + wasm + pck, brotli): ${(total / 1e6).toFixed(1)} MB`);

/* What the page needs to know about this export: a version for the ?v= it requests the files
   under (so they can be cached as immutable), the decoded sizes for its loading bar, and the
   rough download size it shows next to the button. */
const manifest = { v: hash.digest("hex").slice(0, 10), bytes, downloadMb: Math.round(total / 1e6) };
writeFileSync(join(ROOT, "app", "components", "museum", "engineManifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`engineManifest.json: v=${manifest.v}`);

if (process.argv.includes("--upload")) {
  execFileSync("node", [join(ROOT, "scripts", "museum-upload.mjs")], { stdio: "inherit" });
}
