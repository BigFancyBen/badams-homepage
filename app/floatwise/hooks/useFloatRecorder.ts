import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloatTrip, TrackPoint } from "../types";
import {
  StopWatch,
  bearingDegrees,
  isNativeTracking,
  startPositionWatch,
  summarizeTrip,
} from "../tracking";

const TRIPS_KEY = "floatwise-trips";

// Light throttle for the web watcher, which can emit many fixes/second: skip a
// new point unless it's moved a bit or enough time has passed. (Native already
// throttles via distanceFilter.)
const MIN_GAP_METERS = 5;
const MIN_GAP_MS = 4000;

function metersBetween(a: TrackPoint, b: TrackPoint): number {
  // Cheap equirectangular approximation — fine for the throttle check.
  const x = (toRad(b.lon) - toRad(a.lon)) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat) - toRad(a.lat);
  return Math.sqrt(x * x + y * y) * 6_371_000;
}
const toRad = (d: number) => (d * Math.PI) / 180;

function loadTrips(): FloatTrip[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FloatTrip[]) : [];
  } catch (err) {
    console.error("Error loading float trips:", err);
    return [];
  }
}

/**
 * Records floats: streams position fixes into a live breadcrumb track, derives
 * live stats (distance / moving / stopped), and persists completed trips
 * (put-in, take-out, duration, stops) to localStorage.
 */
export function useFloatRecorder() {
  // Load persisted trips lazily on first render. This hook only runs in the
  // client-only (ssr:false) MapView, so localStorage is available here.
  const [trips, setTrips] = useState<FloatTrip[]>(() =>
    typeof window === "undefined" ? [] : loadTrips()
  );
  const [isRecording, setIsRecording] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [latest, setLatest] = useState<TrackPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopWatchRef = useRef<StopWatch | null>(null);
  const startedAtRef = useRef<number>(0);
  // Mirror of isRecording so the async start() can detect a race with stop().
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Persist trips whenever they change. The first run rewrites the freshly
  // loaded value (a harmless no-op).
  useEffect(() => {
    try {
      localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
    } catch (err) {
      console.error("Error saving float trips:", err);
    }
  }, [trips]);

  const handleFix = useCallback((fix: TrackPoint) => {
    setAcquiring(false);
    setLatest(fix);
    setTrack((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        metersBetween(last, fix) < MIN_GAP_METERS &&
        fix.t - last.t < MIN_GAP_MS
      ) {
        return prev; // too close in space and time — drop as jitter
      }
      return [...prev, fix];
    });
  }, []);

  const stop = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    setIsRecording(false);
    setAcquiring(false);

    setTrack((finalTrack) => {
      if (finalTrack.length >= 2) {
        const summary = summarizeTrip(finalTrack);
        const trip: FloatTrip = {
          id: `${startedAtRef.current}`,
          startedAt: startedAtRef.current,
          endedAt: finalTrack[finalTrack.length - 1].t,
          track: finalTrack,
          putIn: { lat: finalTrack[0].lat, lon: finalTrack[0].lon },
          takeOut: {
            lat: finalTrack[finalTrack.length - 1].lat,
            lon: finalTrack[finalTrack.length - 1].lon,
          },
          ...summary,
        };
        setTrips((prev) => [trip, ...prev]);
      }
      return []; // clear the live track
    });
  }, []);

  const start = useCallback(async () => {
    if (stopWatchRef.current) return; // already recording
    setError(null);
    setTrack([]);
    setLatest(null);
    setAcquiring(true);
    setIsRecording(true);
    startedAtRef.current = Date.now();
    try {
      const stopWatch = await startPositionWatch(handleFix, (msg) =>
        setError(msg)
      );
      // If the user stopped before the async watcher resolved, tear it down.
      if (!stopWatchRef.current && isRecordingRef.current) {
        stopWatchRef.current = stopWatch;
      } else {
        stopWatch();
      }
    } catch {
      setError("Couldn't start location tracking.");
      setIsRecording(false);
      setAcquiring(false);
    }
  }, [handleFix]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else void start();
  }, [isRecording, start, stop]);

  // Stop the watch if the component unmounts mid-recording (e.g. tab switch).
  useEffect(() => {
    return () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
    };
  }, []);

  const deleteTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const renameTrip = useCallback((id: string, name: string) => {
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  // Live stats for the in-progress float.
  const liveSummary = useMemo(() => summarizeTrip(track), [track]);

  // Current heading: prefer the device-reported one; else derive from the last
  // two recorded points.
  const heading = useMemo<number | null>(() => {
    if (latest?.heading != null && !Number.isNaN(latest.heading)) {
      return latest.heading;
    }
    if (track.length >= 2) {
      return bearingDegrees(track[track.length - 2], track[track.length - 1]);
    }
    return null;
  }, [latest, track]);

  return {
    trips,
    isRecording,
    acquiring,
    track,
    latest,
    heading,
    liveSummary,
    error,
    isNative: isNativeTracking(),
    start,
    stop,
    toggle,
    deleteTrip,
    renameTrip,
  };
}
