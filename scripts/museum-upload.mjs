/**
 * Uploads the museum's engine build to the benadams-museum R2 bucket, served by the
 * benadams-museum-cdn Worker (see museum-cdn/README.md).
 *
 *   node scripts/museum-upload.mjs [--force]
 *
 * Reads public/museum/engine/*, public/museum/songs/*.mp3 (to museum/<v>/songs/), public/museum/videos/*.ogv (to museum/<v>/videos/), the two posters and the export hash
 * `v` from app/components/museum/engineManifest.json, and puts them at museum/<v>/<file>.
 * museum.wasm goes up twice: brotli (quality 11) as museum.wasm.br with
 * Content-Encoding: br, and plain as museum.wasm. Uses `wrangler r2 object put --remote`
 * (it can set Content-Encoding and Cache-Control, so the S3 API is not needed).
 *
 * Idempotent: before each put it asks the Worker for the object's size and ETag (R2's md5)
 * and skips the file if both match. A 404 from the Worker (first deploy) just uploads.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "benadams-museum";
const WORKER = process.env.MUSEUM_CDN_URL ?? "https://benadams-museum-cdn.scrandle-worker.workers.dev";
const WRANGLER = join(ROOT, "museum-cdn", "node_modules", "wrangler", "bin", "wrangler.js");
const force = process.argv.includes("--force");
const CACHE = "public, max-age=31536000, immutable";
const TYPES = { wasm: "application/wasm", pck: "application/octet-stream", js: "text/javascript", mp3: "audio/mpeg", webp: "image/webp", ogv: "video/ogg" };

const { v } = JSON.parse(readFileSync(join(ROOT, "app", "components", "museum", "engineManifest.json"), "utf8"));
const engineDir = join(ROOT, "public", "museum", "engine");

/** { name: public name, key suffix, path of bytes, encoding, accept: Accept-Encoding to probe with } */
const jobs = [];
for (const f of readdirSync(engineDir)) jobs.push({ name: f, store: f, path: join(engineDir, f) });
const songsDir = join(ROOT, "public", "museum", "songs");
if (existsSync(songsDir)) {
  for (const f of readdirSync(songsDir).filter((n) => n.endsWith(".mp3"))) jobs.push({ name: `songs/${f}`, store: `songs/${f}`, path: join(songsDir, f) });
} else console.warn(`missing ${songsDir}, no songs uploaded`);
/* The exhibit videos (scripts/museum-videos.mjs), to museum/<v>/videos/. */
const videosDir = join(ROOT, "public", "museum", "videos");
if (existsSync(videosDir)) {
  for (const f of readdirSync(videosDir).filter((n) => n.endsWith(".ogv"))) jobs.push({ name: `videos/${f}`, store: `videos/${f}`, path: join(videosDir, f) });
} else console.warn(`missing ${videosDir}, no videos uploaded (run scripts/museum-videos.mjs)`);
for (const f of ["poster-landscape.webp", "poster-portrait.webp"]) {
  const p = join(ROOT, "public", "museum", f);
  if (existsSync(p)) jobs.push({ name: f, store: f, path: p });
  else console.warn(`missing ${p}, skipped`);
}

const wasm = jobs.find((j) => j.name === "museum.wasm");
if (wasm) {
  // Compressing 39 MB at q11 takes a minute, so the result is cached per export hash.
  const brPath = join(tmpdir(), `museum-${v}.wasm.br`);
  if (!existsSync(brPath)) {
    console.log("compressing museum.wasm with brotli q11 (a minute or so)...");
    const br = brotliCompressSync(readFileSync(wasm.path), { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_LGWIN]: 24 } });
    writeFileSync(brPath, br);
  }
  jobs.push({ name: "museum.wasm", store: "museum.wasm.br", path: brPath, encoding: "br", accept: "br" });
}

async function remoteMatches(job, size, md5) {
  try {
    const res = await fetch(`${WORKER}/museum/${v}/${job.name}`, { method: "HEAD", headers: { "Accept-Encoding": job.accept ?? "identity" } });
    if (res.status !== 200) return false;
    const etag = (res.headers.get("etag") ?? "").replace(/^W\//, "").replaceAll('"', "");
    return Number(res.headers.get("content-length")) === size && etag === md5;
  } catch {
    return false;
  }
}

let uploaded = 0;
let skipped = 0;
let count = 0;
for (const job of jobs) {
  const data = readFileSync(job.path);
  const md5 = createHash("md5").update(data).digest("hex");
  const label = `museum/${v}/${job.store}`;
  if (!force && (await remoteMatches(job, data.length, md5))) {
    skipped++;
    console.log(`skip    ${label} (${(data.length / 1e6).toFixed(2)} MB, unchanged)`);
    continue;
  }
  const ext = job.name.slice(job.name.lastIndexOf(".") + 1);
  const args = [WRANGLER, "r2", "object", "put", `${BUCKET}/${label}`, "--remote", "--file", job.path, "--content-type", TYPES[ext] ?? "application/octet-stream", "--cache-control", CACHE];
  if (job.encoding) args.push("--content-encoding", job.encoding);
  execFileSync(process.execPath, args, { cwd: join(ROOT, "museum-cdn"), stdio: ["ignore", "ignore", "inherit"] });
  uploaded += data.length;
  count++;
  console.log(`put     ${label} (${(data.length / 1e6).toFixed(2)} MB)`);
}
console.log(`uploaded ${count} file(s), ${(uploaded / 1e6).toFixed(2)} MB; skipped ${skipped} unchanged`);
console.log(`base URL: ${WORKER}/museum/${v}/museum`);
