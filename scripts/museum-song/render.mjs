/**
 * Renders the homepage museum's house track: an original 128 BPM loop,
 * written here note by note and synthesized from oscillators and noise.
 * Nothing sampled, nothing borrowed — the rendered file is this script's
 * output and belongs to whoever owns the script.
 *
 *   node scripts/museum-song/render.mjs
 *
 * Writes:
 *   public/museum/songs/after-hours.mp3— [last bar] + 64-bar loop + [first bar], so a
 *                                 player can loop the middle without seams
 *                                 even if the decoder pads the start
 *   museum/songs/after-hours.json— the arrangement, read by the Godot scene so
 *                                 the lights know a breakdown from a drop
 *
 * Needs ffmpeg on PATH for the MP3 encode. Deterministic: same script, same
 * file.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SR = 44100;
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BEAT / 4; // a 16th
const BARS = 64;
const LOOP = BARS * BAR; // 120 s exactly
const TAIL_BARS = 4; // rendered past the end, then wrapped onto the start
const N = Math.round((BARS + TAIL_BARS) * BAR * SR);
const LOOP_N = Math.round(LOOP * SR);

/* ── Arrangement ─────────────────────────────────────────────────────────
   energy (0–1) drives the lights; the flags drive the parts. */
const SECTIONS = [
  { name: "intro", from: 0, to: 8, energy: 0.35, kick: 1, hat: 1, clap: 0, open: 0, bass: 0, stab: 0.4, pad: 0, lead: 0 },
  { name: "groove", from: 8, to: 16, energy: 0.6, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, stab: 0.7, pad: 0, lead: 0 },
  { name: "groove", from: 16, to: 24, energy: 0.72, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, stab: 1, pad: 0, lead: 0, shaker: 1 },
  { name: "break", from: 24, to: 32, energy: 0.25, kick: 0, hat: 0, clap: 0, open: 0, bass: 0, stab: 0.6, pad: 1, lead: 0, riser: 1 },
  { name: "drop", from: 32, to: 48, energy: 1, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, stab: 1, pad: 0.5, lead: 1, shaker: 1 },
  { name: "drop", from: 48, to: 56, energy: 0.9, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, stab: 1, pad: 0, lead: 2, shaker: 1 },
  { name: "outro", from: 56, to: 64, energy: 0.45, kick: 1, hat: 1, clap: 1, open: 0, bass: 1, stab: 0.5, pad: 0, lead: 0 },
];
const sectionAt = (bar) => SECTIONS.find((s) => bar >= s.from && bar < s.to);

/* Two bars a chord: Am9, Fmaj9, Dm9, Em7. MIDI note numbers. */
const CHORDS = [
  { root: 33, notes: [57, 60, 64, 67, 71] },
  { root: 29, notes: [57, 60, 64, 65, 67] },
  { root: 38, notes: [57, 60, 62, 65, 64] },
  { root: 28, notes: [55, 59, 62, 64, 67] },
];
const chordAt = (bar) => CHORDS[Math.floor(bar / 2) % 4];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ── Utilities ─────────────────────────────────────────────────────────── */
let seed = 0x5eed128;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const noise = () => rand() * 2 - 1;

/** Zavalishin TPT state-variable filter; stable at any cutoff. */
function svf() {
  let ic1 = 0, ic2 = 0;
  return (x, cutoff, q, mode) => {
    const g = Math.tan((Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const v3 = x - ic2;
    const v1 = a1 * ic1 + g * a1 * v3;
    const v2 = ic2 + g * v1;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    if (mode === "hp") return x - k * v1 - v2;
    if (mode === "bp") return v1;
    return v2;
  };
}

/** PolyBLEP saw, band-limited enough for a house stab. */
function saw(phase, inc) {
  let v = 2 * phase - 1;
  if (phase < inc) { const t = phase / inc; v -= t + t - t * t - 1; }
  else if (phase > 1 - inc) { const t = (phase - 1) / inc; v -= t * t + t + t + 1; }
  return v;
}

const busL = (name) => (buses[name] ??= [new Float32Array(N), new Float32Array(N)]);
const buses = {};
function add(bus, i, l, r = l) {
  if (i < 0 || i >= N) return;
  const b = busL(bus);
  b[0][i] += l;
  b[1][i] += r;
}

/* ── Instruments ───────────────────────────────────────────────────────── */
function kick(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.42 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const f = 48 + 110 * Math.exp(-tt / 0.035);
    ph += f / SR;
    const amp = Math.exp(-tt / 0.18) * (tt < 0.002 ? tt / 0.002 : 1);
    let v = Math.sin(2 * Math.PI * ph) * amp;
    v += Math.exp(-tt / 0.004) * noise() * 0.25; // click
    v = Math.tanh(v * 1.6);
    add("kick", s + n, v * vel * 0.9);
  }
}

function clap(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.3 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    // three quick bursts, then the tail
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (tt >= o) env = Math.max(env, Math.exp(-(tt - o) / 0.008));
    if (tt >= 0.03) env = Math.max(env, 0.8 * Math.exp(-(tt - 0.03) / 0.09));
    const v = f(noise(), 1500, 1.4, "bp") * env * 2.2;
    add("clap", s + n, v * vel * 0.55, v * vel * 0.5);
  }
}

function hat(t, open, vel = 1, pan = 0) {
  const s = Math.round(t * SR);
  const decay = open ? 0.16 : 0.03;
  const len = Math.round(decay * 5 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = f(noise(), 8500, 0.9, "hp") * Math.exp(-tt / decay) * vel * (open ? 0.24 : 0.18);
    add("hat", s + n, v * (1 - pan), v * (1 + pan));
  }
}

function shaker(t, vel) {
  const s = Math.round(t * SR);
  const len = Math.round(0.07 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.min(1, tt / 0.012) * Math.exp(-tt / 0.025);
    const v = f(noise(), 6000, 1.2, "bp") * env * vel * 0.16;
    add("hat", s + n, v * 0.7, v * 1.3);
  }
}

function bass(t, midi, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.03) * SR);
  const f = svf();
  const freq = hz(midi);
  let ph = 0, sub = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const inc = freq / SR;
    ph = (ph + inc) % 1;
    sub += inc;
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.008);
    const env = Math.min(1, tt / 0.003) * gate;
    const cutoff = 180 + 900 * Math.exp(-tt / 0.06);
    let v = f(saw(ph, inc), cutoff, 2.2, "lp") * 0.55 + Math.sin(2 * Math.PI * sub) * 0.5;
    v = Math.tanh(v * 1.3) * env * vel * 0.62;
    add("bass", s + n, v);
  }
}

function stab(t, notes, dur, bright, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.25) * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => [
    { f: hz(m) * 1.004, ph: rand(), side: -1 },
    { f: hz(m) * 0.996, ph: rand(), side: 1 },
  ]);
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = v.f / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      if (v.side < 0) l += x; else r += x;
    }
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.06);
    const env = Math.min(1, tt / 0.004) * gate;
    const cutoff = 400 + bright * 3800 * Math.exp(-tt / 0.09);
    const g = (env * vel * 0.085);
    add("stab", s + n, fl(l, cutoff, 1.1, "lp") * g, fr(r, cutoff, 1.1, "lp") * g);
  }
}

function pad(t, notes, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 1.2) * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => [0.993, 1, 1.007].map((d, k) => ({ f: hz(m - 12) * d, ph: rand(), k })));
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = v.f / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      if (v.k === 0) l += x; else if (v.k === 2) r += x; else { l += x * 0.5; r += x * 0.5; }
    }
    const att = Math.min(1, tt / 1.4);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.4);
    const cutoff = 500 + 1400 * Math.min(1, tt / dur);
    const g = att * rel * vel * 0.045;
    add("pad", s + n, fl(l, cutoff, 0.8, "lp") * g, fr(r, cutoff, 0.8, "lp") * g);
  }
}

function pluck(t, midi, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.35 * SR);
  const f = svf();
  const freq = hz(midi);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    ph = (ph + freq / SR) % 1;
    const sq = ph < 0.5 ? 1 : -1;
    const env = Math.min(1, tt / 0.002) * Math.exp(-tt / 0.11);
    const v = f(sq, 600 + 4200 * Math.exp(-tt / 0.05), 1.8, "lp") * env * vel * 0.12;
    add("lead", s + n, v);
  }
}

function riser(t, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const v = f(noise(), 300 + 9000 * p * p, 3, "bp") * p * p * 0.35;
    add("fx", s + n, v * (1 - 0.3 * Math.sin(p * 40)), v * (1 + 0.3 * Math.sin(p * 40)));
  }
}

function snareRoll(t, bars) {
  const steps = bars * 16;
  for (let k = 0; k < steps; k++) {
    const p = k / steps;
    const every = p < 0.5 ? 4 : p < 0.75 ? 2 : 1;
    if (k % every) continue;
    const s = Math.round((t + k * STEP) * SR);
    const len = Math.round(0.12 * SR);
    const f = svf();
    for (let n = 0; n < len; n++) {
      const tt = n / SR;
      const v = (f(noise(), 2400, 1, "bp") * 1.6 + Math.sin(2 * Math.PI * 190 * tt) * 0.4) * Math.exp(-tt / 0.045) * (0.15 + 0.5 * p);
      add("clap", s + n, v * 0.5);
    }
  }
}

/* ── Sequence ──────────────────────────────────────────────────────────── */
const STAB_RHYTHM = [3, 6, 10, 13]; // 16th steps in a bar
const BASS_RHYTHM = [2, 6, 10, 14, 15]; // off-beats, plus a pickup
const ARP = [0, 2, 1, 3, 4, 3, 1, 2];

for (let bar = 0; bar < BARS + TAIL_BARS; bar++) {
  const sec = sectionAt(bar % BARS);
  const loopBar = bar % BARS;
  if (bar >= BARS && loopBar >= TAIL_BARS) break;
  // the tail only carries ringing notes; no new hits after the loop's end
  if (bar >= BARS) continue;
  const t0 = bar * BAR;
  const ch = chordAt(bar);
  const inSec = bar - sec.from;
  const lastBarOfSec = bar === sec.to - 1;

  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (sec.kick) kick(tb, b === 0 ? 1 : 0.95);
    if (sec.clap && (b === 1 || b === 3)) clap(tb + 0.004);
    if (sec.open) hat(tb + BEAT / 2, true, 0.9, 0.15);
    if (sec.hat) {
      for (let k = 0; k < 4; k++) {
        if (k === 2 && sec.open) continue;
        hat(tb + k * STEP + (k % 2 ? 0.008 : 0), false, k % 2 ? 0.7 : 1, -0.2);
      }
    }
    if (sec.shaker) for (let k = 0; k < 4; k++) shaker(tb + k * STEP, k === 2 ? 1 : 0.6);
  }

  if (sec.bass) {
    for (const st of BASS_RHYTHM) {
      // the outro's last two bars thin out into the intro
      if (sec.name === "outro" && inSec >= 6 && st === 15) continue;
      const midi = ch.root + (st === 15 ? 12 : 0);
      bass(t0 + st * STEP, midi, STEP * (st === 15 ? 0.8 : 1.6), st === 15 ? 0.7 : 1);
    }
  }

  if (sec.stab) {
    const bright = sec.name === "intro" ? 0.15 + 0.1 * inSec : sec.name === "outro" ? 0.6 - 0.07 * inSec : sec.stab;
    for (const st of STAB_RHYTHM) stab(t0 + st * STEP, ch.notes, STEP * 1.2, bright, 0.9);
  }

  if (sec.pad && bar % 2 === 0) pad(t0, ch.notes, BAR * 2, sec.pad);

  if (sec.lead) {
    const tones = [...ch.notes].sort((a, b) => a - b).map((m) => m + 12);
    for (let k = 0; k < 16; k++) {
      if (sec.lead === 2 && k % 4 === 3) continue;
      const idx = ARP[(k + (bar % 2) * 3) % ARP.length];
      pluck(t0 + k * STEP, tones[idx] + (k === 14 ? 12 : 0), k % 4 === 0 ? 1 : 0.75);
    }
  }

  if (sec.riser && inSec === 4) riser(t0, BAR * 4);
  if (sec.riser && inSec === 6) snareRoll(t0, 2);
  if (lastBarOfSec && sec.name === "groove" && bar === 23) riser(t0, BAR);
}

/* ── Mix ───────────────────────────────────────────────────────────────── */
// Sidechain from the kick pattern itself: every beat where a kick plays.
const duck = new Float32Array(N).fill(1);
for (let bar = 0; bar < BARS + TAIL_BARS; bar++) {
  const sec = sectionAt(bar % BARS);
  if (bar >= BARS || !sec.kick) continue;
  for (let b = 0; b < 4; b++) {
    const s = Math.round((bar * BAR + b * BEAT) * SR);
    const len = Math.round(BEAT * SR);
    for (let n = 0; n < len && s + n < N; n++) {
      const tt = n / SR;
      duck[s + n] = Math.min(duck[s + n], 1 - 0.7 * Math.exp(-tt / 0.11));
    }
  }
}

const GAIN = { kick: 1, clap: 0.8, hat: 0.85, bass: 0.9, stab: 0.75, pad: 0.8, lead: 0.7, fx: 0.6 };
const DUCKED = new Set(["bass", "stab", "pad", "lead"]);
const REVERB_SEND = { clap: 0.25, stab: 0.3, pad: 0.5, lead: 0.3, fx: 0.4, hat: 0.05 };
const DELAY_SEND = { stab: 0.22, lead: 0.3 };

const outL = new Float32Array(N), outR = new Float32Array(N);
const revInL = new Float32Array(N), revInR = new Float32Array(N);
const dlyInL = new Float32Array(N), dlyInR = new Float32Array(N);

for (const [name, [l, r]] of Object.entries(buses)) {
  const g = GAIN[name] ?? 1;
  const ducked = DUCKED.has(name);
  const rs = REVERB_SEND[name] ?? 0;
  const ds = DELAY_SEND[name] ?? 0;
  for (let i = 0; i < N; i++) {
    const d = ducked ? duck[i] : 1;
    const a = l[i] * g * d, b = r[i] * g * d;
    outL[i] += a; outR[i] += b;
    if (rs) { revInL[i] += a * rs; revInR[i] += b * rs; }
    if (ds) { dlyInL[i] += a * ds; dlyInR[i] += b * ds; }
  }
}

// Ping-pong delay, dotted eighth.
{
  const D = Math.round(STEP * 3 * SR);
  const bl = new Float32Array(D), br = new Float32Array(D);
  const lpL = svf(), lpR = svf();
  let p = 0;
  for (let i = 0; i < N; i++) {
    const yl = bl[p], yr = br[p];
    bl[p] = lpL(dlyInL[i] + yr * 0.45, 3500, 0.7, "lp");
    br[p] = lpR(dlyInR[i] + yl * 0.45, 3500, 0.7, "lp");
    outL[i] += yl * 0.8; outR[i] += yr * 0.8;
    revInL[i] += yl * 0.1; revInR[i] += yr * 0.1;
    p = (p + 1) % D;
  }
}

// Schroeder/Freeverb-style reverb: 4 combs, 2 allpasses per side.
function reverb(input, combs, aps) {
  const out = new Float32Array(N);
  const cb = combs.map((d) => ({ buf: new Float32Array(d), p: 0, lp: 0 }));
  const ab = aps.map((d) => ({ buf: new Float32Array(d), p: 0 }));
  for (let i = 0; i < N; i++) {
    const x = input[i];
    let y = 0;
    for (const c of cb) {
      const o = c.buf[c.p];
      c.lp = o * 0.7 + c.lp * 0.3;
      c.buf[c.p] = x + c.lp * 0.82;
      c.p = (c.p + 1) % c.buf.length;
      y += o;
    }
    for (const a of ab) {
      const o = a.buf[a.p];
      const v = y + o * 0.5;
      a.buf[a.p] = v;
      a.p = (a.p + 1) % a.buf.length;
      y = o - v * 0.5;
    }
    out[i] = y * 0.25;
  }
  return out;
}
const rL = reverb(revInL, [1557, 1617, 1491, 1422], [556, 441]);
const rR = reverb(revInR, [1580, 1640, 1514, 1445], [579, 464]);
for (let i = 0; i < N; i++) { outL[i] += rL[i]; outR[i] += rR[i]; }

// Wrap the tail onto the start, so the loop point rings into itself.
const loopL = outL.slice(0, LOOP_N), loopR = outR.slice(0, LOOP_N);
for (let i = LOOP_N; i < N; i++) { loopL[i - LOOP_N] += outL[i]; loopR[i - LOOP_N] += outR[i]; }

// Master: gentle high-pass, soft clip, normalise to -1 dBFS.
{
  const hl = svf(), hr = svf();
  // run the filter over the loop twice so its state is settled at the seam
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < LOOP_N; i++) {
      const a = hl(loopL[i], 28, 0.7, "hp"), b = hr(loopR[i], 28, 0.7, "hp");
      if (pass) { loopL[i] = Math.tanh(a * 1.4); loopR[i] = Math.tanh(b * 1.4); }
    }
  }
  let peak = 0;
  for (let i = 0; i < LOOP_N; i++) peak = Math.max(peak, Math.abs(loopL[i]), Math.abs(loopR[i]));
  const g = 0.89 / peak;
  for (let i = 0; i < LOOP_N; i++) { loopL[i] *= g; loopR[i] *= g; }
}

/* ── Write ─────────────────────────────────────────────────────────────── */
const BAR_N = Math.round(BAR * SR);
const total = LOOP_N + 2 * BAR_N;
const wav = Buffer.alloc(44 + total * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + total * 4, 4); wav.write("WAVE", 8);
wav.write("fmt ", 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(total * 4, 40);
for (let k = 0; k < total; k++) {
  const i = (k - BAR_N + LOOP_N) % LOOP_N; // last bar, the loop, first bar
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, loopL[i])) * 32767), 44 + k * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, loopR[i])) * 32767), 46 + k * 4);
}
const tmp = join(tmpdir(), "museum-song.wav");
writeFileSync(tmp, wav);

mkdirSync(join(ROOT, "public", "museum"), { recursive: true });
mkdirSync(join(ROOT, "public", "museum", "songs"), { recursive: true });
const mp3 = join(ROOT, "public", "museum", "songs", "after-hours.mp3");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "160k",
  "-metadata", "title=Museum After Hours", "-metadata", "artist=Ben Adams", "-metadata", "comment=Rendered by scripts/museum-song/render.mjs",
  mp3]);

mkdirSync(join(ROOT, "museum"), { recursive: true });
mkdirSync(join(ROOT, "museum", "songs"), { recursive: true });
writeFileSync(join(ROOT, "museum", "songs", "after-hours.json"), JSON.stringify({
  id: "after-hours",
  title: "Museum After Hours",
  bpm: BPM,
  bars: BARS,
  loopSeconds: LOOP,
  // where the loop starts inside song.mp3: one bar of pre-roll
  loopStartSeconds: BAR,
  sections: SECTIONS.map(({ name, from, to, energy, kick: k }) => ({ name, from, to, energy, kick: !!k })),
}, null, 2) + "\n");

console.log(`wrote ${mp3} (${(total / SR).toFixed(2)} s, loop ${LOOP} s at ${BPM} BPM)`);
