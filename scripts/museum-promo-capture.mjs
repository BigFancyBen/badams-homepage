#!/usr/bin/env node
// Records /museum frame by frame on a virtual clock, for a promo video (the LinkedIn post).
//
// The page's clocks (performance.now, Date.now, requestAnimationFrame, timers of 50 ms and up,
// CSS/WAAPI animations and the song clock's AudioContext) are frozen and stepped by exactly
// 1/(fps*sub) s, so every captured frame sits at an exact video time however slowly the GPU and the
// screenshots go. The music is not recorded here: each frame logs the song clock it showed, and
// museum-promo-encode.mjs lays the mp3 in from those clocks.
//
// What it films: the poster and loading bar -> the hall appears -> music on -> Free roam on ->
// the drop -> hold S (walk backwards) until the entrance wall stops us -> a moment's hold -> stop.
//
//   node scripts/museum-promo-capture.mjs [--out out/museum-promo] [--url https://www.benadams.dev/museum]
//       [--seed 4] [--song after-hours] [--last velvet-rope] [--fps 30] [--sub 2] [--w 1920] [--h 1080]
//       [--free-at 2] [--walk-beats 2] [--hold-end 2] [--max 60] [--mbps 1.6] [--pace 200] [--jpeg]
//       [--song-only]          print which song this seed picks, then stop
//       [--until-ready 3]      stop this many seconds after the hall appears (a quick test run)
//
// Writes <out>/frames/NNNNN.png, <out>/log.json (per-frame clock, position and events) and
// <out>/console.txt. A full run takes about 3 minutes and ~1,400 frames.
//
// Needs Playwright's Chromium (npx playwright install chromium). On Windows it renders through
// ANGLE/D3D11 on the real GPU; without that, headless Chromium falls back to SwiftShader, which is
// far slower but still correct.
//
// Song pick: the page picks a song with Math.random, avoiding the one in localStorage
// museum-last-song. The script seeds Math.random and sets that key, so a seed always gives the same
// song. Seed 4 with --last velvet-rope gives after-hours; if the song list changes, try other seeds
// with --song-only.

import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const URL_ = arg('url', 'https://www.benadams.dev/museum');
const OUT = resolve(arg('out', join(ROOT, 'out', 'museum-promo')));
const FPS = Number(arg('fps', 30));
const SUB = Number(arg('sub', 2)); // game frames per captured frame (2 = the game runs at 60 Hz)
const W = Number(arg('w', 1920));
const H = Number(arg('h', 1080));
const SEED = Number(arg('seed', 4));
const LAST_SONG = arg('last', 'velvet-rope');
const WANT_SONG = arg('song', 'after-hours');
const SONG_ONLY = Boolean(arg('song-only', false));
const UNTIL_READY = arg('until-ready', null);
const MAX_SECONDS = Number(arg('max', 60));
const MBPS = Number(arg('mbps', 1.6)); // download throttle while the poster is up, MB/s
const PACE_MS = Number(arg('pace', 200)); // min real ms per captured frame while the poster is up
const FREE_AT = Number(arg('free-at', 2.0)); // s after the hall appears: click Free roam
const WALK_BEATS = Number(arg('walk-beats', 2)); // beats after the drop: press S
const HOLD_END = Number(arg('hold-end', 2.0)); // s to keep recording once the wall stops us
const JPEG = Boolean(arg('jpeg', false));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ page-side virtual clock */
function initVirtualTime({ seed, lastSong }) {
  if (window.top !== window) return;
  const P = performance;
  const realNow = P.now.bind(P);
  const realDateNow = Date.now.bind(Date);
  const realSetTimeout = window.setTimeout.bind(window);
  const realClearTimeout = window.clearTimeout.bind(window);
  const realSetInterval = window.setInterval.bind(window);
  const realClearInterval = window.clearInterval.bind(window);

  const vt = {
    base: realNow(),
    creep: 0,
    raf: new Map(),
    rafId: 0,
    timers: new Map(),
    timerId: 1e9,
    tracked: new WeakSet(),
    audioFlag: false,
    readyAt: null,
    buildAt: null,
    steps: 0,
    warnings: [],
  };
  const dateOffset = realDateNow() - vt.base;
  /* Frozen within a step, with a 10 ns creep per read so a spin-wait still terminates. */
  const vnow = () => {
    vt.creep += 1e-5;
    return vt.base + vt.creep;
  };
  Object.defineProperty(P, 'now', { value: vnow, configurable: true, writable: true });
  Date.now = () => Math.floor(dateOffset + vnow());

  window.requestAnimationFrame = function (cb) {
    const id = ++vt.rafId;
    vt.raf.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    vt.raf.delete(id);
  };

  /* Timers of 50 ms and up run on the virtual clock (UI hints, stall checks); shorter ones are yields and stay real. */
  window.setTimeout = function (fn, ms, ...a) {
    ms = Number(ms) || 0;
    if (ms < 50 || typeof fn !== 'function') return realSetTimeout(fn, ms, ...a);
    const id = ++vt.timerId;
    vt.timers.set(id, { due: vt.base + ms, fn, a, every: 0 });
    return id;
  };
  window.clearTimeout = function (id) {
    if (!vt.timers.delete(id)) realClearTimeout(id);
  };
  window.setInterval = function (fn, ms, ...a) {
    ms = Number(ms) || 0;
    if (ms < 50 || typeof fn !== 'function') return realSetInterval(fn, ms, ...a);
    const id = ++vt.timerId;
    vt.timers.set(id, { due: vt.base + ms, fn, a, every: ms });
    return id;
  };
  window.clearInterval = function (id) {
    if (!vt.timers.delete(id)) realClearInterval(id);
  };

  /* Deterministic Math.random (mulberry32), so the song pick is repeatable. */
  let s = seed >>> 0;
  Math.random = function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    localStorage.setItem('museum-last-song', lastSong);
  } catch {}

  /* The song clock's AudioContext (made inside the unmute click, flagged) reads virtual time. */
  const RealAC = window.AudioContext;
  if (RealAC) {
    const Wrapped = function (...a) {
      const ctx = new RealAC(...a);
      if (vt.audioFlag) {
        const t0 = vnow();
        Object.defineProperty(ctx, 'currentTime', { get: () => (vnow() - t0) / 1000, configurable: true });
        Object.defineProperty(ctx, 'outputLatency', { get: () => 0, configurable: true });
        Object.defineProperty(ctx, 'baseLatency', { get: () => 0, configurable: true });
        vt.virtualAudioAt = t0;
      }
      return ctx;
    };
    Wrapped.prototype = RealAC.prototype;
    window.AudioContext = Wrapped;
  }

  /* Note when the hall reports building and ready. */
  let bridgeVal;
  Object.defineProperty(window, 'museumBridge', {
    configurable: true,
    enumerable: true,
    get() {
      return bridgeVal;
    },
    set(v) {
      if (v && !v.__vtWrapped) {
        const onReady = v.onReady;
        v.onReady = function (...a) {
          if (vt.readyAt == null) vt.readyAt = vt.base;
          return onReady.apply(this, a);
        };
        const onBuild = v.onBuildProgress;
        v.onBuildProgress = function (...a) {
          if (vt.buildAt == null) vt.buildAt = vt.base;
          return onBuild.apply(this, a);
        };
        v.__vtWrapped = true;
      }
      bridgeVal = v;
    },
  });

  vt.step = function (dt) {
    if (vt.creep > dt * 0.5) vt.warnings.push(`creep ${vt.creep.toFixed(4)} ms at step ${vt.steps}`);
    vt.base += dt;
    vt.creep = 0;
    vt.steps++;
    for (let guard = 0; guard < 500; guard++) {
      let next = null;
      for (const e of vt.timers) if (e[1].due <= vt.base && (!next || e[1].due < next[1].due)) next = e;
      if (!next) break;
      const [id, t] = next;
      if (t.every) t.due += t.every;
      else vt.timers.delete(id);
      try {
        t.fn(...t.a);
      } catch (err) {
        console.error('[vt] timer', err);
      }
    }
    for (const a of document.getAnimations()) {
      try {
        if (!vt.tracked.has(a)) {
          vt.tracked.add(a);
          a.pause();
          a.currentTime = 0;
          continue;
        }
        if (a.playState === 'finished') continue;
        a.pause();
        a.currentTime = (a.currentTime || 0) + dt;
        const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(end) && a.currentTime >= end) a.finish();
      } catch {}
    }
    const q = vt.raf;
    vt.raf = new Map();
    for (const cb of q.values()) {
      try {
        cb(vt.base);
      } catch (err) {
        console.error('[vt] raf', err);
      }
    }
  };

  vt.info = function () {
    const b = window.museumBridge;
    let clock = null;
    let audible = null;
    try {
      clock = b ? b.time() : null;
      audible = b ? b.audible() : null;
    } catch {}
    const bar = document.querySelector('[role=progressbar]');
    return {
      vt: vt.base,
      readyAt: vt.readyAt,
      buildAt: vt.buildAt,
      clock,
      audible,
      pos: b ? b.debugPos || null : null,
      progress: bar ? Number(bar.getAttribute('aria-valuenow')) : null,
      steps: vt.steps,
    };
  };
  window.__vt = vt;
}

/* ------------------------------------------------------------------ run */
const framesDir = join(OUT, 'frames');
if (!SONG_ONLY) {
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
}

const browser = await chromium.launch({
  headless: true,
  args: [
    ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const consoleLines = [];
let songLine = null;
const urls = new Set();
const log = { args: { URL_, FPS, SUB, W, H, SEED, LAST_SONG, MBPS, PACE_MS, FREE_AT, WALK_BEATS, JPEG }, frames: [], events: [] };

try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(initVirtualTime, { seed: SEED, lastSong: LAST_SONG });
  const page = await context.newPage();
  page.on('console', (m) => {
    const t = m.text();
    consoleLines.push(`[${m.type()}] ${t}`);
    const mm = /\[museum\] song: (\S+) \((\d+(?:\.\d+)?) BPM\)/.exec(t);
    if (mm) songLine = { id: mm[1], bpm: Number(mm[2]) };
  });
  page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(mp3|wasm|pck|ogv)(\?|$)|museum\.js/.test(u)) urls.add(u);
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');

  /* Hold the two big downloads until the first frame is captured, so the bar starts at 0. */
  let releaseGate;
  const gate = new Promise((r) => (releaseGate = r));
  await page.route(/museum\.(wasm|pck)(\?|$)/, async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[role=progressbar]', { timeout: 30000 });
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 50 && !songLine; i++) await sleep(100);
  console.log('song:', songLine);
  if (SONG_ONLY) {
    await browser.close();
    process.exit(0);
  }
  if (!songLine || songLine.id !== WANT_SONG) throw new Error(`song is ${songLine?.id}, wanted ${WANT_SONG}; try another --seed`);

  const cues = JSON.parse(await page.evaluate(() => window.museumBridge.songCues()));
  const barSec = 240 / cues.bpm;
  const di = cues.sections.findIndex((s, k) => s.name === 'drop' && cues.sections[k - 1]?.name === 'break');
  const dropClock = cues.sections[di].from * barSec;
  const walkClock = dropClock + (WALK_BEATS * 60) / cues.bpm;
  log.song = { id: cues.id, bpm: cues.bpm, loopSeconds: cues.loopSeconds, loopStartSeconds: cues.loopStartSeconds, dropClock, walkClock };
  console.log('drop at clock', dropClock.toFixed(3), 'walk at clock', walkClock.toFixed(3));

  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 30,
    downloadThroughput: MBPS * 1024 * 1024,
    uploadThroughput: 4 * 1024 * 1024,
  });
  let throttled = true;

  const dt = 1000 / (FPS * SUB);
  const did = {};
  let frame = 0;
  const realStart = Date.now();
  let lastZ = null;
  let stillFrames = 0;

  for (;;) {
    const frameReal = Date.now();
    for (let s = 0; s < SUB; s++) await page.evaluate((d) => window.__vt.step(d), dt);
    const info = await page.evaluate(() => window.__vt.info());

    if (frame === 0) releaseGate();
    if (throttled && info.buildAt != null) {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      throttled = false;
      log.events.push({ frame, kind: 'unthrottle' });
    }

    if (info.readyAt != null) {
      const since = (info.vt - info.readyAt) / 1000;
      if (did.ready === undefined) {
        did.ready = frame;
        log.events.push({ frame, kind: 'ready', vt: info.readyAt });
      }
      if (did.unmute === undefined) {
        const ok = await page.evaluate(() => {
          const b = document.querySelector('button[aria-label="Play music"]');
          if (!b) return false;
          window.__vt.audioFlag = true;
          try {
            b.click();
          } finally {
            window.__vt.audioFlag = false;
          }
          return true;
        });
        did.unmute = frame;
        log.events.push({ frame, kind: 'unmute', ok });
      }
      if (did.free === undefined && since >= FREE_AT) {
        const ok = await page.evaluate(() => {
          const b = document.querySelector('button[title="Walk around freely"]');
          if (!b) return false;
          b.click();
          return true;
        });
        did.free = frame;
        log.events.push({ frame, kind: 'free', ok });
      }
      if (UNTIL_READY != null && since >= Number(UNTIL_READY)) break;
      if (did.walk === undefined && did.free !== undefined && info.clock != null && info.clock >= walkClock && info.clock < walkClock + 5) {
        await page.keyboard.down('s');
        did.walk = frame;
        log.events.push({ frame, kind: 'walk', clock: info.clock });
      }
      if (did.walk !== undefined && did.arrived === undefined && info.pos) {
        const z = Number(info.pos.split(',')[2]);
        if (lastZ !== null && Math.abs(z - lastZ) < 1e-4) stillFrames++;
        else stillFrames = 0;
        lastZ = z;
        if ((z > 11.0 && stillFrames >= 8) || z > 11.6) {
          did.arrived = frame;
          log.events.push({ frame, kind: 'arrived', z });
        }
      }
      if (did.arrived !== undefined && frame - did.arrived >= HOLD_END * FPS) {
        await page.keyboard.up('s');
        log.events.push({ frame, kind: 'end' });
        break;
      }
    }

    const shot = await cdp.send(
      'Page.captureScreenshot',
      JPEG ? { format: 'jpeg', quality: 95, optimizeForSpeed: true } : { format: 'png', optimizeForSpeed: true },
    );
    await writeFile(join(framesDir, `${String(frame).padStart(5, '0')}.${JPEG ? 'jpg' : 'png'}`), Buffer.from(shot.data, 'base64'));
    log.frames.push({ frame, t: frame / FPS, ...info });
    frame++;

    if (frame % 30 === 0) {
      const el = ((Date.now() - realStart) / 1000).toFixed(1);
      console.log(
        `frame ${frame} (${(frame / FPS).toFixed(1)} s video, ${el} s real) progress=${info.progress} ready=${info.readyAt != null} clock=${info.clock?.toFixed(2)} pos=${info.pos}`,
      );
    }
    if (frame >= MAX_SECONDS * FPS) {
      log.events.push({ frame, kind: 'max' });
      break;
    }
    /* While the poster is up, keep a steady real-time pace per frame so the throttled download fills the bar evenly. */
    if (info.readyAt == null) {
      const spent = Date.now() - frameReal;
      if (spent < PACE_MS) await sleep(PACE_MS - spent);
    }
  }
  log.warnings = await page.evaluate(() => window.__vt.warnings);
  log.frameCount = frame;
} finally {
  log.urls = [...urls];
  writeFileSync(join(OUT, 'log.json'), JSON.stringify(log, null, 1));
  writeFileSync(join(OUT, 'console.txt'), consoleLines.join('\n'));
  await browser.close();
}
console.log('done', log.frameCount, 'frames; events:', JSON.stringify(log.events));
console.log(`next: node scripts/museum-promo-encode.mjs --cap ${OUT} --from-ready 2`);
