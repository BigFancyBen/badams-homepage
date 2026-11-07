#!/usr/bin/env node
// Encodes a museum-promo-capture.mjs recording into an MP4 for LinkedIn (and anywhere else):
// H.264 High, yuv420p BT.709, 30 fps, AAC 48 kHz stereo, faststart. The song is laid in from the
// mp3 at exactly the loop position the page's song clock reported for each frame, so the lights
// stay on the beat.
//
//   node scripts/museum-promo-encode.mjs [--cap out/museum-promo] [--out <cap>/museum.mp4]
//       [--from-ready 2]   start this many seconds after the hall appeared (negative shows the loading bar)
//       [--seconds n]      cut length (default: to the end of the capture)
//       [--fade 1.5]       fade out at the end, seconds
//       [--crf 17]
//       [--song <mp3>]     default: the mp3 the page played, downloaded once into <cap>/song.mp3
//
// Needs ffmpeg and ffprobe on PATH.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? dflt : argv[i + 1];
};
const CAP = resolve(arg('cap', join(ROOT, 'out', 'museum-promo')));
const OUT = resolve(arg('out', join(CAP, 'museum.mp4')));
const FADE = Number(arg('fade', 1.5));
const CRF = Number(arg('crf', 17));

const log = JSON.parse(readFileSync(join(CAP, 'log.json'), 'utf8'));
const FPS = log.args.FPS;
const total = log.frames.length;
const { id: songId, loopStartSeconds: loopStart, loopSeconds } = log.song;

let SONG = arg('song', null);
if (SONG) SONG = resolve(SONG);
else {
  SONG = join(CAP, 'song.mp3');
  if (!existsSync(SONG)) {
    const url = log.urls.find((u) => u.includes(`/${songId}.mp3`));
    if (!url) throw new Error(`no ${songId}.mp3 in the capture's urls; pass --song`);
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(SONG, Buffer.from(await res.arrayBuffer()));
  }
}

/* First frame of the cut: --from-ready <s> starts that many seconds after the hall reported ready. */
const readyFrame = log.events.find((e) => e.kind === 'ready')?.frame ?? 0;
const S = Math.max(0, readyFrame + Math.round(Number(arg('from-ready', 2)) * FPS));
const nFrames = Math.min(total - S, Math.round(Number(arg('seconds', (total - S) / FPS)) * FPS));
const dur = nFrames / FPS;
console.log(`cut starts at captured frame ${S} (ready was frame ${readyFrame})`);

/* Audio segments: runs of audible frames whose clock advances by one frame each (a seek or loop wrap starts a new one). */
const segs = [];
let cur = null;
for (let i = S; i < S + nFrames; i++) {
  const f = log.frames[i];
  if (!f.audible || f.clock == null) {
    cur = null;
    continue;
  }
  const prev = log.frames[i - 1];
  const contiguous = cur && prev && prev.audible && Math.abs(f.clock - prev.clock - 1 / FPS) < 0.01;
  if (!contiguous) {
    cur = { frame: i, clock: f.clock, frames: 0 };
    segs.push(cur);
  }
  cur.frames++;
}
for (const s of segs) {
  const last = log.frames[s.frame + s.frames - 1];
  const drift = last.clock - s.clock - (s.frames - 1) / FPS;
  console.log(
    `audio segment: video ${((s.frame - S) / FPS).toFixed(3)} s, song loop ${s.clock.toFixed(3)} s, ${(s.frames / FPS).toFixed(2)} s long, clock drift ${(drift * 1000).toFixed(2)} ms`,
  );
  if (s.clock + s.frames / FPS > loopSeconds) console.warn('segment crosses the loop end; not handled');
}
if (!segs.length) throw new Error('no audible frames in the cut');

const AF = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const parts = [];
const labels = [];
segs.forEach((s, k) => {
  const start = loopStart + s.clock;
  const len = s.frames / FPS;
  const delay = (s.frame - S) / FPS;
  /* The lead-in is real silence, concatenated in front. Don't use adelay: it only shifts timestamps,
     the MP4 then stores the gap as one AAC packet lasting the whole delay, and browsers (LinkedIn's
     player too) play decoded audio back to back, so the music starts that much early. */
  parts.push(`[1:a]atrim=start=${start.toFixed(4)}:duration=${len.toFixed(4)},asetpts=PTS-STARTPTS,${AF},afade=t=in:st=0:d=0.04[m${k}]`);
  if (delay > 0) {
    parts.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${delay.toFixed(6)},${AF}[z${k}]`);
    parts.push(`[z${k}][m${k}]concat=n=2:v=0:a=1[s${k}]`);
  } else {
    parts.push(`[m${k}]anull[s${k}]`);
  }
  labels.push(`[s${k}]`);
});
parts.push(labels.length > 1 ? `${labels.join('')}amix=inputs=${labels.length}:normalize=0[am]` : `${labels[0]}anull[am]`);
parts.push(`[am]apad,atrim=end=${dur.toFixed(4)},afade=t=out:st=${(dur - FADE).toFixed(4)}:d=${FADE},aformat=sample_rates=48000:channel_layouts=stereo[a]`);
parts.push(
  `[0:v]trim=end_frame=${nFrames},setpts=PTS-STARTPTS,fade=t=out:st=${(dur - FADE).toFixed(4)}:d=${FADE},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]`,
);

const ext = log.args.JPEG ? 'jpg' : 'png';
const args = [
  '-y', '-v', 'error', '-stats',
  '-framerate', String(FPS), '-start_number', String(S), '-i', join(CAP, 'frames', `%05d.${ext}`),
  '-i', SONG,
  '-filter_complex', parts.join(';'),
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-profile:v', 'high', '-level:v', '4.2',
  '-maxrate', '20M', '-bufsize', '40M', '-g', String(FPS * 2), '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
  '-movflags', '+faststart',
  '-t', dur.toFixed(4),
  OUT,
];
console.log(`encoding ${nFrames} frames (${dur.toFixed(2)} s) -> ${OUT}`);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

/* Every AAC packet should be one 1024-sample frame (~21.3 ms). A longer one is a stored gap that
   players skip over, which puts the music out of step with the picture. */
const packets = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'packet=duration_time', '-of', 'csv=p=0', OUT], {
  encoding: 'utf8',
})
  .split(/\s+/)
  .map((v) => parseFloat(v)) // a line can carry a trailing comma
  .filter(Number.isFinite);
const longest = Math.max(...packets);
if (longest > 0.03) {
  console.error(`audio check failed: a ${(longest * 1000).toFixed(0)} ms audio packet; the music will play early in browsers`);
  process.exit(1);
}
console.log(`audio check ok: ${packets.length} packets, none longer than ${(longest * 1000).toFixed(1)} ms`);
