// Location types
export interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  subtitle?: string;
  preferredWindDirection?: string;
}

// Wind direction constants
export const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type WindDirection = typeof WIND_DIRECTIONS[number];

// User preferences for display thresholds
export interface UserPreferences {
  temperatureThreshold: number;   // Below this = red (default 65)
  precipThreshold: number;        // Above this = red (default 30)
  windSpeedThreshold: number;     // Above this = red (default 10)
}

// Weather data from NOAA API
export interface NOAAForecast {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  probabilityOfPrecipitation?: {
    unitCode: string;
    value: number | null;
  };
}

export interface NOAAResponse {
  properties: {
    periods: NOAAForecast[];
  };
}

// Processed weather data for display
export interface WeatherHour {
  time: string;
  hour: number;
  temperature: number;
  windSpeed: string;
  windDirection: string;
  precipChance: number | null;
  shortForecast: string;
}

export interface LocationWeather {
  location: Location;
  date: string;
  hours: WeatherHour[];
  isLoading: boolean;
  error?: string;
}

// Component props
export interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export interface LocationManagerProps {
  locations: Location[];
  onAddLocation: (location: Location) => void;
  onRemoveLocation: (locationId: string) => void;
  onReorderLocations: (locations: Location[]) => void;
  onRenameLocation: (locationId: string, newName: string) => void;
  onUpdateLocation: (locationId: string, updates: Partial<Location>) => void;
  onImportLocations: (locations: Location[]) => void;
  showShareButton?: boolean;
  onShareClick?: () => Promise<void>;
  isViewingSharedLink?: boolean;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
}

export interface WeatherDisplayProps {
  locationWeather: LocationWeather[];
  preferences: UserPreferences;
}

export interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (location: Location) => void;
  locations: Location[];
  onRemove: (locationId: string) => void;
  onReorder: (locations: Location[]) => void;
  onRename: (locationId: string, newName: string) => void;
  onUpdateLocation: (locationId: string, updates: Partial<Location>) => void;
  onImportLocations: (locations: Location[]) => void;
}

export interface LocationSearchResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
}

// Utility types
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export type WeatherLoadingState = 'idle' | 'loading' | 'success' | 'error';