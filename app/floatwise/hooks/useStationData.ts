import { useState, useCallback, useRef } from 'react';
import { GeoBounds } from '../utils';
import { fetchOpenMeteoForecasts } from '../sources/open-meteo';
import { fetchSynopticStations, SynopticStation } from '../sources/synoptic';
import { WeatherStation } from '../types';

/** How long a station's forecast stays "fresh" before we'll re-fetch it. */
const FORECAST_TTL_MS = 60 * 60 * 1000; // 1 hour
/** How long fetched station metadata for an area stays usable. */
const META_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
/** Max stations we attach forecasts to / show for one viewport. */
const MAX_STATIONS = 250;

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

function contains(outer: GeoBounds, inner: GeoBounds): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLon >= outer.minLon &&
    inner.maxLon <= outer.maxLon
  );
}

/**
 * Thin a station list to roughly one per `bucketDeg` grid cell, so we never
 * attach forecasts to (or render) more stations than needed at the current
 * zoom. Mirrors the map's display decimation.
 */
function thinByGrid(
  stations: SynopticStation[],
  bucketDeg: number,
  cap: number
): SynopticStation[] {
  if (!isFinite(bucketDeg) || bucketDeg <= 0) return stations.slice(0, cap);
  const seen = new Set<string>();
  const out: SynopticStation[] = [];
  for (const s of stations) {
    const key = `${Math.round(s.lat / bucketDeg)},${Math.round(s.lon / bucketDeg)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

interface Viewport {
  bounds: GeoBounds;
  zoom: number;
}

interface CachedForecast {
  hours: WeatherStation['hours'];
  ts: number;
}

/**
 * Fetches the real surface weather stations (from Synoptic) within the current
 * map viewport and attaches the Open-Meteo forecast for the selected date to
 * each. Markers sit at real station locations — sparse in remote terrain, dense
 * near towns — while the weather values are model forecast data for that point.
 *
 * Station metadata is fetched once per area (cached 12h, since stations rarely
 * move) and forecasts are cached per station per day (1h TTL), so panning and
 * zooming around explored areas costs little to no network.
 */
export function useStationData() {
  const [stations, setStations] = useState<WeatherStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // All station metadata we've seen, keyed by station id (accumulates on pan).
  const metaRef = useRef<Map<string, SynopticStation>>(new Map());
  // Bounding boxes whose station metadata we've already fetched, with timestamps.
  const coveredRef = useRef<{ box: GeoBounds; ts: number }[]>([]);
  // Per-day forecast cache keyed by station id, with timestamps.
  const forecastRef = useRef<Map<string, Map<string, CachedForecast>>>(new Map());
  // Guards against out-of-order responses toggling loading state incorrectly.
  const reqIdRef = useRef(0);

  const fetchStations = useCallback(async (viewport: Viewport, date: Date) => {
    const { bounds, zoom } = viewport;
    const day = dateKey(date);
    const now = Date.now();

    const forecasts =
      forecastRef.current.get(day) ?? new Map<string, CachedForecast>();
    forecastRef.current.set(day, forecasts);

    const displayBounds = expandBounds(bounds, 0.15);

    // Build the current view's stations from whatever metadata + forecasts we
    // already hold, thinned to the zoom so the map isn't overcrowded.
    const bucketDeg = 55 * degPerPixel(zoom);
    const buildVisible = (): WeatherStation[] => {
      const inView = Array.from(metaRef.current.values()).filter((s) =>
        inBounds(s.lat, s.lon, displayBounds)
      );
      return thinByGrid(inView, bucketDeg, MAX_STATIONS)
        .map((s) => {
          const f = forecasts.get(s.id);
          if (!f || f.hours.length === 0) return null;
          return { ...s, hours: f.hours };
        })
        .filter((s): s is WeatherStation => s !== null);
    };

    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(undefined);

    try {
      // 1. Ensure we have station metadata covering this viewport. One Synoptic
      //    bbox call covers the whole view; skip it if a fresh fetch already did.
      const needMeta = !coveredRef.current.some(
        (c) => now - c.ts < META_TTL_MS && contains(c.box, displayBounds)
      );
      if (needMeta) {
        // Over-fetch a padded box so small pans stay covered without re-querying.
        const fetchBox = expandBounds(bounds, 0.5);
        const found = await fetchSynopticStations(fetchBox);
        for (const s of found) metaRef.current.set(s.id, s);
        coveredRef.current.push({ box: fetchBox, ts: Date.now() });
        // Keep the covered-box list bounded.
        if (coveredRef.current.length > 24) coveredRef.current.shift();
      }

      // 2. Pick the stations we'll show and fetch any forecasts we're missing.
      const inView = Array.from(metaRef.current.values()).filter((s) =>
        inBounds(s.lat, s.lon, displayBounds)
      );
      const shown = thinByGrid(inView, bucketDeg, MAX_STATIONS);
      const stale = shown.filter((s) => {
        const f = forecasts.get(s.id);
        return !f || now - f.ts > FORECAST_TTL_MS;
      });

      if (stale.length > 0) {
        const points = stale.map((s) => ({ lat: s.lat, lon: s.lon }));
        const hoursByIndex = await fetchOpenMeteoForecasts(points, date);
        const fetchedAt = Date.now();
        stale.forEach((s, i) => {
          const hours = hoursByIndex[i];
          if (hours && hours.length > 0) {
            forecasts.set(s.id, { hours, ts: fetchedAt });
          }
        });
      }

      setStations(buildVisible());
    } catch (err) {
      console.error('Error fetching weather stations:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch weather stations'
      );
      // Keep whatever we can still build rather than blanking the map.
      setStations(buildVisible());
    } finally {
      // Only the latest in-flight request clears the loading indicator.
      if (reqId === reqIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  return { stations, isLoading, error, fetchStations };
}
