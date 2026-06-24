import { NextRequest, NextResponse } from 'next/server';

const SYNOPTIC_METADATA_URL =
  'https://api.synopticdata.com/v2/stations/metadata';

/** Cap on stations returned for one viewport; the client thins further. */
const MAX_STATIONS = 2000;
/** Feet → metres, for normalising Synoptic's elevation field. */
const FEET_TO_METRES = 0.3048;

interface SynopticStationRaw {
  STID?: string;
  NAME?: string;
  LATITUDE?: string | number;
  LONGITUDE?: string | number;
  ELEVATION?: string | number | null;
}

interface SynopticMetadataResponse {
  STATION?: SynopticStationRaw[];
  SUMMARY?: { RESPONSE_CODE?: number; RESPONSE_MESSAGE?: string };
}

function num(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Returns the real surface weather stations within a map bounding box, sourced
 * from Synoptic Data's mesonet metadata service. The Synoptic token is read
 * from the server-side SYNOPTIC_TOKEN env var so it never reaches the browser.
 *
 * Query params: minLat, minLon, maxLat, maxLon (decimal degrees).
 */
export async function GET(request: NextRequest) {
  const token = process.env.SYNOPTIC_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Synoptic token not configured' },
      { status: 500 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const minLat = num(sp.get('minLat'));
  const minLon = num(sp.get('minLon'));
  const maxLat = num(sp.get('maxLat'));
  const maxLon = num(sp.get('maxLon'));

  if (
    minLat === undefined ||
    minLon === undefined ||
    maxLat === undefined ||
    maxLon === undefined
  ) {
    return NextResponse.json(
      { error: 'minLat, minLon, maxLat and maxLon are required' },
      { status: 400 }
    );
  }

  // Synoptic expects bbox as lonmin,latmin,lonmax,latmax.
  const bbox = [minLon, minLat, maxLon, maxLat].join(',');
  const params = new URLSearchParams({
    bbox,
    status: 'active',
    token,
  });

  let data: SynopticMetadataResponse;
  try {
    const res = await fetch(`${SYNOPTIC_METADATA_URL}?${params}`);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Synoptic API error: ${res.status}` },
        { status: 502 }
      );
    }
    data = await res.json();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Synoptic request failed' },
      { status: 502 }
    );
  }

  // RESPONSE_CODE 1 is success; 2 means "no stations found" (not an error).
  const code = data.SUMMARY?.RESPONSE_CODE;
  if (code !== undefined && code !== 1 && code !== 2) {
    return NextResponse.json(
      { error: data.SUMMARY?.RESPONSE_MESSAGE ?? 'Synoptic error' },
      { status: 502 }
    );
  }

  const stations = (data.STATION ?? [])
    .map((s) => {
      const lat = num(s.LATITUDE);
      const lon = num(s.LONGITUDE);
      if (!s.STID || lat === undefined || lon === undefined) return null;
      const elevFt = num(s.ELEVATION);
      return {
        id: s.STID,
        name: s.NAME ?? s.STID,
        lat,
        lon,
        elevation: elevFt !== undefined ? elevFt * FEET_TO_METRES : undefined,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .slice(0, MAX_STATIONS);

  return NextResponse.json(
    { stations },
    // Cache at the edge for an hour; station metadata changes rarely.
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
  );
}
