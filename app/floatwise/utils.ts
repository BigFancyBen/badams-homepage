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
 */
export function parseWeatherForTimeRange(
  forecast: NOAAResponse, 
  targetDate: Date
): WeatherHour[] {
  const hours: WeatherHour[] = [];
  const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Filter periods for the target date and time range (10am-7pm)
  // Note: NOAA hourly data may not have every single hour available
  const relevantPeriods = forecast.properties.periods.filter(period => {
    const periodDate = new Date(period.startTime);
    const periodDateStr = periodDate.toISOString().split('T')[0];
    const periodHour = periodDate.getHours();
    
    // Include daytime hours (10am-7pm) for the target date
    return periodDateStr === targetDateStr && periodHour >= 10 && periodHour <= 19;
  });
  
  // Convert periods to our hourly format
  relevantPeriods.forEach(period => {
    const startTime = new Date(period.startTime);
    const hour = startTime.getHours();
    
    hours.push({
      time: startTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        hour12: true 
      }),
      hour,
      temperature: period.temperature,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection
    });
  });
  
  // Sort by hour
  hours.sort((a, b) => a.hour - b.hour);
  
  return hours;
}

/**
 * Generate next 10 days starting from today
 */
export function getNext10Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < 10; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
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
 * Search for locations by city name using multiple strategies for better results
 */
export async function searchLocationByName(cityName: string): Promise<GeocodingResult[]> {
  if (!cityName.trim()) {
    return [];
  }

  try {
    const query = cityName.trim();
    const encodedQuery = encodeURIComponent(query);
    
    // Try multiple search strategies in parallel for better coverage
    const searchPromises = [
      // Strategy 1: Direct city search with structured query
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&city=${encodedQuery}&countrycodes=us&limit=5&addressdetails=1&dedupe=1`,
        { headers: { 'User-Agent': 'FloatWise-Weather-App' } }
      ),
      
      // Strategy 2: General search with place types
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=us&limit=8&addressdetails=1&dedupe=1&featuretype=city,town,village`,
        { headers: { 'User-Agent': 'FloatWise-Weather-App' } }
      ),
      
      // Strategy 3: Search with state context if query doesn't contain comma
      !query.includes(',') ? fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery},USA&countrycodes=us&limit=5&addressdetails=1&dedupe=1`,
        { headers: { 'User-Agent': 'FloatWise-Weather-App' } }
      ) : null
    ].filter(Boolean);

    const responses = await Promise.allSettled(searchPromises);
    const allResults: GeocodingResult[] = [];

    // Combine results from all successful searches
    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value && response.value.ok) {
        const data: GeocodingResponse = await response.value.json();
        allResults.push(...data);
      }
    }

    // Remove duplicates and filter for relevant places
    const seenCoords = new Set<string>();
    const uniqueResults = allResults.filter(result => {
      const coordKey = `${result.lat},${result.lon}`;
      if (seenCoords.has(coordKey)) return false;
      seenCoords.add(coordKey);

      const addressType = result.addresstype || result.type;
      const placeClass = result.class;
      const displayName = result.display_name.toLowerCase();
      
      // More inclusive filtering for better results
      return (
        addressType === 'city' || 
        addressType === 'town' || 
        addressType === 'village' ||
        addressType === 'municipality' ||
        addressType === 'administrative' ||
        placeClass === 'place' ||
        placeClass === 'boundary' ||
        displayName.includes('city') ||
        displayName.includes('town') ||
        displayName.includes('village') ||
        displayName.includes('borough') ||
        displayName.includes('township') ||
        // Include populated places
        (result.address && (result.address.city || result.address.town || result.address.village))
      );
    });

    // Sort by relevance: importance score, then by how well the name matches
    return uniqueResults
      .sort((a, b) => {
        const aName = (a.address?.city || a.address?.town || a.address?.village || a.display_name.split(',')[0]).toLowerCase();
        const bName = (b.address?.city || b.address?.town || b.address?.village || b.display_name.split(',')[0]).toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact matches first
        const aExact = aName === queryLower ? 1 : 0;
        const bExact = bName === queryLower ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Then by starts with
        const aStarts = aName.startsWith(queryLower) ? 1 : 0;
        const bStarts = bName.startsWith(queryLower) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        
        // Finally by importance
        return (b.importance || 0) - (a.importance || 0);
      })
      .slice(0, 10); // Limit final results
      
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