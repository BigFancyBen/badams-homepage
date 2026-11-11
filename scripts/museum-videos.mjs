#!/usr/bin/env node
/**
 * Transcodes the exhibit videos for the museum into Theora (.ogv), the one video format Godot's web
 * build plays. Each is cropped to fill its exhibit's main picture (museum/exhibits/<id>-1.jpg), so
 * the video takes the picture's place in its frame without changing the frame.
 *
 *   node scripts/museum-videos.mjs [--masters <dir>]
 *
 * The museum shows a video much bigger than the homepage does, so it is encoded at up to 1280 px on
 * its long side, at a fixed bit rate per pixel (BITS_PER_PIXEL). An exhibit with a `master` takes it
 * from the full-size capture in the masters folder (default C:\Users\Tango\Videos\prognosticator\
 * homepage-masters; the 1080p recordings are kept out of git) and falls back to its homepage loop
 * when the folder doesn't have it. A video is never scaled past its source, so a 960 px loop stays
 * 960 px. 24 fps, no sound.
 *
 * Writes public/museum/videos/<id>.ogv (ignored by git; museum-upload.mjs puts them on R2 next
 * to the engine). The exhibits that have one are listed in app/components/museum/constants.ts
 * (MUSEUM_VIDEOS); keep the two in step.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "museum", "videos");
const LONG_SIDE = 1280;
/** Theora bits per pixel per frame. A quality target (-q:v) let a laser show run to 50 MB; a rate keeps
    every exhibit near its share of the download whatever is in the picture. */
const BITS_PER_PIXEL = 0.18;
const i = process.argv.indexOf("--masters");
const MASTERS = i > 0 ? process.argv[i + 1] : "C:\\Users\\Tango\\Videos\\prognosticator\\homepage-masters";

/**
 * exhibit id -> its homepage loop (relative to the repo root) and, optionally, the 1080p master it
 * was cut from: a file in MASTERS plus the same start and length the loop was cut at.
 */
const SOURCES = {
  mfrs: { clip: "public/mfrs/loop.mp4" },
  oathkeep: { clip: "public/oathkeep/unlit-hall.mp4" },
  prognosticator: { clip: "public/prognosticator/stadium/loop.mp4", master: { file: "stadium.mp4", ss: 0, t: 20 } },
  warehouse: { clip: "public/prognosticator/warehouse/loop.mp4" },
};

const probe = (file) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], {
    encoding: "utf8",
  })
    .trim()
    .split(",")
    .map(Number);

mkdirSync(OUT, { recursive: true });
for (const [id, { clip, master }] of Object.entries(SOURCES)) {
  const masterPath = master && join(MASTERS, master.file);
  const useMaster = masterPath && existsSync(masterPath);
  const src = useMaster ? masterPath : join(ROOT, clip);
  const trim = useMaster ? ["-ss", String(master.ss), "-t", String(master.t)] : [];

  // the exhibit frame's aspect, at the largest size that fits LONG_SIDE and that the source can fill
  const [pw, ph] = probe(join(ROOT, "museum", "exhibits", `${id}-1.jpg`));
  const [sw, sh] = probe(src);
  const cover = Math.max(pw / sw, ph / sh); // scale that makes the frame cover the source
  const long = Math.min(LONG_SIDE, Math.max(pw, ph) / cover);
  const scale = long / Math.max(pw, ph);
  const w = Math.round((pw * scale) / 2) * 2;
  const h = Math.round((ph * scale) / 2) * 2;
  const out = join(OUT, `${id}.ogv`);
  // fill w x h (scale up to cover, centre crop), 24 fps
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},fps=24,format=yuv420p`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...trim, "-i", src, "-an", "-vf", vf, "-c:v", "libtheora", "-b:v", `${Math.round((w * h * 24 * BITS_PER_PIXEL) / 1000)}k`, out], {
    stdio: "inherit",
  });
  console.log(`${id}.ogv  ${w}x${h}  ${(statSync(out).size / 1048576).toFixed(2)} MB  <- ${useMaster ? masterPath : clip}`);
}
