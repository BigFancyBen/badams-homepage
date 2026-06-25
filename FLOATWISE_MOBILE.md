# FloatWise — Android app (Capacitor)

FloatWise can be built as a native **Android** app so it can record a float with
**background GPS** — the track keeps logging even when the phone is locked or in
a dry bag, which a browser/PWA cannot do (mobile browsers suspend JavaScript and
`watchPosition` shortly after the page is backgrounded).

The app bundles **only FloatWise** as an offline static export. The rest of the
homepage (commander, tutor-helper, etc.) stays a normal server-rendered web app
and is untouched by the mobile build.

## What you get

- **Live breadcrumb trail** — a dotted line on the map back to the put-in, with a
  heading arrow on the "you are here" dot showing direction of travel.
- **Float history** — each float is saved with put-in, take-out, total time,
  moving time, and distance. Replay any past float on the map.
- **Stop detection** — pull-overs / lunch breaks (staying put ~8+ min) are
  detected, marked on the map, and split out as "stopped" vs "moving" time.
- **Background tracking** (native only) — a foreground service keeps recording
  with the app backgrounded / screen off.

On the **web** the same UI works in a foreground-only mode (it requests a Screen
Wake Lock to keep the screen awake while recording), so you can try everything in
a browser — it just can't track with the screen off. The map shows a banner
making this clear.

## Architecture

| Piece | File |
| --- | --- |
| Platform-abstracted position stream + geo math | `app/floatwise/tracking.ts` |
| Recording state, trip persistence (localStorage) | `app/floatwise/hooks/useFloatRecorder.ts` |
| Map trail / markers / controls / history UI | `app/floatwise/components/MapView.tsx` |
| Static-export pipeline (FloatWise only) | `scripts/build-mobile.mjs` |
| Capacitor shell config | `capacitor.config.ts` |
| Android project (committed) | `android/` |

`build-mobile.mjs` temporarily swaps the real `app/` for a minimal one (root
layout + `globals.css` + the `floatwise` route + a root redirect), runs
`CAPACITOR=1 next build` (see `next.config.ts`) to produce `out/`, then always
restores `app/` and runs `cap sync`. Because no sibling routes are present, the
server-only routes (`api/*`, `sitemap`, `robots`) can't break the export.

## Prerequisites (your machine, not CI)

- Node ≥ 22 (already required by this repo)
- **Android Studio** (or the Android SDK + a JDK 17). The cloud/CI environment
  has no Android SDK, so the `.apk` must be built locally.

## Build & run

```bash
npm install                 # first time

# 1. Build the FloatWise static bundle and sync it into android/
npm run build:mobile

# 2. Open the Android project in Android Studio…
npm run cap:open:android
#    …then Run ▶ onto a device/emulator.

# — or build a debug APK from the CLI —
cd android && ./gradlew assembleDebug
# => android/app/build/outputs/apk/debug/app-debug.apk
```

Re-run `npm run build:mobile` whenever you change FloatWise web code; it
re-exports and re-syncs `android/`.

> The `android/` project is added with `npm run cap:add:android` (already done
> and committed). You only need that command if `android/` is ever deleted.

## Permissions

The required permissions are declared in
`android/app/src/main/AndroidManifest.xml`:

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- **`ACCESS_BACKGROUND_LOCATION`** — the key one; the user must grant
  **"Allow all the time"** for the float to keep recording in the background.
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`
- `POST_NOTIFICATIONS` (Android 13+) — for the persistent "recording" notice.

On first "Start float", the plugin requests location permission. Android only
offers "Allow all the time" via Settings on newer versions — if background fixes
stop, check Settings → Apps → FloatWise → Permissions → Location → *Allow all the
time*.

## Notes / limitations

- Background tracking is powered by
  [`@capacitor-community/background-geolocation`](https://github.com/capacitor-community/background-geolocation).
  It shows a persistent notification while recording (required by Android and by
  the plugin to keep the service alive). Battery use is higher while recording.
- This was scaffolded for **Android only**. Adding iOS later is
  `npm run cap:add:android`'s analogue (`npx cap add ios`) plus the Info.plist
  background-location keys — but iOS needs a Mac/Xcode to build.
- `out/` and `.mobile-app-stash/` are git-ignored build artifacts.
