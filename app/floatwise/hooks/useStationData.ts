import { useState, useCallback, useRef } from 'react';
import { GeoBounds } from '../utils';
import { fetchOpenMeteoStations, OpenMeteoStation } from '../sources/open-meteo';

/** How long a fetched station stays "fresh" before we'll query it again. */
const STATION_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Approximate spacing between sample points, in screen pixels. */
const FETCH_STEP_PX = 80;
/** Safety cap on how many points one request may sample. */
const MAX_FETCH_POINTS = 400;

/** Dedupe key for a grid cell — same cell returns identical coordinates. */
function stationKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/** Stable per-day cache key (local date, TZ-safe). */
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Leaflet web-mercator degrees-per-pixel at a given zoom. */
function degPerPixel(zoom: number): number {
  return 360 / (256 * Math.pow(2, zoom));
}

/** Expand a box by a fraction of its span on every side. */
function expandBounds(b: GeoBounds, frac: number): GeoBounds {
  const latPad = (b.maxLat - b.minLat) * frac;
  const lonPad = (b.maxLon - b.minLon) * frac;
  return {
    minLat: b.minLat - latPad,
    maxLat: b.maxLat + latPad,
    minLon: b.minLon - lonPad,
    maxLon: b.maxLon + lonPad,
  };
}

function inBounds(lat: number, lon: number, b: GeoBounds): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

interface Viewport {
  bounds: GeoBounds;
  zoom: number;
}

interface CachedStation {
  station: OpenMeteoStation;
  ts: number;
}

/**
 * Fetches the actual Open-Meteo grid cells ("weather stations") for the current
 * map viewport, with a cell-based cache so we never re-query data we already
 * have.
 *
 * Sampling snaps to a stable per-zoom grid. Before fetching, every candidate
 * grid bucket is skipped if we already hold a fresh station for it, or if we
 * queried that bucket recently — so panning across, and zooming back into,
 * already-explored areas costs no network requests. Only genuinely new buckets
 * (e.g. gaps revealed by zooming in) are fetched, and cached cells refresh once
 * they pass the TTL.
 *
 * Nothing is interpolated — each station is a raw source data point.
 */
export function useStationData() {
  const [stations, setStations] = useState<OpenMeteoStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Per-day cache of stations keyed by grid-cell coordinate, with timestamps.
  const cacheRef = useRef<Map<string, Map<string, CachedStation>>>(new Map());
  // Per-day record of which sample buckets we've already queried (key includes
  // zoom), with timestamps, so empty buckets aren't re-queried every move.
  const coveredRef = useRef<Map<string, Map<string, number>>>(new Map());
  // Guards against out-of-order responses toggling loading state incorrectly.
  const reqIdRef = useRef(0);

  const fetchStations = useCallback(async (viewport: Viewport, date: Date) => {
    const { bounds, zoom } = viewport;
    const day = dateKey(date);
    const now = Date.now();

    const cache = cacheRef.current.get(day) ?? new Map<string, CachedStation>();
    cacheRef.current.set(day, cache);
    const covered = coveredRef.current.get(day) ?? new Map<string, number>();
    coveredRef.current.set(day, covered);

    // Stations to show: everything cached for this day within the viewport.
    const displayBounds = expandBounds(bounds, 0.25);
    const visibleFromCache = () =>
      Array.from(cache.values())
        .map((e) => e.station)
        .filter((s) => inBounds(s.lat, s.lon, displayBounds));

    const step = FETCH_STEP_PX * degPerPixel(zoom);
    if (!isFinite(step) || step <= 0) {
      setStations(visibleFromCache());
      return;
    }

    // Buckets we already have a fresh station for — no need to re-query them.
    const cachedBuckets = new Set<string>();
    for (const { station, ts } of cache.values()) {
      if (now - ts > STATION_TTL_MS) continue;
      cachedBuckets.add(
        `${Math.round(station.lat / step)},${Math.round(station.lon / step)}`
      );
    }

    // Walk the snapped grid over the (slightly padded) viewport and collect only
    // the buckets we neither hold nor queried recently.
    const fetchArea = expandBounds(bounds, 0.1);
    const iLatMin = Math.floor(fetchArea.minLat / step);
    const iLatMax = Math.ceil(fetchArea.maxLat / step);
    const iLonMin = Math.floor(fetchArea.minLon / step);
    const iLonMax = Math.ceil(fetchArea.maxLon / step);

    const toFetch: { lat: number; lon: number }[] = [];
    const fetchedBucketKeys: string[] = [];
    outer: for (let i = iLatMin; i <= iLatMax; i++) {
      for (let j = iLonMin; j <= iLonMax; j++) {
        const bucket = `${i},${j}`;
        if (cachedBuckets.has(bucket)) continue;
        const coveredKey = `${zoom}|${bucket}`;
        const cts = covered.get(coveredKey);
        if (cts !== undefined && now - cts < STATION_TTL_MS) continue;
        toFetch.push({ lat: i * step, lon: j * step });
        fetchedBucketKeys.push(coveredKey);
        if (toFetch.length >= MAX_FETCH_POINTS) break outer;
      }
    }

    if (toFetch.length === 0) {
      // Everything in view is already cached / recently queried — no network.
      setStations(visibleFromCache());
      return;
    }

    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(undefined);

    try {
      const results = await fetchOpenMeteoStations(toFetch, date);

      const fetchedAt = Date.now();
      for (const station of results) {
        if (
          typeof station.lat !== 'number' ||
          typeof station.lon !== 'number' ||
          station.hours.length === 0
        ) {
          continue;
        }
        cache.set(stationKey(station.lat, station.lon), { station, ts: fetchedAt });
      }
      // Mark the queried buckets covered (even empty ones) to avoid re-querying.
      for (const key of fetchedBucketKeys) covered.set(key, fetchedAt);

      setStations(visibleFromCache());
    } catch (err) {
      console.error('Error fetching weather stations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weather stations');
      // Keep any cached stations visible rather than blanking the map.
      setStations(visibleFromCache());
    } finally {
      // Only the latest in-flight request clears the loading indicator.
      if (reqId === reqIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  return { stations, isLoading, error, fetchStations };
}
