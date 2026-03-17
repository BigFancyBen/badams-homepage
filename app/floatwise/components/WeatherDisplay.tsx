import { WeatherDisplayProps, LocationWeather } from "../types";
import { getWeatherEmoji, normalizeWindDirection, getWindDirectionProximity } from "../utils";

// Helper function to get color based on precipitation chance
function getPrecipChanceColor(precipChance: number, threshold: number): string {
  if (precipChance > threshold) {
    return "text-red-600 dark:text-red-500 font-semibold";
  } else {
    return "text-gray-900 dark:text-gray-100";
  }
}

// Helper function to get color based on temperature
// Below threshold = red, at or above = black/standard
function getTemperatureColor(temperature: number, threshold: number): string {
  if (temperature >= threshold) {
    return "text-gray-900 dark:text-gray-100";
  } else {
    return "text-red-600 dark:text-red-500 font-semibold";
  }
}

// Helper function to format location names with state abbreviations
function formatLocationName(locationName: string): string {
  // Common state name to abbreviation mapping
  const stateAbbreviations: { [key: string]: string } = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
  };

  // Replace state names with abbreviations
  let formatted = locationName;
  Object.entries(stateAbbreviations).forEach(([fullName, abbrev]) => {
    formatted = formatted.replace(new RegExp(`\\b${fullName}\\b`, "g"), abbrev);
  });

  return formatted;
}

// Helper function to determine display names based on shared states
function getDisplayNames(locationWeather: LocationWeather[]): {
  [key: string]: string;
} {
  const validLocations = locationWeather.filter(
    (l) => !l.isLoading && !l.error && l.hours.length > 0
  );

  if (validLocations.length === 0) return {};

  // Extract states from location names
  const states = validLocations
    .map((l) => {
      const formatted = formatLocationName(l.location.name);
      const parts = formatted.split(", ");
      return parts.length > 1 ? parts[parts.length - 1] : null;
    })
    .filter(Boolean);

  // Check if all locations share the same state
  const uniqueStates = [...new Set(states)];
  const sameState = uniqueStates.length === 1;

  // Create display names
  const displayNames: { [key: string]: string } = {};
  validLocations.forEach((locationData) => {
    const formatted = formatLocationName(locationData.location.name);
    if (sameState) {
      // Remove state if all locations share the same state
      const parts = formatted.split(", ");
      displayNames[locationData.location.id] = parts[0];
    } else {
      displayNames[locationData.location.id] = formatted;
    }
  });

  // Add fallback entries for loading/errored locations so they have display names
  locationWeather.forEach((locationData) => {
    if (!displayNames[locationData.location.id]) {
      displayNames[locationData.location.id] = formatLocationName(locationData.location.name);
    }
  });

  return displayNames;
}

// SVG wind direction arrow component
function WindArrow({ degrees, className }: { degrees: number; className: string }) {
  // Add 180° so arrow points in the direction wind is blowing TO
  const rotation = degrees + 180;
  return (
    <svg
      className={`w-5 h-5 sm:w-6 sm:h-6 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M12 4L12 20M12 4L7 9M12 4L17 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Get arrow color based on preferred direction proximity or wind speed threshold
function getArrowColor(
  windDirectionDegrees: number,
  windSpeed: string,
  windSpeedThreshold: number,
  preferredDirection?: string
): string {
  if (preferredDirection) {
    const normalized = normalizeWindDirection(preferredDirection);
    const proximity = getWindDirectionProximity(windDirectionDegrees, normalized);
    if (proximity === 'exact') return "text-green-500";
    if (proximity === 'adjacent') return "text-yellow-500";
    return "text-red-500";
  }
  const speed = parseInt(windSpeed.replace(/[^\d]/g, "")) || 0;
  if (speed > windSpeedThreshold) {
    return "text-red-600 dark:text-red-500";
  }
  return "text-gray-900 dark:text-gray-100";
}

export function WeatherDisplay({ locationWeather, preferences, loadedCount, totalCount }: WeatherDisplayProps) {
  if (locationWeather.length === 0) {
    return null;
  }

  // Get all unique hours from all locations to create unified column headers
  // Always show all 24 hours (or a fixed set of hours) to keep columns consistent
  // Fixed set of columns for 10am to 7pm
  const hourTimeMap = new Map<number, string>();
  const sortedHours = Array.from({ length: 10 }, (_, i) => i + 10); // 10 to 19
  sortedHours.forEach((hour) => {
    const ampm =
      hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
    hourTimeMap.set(hour, ampm);
  });

  const loadingCount = locationWeather.filter((l) => l.isLoading).length;

  // Check if all locations failed (none loading, none with data)
  const hasAnyData = locationWeather.some(
    (locationData) =>
      !locationData.isLoading &&
      !locationData.error &&
      locationData.hours.length > 0
  );

  if (!hasAnyData && loadingCount === 0) {
    return (
      <div className="w-full">
        <div className="text-center py-8 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700">
          <p className="mb-2">Failed to load weather data</p>
          <p className="text-sm">No weather data available for this date</p>
        </div>
      </div>
    );
  }

  const displayNames = getDisplayNames(locationWeather);

  return (
    <div className="w-full ">
      {loadingCount > 0 && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Loading weather data...{totalCount && totalCount > 1 ? ` (${loadedCount}/${totalCount} locations)` : ''}
          </span>
        </div>
      )}
      <div className="">
        <div
          className="overflow-x-auto -mx-3 sm:mx-0"
          style={{ height: "auto", maxHeight: "80vh" }}
        >
          <table className="w-full table-fixed border-collapse text-[10px] sm:text-[11px] min-w-[700px]">
            <thead className="sticky top-0 z-30">
              <tr
                className="bg-white dark:bg-gray-800"
                style={{ boxShadow: "0 2px 0 0 rgb(156 163 175)" }}
              >
                <th className="sticky left-0 z-40 text-left py-0.5 px-1 sm:px-1.5 font-medium text-gray-700 dark:text-gray-200 text-[10px] sm:text-[11px] w-[50px] sm:w-[55px] bg-white dark:bg-gray-800 sticky-right-divider"></th>
                {sortedHours.map((hour, idx) => (
                  <th
                    key={hour}
                    className={`text-center py-0.5 px-0 font-medium text-gray-700 dark:text-gray-200 text-[10px] sm:text-[11px] whitespace-nowrap ${
                      idx % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                    style={{
                      width: "56px",
                      minWidth: "56px",
                      maxWidth: "56px",
                    }}
                  >
                    <div>{hourTimeMap.get(hour)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locationWeather.map((locationData, locationIndex) => {
                if (
                  locationData.isLoading ||
                  locationData.error ||
                  locationData.hours.length === 0
                ) {
                  return (
                    <tr key={`${locationData.location.id}-skeleton`} className="h-[40px]">
                      <td
                        className={`sticky left-0 z-30 py-1 px-1 sm:px-1.5 pl-2 font-medium text-gray-900 dark:text-gray-100 text-[10px] sm:text-[11px] whitespace-normal sticky-right-divider border-b border-gray-500/20 w-[50px] sm:w-[55px] ${
                          locationIndex === 0
                            ? "border-t-2 border-t-white dark:border-t-gray-900"
                            : "border-t border-t-gray-500/20"
                        } ${
                          locationIndex % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "bg-gray-50 dark:bg-gray-700"
                        }`}
                      >
                        <div
                          className="font-semibold mx-1 text-[8px] sm:text-[9px] leading-tight line-clamp-3 wrap-break-word"
                          title={displayNames[locationData.location.id] || locationData.location.name}
                        >
                          {displayNames[locationData.location.id] || locationData.location.name}
                          {locationData.location.subtitle && (
                            <div className="font-normal text-[7px] sm:text-[8px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {locationData.location.subtitle}
                            </div>
                          )}
                        </div>
                      </td>
                      {sortedHours.map((hour, idx) => {
                        const isRowEven = locationIndex % 2 === 0;
                        const isColEven = idx % 2 === 0;
                        const cellBgClass = isRowEven
                          ? isColEven
                            ? "bg-white dark:bg-gray-800"
                            : "bg-gray-50 dark:bg-gray-700"
                          : isColEven
                          ? "bg-gray-50 dark:bg-gray-800"
                          : "bg-white dark:bg-gray-700";
                        return (
                          <td
                            key={hour}
                            className={`py-1 px-0 text-center border-b border-gray-500/20 ${cellBgClass}`}
                          >
                            <div className="animate-pulse space-y-1 py-1 px-0.5">
                              <div className="h-2 bg-gray-200 dark:bg-gray-600 w-8 mx-auto"></div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-600 w-6 mx-auto"></div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                const hourDataMap = new Map();
                locationData.hours.forEach((hour) => {
                  hourDataMap.set(hour.hour, hour);
                });

                return (
                  // Combined temperature and wind row for this location
                  <tr
                    key={`${locationData.location.id}-combined`}
                    className="h-[40px]"
                  >
                    <td
                      className={`sticky left-0 z-30 py-1 px-1 sm:px-1.5 pl-2 font-medium text-gray-900 dark:text-gray-100 text-[10px] sm:text-[11px] whitespace-normal sticky-right-divider border-b border-gray-500/20 w-[50px] sm:w-[55px] ${
                        locationIndex === 0
                          ? "border-t-2 border-t-white dark:border-t-gray-900"
                          : "border-t border-t-gray-500/20"
                      } ${
                        locationIndex % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "bg-gray-50 dark:bg-gray-700"
                      }`}
                    >
                      <div
                        className="font-semibold mx-1 text-[8px] sm:text-[9px] leading-tight line-clamp-3 wrap-break-word"
                        title={
                          displayNames[locationData.location.id] ||
                          locationData.location.name
                        }
                      >
                        {displayNames[locationData.location.id] ||
                          locationData.location.name}
                        {locationData.location.subtitle && (
                          <div className="font-normal text-[7px] sm:text-[8px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {locationData.location.subtitle}
                          </div>
                        )}
                      </div>
                    </td>
                    {sortedHours.map((hour, idx) => {
                      const hourData = hourDataMap.get(hour);
                      const colors = hourData
                        ? getWindSpeedColor(hourData.windSpeed, preferences.windSpeedThreshold)
                        : null;
                      const windDirColor = hourData
                        ? getWindDirectionColor(hourData.windDirectionDegrees, locationData.location.preferredWindDirection)
                        : "";
                      const arrowColor = hourData
                        ? getArrowColor(hourData.windDirectionDegrees, hourData.windSpeed, preferences.windSpeedThreshold, locationData.location.preferredWindDirection)
                        : "";
                      // Checkerboard cell background based on row and column parity
                      const isRowEven = locationIndex % 2 === 0;
                      const isColEven = idx % 2 === 0;
                      const cellBgClass = isRowEven
                        ? isColEven
                          ? "bg-white dark:bg-gray-800"
                          : "bg-gray-50 dark:bg-gray-700"
                        : isColEven
                        ? "bg-gray-50 dark:bg-gray-800"
                        : "bg-white dark:bg-gray-700";
                      return (
                        <td
                          key={`combined-${hour}`}
                          className={`py-1 px-0 text-center border-b border-gray-500/20  ${cellBgClass}`}
                        >
                          {hourData ? (
                            <div className="mx-auto flex flex-row items-center justify-center gap-0.5 sm:max-w-[65px]">
                              {/* Wind direction arrow */}
                              <div className="shrink-0">
                                <WindArrow
                                  degrees={hourData.windDirectionDegrees}
                                  className={arrowColor}
                                />
                              </div>
                              {/* Right column: stacked data */}
                              <div className="flex flex-col items-start justify-center gap-px">
                                {/* Temperature + emoji */}
                                <div className="flex items-center gap-0.5">
                                  <span className={`text-[10px] sm:text-[11px] font-medium leading-none ${getTemperatureColor(hourData.temperature, preferences.temperatureThreshold)}`}>
                                    {hourData.temperature}°
                                  </span>
                                  <span
                                    className="text-[10px] sm:text-[11px] leading-none"
                                    title={hourData.shortForecast}
                                  >
                                    {getWeatherEmoji(hourData.weatherCode)}
                                  </span>
                                </div>
                                {/* Wind speed + compass direction */}
                                <div className="text-[9px] sm:text-[10px] whitespace-nowrap leading-none">
                                  <span className={colors?.text}>
                                    {hourData.windSpeed.replace(/\s*mph/i, "")}
                                  </span>
                                  {" "}
                                  <span className={locationData.location.preferredWindDirection ? windDirColor : (colors?.text || "")}>
                                    {hourData.windDirection}
                                  </span>
                                </div>
                                {/* Precipitation % */}
                                <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] leading-none">
                                  {hourData.precipChance !== null && (
                                    <span
                                      className={getPrecipChanceColor(
                                        hourData.precipChance,
                                        preferences.precipThreshold
                                      )}
                                    >
                                      {hourData.precipChance}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-600">
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper function to get color based on wind speed
function getWindSpeedColor(windSpeed: string, threshold: number): { text: string; arrow: string } {
  // Extract numeric value from wind speed (e.g., "10 mph" -> 10)
  const speed = parseInt(windSpeed.replace(/[^\d]/g, "")) || 0;

  if (speed > threshold) {
    return {
      text: "text-red-600 dark:text-red-500 font-semibold",
      arrow: "border-red-600 dark:border-red-500",
    };
  } else {
    return {
      text: "text-gray-900 dark:text-gray-100",
      arrow: "border-gray-900 dark:border-gray-100",
    };
  }
}

// Helper function to get wind direction text color based on preferred direction proximity
function getWindDirectionColor(
  actualDegrees: number,
  preferredDirection?: string
): string {
  if (!preferredDirection) return "text-gray-900 dark:text-gray-100";
  const normalized = normalizeWindDirection(preferredDirection);
  const proximity = getWindDirectionProximity(actualDegrees, normalized);
  if (proximity === 'exact') return "text-green-600 dark:text-green-400 font-semibold";
  if (proximity === 'adjacent') return "text-yellow-600 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
}
