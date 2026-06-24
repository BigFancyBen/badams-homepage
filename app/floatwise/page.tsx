"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Calendar } from "./components/Calendar";
import { HourSelector } from "./components/HourSelector";
import { LocationManager } from "./components/LocationManager";
import { WeatherDisplay } from "./components/WeatherDisplay";
import { RiverFlow } from "./components/RiverFlow";
import { useLocationStorage } from "./hooks/useLocationStorage";
import { useWeatherData } from "./hooks/useWeatherData";
import { useStationData } from "./hooks/useStationData";
import { useUserPreferences } from "./hooks/useUserPreferences";
import { Location } from "./types";
import {
  encodeLocationsToURL,
  decodeLocationsFromURL,
  getInitialDate,
  GeoBounds,
} from "./utils";

// Leaflet touches `window`, so the map view is client-only (no SSR).
const MapView = dynamic(
  () => import("./components/MapView").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full border border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-100 dark:bg-gray-900"
        style={{ height: "70vh" }}
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    ),
  }
);

type FloatWiseTab = "table" | "map";

export default function FloatWisePage() {
  const [selectedDate, setSelectedDate] = useState(getInitialDate());
  const [activeTab, setActiveTab] = useState<FloatWiseTab>("table");
  const [selectedHour, setSelectedHour] = useState(12);
  const [mapViewport, setMapViewport] = useState<{
    bounds: GeoBounds;
    zoom: number;
  } | null>(null);
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
  const {
    stations,
    isLoading: stationsLoading,
    error: stationsError,
    fetchStations,
  } = useStationData();
  const { preferences, updatePreferences } = useUserPreferences();

  // Fetch weather data when locations or selected date changes
  useEffect(() => {
    if (isLoaded && locations.length > 0) {
      fetchWeatherForLocations(locations, selectedDate);
    }
  }, [locations, selectedDate, isLoaded, fetchWeatherForLocations]);

  // Fetch the actual weather stations for the current map viewport. Driven by
  // the map viewport (updated on pan/zoom) and the selected date. The hook
  // caches per day and skips redundant fetches, so this can fire freely.
  useEffect(() => {
    if (isLoaded && activeTab === "map" && mapViewport) {
      fetchStations(mapViewport, selectedDate);
    }
  }, [activeTab, mapViewport, selectedDate, isLoaded, fetchStations]);

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                FloatWise
              </h1>
              <RiverFlow />
              {weatherData.some((l) => l.isLoading) && (
                <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
                  <svg className="w-5 h-4 text-blue-500" viewBox="0 0 28 16">
                    <path
                      d="M0 10 Q3.5 4, 7 10 Q10.5 16, 14 10 Q17.5 4, 21 10 Q24.5 16, 28 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0; -14,0; 0,0"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </svg>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {totalCount && totalCount > 1 ? `${loadedCount}/${totalCount}` : 'Loading...'}
                  </span>
                </div>
              )}
            </div>
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
              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-300 dark:border-gray-600 mb-2 px-1 sm:px-0">
                {(["table", "map"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                      activeTab === tab
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Calendar (shared date selection) */}
              <Calendar
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />

              {activeTab === "table" ? (
                /* Weather Display */
                <WeatherDisplay
                  locationWeather={weatherData}
                  preferences={preferences}
                  loadedCount={loadedCount}
                  totalCount={totalCount}
                />
              ) : (
                <>
                  {/* Time selection (map only) */}
                  <HourSelector
                    selectedHour={selectedHour}
                    onHourSelect={setSelectedHour}
                  />
                  <MapView
                    locations={locations}
                    stations={stations}
                    isLoading={stationsLoading}
                    error={stationsError}
                    selectedHour={selectedHour}
                    preferences={preferences}
                    onViewportChange={setMapViewport}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
