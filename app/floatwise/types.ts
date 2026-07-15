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

// ── River waypoints ─────────────────────────────────────────────────────────

/** The category a waypoint can belong to. A waypoint may have several. */
export type WaypointCategory =
  | 'put-in'
  | 'take-out'
  | 'potty-stop'
  | 'swimming-hole'
  | 'picnic'
  | 'landmark';

/** Display metadata for each waypoint category. */
export interface WaypointCategoryMeta {
  id: WaypointCategory;
  label: string;
  /** Emoji shown on the map marker and in the picker. */
  emoji: string;
  /** Accent color (hex) used for the marker border/pointer. */
  color: string;
}

/**
 * The ordered list of waypoint categories. Order matters: the index is used as
 * a compact identifier when encoding waypoints into a share URL, so append new
 * categories to the END rather than inserting in the middle.
 */
export const WAYPOINT_CATEGORIES: WaypointCategoryMeta[] = [
  { id: 'put-in', label: 'Put In', emoji: '🛶', color: '#22c55e' },
  { id: 'take-out', label: 'Take Out', emoji: '🏁', color: '#ef4444' },
  { id: 'potty-stop', label: 'Potty Stop', emoji: '🚻', color: '#3b82f6' },
  { id: 'swimming-hole', label: 'Swimming Hole', emoji: '🏊', color: '#06b6d4' },
  { id: 'picnic', label: 'Picnic', emoji: '🧺', color: '#f59e0b' },
  { id: 'landmark', label: 'Landmark', emoji: '📸', color: '#a855f7' },
];

/** Fast lookup of category metadata by id. */
export const WAYPOINT_CATEGORY_MAP: Record<WaypointCategory, WaypointCategoryMeta> =
  WAYPOINT_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.id] = c;
      return acc;
    },
    {} as Record<WaypointCategory, WaypointCategoryMeta>
  );

/** A user-placed point of interest along a river. */
export interface Waypoint {
  id: string;
  /** Optional short label (e.g. "Boulder rapids"). */
  name?: string;
  lat: number;
  lon: number;
  /** One or more categories. A waypoint always has at least one. */
  categories: WaypointCategory[];
  /** Optional free-form note. */
  note?: string;
}

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