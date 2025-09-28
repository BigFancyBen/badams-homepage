import { useState, useEffect } from 'react';
import { Location } from '../types';

const STORAGE_KEY = 'floatwise-locations';

export function useLocationStorage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load locations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedLocations = JSON.parse(stored);
        setLocations(parsedLocations);
      }
    } catch (error) {
      console.error('Error loading locations from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save locations to localStorage whenever locations change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
      } catch (error) {
        console.error('Error saving locations to localStorage:', error);
      }
    }
  }, [locations, isLoaded]);

  const addLocation = (location: Location) => {
    setLocations(prev => {
      // Check if location already exists
      const exists = prev.some(loc => loc.id === location.id);
      if (exists) {
        return prev;
      }
      return [...prev, location];
    });
  };

  const removeLocation = (locationId: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== locationId));
  };

  const updateLocation = (locationId: string, updates: Partial<Location>) => {
    setLocations(prev => prev.map(loc => 
      loc.id === locationId ? { ...loc, ...updates } : loc
    ));
  };

  const clearLocations = () => {
    setLocations([]);
  };

  return {
    locations,
    isLoaded,
    addLocation,
    removeLocation,
    updateLocation,
    clearLocations
  };
}