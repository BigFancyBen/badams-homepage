/**
 * Re-bakes the museum's offline assets: the bay plaques' text masks
 * (museum/textures/plaques/<exhibit id>.png, from museum/scripts/plaque_bake_tool.gd).
 *
 *   node scripts/museum-bake.mjs [--project <dir>]
 *
 * Run it after changing an exhibit's title in museum/exhibits.json or the plaque layout in
 * signage.gd, then `node scripts/museum-export.mjs`. The tool renders text, so it opens a window
 * (the queue books the GPU for it); Godot runs through the machine's queue, as every engine run on
 * this box must.
 */

import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--project");
const PROJECT = resolve(at >= 0 ? argv[at + 1] : join(ROOT, "museum"));
const env = {
  ...process.env,
  GODOT_BIN: process.env.MUSEUM_GODOT_BIN ?? "C:/Users/Tango/Documents/projects/_tools/godot/Godot_v4.7.1-stable_win64_console.exe",
};
const QUEUED = process.env.GODOT_QUEUED ?? "C:/Users/Tango/Documents/projects/prognosticator/scripts/godot-queued.mjs";
const godot = (...args) => execFileSync("node", [QUEUED, "--path", PROJECT, ...args], { env, stdio: "inherit" });

godot("--headless", "--import");
godot("--script", "res://scripts/plaque_bake_tool.gd");
godot("--headless", "--import");
