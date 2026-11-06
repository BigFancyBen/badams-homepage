#!/usr/bin/env node
// Render named still frames of the Godot museum scene, one PNG per shot.
//
//   node scripts/museum-frames.mjs [--project <godot project dir>] --out <dir> [--shots entrance,bay3,plaque3,marquee,stage,stage_drop,hall_drop]
//                                  [--res 1280x720] [--frames 20] [--extra "--tier=mobile"]
//
// Shots are defined in GDScript (museum/scripts/layout.gd, applied by main.gd via --shot=<name>) so
// they are identical everywhere: entrance (drop, t=70), break (t=50), bayN / plaqueN (1-based exhibit
// number), marquee, stage, stage_drop, hall_drop. Portrait: --res 720x1280.
//
// Each shot runs a windowed Godot through the machine queue (prognosticator's godot-queued.mjs) with
// --write-movie and a fixed song time and camera, keeps only the last frame as <out>/<shot>.png and
// deletes the rest.
//
// Env: GODOT_BIN (default: the shared tools copy), GODOT_QUEUED (path to godot-queued.mjs).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, copyFileSync, rmSync, rmdirSync, symlinkSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let PROJECT = join(ROOT, 'museum');
const DEFAULT_SHOTS = ['entrance', 'bay3', 'plaque3', 'marquee', 'stage', 'stage_drop', 'hall_drop'];

const GODOT_BIN =
  process.env.GODOT_BIN ?? 'C:/Users/Tango/Documents/projects/_tools/godot/Godot_v4.7.1-stable_win64_console.exe';
const QUEUED =
  process.env.GODOT_QUEUED ?? 'C:/Users/Tango/Documents/projects/prognosticator/scripts/godot-queued.mjs';

function parseArgs(argv) {
  const opts = { out: null, shots: DEFAULT_SHOTS, res: '1280x720', frames: 150, extra: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--out') opts.out = val();
    else if (a === '--shots') opts.shots = val().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--res') opts.res = val();
    else if (a === '--frames') opts.frames = Number(val());
    else if (a === '--extra') opts.extra = val().split(/\s+/).filter(Boolean); // user args after `--`, e.g. --tier=mobile
    else if (a === '--project') PROJECT = val();
    else if (a === '-h' || a === '--help') opts.help = true;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help || !opts.out) {
  console.error('usage: node scripts/museum-frames.mjs --out <dir> [--shots a,b,c] [--res 1280x720] [--frames 20]');
  process.exit(opts.help ? 0 : 2);
}
if (!/^\d+x\d+$/.test(opts.res)) {
  console.error(`--res must look like 1280x720, got: ${opts.res}`);
  process.exit(2);
}
if (!existsSync(GODOT_BIN)) {
  console.error(`GODOT_BIN does not exist: ${GODOT_BIN}`);
  process.exit(1);
}
if (!existsSync(QUEUED)) {
  console.error(`godot-queued.mjs not found: ${QUEUED}`);
  process.exit(1);
}

const out = resolve(opts.out);
mkdirSync(out, { recursive: true });

// Run against a staged copy of the project dir: directories are junctions to the real ones, files
// are copies, with two differences. museum/override.cfg is left out (it can pin the window size and
// beat --resolution), and project.godot gets the requested size as its base viewport size (the movie
// writer records the viewport, not the window).
const [resW, resH] = opts.res.split('x');
const staged = mkdtempSync(join(tmpdir(), 'museum-proj-'));
const projectDir = staged;
for (const name of readdirSync(PROJECT)) {
  if (name === 'override.cfg') continue;
  const src = join(PROJECT, name);
  if (statSync(src).isDirectory()) symlinkSync(src, join(staged, name), 'junction');
  else if (name === 'project.godot') {
    const txt = readFileSync(src, 'utf8')
      .replace(/^window\/size\/viewport_width=.*$/m, `window/size/viewport_width=${resW}`)
      .replace(/^window\/size\/viewport_height=.*$/m, `window/size/viewport_height=${resH}`);
    writeFileSync(join(staged, name), txt);
  } else copyFileSync(src, join(staged, name));
}
function cleanupStage() {
  for (const name of readdirSync(staged)) {
    const p = join(staged, name);
    if (statSync(join(PROJECT, name), { throwIfNoEntry: false })?.isDirectory()) rmdirSync(p); // drops the junction only
  }
  rmSync(staged, { recursive: true, force: true });
}

function run(shot) {
  const tmp = mkdtempSync(join(tmpdir(), `museum-${shot}-`));
  const args = [
    QUEUED,
    '--path', projectDir,
    '--rendering-driver', 'opengl3',
    '--resolution', opts.res,
    '--write-movie', join(tmp, 'frame.png'),
    '--fixed-fps', '30',
    '--quit-after', String(opts.frames),
    '--', `--shot=${shot}`, ...opts.extra,
  ];
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, GODOT_BIN },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('close', (code) => {
      const frames = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
      let ok = false;
      if (frames.length) {
        copyFileSync(join(tmp, frames[frames.length - 1]), join(out, `${shot}.png`));
        ok = true;
      }
      rmSync(tmp, { recursive: true, force: true });
      const problems = log.split('\n').filter((l) => /ERROR|WARNING|SCRIPT ERROR/.test(l));
      done({ shot, code, ok, problems });
    });
  });
}

let failed = 0;
for (const shot of opts.shots) {
  const r = await run(shot);
  if (r.ok) console.log(`${shot}: ${join(out, `${shot}.png`)}`);
  else {
    failed++;
    console.error(`${shot}: no frame written (godot exit ${r.code})`);
  }
  for (const p of r.problems) console.error(`  ${p.trim()}`);
}
cleanupStage();
process.exit(failed ? 1 : 0);
