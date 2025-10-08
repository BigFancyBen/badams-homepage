import { NOAAResponse, WeatherHour } from './types';

// NOAA API base URL
const NOAA_BASE_URL = 'https://api.weather.gov';

/**
 * Validate if coordinates are within NOAA coverage area (roughly US and territories)
 */
function isWithinNOAACoverage(lat: number, lon: number): boolean {
  // Basic bounds for NOAA coverage (US and territories)
  // Mainland US, Alaska, Hawaii, Puerto Rico, etc.
  return (
    (lat >= 24.0 && lat <= 71.5 && lon >= -179.0 && lon <= -66.0) || // Mainland US + Alaska
    (lat >= 18.0 && lat <= 28.5 && lon >= -179.0 && lon <= -154.0) || // Hawaii
    (lat >= 17.0 && lat <= 19.0 && lon >= -68.0 && lon <= -65.0)     // Puerto Rico/VI
  );
}

/**
 * Get the NOAA grid point for a given lat/lon
 */
export async function getNOAAGridPoint(lat: number, lon: number) {
  // Check if coordinates are within NOAA coverage area
  if (!isWithinNOAACoverage(lat, lon)) {
    throw new Error(`Location is outside NOAA weather service coverage area. NOAA only provides weather data for US locations.`);
  }

  const response = await fetch(`${NOAA_BASE_URL}/points/${lat},${lon}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Weather data not available for this location. NOAA may not have coverage for this specific coordinate.`);
    }
    throw new Error(`Failed to get grid point: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Get the forecast URL from grid point data
 */
export function getForecastUrl(gridPointData: { properties: { forecastHourly: string } }): string {
  // Use hourly forecast instead of regular forecast for more detailed data
  return gridPointData.properties.forecastHourly;
}

/**
 * Fetch weather forecast from NOAA API
 */
export async function fetchNOAAWeather(lat: number, lon: number): Promise<NOAAResponse> {
  try {
    // First get the grid point
    const gridPoint = await getNOAAGridPoint(lat, lon);
    const forecastUrl = getForecastUrl(gridPoint);
    
    // Then get the forecast
    const response = await fetch(forecastUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch weather: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching NOAA weather:', error);
    throw error;
  }
}

/**
 * Parse NOAA forecast periods and extract hourly data for 10am-7pm
 * Converts NOAA times to user's local timezone for display
 */
export function parseWeatherForTimeRange(
  forecast: NOAAResponse, 
  targetDate: Date
): WeatherHour[] {
  const hours: WeatherHour[] = [];
  
  // Format target date as YYYY-MM-DD in user's local timezone
  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const targetDay = String(targetDate.getDate()).padStart(2, '0');
  const targetDateStr = `${targetYear}-${targetMonth}-${targetDay}`;
  
  // Filter periods for the target date and time range (10am-7pm)
  const relevantPeriods = forecast.properties.periods.filter(period => {
    // Parse NOAA time to Date object (converts to user's local timezone)
    const periodDate = new Date(period.startTime);
    
    // Get date components in user's local timezone
    const periodYear = periodDate.getFullYear();
    const periodMonth = String(periodDate.getMonth() + 1).padStart(2, '0');
    const periodDay = String(periodDate.getDate()).padStart(2, '0');
    const periodDateStr = `${periodYear}-${periodMonth}-${periodDay}`;
    
    // Get hour in user's local timezone
    const periodHour = periodDate.getHours();
    
    // Check if same date and within time range (10am-7pm) in user's timezone
    return periodDateStr === targetDateStr && periodHour >= 10 && periodHour <= 19;
  });
  
  // Convert periods to our hourly format
  relevantPeriods.forEach(period => {
    // Parse to Date object to get time in user's local timezone
    const periodDate = new Date(period.startTime);
    const hour = periodDate.getHours();
    
    // Format time display
    const hour12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const time = `${hour12} ${ampm}`;
    
    hours.push({
      time,
      hour,
      temperature: period.temperature,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection,
      precipChance: period.probabilityOfPrecipitation?.value ?? null,
      shortForecast: period.shortForecast
    });
  });
  
  // Sort by hour
  hours.sort((a, b) => a.hour - b.hour);
  
  return hours;
}

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
export function getNext10Days(): Date[] {
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