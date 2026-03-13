import { useState, useCallback } from 'react';
import { Location, LocationWeather, WeatherLoadingState } from '../types';
import { fetchWeatherForDate } from '../utils';

export function useWeatherData() {
  const [weatherData, setWeatherData] = useState<LocationWeather[]>([]);
  const [loadingState, setLoadingState] = useState<WeatherLoadingState>('idle');
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchWeatherForLocation = useCallback(async (location: Location, date: Date) => {
    try {
      const hours = await fetchWeatherForDate(location.lat, location.lon, date);
      
      return {
        location,
        date: date.toISOString().split('T')[0],
        hours,
        isLoading: false
      };
    } catch (error) {
      console.error(`Error fetching weather for ${location.name}:`, error);
      return {
        location,
        date: date.toISOString().split('T')[0],
        hours: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch weather data'
      };
    }
  }, []);

  const fetchWeatherForLocations = useCallback(async (locations: Location[], date: Date) => {
    if (locations.length === 0) {
      setWeatherData([]);
      return;
    }

    setLoadingState('loading');
    setTotalCount(locations.length);
    setLoadedCount(0);

    // Set initial loading state for all locations
    setWeatherData(locations.map(location => ({
      location,
      date: date.toISOString().split('T')[0],
      hours: [],
      isLoading: true
    })));

    try {
      // Fetch weather data for all locations in parallel, tracking progress
      const weatherPromises = locations.map(async (location) => {
        const result = await fetchWeatherForLocation(location, date);
        setLoadedCount(prev => prev + 1);
        return result;
      });

      const results = await Promise.all(weatherPromises);
      setWeatherData(results);
      setLoadingState('success');
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setLoadingState('error');
    }
  }, [fetchWeatherForLocation]);

  const refreshWeatherForLocation = useCallback(async (locationId: string, date: Date) => {
    const locationWeather = weatherData.find(wd => wd.location.id === locationId);
    if (!locationWeather) return;

    // Set loading state for this specific location
    setWeatherData(prev => prev.map(wd => 
      wd.location.id === locationId 
        ? { ...wd, isLoading: true, error: undefined }
        : wd
    ));

    try {
      const result = await fetchWeatherForLocation(locationWeather.location, date);
      setWeatherData(prev => prev.map(wd => 
        wd.location.id === locationId ? result : wd
      ));
    } catch (error) {
      console.error(`Error refreshing weather for ${locationWeather.location.name}:`, error);
      setWeatherData(prev => prev.map(wd => 
        wd.location.id === locationId 
          ? { 
              ...wd, 
              isLoading: false, 
              error: error instanceof Error ? error.message : 'Failed to refresh weather data' 
            }
          : wd
      ));
    }
  }, [weatherData, fetchWeatherForLocation]);

  return {
    weatherData,
    loadingState,
    loadedCount,
    totalCount,
    fetchWeatherForLocations,
    refreshWeatherForLocation
  };
}