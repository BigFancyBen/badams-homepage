/**
 * "Velvet Rope": an original 122 BPM deep house track in F minor for the
 * homepage museum. Warm FM electric piano, a rolling sub, swung 16th hats,
 * rimshot and shaker, and a breathy formant "vox" pad. Written note by note
 * here and synthesized from oscillators and noise. Nothing sampled, nothing
 * borrowed.
 *
 *   node scripts/museum-song/velvet-rope.mjs
 *
 * Writes:
 *   public/museum/songs/velvet-rope.mp3  [last bar] + 64-bar loop + [first bar]
 *   museum/songs/velvet-rope.json        the arrangement the lights read
 *
 * Needs ffmpeg on PATH for the MP3 encode. Deterministic.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "velvet-rope";
const TITLE = "Velvet Rope";

const SR = 44100;
const BPM = 122;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BEAT / 4; // a straight 16th
const SWING = 0.2; // odd 16ths land this fraction of a step late
const BARS = 64;
const LOOP = BARS * BAR;
const TAIL_BARS = 4;
const N = Math.round((BARS + TAIL_BARS) * BAR * SR);
const LOOP_N = Math.round(LOOP * SR);
const DRIVE = Number(process.env.DRIVE ?? 1.5);

/* ── Arrangement ───────────────────────────────────────────────────────── */
const SECTIONS = [
  { name: "intro", from: 0, to: 8, energy: 0.3, kick: 1, hat: 1, open: 0, clap: 0, rim: 0, shaker: 0, bass: 0, ep: 1, vox: 0, lead: 0 },
  { name: "groove", from: 8, to: 16, energy: 0.55, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, shaker: 0, bass: 1, ep: 2, vox: 0, lead: 0 },
  { name: "groove", from: 16, to: 24, energy: 0.7, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, shaker: 1, bass: 1, ep: 2, vox: 1, lead: 0 },
  { name: "break", from: 24, to: 32, energy: 0.22, kick: 0, hat: 0, open: 0, clap: 0, rim: 0, shaker: 0, bass: 0, ep: 3, vox: 2, lead: 0, riser: 1 },
  { name: "drop", from: 32, to: 48, energy: 1, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, shaker: 1, bass: 1, ep: 2, vox: 1, lead: 1 },
  { name: "drop", from: 48, to: 56, energy: 0.9, kick: 1, hat: 1, open: 1, clap: 1, rim: 1, shaker: 1, bass: 1, ep: 2, vox: 1, lead: 2 },
  { name: "outro", from: 56, to: 64, energy: 0.4, kick: 1, hat: 1, open: 0, clap: 0, rim: 1, shaker: 0, bass: 1, ep: 1, vox: 0, lead: 0 },
];
const sectionAt = (bar) => SECTIONS.find((s) => bar >= s.from && bar < s.to);

/* Two bars a chord: Fm9, Dbmaj9, Bbm9, Cm9. */
const CHORDS = [
  { root: 41, notes: [53, 56, 60, 63, 67] }, // F Ab C Eb G
  { root: 37, notes: [53, 56, 60, 63, 65] }, // F Ab C Eb F over Db
  { root: 34, notes: [58, 61, 65, 68, 72] }, // Bb Db F Ab C
  { root: 36, notes: [55, 58, 62, 63, 67] }, // G Bb D Eb G over C
];
const chordAt = (bar) => CHORDS[Math.floor(bar / 2) % 4];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** time of 16th-step k inside a bar starting at t0, with swing */
const sw = (t0, k) => t0 + (k + (k % 2 ? SWING : 0)) * STEP;

/* ── Utilities ─────────────────────────────────────────────────────────── */
let seed = 0x7e1e7;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const noise = () => rand() * 2 - 1;
const TAU = Math.PI * 2;

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

/* ── Instruments ───────────────────────────────────────────────────────── */
function kick(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.4 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const f = 46 + 95 * Math.exp(-tt / 0.028);
    ph += f / SR;
    const amp = Math.exp(-tt / 0.17) * (tt < 0.002 ? tt / 0.002 : 1);
    let v = Math.sin(TAU * ph) * amp;
    v += Math.exp(-tt / 0.003) * noise() * 0.15;
    v = Math.tanh(v * 1.5);
    add("kick", s + n, v * vel * 0.9);
  }
}

function softClap(t, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round(0.35 * SR);
  const f = svf(), f2 = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    let env = 0;
    for (const o of [0, 0.013, 0.027]) if (tt >= o) env = Math.max(env, 0.7 * Math.exp(-(tt - o) / 0.01));
    if (tt >= 0.034) env = Math.max(env, 0.6 * Math.exp(-(tt - 0.034) / 0.1));
    const v = f2(f(noise(), 1250, 1.1, "bp"), 3500, 0.7, "lp") * env * 2.0;
    add("clap", s + n, v * vel * 0.5, v * vel * 0.46);
  }
}

function rim(t, vel = 1, pan = 0.2) {
  const s = Math.round(t * SR);
  const len = Math.round(0.09 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.exp(-tt / 0.012);
    const tone = Math.sin(TAU * 1750 * tt) * 0.5 + Math.sin(TAU * 480 * tt) * 0.5 * Math.exp(-tt / 0.02);
    const v = (tone + f(noise(), 3200, 1.5, "bp") * 0.7) * env * vel * 0.3;
    add("rim", s + n, v * (1 - pan), v * (1 + pan));
  }
}

function hat(t, open, vel = 1, pan = 0) {
  const s = Math.round(t * SR);
  const decay = open ? 0.13 : 0.028;
  const len = Math.round(decay * 5 * SR);
  const f = svf(), lp = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const x = lp(f(noise(), 7200, 0.8, "hp"), 11000, 0.7, "lp");
    const v = x * Math.exp(-tt / decay) * (tt < 0.001 ? tt / 0.001 : 1) * vel * (open ? 0.2 : 0.17);
    add("hat", s + n, v * (1 - pan), v * (1 + pan));
  }
}

function shaker(t, vel, pan = 0) {
  const s = Math.round(t * SR);
  const len = Math.round(0.08 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const env = Math.min(1, tt / 0.014) * Math.exp(-tt / 0.024);
    const v = f(noise(), 5600, 1.1, "bp") * env * vel * 0.17;
    add("hat", s + n, v * (1 - pan), v * (1 + pan));
  }
}

/** Rolling sub: sine plus a filtered saw, with a short glide from the previous pitch. */
function bass(t, fromMidi, midi, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.05) * SR);
  const f = svf();
  let ph = 0, sph = 0;
  const f0 = hz(fromMidi), f1 = hz(midi);
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const g = Math.min(1, tt / 0.05);
    const freq = f0 * Math.pow(f1 / f0, g);
    const inc = freq / SR;
    ph = (ph + inc) % 1;
    sph += inc;
    const gate = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.015);
    const env = Math.min(1, tt / 0.006) * gate;
    const cutoff = 150 + 380 * Math.exp(-tt / 0.1);
    let v = f(saw(ph, inc), cutoff, 1.4, "lp") * 0.4 + Math.sin(TAU * sph) * 0.62;
    v = Math.tanh(v * 1.4) * env * vel * 0.62;
    add("bass", s + n, v);
  }
}

/** Rhodes-ish FM: a sine carrier with a body modulator at 1:1 and a short bell modulator at 14:1. */
function epiano(t, midi, dur, vel = 1, tremPhase = 0) {
  const s = Math.round(t * SR);
  const f = hz(midi);
  const decayT = 2.2 - Math.min(1.4, (midi - 48) * 0.035);
  const len = Math.round(Math.min(dur + 0.45, decayT * 3.2 + 0.45) * SR);
  let pc = 0, pm = 0, pb = 0;
  const bellOk = f * 14 < 9000 ? 1 : 0.3;
  const bodyIdx = 0.55 + 0.9 * vel;
  const lpf = svf();
  const t0abs = t;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    pc += f / SR; pm += f / SR; pb += (f * 14) / SR;
    const i1 = bodyIdx * Math.exp(-tt / 0.7) + 0.12;
    const i2 = 2.2 * vel * bellOk * Math.exp(-tt / 0.03);
    let y = Math.sin(TAU * pc + i1 * Math.sin(TAU * pm) + i2 * Math.sin(TAU * pb));
    // a touch of tine "growl" from the second partial
    y += 0.12 * Math.sin(TAU * 2 * pc + 0.8 * i1 * Math.sin(TAU * 2 * pm)) * Math.exp(-tt / 0.4);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.14);
    const env = Math.min(1, tt / 0.0025) * Math.exp(-tt / decayT) * rel;
    y = lpf(y, 2600 + 3200 * vel * Math.exp(-tt / 0.2), 0.7, "lp");
    const a = TAU * 4.4 * (t0abs + tt) + tremPhase;
    const l = 1 - 0.2 * (0.5 + 0.5 * Math.sin(a));
    const r = 1 - 0.2 * (0.5 + 0.5 * Math.sin(a + Math.PI));
    const g = env * vel * 0.13;
    add("ep", s + n, y * g * l, y * g * r);
  }
}

const VOWELS = {
  ah: [730, 1090, 2440],
  oo: [310, 870, 2250],
  eh: [530, 1840, 2480],
  oh: [570, 840, 2410],
};
/** Breathy vowel pad / stab: saws through three formant band-passes, plus air. */
function vox(t, notes, dur, vA, vB, vel = 1, attack = 0.04) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.6) * SR);
  const A = VOWELS[vA], B = VOWELS[vB];
  const fl = [svf(), svf(), svf()], fr = [svf(), svf(), svf()];
  const air = svf();
  const voices = notes.map((m) => ({ f: hz(m), ph: rand(), ph2: rand() }));
  const gains = [1, 0.7, 0.35];
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const vib = 1 + 0.004 * Math.sin(TAU * 5.3 * tt) * Math.min(1, tt / 0.4);
    let x = 0;
    for (const v of voices) {
      const inc = (v.f * vib) / SR;
      v.ph = (v.ph + inc) % 1;
      v.ph2 = (v.ph2 + inc * 1.006) % 1;
      x += saw(v.ph, inc) + saw(v.ph2, inc * 1.006);
    }
    x = x / voices.length * 0.5;
    x += air(noise(), 5200, 0.7, "bp") * 0.5; // breath
    const mix = Math.min(1, tt / Math.max(dur, 0.1));
    let l = 0, r = 0;
    for (let k = 0; k < 3; k++) {
      const fc = A[k] + (B[k] - A[k]) * mix;
      l += fl[k](x, fc, 7, "bp") * gains[k];
      r += fr[k](x, fc * 1.035, 7, "bp") * gains[k];
    }
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.25);
    const env = Math.min(1, tt / attack) * rel;
    const g = env * vel * 0.17;
    add("vox", s + n, l * g, r * g);
  }
}

/** Glassy FM lead with a little late vibrato. */
function lead(t, midi, dur, vel = 1) {
  const s = Math.round(t * SR);
  const len = Math.round((dur + 0.35) * SR);
  const f = hz(midi);
  let pc = 0, pm = 0;
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const vib = 1 + 0.0035 * Math.sin(TAU * 5.1 * tt) * Math.min(1, Math.max(0, tt - 0.12) / 0.2);
    pc += (f * vib) / SR; pm += (f * 2 * vib) / SR;
    const idx = 0.35 + 1.5 * Math.exp(-tt / 0.18);
    const y = Math.sin(TAU * pc + idx * Math.sin(TAU * pm)) + 0.2 * Math.sin(TAU * 3 * pc);
    const rel = tt < dur ? 1 : Math.exp(-(tt - dur) / 0.14);
    const env = Math.min(1, tt / 0.01) * rel * (0.75 + 0.25 * Math.exp(-tt / 0.3));
    const v = y * env * vel * 0.1;
    add("lead", s + n, v * 0.9, v * 1.1);
  }
}

function riser(t, dur) {
  const s = Math.round(t * SR);
  const len = Math.round(dur * SR);
  const f = svf(), hp = svf();
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const p = n / len;
    const v = f(noise(), 250 + 9500 * p * p, 2.6, "bp") * p * p * 0.4;
    ph += (180 * Math.pow(8, p)) / SR;
    const tone = Math.sin(TAU * ph) * p * p * 0.06;
    const x = hp(v, 150, 0.7, "hp") + tone;
    const wob = 0.3 * Math.sin(p * 60);
    add("fx", s + n, x * (1 - wob), x * (1 + wob));
  }
}

function snare(t, vel, decay = 0.06) {
  const s = Math.round(t * SR);
  const len = Math.round(Math.max(0.1, decay * 4) * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = (f(noise(), 2300, 1, "bp") * 1.5 + Math.sin(TAU * 185 * tt) * 0.4) * Math.exp(-tt / decay) * vel;
    add("snare", s + n, v * 0.5);
  }
}

function snareRoll(t0, bars) {
  // quarters, eighths, sixteenths, thirty-seconds: one density per bar
  const total = bars * 4;
  for (let b = 0; b < bars; b++) {
    const per = [1, 2, 4, 8][Math.min(3, b + (4 - bars))];
    const hits = 4 * per;
    for (let k = 0; k < hits; k++) {
      const p = (b * 4 + k / per) / total;
      snare(t0 + b * BAR + (k / per) * BEAT, 0.12 + 0.5 * p, per >= 8 ? 0.035 : 0.055);
    }
  }
}

function crash(t) {
  const s = Math.round(t * SR);
  const len = Math.round(1.8 * SR);
  const f = svf();
  for (let n = 0; n < len; n++) {
    const tt = n / SR;
    const v = f(noise(), 6500, 0.8, "hp") * Math.exp(-tt / 0.55) * 0.22;
    add("fx", s + n, v * 0.9, v * 1.1);
  }
  // sub boom under the downbeat
  const bl = Math.round(1.0 * SR);
  for (let n = 0; n < bl; n++) {
    const tt = n / SR;
    add("fx", s + n, Math.sin(TAU * 43 * tt) * Math.exp(-tt / 0.45) * 0.35);
  }
}

/* ── Sequence ──────────────────────────────────────────────────────────── */
// [step in 2 bars, length in steps, velocity]
const EP_COMP = [[0, 5, 1], [6, 3, 0.78], [10, 2, 0.7], [16, 5, 0.95], [22, 3, 0.78], [27, 4, 0.68]];
const EP_SPARSE = [[0, 12, 0.85], [16, 12, 0.8]];
const EP_SUSTAIN = [[0, 13, 0.9], [16, 13, 0.85]];
const BASS_PAT = [[0, 0, 2.6], [3, 0, 1.5], [6, 12, 1], [8, 0, 2.2], [11, 7, 1.4], [14, 10, 1.4]];
const LEAD_MOTIF = [
  [[0, 72, 3], [3, 75, 3], [6, 77, 6], [14, 75, 2], [16, 72, 4], [22, 68, 2], [24, 72, 6]],
  [[0, 77, 3], [3, 75, 3], [6, 72, 6], [14, 68, 2], [16, 72, 4], [20, 73, 4], [24, 75, 8]],
  [[0, 70, 3], [3, 73, 3], [6, 77, 6], [14, 73, 2], [16, 72, 4], [22, 68, 2], [24, 70, 6]],
  [[0, 72, 3], [3, 75, 3], [6, 79, 6], [14, 77, 2], [16, 75, 4], [20, 74, 4], [24, 72, 5], [29, 70, 3]],
];

for (let bar = 0; bar < BARS; bar++) {
  const sec = sectionAt(bar);
  const t0 = bar * BAR;
  const ch = chordAt(bar);
  const inSec = bar - sec.from;
  const barInPair = bar % 2;
  const pairIdx = Math.floor(bar / 2) % 4;
  const pairT0 = (bar - barInPair) * BAR;

  // drums
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    if (sec.kick) kick(tb, b === 0 ? 1 : 0.96);
    if (sec.clap && (b === 1 || b === 3)) softClap(tb + 0.004, 0.8);
    if (sec.open) hat(sw(t0, b * 4 + 2), true, 0.75, 0.15);
  }
  if (sec.hat) {
    const V = [0.5, 0.3, 0.0, 0.42];
    // outro thins its hats toward the loop point
    const thin = sec.name === "outro" && inSec >= 6;
    for (let k = 0; k < 16; k++) {
      const v = V[k % 4];
      if (v === 0 && sec.open) continue;
      const vv = v === 0 ? 0.6 : v;
      if (thin && k % 2) continue;
      hat(sw(t0, k), false, vv, -0.18 + (k % 8) * 0.01);
    }
  }
  if (sec.rim) for (const k of [3, 11, ...(bar % 4 === 3 ? [14] : [])]) rim(sw(t0, k), k === 14 ? 0.5 : 0.85);
  if (sec.shaker) for (let k = 0; k < 16; k++) shaker(sw(t0, k), k % 4 === 2 ? 0.9 : k % 2 ? 0.55 : 0.4, k % 2 ? 0.3 : -0.3);

  // bass
  if (sec.bass) {
    const fade = sec.name === "outro" && inSec >= 4;
    if (!fade) {
      let prev = ch.root;
      for (const [st, off, d] of BASS_PAT) {
        // the last pickup walks to the next chord's root on the bar before a change
        let midi = ch.root + off;
        if (st === 14 && barInPair === 1) midi = chordAt(bar + 2).root + 12;
        bass(sw(t0, st), prev, midi, d * STEP, st === 6 ? 0.8 : 1);
        prev = midi;
      }
    }
  }

  // electric piano comping on the two-bar chord
  if (sec.ep && barInPair === 0) {
    const pat = sec.ep === 1 ? EP_SPARSE : sec.ep === 3 ? EP_SUSTAIN : EP_COMP;
    for (const [st, d, vel] of pat) {
      const inIntro = sec.name === "intro";
      const brk = sec.name === "break" ? 0.5 : 1;
      const v = brk * (inIntro ? vel * (0.55 + 0.05 * inSec) : sec.name === "outro" ? vel * (0.9 - 0.04 * inSec) : vel);
      ch.notes.forEach((m, i) => epiano(sw(pairT0, st) + i * 0.007, m, d * STEP, v, i * 0.9));
    }
  }

  // vox
  if (sec.vox === 1 && barInPair === 0) {
    const up = ch.notes.slice(1).map((m) => m + 12);
    const vowelA = ["ah", "oh", "oo", "eh"][pairIdx];
    vox(sw(pairT0, 10), up, STEP * 2.4, vowelA, "oh", 0.9, 0.03);
    vox(sw(pairT0, 26), up, STEP * 3.2, "oo", "ah", 0.8, 0.03);
  }
  if (sec.vox === 2 && barInPair === 0) {
    const up = ch.notes.slice(1).map((m) => m + 12);
    vox(pairT0, up, BAR * 2 - 0.2, ["oo", "oh", "oo", "eh"][pairIdx], ["ah", "ah", "eh", "oh"][pairIdx], 0.5, 0.7);
  }

  // lead motif
  if (sec.lead && barInPair === 0) {
    for (const [st, midi, d] of LEAD_MOTIF[pairIdx]) {
      lead(sw(pairT0, st), midi, d * STEP * 0.92, 1);
      if (sec.lead === 2) lead(sw(pairT0, st), midi - 12, d * STEP * 0.92, 0.5);
    }
  }

  // build: riser and a snare roll across the break's last four bars
  if (sec.riser && inSec === 4) {
    riser(t0, BAR * 4);
    snareRoll(t0, 4);
  }
  if (sec.name === "drop" && inSec === 0 && sectionAt(bar - 1)?.name === "break") crash(t0);
}

/* ── Mix ───────────────────────────────────────────────────────────────── */
const duck = new Float32Array(N).fill(1);
for (let bar = 0; bar < BARS + TAIL_BARS; bar++) {
  const sec = sectionAt(bar % BARS);
  if (bar >= BARS || !sec.kick) continue;
  for (let b = 0; b < 4; b++) {
    const s = Math.round((bar * BAR + b * BEAT) * SR);
    const len = Math.round(BEAT * SR);
    for (let n = 0; n < len && s + n < N; n++) {
      const tt = n / SR;
      duck[s + n] = Math.min(duck[s + n], 1 - 0.75 * Math.exp(-tt / 0.1));
    }
  }
}

const GAIN = { kick: 1, clap: 0.8, rim: 0.8, hat: 0.85, snare: 0.8, bass: 0.95, ep: 1.0, vox: 0.9, lead: 0.85, fx: 0.6 };
const DUCK_AMT = { bass: 1, ep: 0.45, vox: 0.55, lead: 0.35 };
const REVERB_SEND = { clap: 0.3, rim: 0.2, snare: 0.25, ep: 0.22, vox: 0.5, lead: 0.3, fx: 0.4, hat: 0.05 };
const DELAY_SEND = { ep: 0.12, vox: 0.25, lead: 0.32 };

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
      c.lp = o * 0.65 + c.lp * 0.35;
      c.buf[c.p] = x + c.lp * 0.84;
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

// Master: high-pass, soft clip, normalise.
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
  const g = Number(process.env.PEAK ?? 0.9) / peak;
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
const tmp = join(tmpdir(), `museum-song-${ID}.wav`);
writeFileSync(tmp, wav);

const songsDir = join(ROOT, "public", "museum", "songs");
mkdirSync(songsDir, { recursive: true });
const mp3 = join(songsDir, `${ID}.mp3`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "160k",
  "-metadata", `title=${TITLE}`, "-metadata", "artist=Ben Adams", "-metadata", `comment=Rendered by scripts/museum-song/${ID}.mjs`,
  mp3]);

const cuesDir = join(ROOT, "museum", "songs");
mkdirSync(cuesDir, { recursive: true });
writeFileSync(join(cuesDir, `${ID}.json`), JSON.stringify({
  id: ID,
  title: TITLE,
  bpm: BPM,
  bars: BARS,
  loopSeconds: LOOP,
  loopStartSeconds: BAR,
  sections: SECTIONS.map(({ name, from, to, energy, kick: k }) => ({ name, from, to, energy, kick: !!k })),
}, null, 2) + "\n");

console.log(`wrote ${mp3} (${(total / SR).toFixed(2)} s, loop ${LOOP.toFixed(3)} s at ${BPM} BPM)`);
