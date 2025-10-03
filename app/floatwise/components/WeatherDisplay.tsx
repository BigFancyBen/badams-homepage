import { WeatherDisplayProps, LocationWeather } from "../types";
import { formatDate } from "../utils";
import {
  WeatherLottieIcon,
  getWeatherLottieIconType,
} from "../lottieweathericons/WeatherLottieIcon";

// Helper function to get color based on precipitation chance
function getPrecipChanceColor(precipChance: number): string {
  if (precipChance >= 70) {
    return "text-red-600 dark:text-red-400 font-semibold";
  } else if (precipChance >= 50) {
    return "text-orange-600 dark:text-orange-400 font-medium";
  } else if (precipChance >= 30) {
    return "text-yellow-600 dark:text-yellow-500 font-medium";
  } else if (precipChance >= 10) {
    return "text-blue-600 dark:text-blue-400";
  } else {
    return "text-gray-500 dark:text-gray-400";
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

  return displayNames;
}

export function WeatherDisplay({
  locationWeather,
  selectedDate,
}: WeatherDisplayProps) {
  if (locationWeather.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Add locations to view weather data</p>
      </div>
    );
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

  // Check if any location has data
  const hasAnyData = locationWeather.some(
    (locationData) =>
      !locationData.isLoading &&
      !locationData.error &&
      locationData.hours.length > 0
  );

  if (!hasAnyData) {
    const loadingCount = locationWeather.filter((l) => l.isLoading).length;

    if (loadingCount > 0) {
      return (
        <div className="w-full">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-gray-600 dark:text-gray-300">
              Loading weather data...
            </span>
          </div>
        </div>
      );
    }

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
                  return null; // Skip locations without data
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
                        className="font-semibold mx-1 text-[8px] sm:text-[9px] leading-tight line-clamp-3 break-words"
                        title={
                          displayNames[locationData.location.id] ||
                          locationData.location.name
                        }
                      >
                        {displayNames[locationData.location.id] ||
                          locationData.location.name}
                      </div>
                    </td>
                    {sortedHours.map((hour, idx) => {
                      const hourData = hourDataMap.get(hour);
                      const colors = hourData
                        ? getWindSpeedColor(hourData.windSpeed)
                        : null;
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
                            <div className="ml-2 sm:mx-auto flex flex-row items-center justify-between sm:max-w-[65px] relative">
                              <div className="flex flex-col items-start justify-center gap-[1px]">
                                {/* Temperature */}
                                <span className="text-[10px] sm:text-[11px] text-gray-900 dark:text-gray-100 font-medium leading-none">
                                  {hourData.temperature}°
                                </span>
                                {/* Wind - prevent wrapping with nowrap */}
                                <div className="text-[9px] sm:text-[10px] whitespace-nowrap leading-none z-20">
                                  <span className={colors?.text}>
                                    {hourData.windSpeed.replace(/\s*mph/i, "")}{" "}
                                    {hourData.windDirection}
                                  </span>
                                </div>
                                {/* Precipitation % + Weather Icon on same line */}
                                <div className="flex items-center justify-center gap-0.5 text-[9px] sm:text-[10px] leading-none z-20">
                                  {hourData.precipChance !== null &&
                                    hourData.precipChance >= 5 && (
                                      <span
                                        className={getPrecipChanceColor(
                                          hourData.precipChance
                                        )}
                                      >
                                        {hourData.precipChance}%
                                      </span>
                                    )}
                                </div>
                              </div>
                              <WeatherLottieIcon
                                type={getWeatherLottieIconType(
                                  hourData.shortForecast,
                                  hourData.precipChance,
                                  hourData.hour
                                )}
                                className="w-8 h-8 shrink-0 absolute right-0 z-10 opacity-60"
                                title={hourData.shortForecast}
                              />
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
function getWindSpeedColor(windSpeed: string): { text: string; arrow: string } {
  // Extract numeric value from wind speed (e.g., "10 mph" -> 10)
  const speed = parseInt(windSpeed.replace(/[^\d]/g, "")) || 0;

  if (speed === 0) {
    return {
      text: "text-gray-400 dark:text-gray-500",
      arrow: "border-gray-400 dark:border-gray-500",
    };
  } else if (speed <= 5) {
    return {
      text: "text-green-600 dark:text-green-400",
      arrow: "border-green-600 dark:border-green-400",
    };
  } else if (speed <= 10) {
    return {
      text: "text-teal-600 dark:text-teal-400",
      arrow: "border-teal-600 dark:border-teal-400",
    };
  } else if (speed <= 15) {
    return {
      text: "text-yellow-600 dark:text-yellow-400",
      arrow: "border-yellow-600 dark:border-yellow-400",
    };
  } else if (speed <= 20) {
    return {
      text: "text-orange-600 dark:text-orange-400",
      arrow: "border-orange-600 dark:border-orange-400",
    };
  } else if (speed <= 30) {
    return {
      text: "text-red-600 dark:text-red-400",
      arrow: "border-red-600 dark:border-red-400",
    };
  } else {
    return {
      text: "text-purple-600 dark:text-purple-400",
      arrow: "border-purple-600 dark:border-purple-400",
    };
  }
}
