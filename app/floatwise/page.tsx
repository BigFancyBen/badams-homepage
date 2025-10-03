"use client";

import { useState, useEffect } from "react";
import { Calendar } from "./components/Calendar";
import { LocationManager } from "./components/LocationManager";
import { WeatherDisplay } from "./components/WeatherDisplay";
import { useLocationStorage } from "./hooks/useLocationStorage";
import { useWeatherData } from "./hooks/useWeatherData";
import { Location } from "./types";

export default function FloatWisePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { locations, isLoaded, addLocation, removeLocation } =
    useLocationStorage();
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-1 sm:p-3">
          <div className="flex items-center justify-center mb-2 relative">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
              FloatWise
            </h1>
            <LocationManager
              locations={locations}
              onAddLocation={handleAddLocation}
              onRemoveLocation={handleRemoveLocation}
            />
          </div>
          {/* Calendar */}
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Weather Display */}
          <WeatherDisplay
            locationWeather={weatherData}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </div>
  );
}
