import { GeoBounds } from '../utils';

/** A real surface weather station's identity and location (no weather yet). */
export interface SynopticStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Elevation in metres, when known. */
  elevation?: number;
}

interface StationsResponse {
  stations?: SynopticStation[];
  error?: string;
}

/**
 * Fetch the real surface weather stations within a map bounding box from our
 * server-side Synoptic proxy (which holds the API token). These are physical
 * stations — sparse in remote terrain, dense near populated areas — and carry
 * no weather data; forecasts are attached separately from Open-Meteo.
 */
export async function fetchSynopticStations(
  bounds: GeoBounds
): Promise<SynopticStation[]> {
  const params = new URLSearchParams({
    minLat: bounds.minLat.toFixed(4),
    minLon: bounds.minLon.toFixed(4),
    maxLat: bounds.maxLat.toFixed(4),
    maxLon: bounds.maxLon.toFixed(4),
  });

  const res = await fetch(`/api/synoptic/stations?${params}`);
  const data: StationsResponse = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Station lookup failed: ${res.status}`);
  }
  return data.stations ?? [];
}
