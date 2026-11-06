/**
 * "Gallery Lights": an original uplifting house track for the homepage
 * museum. 124 BPM, B flat major, 64 bars. Supersaw chord stabs, a plucky hook
 * and arp, a rolling saw+sub bass, a string pad, and a heavy sidechain pump.
 * Everything is written here note by note and synthesized from oscillators
 * and noise. Nothing sampled, nothing borrowed.
 *
 *   node scripts/museum-song/gallery-lights.mjs
 *
 * Writes:
 *   public/museum/songs/gallery-lights.mp3  [last bar] + loop + [first bar]
 *   museum/songs/gallery-lights.json        the arrangement for the lights
 *
 * Needs ffmpeg on PATH. Deterministic.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "gallery-lights";
const TITLE = "Gallery Lights";

const SR = 44100;
const BPM = 124;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BEAT / 4;
const BARS = 64;
const LOOP = BARS * BAR;
const TAIL_BARS = 4;
const N = Math.round((BARS + TAIL_BARS) * BAR * SR);
const LOOP_N = Math.round(LOOP * SR);

/* ── Arrangement ───────────────────────────────────────────────────────── */
const SECTIONS = [
  { name: "intro", from: 0, to: 4, energy: 0.35, kick: 1, hat: 1 },
  { name: "intro", from: 4, to: 8, energy: 0.35, kick: 1, hat: 1, open: 1, shaker: 1, bass: 1, stab: 0.3 },
  { name: "groove", from: 8, to: 16, energy: 0.62, kick: 1, hat: 1, clap: 1, open: 1, shaker: 1, bass: 1, stab: 0.7 },
  { name: "groove", from: 16, to: 24, energy: 0.75, kick: 1, hat: 1, clap: 1, open: 1, shaker: 1, bass: 1, stab: 0.85, arp: 1, pad: 0.5 },
  { name: "break", from: 24, to: 32, energy: 0.25, pad: 1.8, hook: "filtered" },
  { name: "drop", from: 32, to: 48, energy: 1, kick: 1, hat: 1, clap: 1, open: 1, shaker: 1, ride: 1, bass: 1, stab: 1, pad: 0.45, hook: "full", crash: 1 },
  { name: "drop", from: 48, to: 56, energy: 0.95, kick: 1, hat: 1, clap: 1, open: 1, shaker: 1, ride: 1, bass: 1, stab: 1, pad: 0.45, hook: "full", arp: 1 },
  { name: "outro", from: 56, to: 64, energy: 0.45, kick: 1, hat: 1, clap: 1, open: 0, shaker: 1, bass: 1, stab: 0.5 },
];
const sectionAt = (bar) => SECTIONS.find((s) => bar >= s.from && bar < s.to);

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* One chord a bar over 8 bars: Bb Dm Eb F | Bb Gm Eb F */
const PROG = ["Bb", "Dm", "Eb", "F", "Bb", "Gm", "Eb", "F"];
const CH = {
  Bb: { root: 34, up: [62, 65, 70, 74] },
  Dm: { root: 38, up: [62, 65, 69, 74] },
  Eb: { root: 39, up: [63, 67, 70, 75] },
  F: { root: 41, up: [60, 65, 69, 72] },
  Gm: { root: 31, up: [62, 67, 70, 74] },
};
const chordAt = (bar) => CH[PROG[bar % 8]];

/* The hook: a 2-bar idea that answers itself, then climbs, then resolves.
   [step, midi, length in steps] per bar, over PROG. Notes at 0-3-6 push a
   3-3-2 feel; the last note of each bar holds. */
const HOOK = [
  [[0, 77, 3], [3, 79, 3], [6, 82, 2], [10, 81, 2], [12, 79, 4]],
  [[0, 77, 3], [3, 74, 3], [6, 77, 2], [10, 81, 2], [12, 77, 4]],
  [[0, 79, 3], [3, 82, 3], [6, 84, 2], [10, 82, 2], [12, 79, 4]],
  [[0, 81, 3], [3, 84, 3], [6, 81, 2], [10, 77, 2], [12, 81, 4]],
  [[0, 77, 3], [3, 79, 3], [6, 82, 2], [10, 86, 2], [12, 84, 4]],
  [[0, 74, 3], [3, 77, 3], [6, 79, 2], [10, 82, 2], [12, 86, 4]],
  [[0, 87, 3], [3, 86, 3], [6, 82, 2], [10, 79, 2], [12, 82, 4]],
  [[0, 84, 3], [3, 81, 3], [6, 84, 2], [10, 81, 2], [12, 77, 4]],
];

/* ── Utilities ─────────────────────────────────────────────────────────── */
let seed = 0x124bb5;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const noise = () => rand() * 2 - 1;

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

function saw(phase, inc) {
  let v = 2 * phase - 1;
  if (phase < inc) { const t = phase / inc; v -= t + t - t * t - 1; }
  else if (phase > 1 - inc) { const t = (phase - 1) / inc; v -= t * t + t + t + 1; }
  return v;
}

const buses = {};
const busL = (name) => (buses[name] ??= [new Float32Array(N), new Float32Array(N)]);
function add(bus, i, l, r = l) {
  if (i < 0 || i >= N) return;
  const b = busL(bus);
  b[0][i] += l;
  b[1][i] += r;
}

/* ── Drums ─────────────────────────────────────────────────────────────── */
function kick(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.5 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const f = 45 + 135 * Math.exp(-tt / 0.028);
    ph += f / SR;
    const amp = Math.exp(-tt / 0.22) * (tt < 0.0015 ? tt / 0.0015 : 1);
    let v = Math.sin(2 * Math.PI * ph) * amp;
    v += Math.exp(-tt / 0.005) * noise() * 0.3; // beater click
    v += Math.sin(2 * Math.PI * 62 * tt) * Math.exp(-tt / 0.1) * 0.25; // body
    v = Math.tanh(v * 1.8);
    add("kick", s + n, v * vel * 0.9);
  }
}

function clap(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.32 * SR);
  const f = svf(), f2 = svf(), f3 = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let env = 0;
    for (const o of [0, 0.010, 0.021, 0.031]) if (tt >= o) env = Math.max(env, Math.exp(-(tt - o) / 0.007));
    if (tt >= 0.036) env = Math.max(env, 0.8 * Math.exp(-(tt - 0.036) / 0.09));
    const x = noise();
    // two layers: a bright snap and a lower body
    const v = (f2(f(x, 1500, 1.2, "bp"), 7500, 0.7, "lp") * 2.2 + f3(x, 700, 1.2, "bp") * 1.2) * env;
    add("clap", s + n, v * vel * 0.55, v * vel * 0.5);
  }
}

function hat(t, open, vel = 1, pan = 0) {
  const s = Math.round(t * SR);
  const decay = open ? 0.085 : 0.025;
  const len = Math.round(decay * 6 * SR);
  const f = svf(), lp = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = lp(f(noise(), 7500, 0.8, "hp"), 11000, 0.6, "lp") * Math.exp(-tt / decay) * vel * (open ? 0.24 : 0.15);
    add("hat", s + n, v * (1 - pan), v * (1 + pan));
  }
}

function shaker(t, vel, pan = 0.3) {
  const s = Math.round(t * SR);
  const len = Math.round(0.07 * SR);
  const f = svf(), lp = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.min(1, tt / 0.012) * Math.exp(-tt / 0.022);
    const v = lp(f(noise(), 5800, 1.1, "bp"), 9000, 0.6, "lp") * env * vel * 0.17;
    add("shaker", s + n, v * (1 - pan), v * (1 + pan));
  }
}

function ride(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.6 * SR);
  const f = svf();
  const parts = [3150, 4260, 5410, 6730, 8120];
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let v = 0;
    for (let k = 0; k < parts.length; k++) v += Math.sin(2 * Math.PI * parts[k] * tt + k) * (1 / (1 + k * 0.4));
    v = (v * 0.25 + f(noise(), 6500, 0.8, "hp") * 0.5) * Math.exp(-tt / 0.16) * (tt < 0.001 ? tt / 0.001 : 1);
    add("ride", s + n, v * vel * 0.1, v * vel * 0.1);
  }
}

function crash(t) {
  const s = Math.round(t * SR);
  const len = Math.round(2.6 * SR);
  const f = svf(), lp = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = lp(f(noise(), 5000, 0.8, "hp"), 12000, 0.6, "lp") * Math.exp(-tt / 0.65) * 0.24;
    add("fx", s + n, v * 0.9, v * 1.1);
  }
}

/* Reverse cymbal: the crash noise run backwards, so it swells into the drop. */
function reverseCymbal(tEnd, dur) {
  const len = Math.round(dur * SR);
  const s = Math.round(tEnd * SR) - len;
  const f = svf(), lp = svf();
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const tt = (len - n) / SR; // time-since-hit, running backwards
    const v = lp(f(noise(), 4500, 0.8, "hp"), 12000, 0.6, "lp") * Math.exp(-tt / 0.65 * (2.6 / dur * 0.9)) * Math.pow(p, 2.2) * 0.3;
    add("fx", s + n, v, v);
  }
}

function snareHit(t, vel) {
  const s = Math.round(t * SR);
  const len = Math.round(0.14 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = (f(noise(), 2600, 1, "bp") * 1.5 + Math.sin(2 * Math.PI * 195 * tt) * 0.4) * Math.exp(-tt / 0.045) * vel;
    add("clap", s + n, v * 0.5);
  }
}

/* 4 bars: quarters, eighths, eighths, sixteenths, building in level. */
function snareRoll(t) {
  for (let bar = 0; bar < 4; bar++) {
    const every = bar === 0 ? 4 : bar < 3 ? 2 : 1;
    for (let k = 0; k < 16; k += every) {
      if (bar === 3 && k >= 15) continue;
      const p = (bar * 16 + k) / 64;
      snareHit(t + bar * BAR + k * STEP, 0.12 + 0.55 * p);
    }
  }
}

/* ── Tonal instruments ─────────────────────────────────────────────────── */
/* Rolling bass: saw through a filter envelope, plus a sine sub. */
function bass(t, midi, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.04) * SR);
  const freq = hz(midi);
  const f = svf();
  let ph = 0, sub = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const inc = freq / SR;
    ph = (ph + inc) % 1;
    sub += inc;
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.01);
    const env = Math.min(1, tt / 0.003) * gate;
    const cutoff = 150 + 1500 * Math.exp(-tt / 0.07);
    let v = f(saw(ph, inc), cutoff, 2.4, "lp") * 0.6 + Math.sin(2 * Math.PI * sub) * 0.6;
    v = Math.tanh(v * 1.3) * env * vel * 0.58;
    add("bass", s + n, v);
  }
}

/* Supersaw chord stab: 7 detuned saws per note, spread across the stereo
   field, a low-pass with a short envelope. */
const SS = [-0.19, -0.12, -0.06, 0, 0.06, 0.12, 0.19]; // detune, semitones
const SS_PAN = [-1, 0.6, -0.3, 0, 0.3, -0.6, 1];
function stab(t, notes, dur, bright, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.3) * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => SS.map((d, k) => ({ f: hz(m) * Math.pow(2, d / 12), ph: rand(), pan: SS_PAN[k] })));
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = v.f / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      l += x * (0.5 - 0.5 * v.pan * 0.8);
      r += x * (0.5 + 0.5 * v.pan * 0.8);
    }
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.05);
    const env = Math.min(1, tt / 0.003) * gate;
    const cutoff = 450 + bright * 5200 * Math.exp(-tt / 0.1);
    const g = env * vel * 0.019;
    add("stab", s + n, fl(l, cutoff, 1.1, "lp") * g, fr(r, cutoff, 1.1, "lp") * g);
  }
}

/* Plucky lead: saw + square through a filter envelope. `open` scales how far
   the filter reaches (small = filtered down). */
function pluck(t, midi, dur, vel = 1, open = 1, pan = 0, bus = "lead") {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.25) * SR);
  const f = svf();
  const fr = hz(midi);
  let p1 = rand(), p2 = rand(), p3 = rand();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const i1 = (fr * 1.003) / SR, i2 = (fr * 0.997) / SR, i3 = fr / SR;
    p1 = (p1 + i1) % 1; p2 = (p2 + i2) % 1; p3 = (p3 + i3) % 1;
    const sq = p3 < 0.5 ? 0.6 : -0.6;
    const x = saw(p1, i1) * 0.5 + saw(p2, i2) * 0.5 + sq * 0.4;
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.05);
    const env = Math.min(1, tt / 0.002) * Math.exp(-tt / (0.25 + dur)) * gate;
    const cutoff = 500 + open * 5500 * Math.exp(-tt / 0.14);
    const v = f(x, cutoff, 1.6, "lp") * env * vel * 0.11;
    add(bus, s + n, v * (1 - pan), v * (1 + pan));
  }
}

/* Lush string pad: detuned saws, slow bow attack, soft low-pass. */
function pad(t, notes, dur, vel = 1, cutMax = 3200) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 1.4) * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => [0.992, 1.0, 1.008].map((d, k) => ({ f: hz(m) * d, ph: rand(), k })));
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = v.f / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      if (v.k === 0) l += x; else if (v.k === 2) r += x; else { l += x * 0.55; r += x * 0.55; }
    }
    const att = Math.min(1, tt / 0.8);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.5);
    const cutoff = 800 + (cutMax - 800) * Math.min(1, tt / 1.5);
    const g = att * rel * vel * 0.03;
    add("pad", s + n, fl(l, cutoff, 0.7, "lp") * g, fr(r, cutoff, 0.7, "lp") * g);
  }
}

/* Riser: white noise through a rising band-pass, swelling. */
function riser(t, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const fb = svf(), fh = svf(), fb2 = svf();
  const cut = Math.round(0.06 * SR);
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const x = noise();
    const sw = 250 * Math.pow(48, p);
    const v = fb(x, sw, 2.2, "bp") * 0.9 + fh(fb2(x, 400 + 5000 * p, 0.7, "lp"), 600, 0.7, "hp") * 0.25;
    const fade = n > len - cut ? Math.max(0, (len - n) / cut) : 1;
    const o = v * (0.04 + 0.96 * p * p) * 0.55 * fade;
    const w = 0.35 * Math.sin(p * 50);
    add("fx", s + n, o * (1 - w), o * (1 + w));
  }
}

/* Filter-swept saw chord under the riser. */
function sweepChord(t, notes, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => [0.995, 1.005].map((d, k) => ({ f: hz(m) * d, ph: rand(), k })));
  const cut = Math.round(0.06 * SR);
  for (let n = 0; n < len; n++) {
    const p = n / len;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = v.f / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      if (v.k === 0) l += x; else r += x;
    }
    const cutoff = 300 * Math.pow(30, p);
    const fade = n > len - cut ? Math.max(0, (len - n) / cut) : 1;
    const g = (0.02 + 0.98 * p) * 0.03 * fade;
    add("fx", s + n, fl(l, cutoff, 2.5, "lp") * g, fr(r, cutoff, 2.5, "lp") * g);
  }
}

/* ── Sequence ──────────────────────────────────────────────────────────── */
// Stab rhythm, two alternating bars: [step, length in steps]
const STAB_A = [[0, 2], [3, 2], [6, 3], [10, 2], [12, 1.5], [14, 1.5]];
const STAB_B = [[0, 2], [3, 2], [6, 2], [9, 1.5], [11, 2], [14, 1.5]];
// Bass: offbeats with octave jumps and a rolling 16th pickup
const BASS_PAT = [[2, 0, 1.3, 1], [3, 12, 0.7, 0.75], [6, 0, 1.3, 1], [7, 0, 0.7, 0.8], [10, 0, 1.3, 1], [11, 12, 0.7, 0.75], [14, 0, 0.9, 1], [15, 12, 0.7, 0.7]];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];

for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  const t0 = bar * BAR;
  const ch = chordAt(bar);
  const inSec = bar - sec.from;
  const isBuild = bar >= 28 && bar < 32;

  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (sec.kick) kick(tb, 1);
    if (sec.clap && (b === 1 || b === 3)) clap(tb + 0.003, 1);
    if (sec.open) hat(tb + BEAT / 2, true, 0.9, 0.15);
    if (sec.hat) {
      for (let k = 0; k < 4; k++) {
        if (k === 2 && sec.open) continue;
        hat(tb + k * STEP + (k % 2 ? 0.005 : 0), false, k % 2 ? 0.55 : 0.85, -0.2);
      }
    }
    if (sec.shaker) for (let k = 0; k < 4; k++) shaker(tb + k * STEP, k === 3 ? 1 : k === 1 ? 0.7 : 0.5, k % 2 ? 0.35 : -0.35);
    if (sec.ride) { ride(tb + BEAT / 2, 0.9); if (b === 3) ride(tb + STEP * 3, 0.6); }
  }

  if (sec.bass) {
    for (const [st, off, len, v] of BASS_PAT) {
      if (sec.name === "outro" && inSec === 7 && st >= 14) continue;
      bass(t0 + st * STEP, ch.root + off, STEP * len, v);
    }
  }

  if (sec.stab) {
    let bright = sec.stab;
    if (sec.name === "intro") bright = 0.1 + 0.07 * inSec;
    if (sec.name === "outro") bright = 0.6 - 0.07 * inSec;
    const rhythm = bar % 2 === 0 ? STAB_A : STAB_B;
    for (const [st, len] of rhythm) stab(t0 + st * STEP, ch.up, len * STEP * 0.85, bright, 0.9);
  }

  // Pad: one chord a bar in the groove and drop; the lush bed of the break.
  if (sec.pad) {
    const notes = [...ch.up.map((m) => m - 12), ...ch.up.slice(1)];
    if (sec.name === "break") {
      // the build pushes the pad's filter open
      pad(t0, notes, BAR * 0.99, sec.pad, isBuild ? 3600 + 800 * (bar - 28) : 2800);
    } else pad(t0, notes, BAR * 0.99, sec.pad);
  }

  // Pluck arp in 16ths, bouncing off the chord tones, with the delay.
  if (sec.arp) {
    const tones = ch.up.map((m) => m + 12);
    for (let k = 0; k < 16; k++) {
      if (k % 4 === 3 && bar % 2) continue;
      pluck(t0 + k * STEP, tones[ARP[k] % 4], STEP * 0.7, k % 4 === 0 ? 0.7 : 0.45, 0.8, k % 2 ? 0.3 : -0.3, "arp");
    }
  }

  // The hook
  if (sec.hook) {
    const full = sec.hook === "full";
    const open = full ? 1.1 : isBuild ? 0.25 + 0.28 * (bar - 28) : 0.12;
    for (const [st, m, len] of HOOK[bar % 8]) {
      pluck(t0 + st * STEP, m, len * STEP * 0.85, full ? 1 : 0.85, open, 0, "lead");
      if (full) pluck(t0 + st * STEP, m - 12, len * STEP * 0.85, 0.5, 0.7, 0, "lead");
    }
  }

  if (isBuild) {
    const k = bar - 28;
    // rolling 8th-note stabs in the last 2 bars
    if (k >= 2) for (let h = 0; h < 8; h++) stab(t0 + h * (BAR / 8), ch.up, (BAR / 8) * 0.7, 0.4 + 0.15 * k, 0.55);
    if (k === 0) {
      riser(t0, BAR * 4);
      sweepChord(t0, [...CH.F.up.map((m) => m - 12), ...CH.Bb.up.slice(1)], BAR * 4);
      snareRoll(t0);
    }
    if (k === 3) reverseCymbal(t0 + BAR, BAR * 1);
  }

  if (sec.crash && inSec === 0) crash(t0);
}

/* ── Mix ───────────────────────────────────────────────────────────────── */
// Sidechain pump from the kick grid (and a gentler ghost pump in the break).
const duck = new Float32Array(N).fill(1);
for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  const strength = sec.kick ? 1 : sec.name === "break" ? 0.5 : 0;
  if (!strength) continue;
  for (let b = 0; b < 4; b++) {
    const s = Math.round((bar * BAR + b * BEAT) * SR);
    const len = Math.round(BEAT * SR);
    for (let n = 0; n < len && s + n < N; n++) {
      const tt = n / SR;
      duck[s + n] = Math.min(duck[s + n], 1 - 0.9 * strength * Math.exp(-tt / 0.12));
    }
  }
}

const GAIN = { kick: 1.1, clap: 0.8, hat: 0.75, shaker: 0.8, ride: 0.8, bass: 1.0, stab: 1.0, pad: 0.85, lead: 0.9, arp: 0.65, fx: 0.55 };
const DUCK_AMT = { bass: 1, stab: 1, pad: 0.8, lead: 0.5, arp: 0.6 };
const REVERB_SEND = { clap: 0.35, stab: 0.12, pad: 0.35, lead: 0.2, arp: 0.15, fx: 0.35, ride: 0.1, hat: 0.04 };
const DELAY_SEND = { lead: 0.28, arp: 0.35, stab: 0.06 };

const outL = new Float32Array(N), outR = new Float32Array(N);
const revInL = new Float32Array(N), revInR = new Float32Array(N);
const dlyInL = new Float32Array(N), dlyInR = new Float32Array(N);

for (const [name, [l, r]] of Object.entries(buses)) {
  const g = GAIN[name] ?? 1;
  const da = DUCK_AMT[name] ?? 0;
  const rs = REVERB_SEND[name] ?? 0;
  const ds = DELAY_SEND[name] ?? 0;
  for (let i = 0; i < N; i++) {
    const d = da ? 1 - da * (1 - duck[i]) : 1;
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
    bl[p] = lpL(dlyInL[i] + yr * 0.45, 3800, 0.7, "lp");
    br[p] = lpR(dlyInR[i] + yl * 0.45, 3800, 0.7, "lp");
    outL[i] += yl * 0.85; outR[i] += yr * 0.85;
    revInL[i] += yl * 0.1; revInR[i] += yr * 0.1;
    p = (p + 1) % D;
  }
}

// Freeverb-style reverb, a medium room (feedback 0.8).
function reverb(input, combs, aps, fb = 0.8) {
  const out = new Float32Array(N);
  const cb = combs.map((d) => ({ buf: new Float32Array(d), p: 0, lp: 0 }));
  const ab = aps.map((d) => ({ buf: new Float32Array(d), p: 0 }));
  for (let i = 0; i < N; i++) {
    const x = input[i];
    let y = 0;
    for (const c of cb) {
      const o = c.buf[c.p];
      c.lp = o * 0.62 + c.lp * 0.38;
      c.buf[c.p] = x + c.lp * fb;
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
    out[i] = y * 0.22;
  }
  return out;
}
const rL = reverb(revInL, [1557, 1617, 1491, 1422, 1277, 1356], [556, 441, 341]);
const rR = reverb(revInR, [1580, 1640, 1514, 1445, 1300, 1379], [579, 464, 364]);
for (let i = 0; i < N; i++) { outL[i] += rL[i]; outR[i] += rR[i]; }

// Wrap the tail onto the start so the loop point rings into itself.
const loopL = outL.slice(0, LOOP_N), loopR = outR.slice(0, LOOP_N);
for (let i = LOOP_N; i < N; i++) { loopL[i - LOOP_N] += outL[i]; loopR[i - LOOP_N] += outR[i]; }

// Master: high-pass, soft clip, normalise.
const DRIVE = Number(process.env.DRIVE ?? 1.2);
const PEAK = Number(process.env.PEAK ?? 0.89);
{
  const hl = svf(), hr = svf();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < LOOP_N; i++) {
      const a = hl(loopL[i], 28, 0.7, "hp"), b = hr(loopR[i], 28, 0.7, "hp");
      if (pass) { loopL[i] = Math.tanh(a * DRIVE); loopR[i] = Math.tanh(b * DRIVE); }
    }
  }
  let peak = 0;
  for (let i = 0; i < LOOP_N; i++) peak = Math.max(peak, Math.abs(loopL[i]), Math.abs(loopR[i]));
  const g = PEAK / peak;
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
  const i = (k - BAR_N + LOOP_N) % LOOP_N;
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, loopL[i])) * 32767), 44 + k * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, loopR[i])) * 32767), 46 + k * 4);
}
const tmp = join(tmpdir(), `museum-${ID}.wav`);
writeFileSync(tmp, wav);

const songsDir = join(ROOT, "public", "museum", "songs");
mkdirSync(songsDir, { recursive: true });
const mp3 = join(songsDir, `${ID}.mp3`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "160k",
  "-metadata", `title=${TITLE}`, "-metadata", "artist=Ben Adams", "-metadata", `comment=Rendered by scripts/museum-song/${ID}.mjs`,
  mp3]);

// Cues: the two intro halves are one section as far as the lights go.
const cues = [];
for (const s of SECTIONS) {
  const prev = cues[cues.length - 1];
  if (prev && prev.name === s.name && prev.energy === s.energy && prev.kick === !!s.kick) prev.to = s.to;
  else cues.push({ name: s.name, from: s.from, to: s.to, energy: s.energy, kick: !!s.kick });
}
const cuesDir = join(ROOT, "museum", "songs");
mkdirSync(cuesDir, { recursive: true });
writeFileSync(join(cuesDir, `${ID}.json`), JSON.stringify({
  id: ID,
  title: TITLE,
  bpm: BPM,
  bars: BARS,
  loopSeconds: LOOP,
  loopStartSeconds: BAR,
  sections: cues,
}, null, 2) + "\n");

console.log(`wrote ${mp3} (${(total / SR).toFixed(2)} s, loop ${LOOP.toFixed(3)} s at ${BPM} BPM)`);
