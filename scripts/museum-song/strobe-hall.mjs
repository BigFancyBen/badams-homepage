/**
 * "Strobe Hall": an original 126 BPM tech house loop in G minor for the
 * homepage museum. Synthesized from oscillators and noise only; nothing
 * sampled, nothing borrowed.
 *
 *   node scripts/museum-song/strobe-hall.mjs
 *
 * Writes:
 *   public/museum/songs/strobe-hall.mp3  [last bar] + loop + [first bar]
 *   museum/songs/strobe-hall.json        arrangement cues for the lights
 *
 * Needs ffmpeg on PATH. Deterministic.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "strobe-hall";
const TITLE = "Strobe Hall";

const SR = 44100;
const BPM = 126;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BEAT / 4;
const BARS = 72;
const LOOP = BARS * BAR;
const TAIL_BARS = 4;
const N = Math.round((BARS + TAIL_BARS) * BAR * SR);
const LOOP_N = Math.round(LOOP * SR);

/* ── Arrangement ───────────────────────────────────────────────────────── */
const SECTIONS = [
  { name: "intro", from: 0, to: 8, energy: 0.35, kick: 1, hat: 1, conga: 0.5, rim: 0.5 },
  { name: "groove", from: 8, to: 16, energy: 0.6, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, conga: 1, bass: 1 },
  { name: "groove", from: 16, to: 24, energy: 0.75, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, conga: 1, bass: 1, acid: 1, stab: 1, shaker: 1 },
  { name: "break", from: 24, to: 32, energy: 0.25, acid: 1, pad: 1, riser: 1 },
  { name: "drop", from: 32, to: 48, energy: 1, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, conga: 1, bass: 1, acid: 1, stab: 1, ride: 1, shaker: 1 },
  { name: "drop", from: 48, to: 64, energy: 0.92, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, conga: 1, bass: 1, acid: 1, stab: 1, ride: 1, shaker: 1, busy: 1 },
  { name: "outro", from: 64, to: 72, energy: 0.45, kick: 1, hat: 1, clap: 1, conga: 1, rim: 0.5, bass: 1 },
];
const sectionAt = (bar) => SECTIONS.find((s) => bar >= s.from && bar < s.to);

/* Roots per bar (MIDI, bass register): mostly G, with a lift to Eb and F. */
const ROOTS = [31, 31, 31, 31, 31, 31, 27, 29];
const CHORDS = {
  31: [55, 58, 62, 65], // Gm7
  27: [51, 55, 58, 62], // Ebmaj7 (no 5th shift)
  29: [53, 57, 60, 65], // F
};
const rootAt = (bar) => ROOTS[bar % 8];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ── Utilities ─────────────────────────────────────────────────────────── */
let seed = 0x57b0be11;
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
  const len = Math.round(0.3 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const f = 46 + 120 * Math.exp(-tt / 0.022);
    ph += f / SR;
    const amp = Math.exp(-tt / 0.1) * (tt < 0.001 ? tt / 0.001 : 1);
    let v = Math.sin(2 * Math.PI * ph) * amp;
    v += Math.exp(-tt / 0.003) * noise() * 0.22;
    v = Math.tanh(v * 1.8);
    add("kick", s + n, v * vel * 0.9);
  }
}

function clap(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.18 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let env = 0;
    for (const o of [0, 0.009, 0.019]) if (tt >= o) env = Math.max(env, Math.exp(-(tt - o) / 0.006));
    if (tt >= 0.027) env = Math.max(env, 0.7 * Math.exp(-(tt - 0.027) / 0.035));
    const v = f(noise(), 1700, 1.5, "bp") * env * 2.2;
    add("clap", s + n, v * vel * 0.5, v * vel * 0.46);
  }
}

function rim(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.06 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.exp(-tt / 0.008);
    const v = (Math.sin(2 * Math.PI * 1750 * tt) * 0.6 + Math.sin(2 * Math.PI * 480 * tt) * 0.5 + f(noise(), 3500, 2, "bp") * 0.8) * env;
    add("perc", s + n, v * vel * 0.17, v * vel * 0.22);
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
  const len = Math.round(0.06 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.min(1, tt / 0.01) * Math.exp(-tt / 0.02);
    const v = f(noise(), 5500, 1.2, "bp") * env * vel * 0.14;
    add("hat", s + n, v * 0.6, v * 1.4);
  }
}

/** Metallic ride: inharmonic square partials, high-passed, with a long ring. */
const RIDE_PARTIALS = [3410, 4570, 5870, 7260, 8830];
function ride(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.6 * SR);
  const f = svf();
  const phs = RIDE_PARTIALS.map(() => 0);
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let x = 0;
    for (let k = 0; k < phs.length; k++) {
      phs[k] = (phs[k] + RIDE_PARTIALS[k] / SR) % 1;
      x += phs[k] < 0.5 ? 1 : -1;
    }
    x = x / phs.length + noise() * 0.3;
    const env = Math.exp(-tt / 0.03) * 0.6 + Math.exp(-tt / 0.2) * 0.4;
    const v = f(x, 5200, 0.8, "hp") * env * vel * 0.1;
    add("hat", s + n, v * 1.15, v * 0.85);
  }
}

/** Synthesized conga: pitched membrane plus a slap of noise. kind: lo, hi, slap. */
function conga(t, kind, vel = 1, pan = 0) {
  const s = Math.round(t * SR);
  const len = Math.round(0.3 * SR);
  const f = svf();
  const base = kind === "lo" ? 205 : kind === "hi" ? 305 : 420;
  const dec = kind === "slap" ? 0.04 : kind === "hi" ? 0.09 : 0.14;
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const fr = base * (1 + 0.28 * Math.exp(-tt / 0.012));
    ph += fr / SR;
    const body = Math.sin(2 * Math.PI * ph) * Math.exp(-tt / dec);
    const over = Math.sin(2 * Math.PI * ph * 1.9) * Math.exp(-tt / (dec * 0.4)) * 0.2;
    const slap = f(noise(), 2400, 1.4, "bp") * Math.exp(-tt / 0.006) * (kind === "slap" ? 0.9 : 0.35);
    const v = (body * 0.8 + over + slap) * vel * 0.3;
    add("perc", s + n, v * (1 - pan), v * (1 + pan));
  }
}

/** Rolling offbeat bass: sine sub plus a filtered saw with a quick pluck. */
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
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.01);
    const env = Math.min(1, tt / 0.003) * gate;
    const cutoff = 220 + 1100 * Math.exp(-tt / 0.05);
    let v = f(saw(ph, inc), cutoff, 2.4, "lp") * 0.5 + Math.sin(2 * Math.PI * sub) * 0.55;
    v = Math.tanh(v * 1.3) * env * vel * 0.6;
    add("bass", s + n, v);
  }
}

/** Dub-style chord stab. */
function stab(t, notes, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.3) * SR);
  const fl = svf(), fr = svf();
  const voices = notes.flatMap((m) => [
    { f: hz(m) * 1.003, ph: rand(), side: -1 },
    { f: hz(m) * 0.997, ph: rand(), side: 1 },
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
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.07);
    const env = Math.min(1, tt / 0.004) * gate;
    const cutoff = 350 + 1900 * Math.exp(-tt / 0.1);
    const g = env * vel * 0.085;
    add("stab", s + n, fl(l, cutoff, 1.2, "lp") * g, fr(r, cutoff, 1.2, "lp") * g);
  }
}

function pad(t, notes, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 1.5) * SR);
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
    const att = Math.min(1, tt / 1.6);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.5);
    const cutoff = 450 + 1500 * Math.min(1, tt / dur);
    const g = att * rel * vel * 0.045;
    add("pad", s + n, fl(l, cutoff, 0.8, "lp") * g, fr(r, cutoff, 0.8, "lp") * g);
  }
}

function riser(t, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const f = svf(), g2 = svf();
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const w = 0.5 + 0.5 * Math.sin(p * 60);
    // white-noise sweep
    const nz = f(noise(), 400 + 11000 * p * p, 2.5, "bp") * p * p * 0.4;
    // tonal sweep, an octave-and-a-half up
    ph += (180 * Math.pow(2, 3 * p)) / SR;
    const tone = g2(saw(ph % 1, 0.02), 600 + 5000 * p, 1.5, "lp") * p * p * 0.07;
    const v = nz + tone;
    add("fx", s + n, v * (0.7 + 0.3 * w), v * (1.3 - 0.3 * w));
  }
}

/** Snare roll: quarters, eighths, sixteenths, then 32nds across 4 bars. */
function snareRoll(t) {
  const per = [4, 2, 1, 0.5];
  let tt0 = t;
  for (let b = 0; b < 4; b++) {
    for (let k = 0; k < 16 / per[b]; k++) {
      const at = tt0 + k * per[b] * STEP;
      const p = (b * 16 + k * per[b]) / 64;
      const s = Math.round(at * SR);
      const len = Math.round(0.14 * SR);
      const f = svf();
      for (let n = 0; n < len; n++) {
        const x = n / SR;
        const v = (f(noise(), 2600, 1, "bp") * 1.5 + Math.sin(2 * Math.PI * (180 + 40 * Math.exp(-x / 0.02)) * x) * 0.4) * Math.exp(-x / 0.05) * (0.12 + 0.6 * p);
        add("clap", s + n, v * 0.55);
      }
    }
    tt0 += BAR;
  }
}

/* ── Acid line (303-style) ─────────────────────────────────────────────── */
// 16 steps per bar: [midi, accent, slide-into-this-note]; null = rest.
const A = (m, a = 0, sl = 0) => [m, a, sl];
const ACID_A = [
  A(43, 1), null, A(43), A(46, 0, 1), null, A(55, 1), A(43), null,
  A(41, 1), null, A(43), A(50, 0, 1), null, A(46), A(43, 1), A(48, 0, 1),
];
const ACID_B = [
  A(43, 1), A(43), null, A(55, 0, 1), A(53), null, A(46, 1), null,
  A(43), A(43), A(50, 1), null, A(48, 0, 1), A(46), null, A(43, 1),
];
const ACID_C = [ // for the Eb and F bars
  A(39, 1), null, A(39), A(42, 0, 1), null, A(51, 1), A(39), null,
  A(41, 1), null, A(41), A(48, 0, 1), null, A(44), A(41, 1), A(46, 0, 1),
];
const acidEvents = [];

/** How open the filter is (0..1) at a (fractional) bar. */
function acidOpen(bar) {
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (from, to, a, b) => lerp(a, b, (bar - from) / (to - from));
  if (bar < 16) return 0;
  if (bar < 24) return seg(16, 24, 0.06, 0.32); // enters filtered
  if (bar < 28) return seg(24, 28, 0.1, 0.2) + 0.03 * Math.sin(bar * 6); // break, held down
  if (bar < 32) return seg(28, 32, 0.2, 0.5); // opens as the riser climbs
  if (bar < 48) return 0.86 + 0.1 * Math.sin(bar * 1.3); // drop, wide open
  if (bar < 64) return 0.96 + 0.04 * Math.sin(bar * 1.7);
  return seg(64, 72, 0.5, 0.12);
}

function renderAcid() {
  const l = busOf("acid")[0], r = busOf("acid")[1];
  const f1 = svf(), f2 = svf();
  const evs = acidEvents.sort((a, b) => a.at - b.at);
  let ei = 0, cur = null, env = 0, accEnv = 0, accent = 0;
  let freq = hz(43), ph = 0, amp = 0, sq = 0;
  for (let i = 0; i < N; i++) {
    const tNow = i / SR;
    while (ei < evs.length && evs[ei].at <= tNow) {
      const e = evs[ei++];
      cur = e;
      if (!e.slide) { env = 1; accEnv = e.accent ? 1 : 0; }
      accent = e.accent ? 1 : 0;
    }
    let gate = 0;
    if (cur && tNow < cur.at + cur.len) gate = 1;
    amp += (gate - amp) * (gate ? 0.01 : 0.004);
    if (cur) freq += (hz(cur.midi) - freq) * (cur.slide ? 0.0025 : 0.03);
    env *= 0.99985 - (accent ? 0.0001 : 0);
    accEnv *= 0.9992;
    const bar = tNow / BAR;
    const open = acidOpen(bar % BARS + (bar >= BARS ? 0 : 0));
    const inc = freq / SR;
    ph = (ph + inc) % 1;
    const osc = saw(ph, inc) * 0.7 + (ph < 0.5 ? 0.3 : -0.3);
    const cutoff = 150 + open * 1500 + env * (200 + open * 3600) * (1 + accEnv * 0.5) + accEnv * 600 * open;
    const q = 4.5 + 3 * open + accEnv * 2;
    let v = f2(f1(osc, cutoff, q, "lp"), cutoff * 1.1, 1.2, "lp");
    v = Math.tanh(v * (1.6 + accEnv)) * amp * (0.32 + 0.12 * accent);
    sq = v;
    l[i] += sq * 0.92;
    r[i] += sq * 1.08;
  }
}

/* ── Sequence ──────────────────────────────────────────────────────────── */
const BASS_A = [[2, 0, 1.4, 1], [3, 0, 0.6, 0.55], [6, 0, 1.4, 1], [7, 12, 0.7, 0.7], [10, 0, 1.4, 1], [11, 0, 0.6, 0.5], [14, 12, 1.2, 0.85], [15, 0, 0.6, 0.6]];
const BASS_B = [[2, 0, 1.4, 1], [5, 0, 0.6, 0.55], [6, 12, 0.8, 0.8], [7, 0, 0.7, 0.6], [10, 0, 1.4, 1], [13, 12, 0.6, 0.65], [14, 0, 1.2, 0.9], [15, 7, 0.6, 0.6]];

const CONGA_A = [[3, "hi", 0.8], [5, "lo", 0.9], [7, "slap", 0.55], [10, "hi", 0.75], [11, "lo", 0.85], [14, "hi", 0.7]];
const CONGA_B = [[2, "lo", 0.8], [4, "slap", 0.5], [6, "hi", 0.85], [9, "lo", 0.9], [11, "hi", 0.7], [13, "slap", 0.5], [15, "hi", 0.75]];

const swing = (k) => (k % 2 ? STEP * 0.12 : 0);

for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  const t0 = bar * BAR;
  const root = rootAt(bar);
  const inSec = bar - sec.from;
  const odd = bar % 2;
  const nextSec = sectionAt((bar + 1) % BARS);
  const lastBarOfLoop = bar === BARS - 1;

  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (sec.kick) kick(tb, b === 0 ? 1 : 0.95);
    if (sec.clap && (b === 1 || b === 3)) clap(tb + 0.003);
    if (sec.open) hat(tb + BEAT / 2, true, 0.9, 0.15);
    if (sec.ride) ride(tb + BEAT / 2, 0.85);
    if (sec.hat) {
      const full = sec.busy || sec.ride;
      for (let k = 0; k < 4; k++) {
        if (k === 2 && sec.open) continue;
        const v = k % 2 ? 0.55 : 0.9;
        if (full || k % 2 === 1 || sec.name === "groove" || sec.name === "outro" || k === 0) hat(tb + k * STEP + swing(k), false, v, -0.2);
      }
    }
    if (sec.shaker) for (let k = 0; k < 4; k++) shaker(tb + k * STEP + swing(k), k === 2 ? 0.9 : 0.5);
  }

  if (sec.rim) {
    const full = sec.rim === 1;
    const list = odd ? [[7, 0.9], [11, 0.5], [15, 0.7]] : [[7, 0.9], [14, 0.6]];
    if (full || bar % 4 >= 2) for (const [st, v] of list) rim(t0 + st * STEP + swing(st), v * (full ? 1 : 0.7));
  }

  if (sec.conga && !(sec.conga === 0.5 && inSec < 4)) {
    const pat = odd ? CONGA_B : CONGA_A;
    for (const [st, kind, v] of pat) conga(t0 + st * STEP + swing(st), kind, v * (sec.conga === 0.5 ? 0.7 : 1), (st % 3 - 1) * 0.25);
  }

  if (sec.bass) {
    const pat = odd ? BASS_B : BASS_A;
    for (const [st, off, len, v] of pat) {
      // outro thins out into the intro
      if (sec.name === "outro" && inSec >= 6 && st >= 11) continue;
      bass(t0 + st * STEP + swing(st) * 0.5, root + off, STEP * len, v);
    }
  }

  if (sec.stab) {
    const notes = CHORDS[root];
    const stabSteps = odd ? [6, 11] : [3, 9];
    if (bar % 4 !== 3 || sec.name === "drop") for (const st of stabSteps) stab(t0 + st * STEP, notes, STEP * 1.1, sec.name === "drop" ? 0.9 : 0.7);
  }

  if (sec.pad && bar % 2 === 0) pad(t0, [55, 58, 62, 65, 69], BAR * 2, 1);

  if (sec.acid) {
    const pat = root === 31 ? (odd ? ACID_B : ACID_A) : ACID_C;
    for (let st = 0; st < 16; st++) {
      const e = pat[st];
      if (!e) continue;
      const [midi, accent, slide] = e;
      // let notes that feed a slide run into the next step
      let len = STEP * 0.85;
      const nxt = pat[st + 1];
      if (nxt && nxt[2]) len = STEP * 1.02;
      // in the break, thin the line: skip every other bar's second half
      if (sec.name === "break" && inSec < 4 && st >= 8 && odd) continue;
      // hard drop: nothing in the final sixteenth of the break
      if (sec.name === "break" && inSec === 7 && st >= 14) continue;
      acidEvents.push({ at: t0 + st * STEP + swing(st) * 0.5, midi, accent: !!accent, slide: !!slide, len });
    }
  }

  // break: sweep + roll in the last 4 bars (bars 28..31)
  if (sec.riser && inSec === 4) {
    riser(t0, BAR * 4 - STEP);
    snareRoll(t0);
  }
  // a small lift into the break and into the groove
  if (!sec.riser && nextSec.name === "break" && lastBarOfLoop === false && bar === sec.to - 1) riser(t0 + BAR / 2, BAR / 2);
}

renderAcid();

/* ── Mix ───────────────────────────────────────────────────────────────── */
const duck = new Float32Array(N).fill(1);
for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  if (!sec.kick) continue;
  for (let b = 0; b < 4; b++) {
    const s = Math.round((bar * BAR + b * BEAT) * SR);
    const len = Math.round(BEAT * SR);
    for (let n = 0; n < len && s + n < N; n++) {
      const tt = n / SR;
      duck[s + n] = Math.min(duck[s + n], 1 - 0.75 * Math.exp(-tt / 0.1));
    }
  }
}

const GAIN = { kick: 1, clap: 0.75, hat: 0.8, perc: 0.9, bass: 0.95, stab: 0.7, pad: 0.8, acid: 0.85, fx: 0.7 };
const DUCKED = new Set(["bass", "stab", "pad", "acid"]);
const DUCK_AMT = { acid: 0.6 };
const REVERB_SEND = { clap: 0.2, stab: 0.3, pad: 0.5, acid: 0.1, fx: 0.4, hat: 0.05, perc: 0.12 };
const DELAY_SEND = { stab: 0.35, acid: 0.18, perc: 0.1 };

const outL = new Float32Array(N), outR = new Float32Array(N);
const revInL = new Float32Array(N), revInR = new Float32Array(N);
const dlyInL = new Float32Array(N), dlyInR = new Float32Array(N);

for (const [name, [l, r]] of Object.entries(buses)) {
  const g = GAIN[name] ?? 1;
  const ducked = DUCKED.has(name);
  const amt = DUCK_AMT[name] ?? 1;
  const rs = REVERB_SEND[name] ?? 0;
  const ds = DELAY_SEND[name] ?? 0;
  for (let i = 0; i < N; i++) {
    const d = ducked ? 1 - (1 - duck[i]) * amt : 1;
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
    bl[p] = lpL(dlyInL[i] + yr * 0.42, 3000, 0.7, "lp");
    br[p] = lpR(dlyInR[i] + yl * 0.42, 3000, 0.7, "lp");
    outL[i] += yl * 0.8; outR[i] += yr * 0.8;
    revInL[i] += yl * 0.1; revInR[i] += yr * 0.1;
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

// Master: gentle high-pass, soft clip, normalise.
{
  const hl = svf(), hr = svf();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < LOOP_N; i++) {
      const a = hl(loopL[i], 28, 0.7, "hp"), b = hr(loopR[i], 28, 0.7, "hp");
      if (pass) { loopL[i] = Math.tanh(a * 1.8); loopR[i] = Math.tanh(b * 1.8); }
    }
  }
  let peak = 0;
  for (let i = 0; i < LOOP_N; i++) peak = Math.max(peak, Math.abs(loopL[i]), Math.abs(loopR[i]));
  const g = 0.85 / peak;
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

console.log(`wrote ${mp3} (${(total / SR).toFixed(2)} s, loop ${LOOP.toFixed(3)} s at ${BPM} BPM)`);
