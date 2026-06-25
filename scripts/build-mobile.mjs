#!/usr/bin/env node
/**
 * Mobile (Capacitor) build pipeline — FloatWise only.
 *
 * The homepage is a server-rendered Next app with API routes (Ably, archidekt)
 * and dynamic routes (sitemap, robots) that are incompatible with
 * `output: "export"`. We only want FloatWise as an offline Android app, so this
 * script temporarily swaps the real `app/` directory for a *minimal* one that
 * contains nothing but:
 *
 *   - the root layout + globals.css (FloatWise's only shared dependencies)
 *   - the self-contained `app/floatwise` route
 *   - a tiny root page that redirects to /floatwise/
 *
 * With no sibling routes present, nothing can break the static export. We build
 * with CAPACITOR=1 (see next.config.ts) to produce `out/`, then ALWAYS restore
 * the original `app/` — even if the build fails — and finally `cap sync` if an
 * Android platform has been added.
 *
 * Usage: node scripts/build-mobile.mjs   (or: npm run build:mobile)
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "app");
const STASH = join(ROOT, ".mobile-app-stash");

// Files/dirs copied from the real app into the minimal mobile app.
const KEEP = ["layout.tsx", "globals.css", "favicon.ico", "floatwise"];

// Root page for the bundle: Capacitor loads index.html, which bounces straight
// to the FloatWise route. (trailingSlash:true => /floatwise/ resolves to
// out/floatwise/index.html, whose assets live under /_next and resolve fine.)
const REDIRECT_PAGE = `"use client";

import { useEffect } from "react";

// The mobile bundle ships only FloatWise; the root just forwards to it.
export default function MobileRoot() {
  useEffect(() => {
    window.location.replace("/floatwise/");
  }, []);
  return null;
}
`;

function log(msg) {
  console.log(`\x1b[36m[build-mobile]\x1b[0m ${msg}`);
}

function buildMinimalApp() {
  mkdirSync(APP, { recursive: true });
  for (const name of KEEP) {
    const from = join(STASH, name);
    if (!existsSync(from)) {
      if (name === "favicon.ico") continue; // optional
      throw new Error(`Expected ${from} to exist in the original app/`);
    }
    cpSync(from, join(APP, name), { recursive: true });
  }
  writeFileSync(join(APP, "page.tsx"), REDIRECT_PAGE);
}

function restoreApp() {
  if (existsSync(STASH)) {
    rmSync(APP, { recursive: true, force: true });
    renameSync(STASH, APP);
    log("restored original app/");
  }
}

function main() {
  if (existsSync(STASH)) {
    throw new Error(
      `${STASH} already exists — a previous mobile build was interrupted. ` +
        `Restore it manually: rm -rf app && mv .mobile-app-stash app`
    );
  }

  // Clean any prior export so stale routes can't linger in the bundle.
  rmSync(join(ROOT, "out"), { recursive: true, force: true });

  log("isolating FloatWise into a minimal app/ …");
  renameSync(APP, STASH);
  try {
    buildMinimalApp();
    log("running static export (CAPACITOR=1 next build) …");
    const nextBin = join(
      ROOT,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next"
    );
    execFileSync(nextBin, ["build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, CAPACITOR: "1" },
    });
  } finally {
    restoreApp();
  }

  log("export complete → out/");

  if (existsSync(join(ROOT, "android"))) {
    log("syncing Android project (cap sync android) …");
    execFileSync("npx", ["cap", "sync", "android"], {
      cwd: ROOT,
      stdio: "inherit",
    });
  } else {
    log(
      "no android/ project yet — run `npx cap add android` once, then re-run."
    );
  }

  log("done.");
}

try {
  main();
} catch (err) {
  console.error(`\x1b[31m[build-mobile] ${err.message}\x1b[0m`);
  // Safety net in case we threw before the inner finally restored app/.
  restoreApp();
  process.exit(1);
}
