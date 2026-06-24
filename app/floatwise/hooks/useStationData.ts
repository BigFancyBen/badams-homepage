import { useState, useCallback, useRef } from 'react';
import { GeoBounds, buildSampleGrid } from '../utils';
import { fetchOpenMeteoStations, OpenMeteoStation } from '../sources/open-meteo';

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

/** Is `inner` fully contained within `outer`? */
function boundsContains(outer: GeoBounds, inner: GeoBounds): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLon >= outer.minLon &&
    inner.maxLon <= outer.maxLon
  );
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

/**
 * Fetches the actual Open-Meteo grid cells ("weather stations") covering the
 * current map viewport, with caching so the map stays responsive while panning.
 *
 * Behavior:
 * - Results are cached per day, keyed by the real grid-cell coordinates, and
 *   accumulate as the user explores — revisiting an area is instant (no fetch).
 * - A network request only fires when the viewport actually needs new data:
 *   the day changed, the zoom changed, or the new viewport is not already
 *   contained in the box we last sampled (i.e. a pan into fresh territory).
 *   Small pans within an already-sampled area reuse the cache.
 * - The displayed stations are the cached cells within the current viewport.
 *
 * Nothing is interpolated — each station is a raw source data point.
 */
export function useStationData() {
  const [stations, setStations] = useState<OpenMeteoStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Per-day cache of stations keyed by grid-cell coordinate.
  const cacheRef = useRef<Map<string, Map<string, OpenMeteoStation>>>(new Map());
  // The (day, bounds, zoom) of the most recent actual network fetch.
  const lastFetchRef = useRef<{ day: string; bounds: GeoBounds; zoom: number } | null>(null);
  // Guards against out-of-order responses toggling loading state incorrectly.
  const reqIdRef = useRef(0);

  const fetchStations = useCallback(async (viewport: Viewport, date: Date) => {
    const { bounds, zoom } = viewport;
    const day = dateKey(date);

    const cache = cacheRef.current.get(day) ?? new Map<string, OpenMeteoStation>();
    cacheRef.current.set(day, cache);

    // Show whatever we already have for this viewport immediately.
    const viewportWithMargin = expandBounds(bounds, 0.25);
    const visibleFromCache = () =>
      Array.from(cache.values()).filter((s) => inBounds(s.lat, s.lon, viewportWithMargin));

    const last = lastFetchRef.current;
    const alreadyCovered =
      last !== null &&
      last.day === day &&
      last.zoom === zoom &&
      boundsContains(last.bounds, bounds);

    if (alreadyCovered) {
      // Pure pan within an already-sampled area — reuse the cache, no network.
      setStations(visibleFromCache());
      return;
    }

    const samplePoints = buildSampleGrid(bounds);
    if (samplePoints.length === 0) {
      setStations(visibleFromCache());
      return;
    }

    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(undefined);

    try {
      const results = await fetchOpenMeteoStations(samplePoints, date);

      // Merge newly discovered cells into the day's cache (dedupe by real coords).
      for (const station of results) {
        if (
          typeof station.lat !== 'number' ||
          typeof station.lon !== 'number' ||
          station.hours.length === 0
        ) {
          continue;
        }
        cache.set(stationKey(station.lat, station.lon), station);
      }

      lastFetchRef.current = { day, bounds, zoom };
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
