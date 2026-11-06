/**
 * "Mirror Ball": an original 120 BPM French / filter-disco house loop in
 * E minor, written note by note and synthesized from oscillators and noise.
 * Nothing sampled, nothing borrowed.
 *
 *   node scripts/museum-song/mirror-ball.mjs
 *
 * Writes:
 *   public/museum/songs/mirror-ball.mp3  [last bar] + 72-bar loop + [first bar]
 *   museum/songs/mirror-ball.json        the arrangement, read by the lights
 *
 * Needs ffmpeg on PATH. Deterministic: same script, same file.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "mirror-ball";
const TITLE = "Mirror Ball";

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4; // 2 s
const STEP = BEAT / 4;
const BARS = 72;
const LOOP = BARS * BAR; // 144 s
const TAIL_BARS = 4;
const N = Math.round((BARS + TAIL_BARS) * BAR * SR);
const LOOP_N = Math.round(LOOP * SR);

/* ── Arrangement ───────────────────────────────────────────────────────── */
const SECTIONS = [
  { name: "intro", from: 0, to: 8, energy: 0.35, kick: 1, hat: 0.7, clap: 0, open: 0, bass: 0, loop: 1, stab: 0, str: 0 },
  { name: "groove", from: 8, to: 16, energy: 0.6, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, loop: 1, stab: 0, str: 0 },
  { name: "groove", from: 16, to: 24, energy: 0.75, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, loop: 1, stab: 0.6, str: 0.7, shaker: 1 },
  { name: "break", from: 24, to: 32, energy: 0.25, kick: 0, hat: 0, clap: 0, open: 0, bass: 0, loop: 1, stab: 0, str: 1, riser: 1 },
  { name: "drop", from: 32, to: 48, energy: 1, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, loop: 1, stab: 1, str: 0.55, shaker: 1 },
  { name: "drop", from: 48, to: 56, energy: 0.9, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, loop: 1, stab: 1, str: 0.7, shaker: 1, alt: 1 },
  { name: "groove", from: 56, to: 64, energy: 0.65, kick: 1, hat: 1, clap: 1, open: 1, bass: 1, loop: 1, stab: 0, str: 0.6 },
  { name: "outro", from: 64, to: 72, energy: 0.4, kick: 1, hat: 0.8, clap: 1, open: 0, bass: 1, loop: 1, stab: 0, str: 0 },
];
const sectionAt = (bar) => SECTIONS.find((s) => bar >= s.from && bar < s.to);

/* Two bars a chord: Em9, Cmaj9, Am9, D9. `bass` is the root in MIDI. */
const CH = [
  { bass: 40, notes: [52, 55, 59, 62, 66] },
  { bass: 36, notes: [55, 59, 60, 62, 64] },
  { bass: 33, notes: [55, 57, 59, 60, 64] },
  { bass: 38, notes: [54, 57, 60, 62, 64] },
];
const chordAt = (bar) => CH[Math.floor(bar / 2) % 4];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* Filter sweep (cutoff Hz) as [bar, cutoff] keyframes, exponential between. */
const SWEEP = [
  [0, 300], [8, 1500], [8.001, 500], [16, 3000], [16.001, 700], [24, 5200],
  [24.001, 220], [31.5, 3200], [32, 15000], [56, 15000], [64, 2400], [72, 300],
];
function sweepAt(t) {
  const b = (t / BAR) % BARS;
  for (let i = 1; i < SWEEP.length; i++) {
    if (b <= SWEEP[i][0]) {
      const [b0, c0] = SWEEP[i - 1], [b1, c1] = SWEEP[i];
      const p = (b - b0) / (b1 - b0);
      return c0 * Math.pow(c1 / c0, Math.min(1, Math.max(0, p)));
    }
  }
  return SWEEP[SWEEP.length - 1][1];
}

/* ── Utilities ─────────────────────────────────────────────────────────── */
let seed = 0x3d15c0;
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
const busOf = (name) => (buses[name] ??= [new Float32Array(N), new Float32Array(N)]);
function add(bus, i, l, r = l) {
  if (i < 0 || i >= N) return;
  const b = busOf(bus);
  b[0][i] += l;
  b[1][i] += r;
}

/* ── Instruments ───────────────────────────────────────────────────────── */
function kick(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.45 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    ph += (46 + 120 * Math.exp(-tt / 0.03)) / SR;
    const amp = Math.exp(-tt / 0.2) * (tt < 0.002 ? tt / 0.002 : 1);
    let v = Math.sin(2 * Math.PI * ph) * amp + Math.exp(-tt / 0.004) * noise() * 0.22;
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
    let env = 0;
    for (const o of [0, 0.011, 0.022]) if (tt >= o) env = Math.max(env, Math.exp(-(tt - o) / 0.008));
    if (tt >= 0.03) env = Math.max(env, 0.8 * Math.exp(-(tt - 0.03) / 0.09));
    const v = f(noise(), 1500, 1.4, "bp") * env * 2.2;
    add("clap", s + n, v * vel * 0.55, v * vel * 0.5);
  }
}

function hat(t, open, vel = 1, pan = 0) {
  const s = Math.round(t * SR);
  const decay = open ? 0.12 : 0.025;
  const len = Math.round(decay * 5 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = f(noise(), 7500, 0.8, "hp") * Math.exp(-tt / decay) * vel * (open ? 0.2 : 0.15);
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
    const v = f(noise(), 5500, 1.2, "bp") * env * vel * 0.13;
    add("hat", s + n, v * 0.7, v * 1.3);
  }
}

/** Funk bass: a plucked saw through a snapping filter, a sine sub, and a little
    finger noise; `kind` is "note", "ghost" (dead, muted) or "pop" (slap). */
function bass(t, midi, dur, vel, kind = "note") {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.05) * SR);
  const f = svf();
  const fn = svf();
  const freq = hz(midi);
  let ph = 0, ph2 = 0, sub = 0;
  const open = kind === "pop" ? 4200 : kind === "ghost" ? 500 : 2400;
  const decayF = kind === "pop" ? 0.05 : 0.075;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const inc = freq / SR;
    ph = (ph + inc) % 1;
    ph2 = (ph2 + inc * 1.004) % 1;
    sub += inc;
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.012);
    const env = Math.min(1, tt / 0.002) * gate * (kind === "ghost" ? 1 : Math.exp(-tt / 0.35) * 0.4 + 0.6);
    const cutoff = 160 + open * Math.exp(-tt / decayF);
    let v = f((saw(ph, inc) + saw(ph2, inc * 1.004)) * 0.5, cutoff, 3, "lp") * 0.7;
    v += Math.sin(2 * Math.PI * sub) * (kind === "ghost" ? 0.25 : 0.55);
    v += fn(noise(), 2500, 1, "bp") * Math.exp(-tt / 0.006) * 0.3;
    v = Math.tanh(v * 1.4) * env * vel * 0.6;
    add("bass", s + n, v);
  }
}

/** Chord phrase voice: detuned saws with a touch of tape wobble. */
function chordHit(bus, t, notes, dur, bright, vel, wobble = true) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.2) * SR);
  const voices = notes.flatMap((m) => [
    { f: hz(m) * 1.0045, ph: rand(), side: -1 },
    { f: hz(m) * 0.9955, ph: rand(), side: 1 },
  ]);
  const fl = svf(), fr = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const wob = wobble ? 1 + 0.0025 * Math.sin(2 * Math.PI * 0.6 * (s + n) / SR) : 1;
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = (v.f * wob) / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc);
      if (v.side < 0) l += x; else r += x;
    }
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.05);
    const env = Math.min(1, tt / 0.004) * gate * (0.55 + 0.45 * Math.exp(-tt / 0.18));
    const cutoff = 700 + bright * 5000 * Math.exp(-tt / 0.12);
    const g = env * vel * 0.075;
    add(bus, s + n, fl(l, cutoff, 0.9, "lp") * g, fr(r, cutoff, 0.9, "lp") * g);
  }
}

/** String section: detuned saw trios, slow attack, gentle low-pass. */
function strings(t, notes, dur, vel, bright) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 1.0) * SR);
  const fl = svf(), fr = svf();
  const all = [...notes, notes[notes.length - 1] + 12, notes[0] - 12];
  const voices = all.flatMap((m, idx) => [0.994, 1, 1.006].map((d, k) => ({
    f: hz(m + (idx >= notes.length ? 0 : 0)) * d, ph: rand(), k, a: idx >= notes.length ? 0.5 : 1,
  })));
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const vib = 1 + 0.0035 * Math.sin(2 * Math.PI * 5.2 * tt) * Math.min(1, tt / 1.5);
    let l = 0, r = 0;
    for (const v of voices) {
      const inc = (v.f * vib) / SR;
      v.ph = (v.ph + inc) % 1;
      const x = saw(v.ph, inc) * v.a;
      if (v.k === 0) l += x; else if (v.k === 2) r += x; else { l += x * 0.6; r += x * 0.6; }
    }
    const att = Math.min(1, tt / 0.9);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.35);
    const cutoff = (900 + 1300 * bright) * (0.8 + 0.2 * Math.min(1, tt / dur));
    const g = att * att * rel * vel * 0.03;
    add("str", s + n, fl(l, cutoff, 0.8, "lp") * g, fr(r, cutoff, 0.8, "lp") * g);
  }
}

function riser(t, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const f = svf();
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const nz = f(noise(), 300 + 9000 * p * p, 3, "bp") * p * p * 0.35;
    ph += (180 + 1500 * p * p) / SR;
    const tone = (ph % 1 - 0.5) * 0.08 * p * p;
    const m = 1 - 0.3 * Math.sin(p * 40);
    add("fx", s + n, (nz + tone) * m, (nz + tone) * (2 - m));
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

function impact(t) {
  const s = Math.round(t * SR);
  const len = Math.round(2.2 * SR);
  const f = svf();
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const nz = f(noise(), 200 + 7000 * Math.exp(-tt / 0.35), 1.2, "lp") * Math.exp(-tt / 0.6) * 0.45;
    ph += (38 + 40 * Math.exp(-tt / 0.15)) / SR;
    const boom = Math.sin(2 * Math.PI * ph) * Math.exp(-tt / 0.5) * 0.5;
    add("fx", s + n, nz + boom, nz + boom);
  }
}

/* ── Sequence ──────────────────────────────────────────────────────────── */
// Chord phrase: [16th step, length in steps, velocity]
const PHRASE = [[0, 2.5, 1], [3, 1, 0.8], [6, 1.5, 0.9], [8, 2.5, 1], [11, 1, 0.75], [14, 1.5, 0.85]];
const STABS_A = [2, 7, 10, 15];
const STABS_B = [1, 4, 7, 9, 12, 15];
// Bass patterns: [step, semitones above root, velocity, kind, length in steps]
const BASS_A = [[0, 0, 1, "note", 2], [3, 0, 0.4, "ghost", 0.5], [4, 0, 0.35, "ghost", 0.5], [6, 0, 0.9, "note", 1.5], [7, 12, 0.75, "pop", 0.6], [10, 0, 0.9, "note", 1.5], [12, 7, 0.75, "note", 1], [14, 10, 0.75, "note", 1]];
const BASS_B = [[0, 0, 1, "note", 1.5], [2, 12, 0.75, "pop", 0.6], [3, 0, 0.4, "ghost", 0.5], [6, 0, 0.9, "note", 1.5], [8, 7, 0.8, "note", 1], [10, 0, 0.9, "note", 1], [11, 0, 0.35, "ghost", 0.5], [13, 12, 0.75, "pop", 0.6], [14, 10, 0.7, "note", 1]];

for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  const t0 = bar * BAR;
  const ch = chordAt(bar);
  const next = chordAt(bar + 1);
  const inSec = bar - sec.from;
  const lastOfChord = bar % 2 === 1;

  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (sec.kick) kick(tb, b === 0 ? 1 : 0.95);
    if (sec.clap && (b === 1 || b === 3) && !(sec.name === "outro" && inSec >= 6)) clap(tb + 0.004);
    if (sec.open) hat(tb + BEAT / 2, true, 0.9, 0.15);
    if (sec.hat) {
      for (let k = 0; k < 4; k++) {
        if (k === 2 && sec.open) continue;
        hat(tb + k * STEP + (k % 2 ? 0.006 : 0), false, (k % 2 ? 0.6 : 1) * sec.hat, -0.2);
      }
    }
    if (sec.shaker) for (let k = 0; k < 4; k++) shaker(tb + k * STEP + 0.004, k === 2 ? 1 : 0.55);
  }

  if (sec.bass) {
    const pat = bar % 2 === 0 ? BASS_A : BASS_B;
    for (const [st, off, vel, kind, len] of pat) {
      if (sec.name === "outro" && inSec >= 6 && kind !== "note") continue;
      let midi = ch.bass + off;
      // approach the next root chromatically on the last bar of each chord
      if (lastOfChord && st === 14) midi = next.bass - 1;
      bass(t0 + st * STEP, midi, len * STEP, vel, kind);
    }
  }

  if (sec.loop) {
    // the looped chord phrase; tucked back in the intro, outro and break
    const lv = sec.name === "break" ? 0.9 : 1;
    const phrase = sec.name === "break" && bar >= 28 ? PHRASE.filter((_, i) => i % 2 === 0 || bar >= 30) : PHRASE;
    for (const [st, len, vel] of phrase) chordHit("chord", t0 + st * STEP, ch.notes, len * STEP, 0.6, vel * lv);
  }

  if (sec.stab) {
    const pat = sec.alt ? STABS_B : STABS_A;
    for (const st of pat) chordHit("stab", t0 + st * STEP, ch.notes.map((m) => m + 12), STEP * 0.9, 0.9, sec.stab * 0.7, false);
  }

  if (sec.str && bar % 2 === 0) strings(t0, ch.notes, BAR * 2, sec.str, sec.name === "break" ? 0.6 + 0.4 * (inSec / 8) : 0.8);

  if (sec.riser && inSec === 4) riser(t0, BAR * 4);
  if (sec.riser && inSec === 6) snareRoll(t0, 2);
  if (bar === 32) impact(t0);
  if (bar === 23) riser(t0 + BAR * 0.5, BAR * 0.5); // short lift into the break
}

/* ── Mix ───────────────────────────────────────────────────────────────── */
// Heavy sidechain pump, taken from the kick pattern itself.
const duck = new Float32Array(N).fill(1);
for (let bar = 0; bar < BARS + TAIL_BARS; bar++) {
  const sec = sectionAt(bar % BARS);
  if (bar >= BARS || !sec.kick) continue;
  for (let b = 0; b < 4; b++) {
    const s = Math.round((bar * BAR + b * BEAT) * SR);
    const len = Math.round(BEAT * SR);
    for (let n = 0; n < len && s + n < N; n++) {
      const tt = n / SR;
      duck[s + n] = Math.min(duck[s + n], 1 - 0.85 * Math.exp(-tt / 0.13));
    }
  }
}

// The slow resonant low-pass sweep, then a phaser, on the chord + stab group.
{
  const [cl, cr] = busOf("chord");
  const [sl, sr] = busOf("stab");
  const fl = svf(), fr = svf();
  const pL = [0, 0, 0, 0], pR = [0, 0, 0, 0];
  let fbL = 0, fbR = 0;
  let cutoff = 300, q = 2.4;
  for (let i = 0; i < N; i++) {
    if (i % 16 === 0) {
      cutoff = sweepAt(i / SR);
      q = 0.9 + 1.9 * Math.min(1, Math.max(0, (9000 - cutoff) / 7000));
    }
    // compensate the resonance and the closed-filter level loss a little
    const comp = 1 + 0.6 * Math.min(1, Math.max(0, (4000 - cutoff) / 3700));
    let l = fl(cl[i] + sl[i], cutoff, q, "lp") * comp;
    let r = fr(cr[i] + sr[i], cutoff, q, "lp") * comp;
    // 4-stage phaser, LFO 0.25 Hz (an integer number of periods per loop)
    const ph = (2 * Math.PI * 0.25 * i) / SR;
    const fcL = 400 * Math.pow(7, 0.5 + 0.5 * Math.sin(ph));
    const fcR = 400 * Math.pow(7, 0.5 + 0.5 * Math.sin(ph + 1.6));
    const aL = (Math.tan((Math.PI * fcL) / SR) - 1) / (Math.tan((Math.PI * fcL) / SR) + 1);
    const aR = (Math.tan((Math.PI * fcR) / SR) - 1) / (Math.tan((Math.PI * fcR) / SR) + 1);
    let xl = l + fbL * 0.4, xr = r + fbR * 0.4;
    for (let k = 0; k < 4; k++) {
      const yl = aL * xl + pL[k]; pL[k] = xl - aL * yl; xl = yl;
      const yr = aR * xr + pR[k]; pR[k] = xr - aR * yr; xr = yr;
    }
    fbL = xl; fbR = xr;
    cl[i] = (l + xl) * 0.5;
    cr[i] = (r + xr) * 0.5;
    sl[i] = 0; sr[i] = 0;
  }
}

const GAIN = { kick: 1, clap: 0.8, hat: 0.8, bass: 0.95, chord: 1.15, stab: 1, str: 1, fx: 0.6 };
const DEPTH = { bass: 1, chord: 1, stab: 1, str: 0.7 };
const REVERB_SEND = { clap: 0.25, chord: 0.18, str: 0.4, fx: 0.4, hat: 0.05 };
const DELAY_SEND = { chord: 0.1 };

const outL = new Float32Array(N), outR = new Float32Array(N);
const revInL = new Float32Array(N), revInR = new Float32Array(N);
const dlyInL = new Float32Array(N), dlyInR = new Float32Array(N);

for (const [name, [l, r]] of Object.entries(buses)) {
  const g = GAIN[name] ?? 1;
  const depth = DEPTH[name] ?? 0;
  const rs = REVERB_SEND[name] ?? 0;
  const ds = DELAY_SEND[name] ?? 0;
  for (let i = 0; i < N; i++) {
    const d = 1 - depth * (1 - duck[i]);
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
    bl[p] = lpL(dlyInL[i] + yr * 0.4, 3000, 0.7, "lp");
    br[p] = lpR(dlyInR[i] + yl * 0.4, 3000, 0.7, "lp");
    outL[i] += yl * 0.7; outR[i] += yr * 0.7;
    revInL[i] += yl * 0.08; revInR[i] += yr * 0.08;
    p = (p + 1) % D;
  }
}

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

// Wrap the tail onto the start so the loop point rings into itself.
const loopL = outL.slice(0, LOOP_N), loopR = outR.slice(0, LOOP_N);
for (let i = LOOP_N; i < N; i++) { loopL[i - LOOP_N] += outL[i]; loopR[i - LOOP_N] += outR[i]; }

// Master: high-pass, a gentle high shelf cut (tame the air), soft clip, normalise.
const DRIVE = Number(process.env.DRIVE ?? 1.6);
const PEAK = Number(process.env.PEAK ?? 0.88);
{
  const hl = svf(), hr = svf(), ll = svf(), lr = svf();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < LOOP_N; i++) {
      let a = hl(loopL[i], 28, 0.7, "hp"), b = hr(loopR[i], 28, 0.7, "hp");
      a = ll(a, 15000, 0.7, "lp"); b = lr(b, 15000, 0.7, "lp");
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
const tmp = join(tmpdir(), `museum-song-${ID}.wav`);
writeFileSync(tmp, wav);

const outDir = join(ROOT, "public", "museum", "songs");
mkdirSync(outDir, { recursive: true });
const mp3 = join(outDir, `${ID}.mp3`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "160k",
  "-metadata", `title=${TITLE}`, "-metadata", "artist=Ben Adams", "-metadata", `comment=Rendered by scripts/museum-song/${ID}.mjs`,
  mp3]);

const cueDir = join(ROOT, "museum", "songs");
mkdirSync(cueDir, { recursive: true });
writeFileSync(join(cueDir, `${ID}.json`), JSON.stringify({
  id: ID,
  title: TITLE,
  bpm: BPM,
  bars: BARS,
  loopSeconds: LOOP,
  loopStartSeconds: BAR,
  sections: SECTIONS.map(({ name, from, to, energy, kick: k }) => ({ name, from, to, energy, kick: !!k })),
}, null, 2) + "\n");

console.log(`wrote ${mp3} (${(total / SR).toFixed(2)} s, loop ${LOOP} s at ${BPM} BPM)`);
