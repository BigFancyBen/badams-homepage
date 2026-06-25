// Location types
export interface Location {
  id: string;
  name: string;
  lat: number;
  lon: number;
  subtitle?: string;
  preferredWindDirection?: string;
}

// --- Float tracking ---------------------------------------------------------

/** A single recorded GPS fix along a float. */
export interface TrackPoint {
  lat: number;
  lon: number;
  t: number; // epoch ms
  accuracy?: number; // meters, if known
  speed?: number | null; // m/s, if the platform reports it
  heading?: number | null; // degrees from true north, if the platform reports it
}

/** A detected pull-over / lunch break within a float. */
export interface FloatStop {
  lat: number;
  lon: number;
  startT: number;
  endT: number;
  durationMs: number;
}

/** A recorded float trip — in progress (endedAt === null) or completed. */
export interface FloatTrip {
  id: string;
  startedAt: number;
  endedAt: number | null;
  track: TrackPoint[];
  putIn: { lat: number; lon: number };
  takeOut: { lat: number; lon: number } | null;
  distanceMeters: number;
  totalMs: number;
  movingMs: number;
  stoppedMs: number;
  stops: FloatStop[];
  /** Optional user-given name; defaults to the start date. */
  name?: string;
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

// Processed weather data for display
export interface WeatherHour {
  time: string;
  hour: number;
  temperature: number;
  windSpeed: string;
  windDirection: string;
  precipChance: number | null;
  shortForecast: string;
  windDirectionDegrees: number;
  weatherCode: number;
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
  loadedCount?: number;
  totalCount?: number;
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