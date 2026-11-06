/**
 * Copies the exhibit list into the Godot project.
 *
 *   node scripts/museum-sync.mjs
 *
 * Reads app/components/museum/exhibits.ts (Node strips its types), writes
 * museum/exhibits.json, and writes each image as a 1024px-wide JPEG under
 * museum/exhibits/ so the exported .pck stays small. The JSON's `textures`
 * are res:// paths in the same order as `images`.
 */

import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { EXHIBITS } = await import(pathToFileURL(join(ROOT, "app", "components", "museum", "exhibits.ts")).href);

const outDir = join(ROOT, "museum", "exhibits");
/* Replace the images but keep their .import files: those hold the Basis
   compression and size limits the web build depends on. */
if (existsSync(outDir)) {
  for (const f of readdirSync(outDir)) if (f.endsWith(".jpg")) rmSync(join(outDir, f));
}
mkdirSync(outDir, { recursive: true });

const json = [];
for (const ex of EXHIBITS) {
  const textures = [];
  for (const [i, src] of ex.images.entries()) {
    const name = `${ex.id}-${i + 1}.jpg`;
    await sharp(join(ROOT, "public", src))
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#000000" })
      .jpeg({ quality: 82 })
      .toFile(join(outDir, name));
    textures.push(`res://exhibits/${name}`);
  }
  json.push({ ...ex, textures });
}

writeFileSync(join(ROOT, "museum", "exhibits.json"), JSON.stringify(json, null, 2) + "\n");
console.log(`synced ${json.length} exhibits`);
