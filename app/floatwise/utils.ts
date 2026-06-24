import { Location, UserPreferences, WeatherHour } from './types';

// Default user preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  temperatureThreshold: 65,
  precipThreshold: 30,
  windSpeedThreshold: 10,
};

/**
 * Fetch weather data for a specific location and date using Open-Meteo
 */
export { fetchOpenMeteoWeather as fetchWeatherForDate } from './sources/open-meteo';

/**
 * Get the initial/first selectable date based on current time
 * Returns today if before 7pm, tomorrow if after 7pm
 */
export function getInitialDate(): Date {
  const now = new Date();
  const currentHour = now.getHours();
  
  // If it's past 7pm (19:00), start with tomorrow
  const startOffset = currentHour >= 19 ? 1 : 0;
  
  const date = new Date(now);
  date.setDate(now.getDate() + startOffset);
  date.setHours(0, 0, 0, 0);
  
  return date;
}

/**
 * Generate next 10 days starting from today (or tomorrow if past 7pm)
 * Uses user's local timezone to determine the appropriate starting date
 */
export function getNextDays(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  // If it's past 7pm (19:00), start with tomorrow as the first day
  // since there's no useful weather data left for today
  const startOffset = currentHour >= 19 ? 1 : 0;

  for (let i = 0; i < 10; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + startOffset + i);
    // Set to start of day in user's timezone
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }

  return days;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  });
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Generate a unique ID for a location
 */
export function generateLocationId(name: string, lat: number, lon: number): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${lat.toFixed(4)}-${lon.toFixed(4)}`;
}

/**
 * Validate latitude and longitude values
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * A geographic bounding box.
 */
export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Build a grid of sample points covering a bounding box (typically the current
 * map viewport). Each point is sent to Open-Meteo to reveal which actual grid
 * cell ("weather station") serves it; several points commonly resolve to the
 * same cell, so callers should dedupe the results by the returned coords.
 *
 * `steps` controls the resolution (steps x steps points). A small pad is added
 * so cells right at the viewport edges are still surfaced. Sampling the viewport
 * (rather than a fixed box) means panning/zooming reveals stations wherever the
 * user is looking, at a density that scales with the zoom level.
 */
export function buildSampleGrid(
  bounds: GeoBounds,
  steps = 10
): { lat: number; lon: number }[] {
  const minLat = Math.min(bounds.minLat, bounds.maxLat);
  const maxLat = Math.max(bounds.minLat, bounds.maxLat);
  const minLon = Math.min(bounds.minLon, bounds.maxLon);
  const maxLon = Math.max(bounds.minLon, bounds.maxLon);

  // Small edge pad so stations just outside the visible box still appear.
  const latPad = (maxLat - minLat) * 0.05;
  const lonPad = (maxLon - minLon) * 0.05;

  const lo = {
    lat: Math.max(minLat - latPad, -90),
    lon: Math.max(minLon - lonPad, -180),
  };
  const hi = {
    lat: Math.min(maxLat + latPad, 90),
    lon: Math.min(maxLon + lonPad, 180),
  };

  const divisions = Math.max(steps - 1, 1);
  const points: { lat: number; lon: number }[] = [];

  for (let i = 0; i < steps; i++) {
    const lat = lo.lat + ((hi.lat - lo.lat) * i) / divisions;
    for (let j = 0; j < steps; j++) {
      const lon = lo.lon + ((hi.lon - lo.lon) * j) / divisions;
      points.push({ lat, lon });
    }
  }

  return points;
}

// Geocoding types
export interface GeocodingResult {
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  addresstype?: string;
  importance: number;
  name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

export type GeocodingResponse = GeocodingResult[];

/**
 * Search for locations by city name with optimized single-strategy approach
 */
export async function searchLocationByName(cityName: string): Promise<GeocodingResult[]> {
  if (!cityName.trim()) {
    return [];
  }

  try {
    const query = cityName.trim();
    
    // Skip search for very short queries to reduce noise
    if (query.length < 2) {
      return [];
    }
    
    const encodedQuery = encodeURIComponent(query);
    
    // Single optimized search strategy for better performance and consistency
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=us&limit=8&addressdetails=1&dedupe=1&class=place`,
      { 
        headers: { 'User-Agent': 'FloatWise-Weather-App' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const results: GeocodingResponse = await response.json();
    
    // Filter and sort results for better relevance
    const filteredResults = results
      .filter(result => {
        const addressType = result.addresstype || result.type;
        const placeClass = result.class;
        const displayName = result.display_name.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Filter for cities, towns, and villages
        const isValidPlaceType = (
          addressType === 'city' || 
          addressType === 'town' || 
          addressType === 'village' ||
          addressType === 'municipality' ||
          placeClass === 'place' ||
          displayName.includes('city') ||
          displayName.includes('town') ||
          displayName.includes('village')
        );
        
        // Basic relevance check - name should somewhat match query
        const nameMatch = displayName.includes(queryLower) || 
                          result.name?.toLowerCase().includes(queryLower) ||
                          result.address?.city?.toLowerCase().includes(queryLower) ||
                          result.address?.town?.toLowerCase().includes(queryLower) ||
                          result.address?.village?.toLowerCase().includes(queryLower);
        
        return isValidPlaceType && nameMatch;
      })
      .sort((a, b) => {
        const queryLower = query.toLowerCase();
        
        // Get the primary name for each result
        const aName = (a.address?.city || a.address?.town || a.address?.village || a.name || a.display_name.split(',')[0]).toLowerCase();
        const bName = (b.address?.city || b.address?.town || b.address?.village || b.name || b.display_name.split(',')[0]).toLowerCase();
        
        // Exact matches first
        const aExact = aName === queryLower ? 2 : 0;
        const bExact = bName === queryLower ? 2 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Starts with query second  
        const aStarts = aName.startsWith(queryLower) ? 1 : 0;
        const bStarts = bName.startsWith(queryLower) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        
        // Finally by importance score
        return (b.importance || 0) - (a.importance || 0);
      })
      .slice(0, 8); // Limit to 8 results for better performance
      
    return filteredResults;
      
  } catch (error) {
    console.error('Error searching for location:', error);
    throw error;
  }
}

/**
 * Extract a clean location name from the geocoding display name
 */
export function cleanLocationName(displayName: string): string {
  // Take the first part before the first comma, which is usually the city name
  const parts = displayName.split(',');
  return parts[0].trim();
}

/**
 * Encode locations array into a URL-safe base64 string
 * Uses minimal data structure for shorter URLs (~50% reduction)
 */
export function encodeLocationsToURL(locations: { id: string; name: string; lat: number; lon: number }[]): string {
  if (locations.length === 0) return '';
  
  // Create a compact representation with short keys and reduced precision
  // ID is omitted (can be regenerated), coordinates use 4 decimal places (~11m precision)
  const locationData = locations.map(loc => ({
    n: loc.name,                          // name
    x: parseFloat(loc.lat.toFixed(4)),   // latitude (4 decimals)
    y: parseFloat(loc.lon.toFixed(4))    // longitude (4 decimals)
  }));
  
  const jsonString = JSON.stringify(locationData);
  // Convert to base64 and make it URL-safe
  const base64 = btoa(jsonString);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode locations from a URL parameter
 * Supports both legacy format (with id) and new compact format (without id)
 */
export function decodeLocationsFromURL(encodedString: string): { id: string; name: string; lat: number; lon: number }[] | null {
  if (!encodedString) return null;
  
  try {
    // Convert from URL-safe base64 back to regular base64
    const base64 = encodedString.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    
    const jsonString = atob(padded);
    const locations = JSON.parse(jsonString);
    
    // Validate the structure
    if (!Array.isArray(locations)) return null;
    
    // Check if this is the new compact format (using short keys)
    const isCompactFormat = locations.length > 0 && 'n' in locations[0];
    
    if (isCompactFormat) {
      // New compact format: {n: name, x: lat, y: lon}
      const isValid = locations.every(loc => 
        loc.n && 
        typeof loc.x === 'number' && 
        typeof loc.y === 'number'
      );
      
      if (!isValid) return null;
      
      // Convert to standard format and regenerate IDs
      return locations.map(loc => ({
        id: generateLocationId(loc.n, loc.x, loc.y),
        name: loc.n,
        lat: loc.x,
        lon: loc.y
      }));
    } else {
      // Legacy format: {id, name, lat, lon}
      const isValid = locations.every(loc => 
        loc.id && 
        loc.name && 
        typeof loc.lat === 'number' && 
        typeof loc.lon === 'number'
      );
      
      return isValid ? locations : null;
    }
  } catch (error) {
    console.error('Error decoding locations from URL:', error);
    return null;
  }
}

/**
 * Extract "City, State" format from geocoding display name
 */
export function formatCityState(displayName: string): string {
  const parts = displayName.split(',').map(part => part.trim());
  
  if (parts.length >= 3) {
    // Format: "City, County, State, ZIP, Country" -> "City, State"
    const city = parts[0];
    const state = parts[2]; // Usually state is the 3rd part
    return `${city}, ${state}`;
  } else if (parts.length === 2) {
    // Format: "City, State" -> use as is
    return `${parts[0]}, ${parts[1]}`;
  } else {
    // Fallback to just the city name
    return parts[0] || displayName;
  }
}

/**
 * Throttle function to limit API calls
 */
export function throttle<T extends (...args: unknown[]) => void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return ((...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
}

/**
 * Debounce function to delay function execution
 */
export function debounce<T extends (...args: never[]) => Promise<void> | void>(func: T, delay: number): T {
  let timeoutId: NodeJS.Timeout | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

/**
 * Get weather emoji based on WMO weather code
 */
export function getWeatherEmoji(weatherCode: number): string {
  if (weatherCode === 0) return '☀️';
  if (weatherCode === 1) return '🌤️';
  if (weatherCode === 2) return '⛅';
  if (weatherCode === 3) return '☁️';
  if (weatherCode === 45 || weatherCode === 48) return '🌫️';
  if (weatherCode >= 51 && weatherCode <= 57) return '🌦️';
  if (weatherCode >= 61 && weatherCode <= 67) return '🌧️';
  if (weatherCode >= 71 && weatherCode <= 77) return '🌨️';
  if (weatherCode >= 80 && weatherCode <= 82) return '🌧️';
  if (weatherCode >= 85 && weatherCode <= 86) return '🌨️';
  if (weatherCode >= 95) return '⛈️';
  return '☀️';
}

/**
 * Convert 8-point compass direction to degrees
 */
export function compassToDegrees(compass: string): number {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  };
  return map[compass.toUpperCase()] ?? 0;
}

/**
 * Calculate shortest angular difference between two degree values
 */
export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

/**
 * Whether an hour's conditions are all within the user's "good" thresholds:
 * warm enough, calm enough, dry enough, and (when a preferred wind direction is
 * set) not blowing the wrong way. Shared by the table cells and the map markers
 * so "good" means the same thing in both views.
 */
export function isGoodWeatherHour(
  hourData: WeatherHour,
  preferences: UserPreferences,
  preferredDirection?: string
): boolean {
  const tempOk = hourData.temperature >= preferences.temperatureThreshold;
  const windSpeed = parseInt(hourData.windSpeed.replace(/[^\d]/g, '')) || 0;
  const windOk = windSpeed <= preferences.windSpeedThreshold;
  const precipOk =
    hourData.precipChance === null ||
    hourData.precipChance <= preferences.precipThreshold;
  const dirOk = preferredDirection
    ? getWindDirectionProximity(
        hourData.windDirectionDegrees,
        normalizeWindDirection(preferredDirection)
      ) !== 'opposite'
    : true;
  return tempOk && windOk && precipOk && dirOk;
}

/**
 * Determine proximity of actual wind direction to a preferred compass direction
 */
export function getWindDirectionProximity(
  actualDegrees: number,
  preferredCompass: string
): 'exact' | 'adjacent' | 'opposite' {
  const preferredDegrees = compassToDegrees(preferredCompass);
  const diff = angularDifference(actualDegrees, preferredDegrees);
  if (diff <= 22.5) return 'exact';
  if (diff <= 67.5) return 'adjacent';
  return 'opposite';
}

/**
 * Normalize wind direction string to a standard cardinal/intercardinal direction
 * E.g., "North" -> "N", "NNW" -> "NW", "SSE" -> "SE"
 */
export function normalizeWindDirection(direction: string): string {
  const d = direction.trim().toUpperCase();
  // Map full names
  const nameMap: { [key: string]: string } = {
    'NORTH': 'N', 'SOUTH': 'S', 'EAST': 'E', 'WEST': 'W',
    'NORTHEAST': 'NE', 'NORTHWEST': 'NW', 'SOUTHEAST': 'SE', 'SOUTHWEST': 'SW',
  };
  if (nameMap[d]) return nameMap[d];
  // Map 3-letter intercardinals to nearest 2-letter
  const threeLetterMap: { [key: string]: string } = {
    'NNE': 'NE', 'ENE': 'NE', 'ESE': 'SE', 'SSE': 'SE',
    'SSW': 'SW', 'WSW': 'SW', 'WNW': 'NW', 'NNW': 'NW',
  };
  if (threeLetterMap[d]) return threeLetterMap[d];
  // Already a standard direction
  if (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].includes(d)) return d;
  return d;
}

/**
 * Parse CSV text into Location objects
 * Expected format: name, subtitle, latitude, longitude (one per line)
 * Subtitle column is optional — if only 3 columns, treated as name, lat, lon
 * Header row is auto-detected and skipped if present
 */
export function parseLocationCSV(csvText: string): { locations: Location[]; errors: string[] } {
  const lines = csvText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const locations: Location[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    errors.push('No data found in CSV');
    return { locations, errors };
  }

  // Detect header row: if the 3rd or 4th column of the first row is non-numeric, skip it
  let startIndex = 0;
  const firstLineParts = lines[0].split(',').map(p => p.trim());
  if (firstLineParts.length >= 3) {
    const potentialLat = parseFloat(firstLineParts[firstLineParts.length - 2]);
    const potentialLon = parseFloat(firstLineParts[firstLineParts.length - 1]);
    if (isNaN(potentialLat) || isNaN(potentialLon)) {
      startIndex = 1; // Skip header
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    const lineNum = i + 1;

    if (parts.length < 3) {
      errors.push(`Line ${lineNum}: Need at least 3 columns (name, lat, lon)`);
      continue;
    }

    let name: string;
    let subtitle: string | undefined;
    let latStr: string;
    let lonStr: string;

    if (parts.length >= 4) {
      // 4+ columns: name, subtitle, lat, lon
      name = parts[0];
      subtitle = parts[1] || undefined;
      latStr = parts[2];
      lonStr = parts[3];
    } else {
      // 3 columns: name, lat, lon
      name = parts[0];
      latStr = parts[1];
      lonStr = parts[2];
    }

    if (!name) {
      errors.push(`Line ${lineNum}: Missing location name`);
      continue;
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      errors.push(`Line ${lineNum}: Invalid coordinates "${latStr}, ${lonStr}"`);
      continue;
    }

    if (!isValidCoordinate(lat, lon)) {
      errors.push(`Line ${lineNum}: Coordinates out of range (lat: -90 to 90, lon: -180 to 180)`);
      continue;
    }

    locations.push({
      id: generateLocationId(name, lat, lon),
      name,
      lat,
      lon,
      subtitle,
    });
  }

  return { locations, errors };
}

/**
 * Export configuration (locations + preferences) as a JSON string
 */
export function exportConfigJSON(locations: Location[], preferences: UserPreferences): string {
  return JSON.stringify({ locations, preferences }, null, 2);
}

/**
 * Parse and validate imported config JSON
 */
export function parseConfigJSON(jsonText: string): { locations: Location[]; preferences: UserPreferences } | null {
  try {
    const data = JSON.parse(jsonText);
    if (!data || !Array.isArray(data.locations)) return null;
    
    // Validate locations
    const validLocations = data.locations.every((loc: Record<string, unknown>) =>
      loc.name && typeof loc.lat === 'number' && typeof loc.lon === 'number'
    );
    if (!validLocations) return null;

    // Ensure locations have IDs
    const locations: Location[] = data.locations.map((loc: Location) => ({
      ...loc,
      id: loc.id || generateLocationId(loc.name, loc.lat, loc.lon),
    }));

    // Validate preferences (use defaults for missing fields)
    const preferences: UserPreferences = {
      temperatureThreshold: data.preferences?.temperatureThreshold ?? DEFAULT_PREFERENCES.temperatureThreshold,
      precipThreshold: data.preferences?.precipThreshold ?? DEFAULT_PREFERENCES.precipThreshold,
      windSpeedThreshold: data.preferences?.windSpeedThreshold ?? DEFAULT_PREFERENCES.windSpeedThreshold,
    };

    return { locations, preferences };
  } catch {
    return null;
  }
}