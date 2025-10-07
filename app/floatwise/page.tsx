"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar } from "./components/Calendar";
import { LocationManager } from "./components/LocationManager";
import { WeatherDisplay } from "./components/WeatherDisplay";
import { useLocationStorage } from "./hooks/useLocationStorage";
import { useWeatherData } from "./hooks/useWeatherData";
import { Location } from "./types";
import {
  encodeLocationsToURL,
  decodeLocationsFromURL,
  getInitialDate,
  exportLocationsToCSV,
  downloadTextFile,
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
    reorderLocations,
    renameLocation,
    isViewingSharedLink,
  } = useLocationStorage(urlLocations);
  const { weatherData, fetchWeatherForLocations } = useWeatherData();

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

  const handleReorderLocations = (locations: Location[]) => {
    reorderLocations(locations);
  };

  const handleRenameLocation = (locationId: string, newName: string) => {
    renameLocation(locationId, newName);
  };

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

  const handleExportCSV = async () => {
    if (locations.length === 0) {
      return;
    }

    const csv = exportLocationsToCSV(locations);
    try {
      await navigator.clipboard.writeText(csv);
    } catch (error) {
      console.error("Failed to copy CSV:", error);
    }
  };

  const handleExportCSVFile = () => {
    if (locations.length === 0) {
      return;
    }

    const csv = exportLocationsToCSV(locations);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `floatwise-locations-${timestamp}.csv`);
  };

  const handleImportCSV = (importedLocations: Location[]) => {
    // Add all imported locations (duplicates will be prevented by addLocation)
    importedLocations.forEach(location => {
      addLocation(location);
    });
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
        <div className="bg-white dark:bg-gray-800 shadow-sm  p-1 sm:p-3">
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
                showShareButton={locations.length > 0}
                onShareClick={handleShareClick}
                isViewingSharedLink={isViewingSharedLink}
                onExportCSV={handleExportCSV}
                onExportCSVFile={handleExportCSVFile}
                onImportCSV={handleImportCSV}
              />
            </div>
          </div>
          {/* Calendar */}
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
          {/* Weather Display */}
          <WeatherDisplay locationWeather={weatherData} />
        </div>
      </div>
    </div>
  );
}
