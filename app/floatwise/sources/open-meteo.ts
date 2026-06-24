import { WeatherHour } from '../types';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Convert wind degrees (0-360) to 8-point compass direction */
function degreesToCompass(degrees: number): string {
  return WIND_DIRECTIONS[Math.round(degrees / 45) % 8];
}

/**
 * Map a cloud-cover percentage to a friendly sky label.
 * The raw WMO codes only offer four coarse buckets (Clear / Mainly Clear /
 * Partly Cloudy / Overcast), which tends to read more dramatically than
 * services like Google. Using the actual cloud-cover percentage lets us
 * surface intermediate states like "Mostly Sunny".
 */
function cloudCoverToLabel(cloudCover: number): string {
  if (cloudCover < 10) return 'Sunny';
  if (cloudCover < 40) return 'Mostly Sunny';
  if (cloudCover < 70) return 'Partly Cloudy';
  if (cloudCover < 90) return 'Mostly Cloudy';
  return 'Overcast';
}

/**
 * Map WMO weather codes to short forecast strings.
 * For the clear/cloudy codes (0-3) we defer to the actual cloud-cover
 * percentage when available for a less dramatic, more granular label.
 */
function wmoCodeToForecast(code: number, cloudCover?: number): string {
  // Clear-to-overcast range: prefer cloud-cover-based label when present
  if (code >= 0 && code <= 3 && typeof cloudCover === 'number') {
    return cloudCoverToLabel(cloudCover);
  }

  const map: Record<number, string> = {
    0: 'Sunny',
    1: 'Mostly Sunny',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Freezing Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    56: 'Freezing Drizzle',
    57: 'Heavy Freezing Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain',
    67: 'Heavy Freezing Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ Hail',
    99: 'Thunderstorm w/ Heavy Hail',
  };
  return map[code] ?? 'Unknown';
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  precipitation_probability: number[];
  weather_code: number[];
  cloud_cover: number[];
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
  // When a coordinate is requested, Open-Meteo echoes back the ACTUAL grid-cell
  // coordinates the data is served from (the nearest model grid point), which
  // differ from the requested lat/lon. These are the real "weather station"
  // locations behind the forecast.
  latitude: number;
  longitude: number;
  elevation?: number;
}

/**
 * Fetch weather data from Open-Meteo for a specific date.
 * Returns WeatherHour[] filtered to 10am-7pm.
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  targetDate: Date
): Promise<WeatherHour[]> {
  const dateStr = formatDateParam(targetDate);

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code,cloud_cover',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    // Use Open-Meteo's default "best_match", which automatically selects the
    // best-performing, highest-resolution model for each location and lead
    // time (e.g. high-res HRRR short-range over the US, stronger global models
    // further out). This is the most accurate general setting; pinning a single
    // model degrades multi-day forecasts in complex terrain.
    models: 'best_match',
    start_date: dateStr,
    end_date: dateStr,
  });

  const response = await fetch(`${OPEN_METEO_BASE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.statusText}`);
  }

  const data: OpenMeteoResponse = await response.json();
  return parseHourlyData(data.hourly);
}

/** A single Open-Meteo model grid cell ("weather station") and its actual data. */
export interface OpenMeteoStation {
  /** Actual latitude of the grid cell the data is served from. */
  lat: number;
  /** Actual longitude of the grid cell the data is served from. */
  lon: number;
  /** Grid-cell elevation in metres, when provided. */
  elevation?: number;
  /** Full-day hourly data for the cell (unfiltered, all 24 hours). */
  hours: WeatherHour[];
}

/**
 * Fetch the actual Open-Meteo grid cells ("weather stations") that serve a set
 * of sample points for a given date. Open-Meteo accepts multiple coordinates in
 * a single request (comma-separated), so all points are fetched at once.
 *
 * Each returned object echoes the real grid-cell coordinates the data is served
 * from. Several sample points often resolve to the SAME grid cell; callers
 * should dedupe by the returned lat/lon. Nothing is interpolated — these are the
 * raw source data points behind the forecast.
 */
export async function fetchOpenMeteoStations(
  points: { lat: number; lon: number }[],
  targetDate: Date
): Promise<OpenMeteoStation[]> {
  if (points.length === 0) return [];

  const dateStr = formatDateParam(targetDate);

  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lon.toFixed(4)).join(','),
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code,cloud_cover',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    models: 'best_match',
    start_date: dateStr,
    end_date: dateStr,
  });

  const response = await fetch(`${OPEN_METEO_BASE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.statusText}`);
  }

  const data = await response.json();
  // A single coordinate returns an object; multiple coordinates return an array.
  const entries: OpenMeteoResponse[] = Array.isArray(data) ? data : [data];

  return entries.map((entry) => ({
    lat: entry.latitude,
    lon: entry.longitude,
    elevation: entry.elevation,
    hours: parseHourlyData(entry.hourly, true),
  }));
}

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseHourlyData(hourly: OpenMeteoHourly, allHours = false): WeatherHour[] {
  const hours: WeatherHour[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const dt = new Date(hourly.time[i]);
    const hour = dt.getHours();

    // Table view filters to 10am-7pm; the map view passes allHours to keep all 24.
    if (!allHours && (hour < 10 || hour > 19)) continue;

    const hour12 = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    hours.push({
      time: `${hour12} ${ampm}`,
      hour,
      temperature: Math.round(hourly.temperature_2m[i]),
      windSpeed: `${Math.round(hourly.wind_speed_10m[i])} mph`,
      windDirection: degreesToCompass(hourly.wind_direction_10m[i]),
      precipChance: hourly.precipitation_probability[i] ?? null,
      shortForecast: wmoCodeToForecast(hourly.weather_code[i], hourly.cloud_cover?.[i]),
      windDirectionDegrees: hourly.wind_direction_10m[i],
      weatherCode: hourly.weather_code[i],
    });
  }

  return hours;
}
