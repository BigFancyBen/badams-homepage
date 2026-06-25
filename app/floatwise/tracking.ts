import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location as BgLocation,
} from "@capacitor-community/background-geolocation";
import { FloatStop, TrackPoint } from "./types";

// The community plugin ships native code + types only; the JS binding is created
// here. registerPlugin is lazy and safe to call on web (calls just reject).
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  "BackgroundGeolocation"
);

/**
 * Float tracking primitives.
 *
 * This module has two jobs:
 *  1. `startPositionWatch` — a platform-abstracted location stream. On a
 *     Capacitor native build it uses @capacitor-community/background-geolocation
 *     (a foreground service that keeps recording with the screen off / app
 *     backgrounded). On the web it falls back to navigator.geolocation +
 *     Screen Wake Lock (foreground only — see FLOATWISE_MOBILE.md for why the
 *     web build can't track in the background).
 *  2. Pure geometry helpers (distance, bearing, stop detection, summary) used to
 *     turn a raw breadcrumb track into trip stats.
 */

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

type LatLon = { lat: number; lon: number };

/** Great-circle distance between two coordinates, in meters. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (degrees from true north, 0–360) from `a` to `b`. */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface StopDetectionOptions {
  /** A run of fixes staying within this radius (m) is a candidate stop. */
  radiusMeters?: number;
  /** A candidate must last at least this long (ms) to count as a stop. */
  minDurationMs?: number;
}

const DEFAULT_STOP_OPTS: Required<StopDetectionOptions> = {
  radiusMeters: 40,
  minDurationMs: 8 * 60 * 1000, // 8 minutes — long enough to skip eddy-spins
};

/**
 * Find pull-overs / lunch breaks in a track: contiguous runs of fixes that stay
 * within `radiusMeters` of their anchor for at least `minDurationMs`. Anchors on
 * a point and greedily extends the cluster; a moving paddler advances one fix at
 * a time (no stop), a stationary one grows a cluster that gets recorded.
 */
export function detectStops(
  track: TrackPoint[],
  options: StopDetectionOptions = {}
): FloatStop[] {
  const { radiusMeters, minDurationMs } = { ...DEFAULT_STOP_OPTS, ...options };
  const stops: FloatStop[] = [];
  let i = 0;
  while (i < track.length) {
    let j = i + 1;
    while (
      j < track.length &&
      haversineMeters(track[i], track[j]) <= radiusMeters
    ) {
      j++;
    }
    const last = j - 1; // inclusive end of the cluster anchored at i
    const durationMs = track[last].t - track[i].t;
    if (last > i && durationMs >= minDurationMs) {
      let latSum = 0;
      let lonSum = 0;
      for (let k = i; k <= last; k++) {
        latSum += track[k].lat;
        lonSum += track[k].lon;
      }
      const count = last - i + 1;
      stops.push({
        lat: latSum / count,
        lon: lonSum / count,
        startT: track[i].t,
        endT: track[last].t,
        durationMs,
      });
      i = j; // skip past the whole stop
    } else {
      i++;
    }
  }
  return stops;
}

export interface TripSummary {
  distanceMeters: number;
  totalMs: number;
  movingMs: number;
  stoppedMs: number;
  stops: FloatStop[];
}

/** Jitter floor: segments shorter than this (m) are treated as GPS noise. */
const MIN_SEGMENT_M = 3;

/** Roll a raw breadcrumb track up into distance / time / stop stats. */
export function summarizeTrip(
  track: TrackPoint[],
  options: StopDetectionOptions = {}
): TripSummary {
  let distanceMeters = 0;
  for (let k = 1; k < track.length; k++) {
    const d = haversineMeters(track[k - 1], track[k]);
    if (d >= MIN_SEGMENT_M) distanceMeters += d;
  }
  const stops = detectStops(track, options);
  const stoppedMs = stops.reduce((sum, s) => sum + s.durationMs, 0);
  const totalMs =
    track.length >= 2 ? track[track.length - 1].t - track[0].t : 0;
  const movingMs = Math.max(0, totalMs - stoppedMs);
  return { distanceMeters, totalMs, movingMs, stoppedMs, stops };
}

/** True when running inside the Capacitor native shell (vs a browser). */
export function isNativeTracking(): boolean {
  return Capacitor.isNativePlatform();
}

export type StopWatch = () => void;

/**
 * Start streaming position fixes. Resolves to a function that stops the watch
 * and releases any wake lock. `onError` receives a human-readable message;
 * transient errors don't stop the watch (the underlying APIs keep retrying).
 */
export async function startPositionWatch(
  onFix: (fix: TrackPoint) => void,
  onError: (message: string) => void
): Promise<StopWatch> {
  if (isNativeTracking()) {
    const id = await BackgroundGeolocation.addWatcher(
      {
        // Defining backgroundMessage promotes the watcher to a foreground
        // service, so fixes keep arriving with the app backgrounded.
        backgroundMessage: "Recording your float — tap to return to FloatWise.",
        backgroundTitle: "FloatWise is tracking your float",
        requestPermissions: true,
        stale: false,
        distanceFilter: 10, // meters between fixes; smooths the trail
      },
      (location: BgLocation | undefined, error: CallbackError | undefined) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            onError(
              "Location permission denied. Enable “Allow all the time” in Settings to record floats."
            );
          }
          return;
        }
        if (!location) return;
        onFix({
          lat: location.latitude,
          lon: location.longitude,
          t: location.time ?? Date.now(),
          accuracy: location.accuracy ?? undefined,
          speed: location.speed ?? null,
          heading: location.bearing ?? null,
        });
      }
    );
    return () => {
      void BackgroundGeolocation.removeWatcher({ id });
    };
  }

  // Web fallback: foreground-only. Keep the screen awake while it lasts.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("Location isn't supported by this browser.");
    return () => {};
  }

  let wakeLock: WakeLockSentinel | null = null;
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Non-fatal — tracking still works, the screen just may sleep.
    }
  };
  // Re-acquire the lock when the tab becomes visible again.
  const onVisibility = () => {
    if (document.visibilityState === "visible" && wakeLock === null) {
      void requestWakeLock();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  void requestWakeLock();

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, speed, heading } =
        position.coords;
      onFix({
        lat: latitude,
        lon: longitude,
        t: position.timestamp,
        accuracy,
        speed: speed ?? null,
        heading: heading ?? null,
      });
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        onError("Location permission denied.");
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        onError("Location unavailable — searching…");
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    document.removeEventListener("visibilitychange", onVisibility);
    void wakeLock?.release();
    wakeLock = null;
  };
}
