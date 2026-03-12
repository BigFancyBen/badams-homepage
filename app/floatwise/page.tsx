"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar } from "./components/Calendar";
import { LocationManager } from "./components/LocationManager";
import { WeatherDisplay } from "./components/WeatherDisplay";
import { useLocationStorage } from "./hooks/useLocationStorage";
import { useWeatherData } from "./hooks/useWeatherData";
import { useUserPreferences } from "./hooks/useUserPreferences";
import { Location } from "./types";
import {
  encodeLocationsToURL,
  decodeLocationsFromURL,
  getInitialDate,
} from "./utils";

export default function FloatWisePage() {
  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const searchParams = useSearchParams();

  // Decode locations from URL parameter if present
  const urlLocations = decodeLocationsFromURL(
    searchParams.get("locations") || ""
  );

  const {
    locations,
    isLoaded,
    addLocation,
    removeLocation,
    updateLocation,
    reorderLocations,
    renameLocation,
    isViewingSharedLink,
  } = useLocationStorage(urlLocations);
  const { weatherData, loadedCount, totalCount, fetchWeatherForLocations } = useWeatherData();
  const { preferences, updatePreferences } = useUserPreferences();

  // Fetch weather data when locations or selected date changes
  useEffect(() => {
    if (isLoaded && locations.length > 0) {
      fetchWeatherForLocations(locations, selectedDate);
    }
  }, [locations, selectedDate, isLoaded, fetchWeatherForLocations]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddLocation = (location: Location) => {
    addLocation(location);
  };

  const handleRemoveLocation = (locationId: string) => {
    removeLocation(locationId);
  };

  const handleReorderLocations = (newLocations: Location[]) => {
    reorderLocations(newLocations);
  };

  const handleRenameLocation = (locationId: string, newName: string) => {
    renameLocation(locationId, newName);
  };

  const handleUpdateLocation = (locationId: string, updates: Partial<Location>) => {
    updateLocation(locationId, updates);
  };

  const handleImportLocations = useCallback((newLocations: Location[]) => {
    // Add each location (deduplicates by id)
    newLocations.forEach((loc) => {
      addLocation(loc);
    });
  }, [addLocation]);

  const handleShareClick = async () => {
    if (locations.length === 0) {
      return;
    }

    const encodedLocations = encodeLocationsToURL(locations);
    const shareUrl = `${window.location.origin}${window.location.pathname}?locations=${encodedLocations}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  // Show loading state until localStorage is loaded
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading FloatWise...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="max-w-7xl mx-auto">
        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 shadow-xs  p-1 sm:p-3">
          <div className="flex items-center justify-between mb-2 w-full px-2 sm:px-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
              FloatWise
            </h1>
            <div className="flex items-center gap-1">
              <LocationManager
                locations={locations}
                onAddLocation={handleAddLocation}
                onRemoveLocation={handleRemoveLocation}
                onReorderLocations={handleReorderLocations}
                onRenameLocation={handleRenameLocation}
                onUpdateLocation={handleUpdateLocation}
                onImportLocations={handleImportLocations}
                showShareButton={locations.length > 0}
                onShareClick={handleShareClick}
                isViewingSharedLink={isViewingSharedLink}
                preferences={preferences}
                onUpdatePreferences={updatePreferences}
              />
            </div>
          </div>
          {locations.length === 0 ? (
            <div className="text-center py-12 sm:py-16 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 mt-2">
              <p className="mb-2 text-sm sm:text-base">No locations added yet</p>
              <p className="text-xs sm:text-sm">
                Click the <span className="inline-flex items-center justify-center w-5 h-5 border border-current align-text-bottom">+</span> button to add locations
              </p>
            </div>
          ) : (
            <>
              {/* Calendar */}
              <Calendar
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />
              {/* Weather Display */}
              <WeatherDisplay
                locationWeather={weatherData}
                preferences={preferences}
                loadedCount={loadedCount}
                totalCount={totalCount}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
