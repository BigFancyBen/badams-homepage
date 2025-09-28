import { WeatherDisplayProps, LocationWeather } from "../types";
import { formatDate } from "../utils";

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
function getDisplayNames(locationWeather: LocationWeather[]): { [key: string]: string } {
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
  const allHours = new Set<number>();
  const hourTimeMap = new Map<number, string>();

  locationWeather.forEach((locationData) => {
    locationData.hours.forEach((hour) => {
      allHours.add(hour.hour);
      hourTimeMap.set(hour.hour, hour.time);
    });
  });

  const sortedHours = Array.from(allHours).sort((a, b) => a - b);

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
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
            Weather for {formatDate(selectedDate)}
          </h2>
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
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
          Weather for {formatDate(selectedDate)}
        </h2>
        <div className="text-center py-8 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700">
          <p className="mb-2">Failed to load weather data</p>
          <p className="text-sm">No weather data available for this date</p>
        </div>
      </div>
    );
  }

  const displayNames = getDisplayNames(locationWeather);

  return (
    <div className="w-full">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
        Weather for {formatDate(selectedDate)}
      </h2>

      <div className="">
        <div
          className="overflow-x-auto -mx-3 sm:mx-0"
          style={{ height: "auto", maxHeight: "80vh" }}
        >
          <table className="w-full min-w-[600px] sm:min-w-[800px] border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-white dark:bg-gray-800" style={{ boxShadow: '0 2px 0 0 rgb(156 163 175)' }}>
                <th className="sticky left-0 z-40 text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-200 text-xs sm:text-sm w-20 bg-white dark:bg-gray-800" style={{ boxShadow: '2px 0 0 0 rgb(156 163 175)' }}></th>
                {sortedHours.map((hour) => (
                  <th
                    key={hour}
                    className="text-center py-2 px-1 sm:px-2 font-medium text-gray-700 dark:text-gray-200 text-xs sm:text-sm min-w-[100px] bg-white dark:bg-gray-800"
                  >
                    {hourTimeMap.get(hour)}
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
                    className={`${
                      locationIndex % 2 === 0
                        ? "bg-gray-50 dark:bg-gray-800"
                        : "bg-white dark:bg-gray-700"
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-20 py-2 sm:py-3 px-2 sm:px-3 font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm ${
                        locationIndex % 2 === 0
                          ? "bg-gray-50 dark:bg-gray-800"
                          : "bg-white dark:bg-gray-700"
                      }`}
                      style={{ boxShadow: '2px 0 0 0 rgb(156 163 175)' }}
                    >
                      <div className="font-semibold">
                        {displayNames[locationData.location.id] ||
                          locationData.location.name}
                      </div>
                    </td>
                    {sortedHours.map((hour) => {
                      const hourData = hourDataMap.get(hour);
                      const colors = hourData
                        ? getWindSpeedColor(hourData.windSpeed)
                        : null;
                      return (
                        <td
                          key={`combined-${hour}`}
                          className="py-2 sm:py-3 px-1 sm:px-2 text-center"
                        >
                          {hourData ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100 font-medium">
                                {hourData.temperature}°
                              </span>
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-xs sm:text-sm ${colors?.text}`}>
                                  {hourData.windSpeed.replace(/\s*mph/i, "")} {hourData.windDirection}
                                </span>
                                <div
                                  className={`w-3 h-3 border-t-2 border-r-2 ${colors?.arrow}`}
                                  style={{
                                    transform: `rotate(${getWindDirectionAngle(
                                      hourData.windDirection
                                    )}deg)`,
                                  }}
                                  title={`Wind from ${hourData.windDirection} at ${hourData.windSpeed}`}
                                />
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

// Helper function to convert wind direction to angle for arrow display
function getWindDirectionAngle(direction: string): number {
  const directions: { [key: string]: number } = {
    N: -135,
    NNE: -112.5,
    NE: -90,
    ENE: -67.5,
    E: -45,
    ESE: -22.5,
    SE: 0,
    SSE: 22.5,
    S: 45,
    SSW: 67.5,
    SW: 90,
    WSW: 112.5,
    W: 135,
    WNW: 157.5,
    NW: 180,
    NNW: -157.5,
  };

  return directions[direction.toUpperCase()] || 0;
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
