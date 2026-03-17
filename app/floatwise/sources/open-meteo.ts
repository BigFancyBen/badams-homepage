import { WeatherHour } from '../types';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Convert wind degrees (0-360) to 8-point compass direction */
function degreesToCompass(degrees: number): string {
  return WIND_DIRECTIONS[Math.round(degrees / 45) % 8];
}

/** Map WMO weather codes to short forecast strings */
function wmoCodeToForecast(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly Clear',
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
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
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
    hourly: 'temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,weather_code',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
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

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseHourlyData(hourly: OpenMeteoHourly): WeatherHour[] {
  const hours: WeatherHour[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const dt = new Date(hourly.time[i]);
    const hour = dt.getHours();

    // Filter to 10am-7pm
    if (hour < 10 || hour > 19) continue;

    const hour12 = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    hours.push({
      time: `${hour12} ${ampm}`,
      hour,
      temperature: Math.round(hourly.temperature_2m[i]),
      windSpeed: `${Math.round(hourly.wind_speed_10m[i])} mph`,
      windDirection: degreesToCompass(hourly.wind_direction_10m[i]),
      precipChance: hourly.precipitation_probability[i] ?? null,
      shortForecast: wmoCodeToForecast(hourly.weather_code[i]),
      windDirectionDegrees: hourly.wind_direction_10m[i],
      weatherCode: hourly.weather_code[i],
    });
  }

  return hours;
}
