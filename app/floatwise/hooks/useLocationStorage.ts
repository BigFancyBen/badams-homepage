import { useState, useEffect } from 'react';
import { Location } from '../types';

const STORAGE_KEY = 'floatwise-locations';

export function useLocationStorage(urlLocations?: Location[] | null) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load locations from URL params or localStorage on mount
  useEffect(() => {
    try {
      // If URL locations are provided, use them (but don't save to localStorage)
      if (urlLocations && urlLocations.length > 0) {
        setLocations(urlLocations);
      } else {
        // Otherwise load from localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedLocations = JSON.parse(stored);
          setLocations(parsedLocations);
        }
      }
    } catch (error) {
      console.error('Error loading locations from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, urlLocations is intentionally not a dependency

  // Save locations to localStorage only if not viewing a shared link
  useEffect(() => {
    if (isLoaded && !urlLocations) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
      } catch (error) {
        console.error('Error saving locations to localStorage:', error);
      }
    }
  }, [locations, isLoaded, urlLocations]);

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

  const reorderLocations = (newOrder: Location[]) => {
    setLocations(newOrder);
  };

  const renameLocation = (locationId: string, newName: string) => {
    setLocations(prev => prev.map(loc => 
      loc.id === locationId ? { ...loc, name: newName } : loc
    ));
  };

  return {
    locations,
    isLoaded,
    addLocation,
    removeLocation,
    updateLocation,
    clearLocations,
    reorderLocations,
    renameLocation,
    isViewingSharedLink: !!urlLocations && urlLocations.length > 0
  };
}