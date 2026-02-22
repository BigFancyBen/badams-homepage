import { useState, useEffect } from 'react';
import { UserPreferences } from '../types';
import { DEFAULT_PREFERENCES } from '../utils';

const STORAGE_KEY = 'floatwise-preferences';

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          temperatureThreshold: parsed.temperatureThreshold ?? DEFAULT_PREFERENCES.temperatureThreshold,
          precipThreshold: parsed.precipThreshold ?? DEFAULT_PREFERENCES.precipThreshold,
          windSpeedThreshold: parsed.windSpeedThreshold ?? DEFAULT_PREFERENCES.windSpeedThreshold,
        });
      }
    } catch (error) {
      console.error('Error loading preferences from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preferences to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch (error) {
        console.error('Error saving preferences to localStorage:', error);
      }
    }
  }, [preferences, isLoaded]);

  const updatePreferences = (newPreferences: UserPreferences) => {
    setPreferences(newPreferences);
  };

  return {
    preferences,
    isLoaded,
    updatePreferences,
  };
}
