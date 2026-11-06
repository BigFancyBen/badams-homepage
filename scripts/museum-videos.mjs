#!/usr/bin/env node
/**
 * Transcodes the exhibit videos for the museum: the projects' own short loops (the ones the
 * homepage plays) into Theora (.ogv), the one video format Godot's web build plays. Each is
 * cropped to fill its exhibit's main picture (museum/exhibits/<id>-1.jpg), so the video takes the
 * picture's place in its frame without changing the frame, and kept small: at most 640 px on its
 * long side, 24 fps, no sound.
 *
 *   node scripts/museum-videos.mjs
 *
 * Writes public/museum/videos/<id>.ogv (ignored by git; museum-upload.mjs puts them on R2 next
 * to the engine). The exhibits that have one are listed in app/components/museum/constants.ts
 * (MUSEUM_VIDEOS); keep the two in step.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "museum", "videos");
const LONG_SIDE = 640;

/** exhibit id -> source clip (relative to the repo root) */
const SOURCES = {
  mfrs: "public/mfrs/loop.mp4",
  oathkeep: "public/oathkeep/unlit-hall.mp4",
  prognosticator: "public/prognosticator/sm64/loop.mp4",
  warehouse: "public/prognosticator/warehouse/loop.mp4",
};

const probe = (file) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], {
    encoding: "utf8",
  })
    .trim()
    .split(",")
    .map(Number);

mkdirSync(OUT, { recursive: true });
for (const [id, src] of Object.entries(SOURCES)) {
  const [pw, ph] = probe(join(ROOT, "museum", "exhibits", `${id}-1.jpg`));
  const scale = LONG_SIDE / Math.max(pw, ph);
  const w = Math.round((pw * scale) / 2) * 2;
  const h = Math.round((ph * scale) / 2) * 2;
  const out = join(OUT, `${id}.ogv`);
  // fill w x h (scale up to cover, centre crop), 24 fps
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=24,format=yuv420p`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(ROOT, src), "-an", "-vf", vf, "-c:v", "libtheora", "-q:v", "7", out], {
    stdio: "inherit",
  });
  console.log(`${id}.ogv  ${w}x${h}  ${(statSync(out).size / 1048576).toFixed(2)} MB  <- ${src}`);
}
