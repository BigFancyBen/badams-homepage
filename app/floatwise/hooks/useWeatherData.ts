import { useState, useCallback } from 'react';
import { Location, LocationWeather, WeatherLoadingState } from '../types';
import { fetchNOAAWeather, parseWeatherForTimeRange } from '../utils';

export function useWeatherData() {
  const [weatherData, setWeatherData] = useState<LocationWeather[]>([]);
  const [loadingState, setLoadingState] = useState<WeatherLoadingState>('idle');

  const fetchWeatherForLocation = useCallback(async (location: Location, date: Date) => {
    try {
      const response = await fetchNOAAWeather(location.lat, location.lon);
      const hours = parseWeatherForTimeRange(response, date);
      
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
    
    // Set initial loading state for all locations
    setWeatherData(locations.map(location => ({
      location,
      date: date.toISOString().split('T')[0],
      hours: [],
      isLoading: true
    })));

    try {
      // Fetch weather data for all locations in parallel
      const weatherPromises = locations.map(location => 
        fetchWeatherForLocation(location, date)
      );
      
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
    fetchWeatherForLocations,
    refreshWeatherForLocation
  };
}