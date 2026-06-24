import { useState, useCallback } from 'react';
import { Location } from '../types';
import { buildStationSampleGrid } from '../utils';
import { fetchOpenMeteoStations, OpenMeteoStation } from '../sources/open-meteo';

/** Dedupe key for a grid cell — same cell returns identical coordinates. */
function stationKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

/**
 * Fetches the actual Open-Meteo grid cells ("weather stations") covering the
 * area spanned by the user's table locations. Sample points across the bounding
 * box are queried in a single request, then deduped by the real grid-cell
 * coordinates Open-Meteo returns. Nothing is interpolated — each station is a
 * raw source data point.
 */
export function useStationData() {
  const [stations, setStations] = useState<OpenMeteoStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const fetchStations = useCallback(async (locations: Location[], date: Date) => {
    const samplePoints = buildStationSampleGrid(locations);
    if (samplePoints.length === 0) {
      setStations([]);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const results = await fetchOpenMeteoStations(samplePoints, date);

      // Dedupe by the actual grid-cell coordinates so each real station appears
      // once even though several sample points resolve to it.
      const byCell = new Map<string, OpenMeteoStation>();
      for (const station of results) {
        if (
          typeof station.lat !== 'number' ||
          typeof station.lon !== 'number' ||
          station.hours.length === 0
        ) {
          continue;
        }
        byCell.set(stationKey(station.lat, station.lon), station);
      }

      setStations(Array.from(byCell.values()));
    } catch (err) {
      console.error('Error fetching weather stations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch weather stations');
      setStations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { stations, isLoading, error, fetchStations };
}
