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
  /**
   * The inner SVG path elements for this category's icon, as raw markup. Icons
   * are from lucide (https://lucide.dev, ISC license) and are drawn on a
   * 0 0 24 24 viewBox with `fill="none"` and `stroke="currentColor"`. Stored as
   * strings so the same glyph can be injected into a Leaflet div-icon (an HTML
   * string) and rendered as a React <svg> without drifting apart.
   */
  iconPaths: string;
  /** Accent color (hex) used for the marker background/legend chip. */
  color: string;
}

/**
 * The ordered list of waypoint categories. Order matters: the index is used as
 * a compact identifier when encoding waypoints into a share URL, so append new
 * categories to the END rather than inserting in the middle.
 */
export const WAYPOINT_CATEGORIES: WaypointCategoryMeta[] = [
  {
    id: 'put-in',
    label: 'Put In',
    color: '#22c55e',
    // lucide "sailboat"
    iconPaths:
      '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
  },
  {
    id: 'take-out',
    label: 'Take Out',
    color: '#ef4444',
    // lucide "flag"
    iconPaths:
      '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  },
  {
    id: 'potty-stop',
    label: 'Potty Stop',
    color: '#3b82f6',
    // lucide "toilet"
    iconPaths:
      '<path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/>',
  },
  {
    id: 'swimming-hole',
    label: 'Swimming Hole',
    color: '#06b6d4',
    // lucide "waves"
    iconPaths:
      '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  },
  {
    id: 'picnic',
    label: 'Picnic',
    color: '#f59e0b',
    // lucide "utensils-crossed"
    iconPaths:
      '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  },
  {
    id: 'landmark',
    label: 'Landmark',
    color: '#a855f7',
    // lucide "landmark"
    iconPaths:
      '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
  },
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