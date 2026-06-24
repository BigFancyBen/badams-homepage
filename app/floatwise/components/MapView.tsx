"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Location, UserPreferences } from "../types";
import { OpenMeteoStation } from "../sources/open-meteo";
import { GeoBounds, getWeatherEmoji, isGoodWeatherHour } from "../utils";

interface MapViewProps {
  /** The user's table input locations (shown as reference pins). */
  locations: Location[];
  /** Actual Open-Meteo grid cells covering the area. */
  stations: OpenMeteoStation[];
  isLoading: boolean;
  error?: string;
  /** Hour of day (0-23) whose data is shown on each station. */
  selectedHour: number;
  preferences: UserPreferences;
  /** Reports the current map viewport (debounced) so stations can be refetched. */
  onViewportChange: (viewport: { bounds: GeoBounds; zoom: number }) => void;
}

/** Temperature text color (hex) mirroring the table: below threshold = red. */
function tempColor(temperature: number, threshold: number): string {
  return temperature >= threshold ? "#f3f4f6" : "#f87171";
}

/** Precip text color (hex): above the user's threshold reads red. */
function precipColor(precipChance: number, threshold: number): string {
  return precipChance > threshold ? "#f87171" : "#9ca3af";
}

/** Build the label-style marker for an actual weather station (grid cell). */
function stationIcon(
  temperature: number,
  color: string,
  windDeg: number,
  precipChance: number | null,
  precipTextColor: string,
  good: boolean
): L.DivIcon {
  const rotation = windDeg + 180; // arrow points the way the wind blows TO
  // Good conditions wash the marker green, mirroring the table's green cells.
  const background = good ? "rgba(21,128,61,0.95)" : "rgba(17,24,39,0.92)";
  const borderColor = good ? "#22c55e" : "#4b5563";
  const precipHtml =
    precipChance !== null
      ? `<span style="display:inline-flex;align-items:center;gap:1px;color:${precipTextColor};font-size:9px;font-weight:600;">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12 2 5 11 5 16a7 7 0 0 0 14 0c0-5-7-14-7-14z"/></svg>${precipChance}%
        </span>`
      : "";
  const html = `
    <div style="display:inline-flex;flex-direction:column;align-items:center;line-height:1;background:${background};border:1px solid ${borderColor};padding:1px 4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.5);">
      <span style="display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:600;color:${color};">
        <span>${temperature}&deg;</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="transform:rotate(${rotation}deg);">
          <path d="M12 4L12 20M12 4L7 9M12 4L17 9" stroke="#93c5fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      ${precipHtml}
    </div>`;
  return L.divIcon({
    html,
    className: "fw-station-icon",
    iconSize: [44, 28],
    iconAnchor: [22, 14],
  });
}

/** Build the pin for a user's table location (reference point). */
function locationIcon(): L.DivIcon {
  const html = `<div style="width:14px;height:14px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 0 0 1px #1e3a8a, 0 1px 3px rgba(0,0,0,0.5);"></div>`;
  return L.divIcon({
    html,
    className: "fw-location-icon",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * Pans/zooms the map to contain the user's table locations whenever they change.
 */
function FitToLocations({ locations }: { locations: Location[] }) {
  const map = useMap();

  // Stable dependency so the effect only re-runs when the coordinates change.
  const key = locations.map((l) => `${l.lat},${l.lon}`).join("|");

  useEffect(() => {
    if (locations.length === 0) return;

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lon], 10);
      return;
    }

    const bounds = L.latLngBounds(
      locations.map((l) => [l.lat, l.lon] as [number, number])
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

/**
 * Reports the current viewport (debounced) on pan/zoom so the parent can
 * refetch the actual stations for wherever the user is now looking.
 */
function BoundsWatcher({
  onViewportChange,
}: {
  onViewportChange: (viewport: { bounds: GeoBounds; zoom: number }) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useCallback(
    (m: L.Map) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const b = m.getBounds();
        onViewportChange({
          bounds: {
            minLat: b.getSouth(),
            maxLat: b.getNorth(),
            minLon: b.getWest(),
            maxLon: b.getEast(),
          },
          zoom: m.getZoom(),
        });
      }, 500);
    },
    [onViewportChange]
  );

  const map = useMapEvents({
    moveend: () => report(map),
    zoomend: () => report(map),
  });

  // Report the initial viewport once the map is ready.
  useEffect(() => {
    report(map);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function MapView({
  locations,
  stations,
  isLoading,
  error,
  selectedHour,
  preferences,
  onViewportChange,
}: MapViewProps) {
  const center = useMemo<[number, number]>(() => {
    if (locations.length > 0) {
      return [locations[0].lat, locations[0].lon];
    }
    return [39.5, -98.35]; // Geographic center of the contiguous US.
  }, [locations]);

  const locIcon = useMemo(() => locationIcon(), []);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 px-1 text-[11px] text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-blue-600 border-2 border-white" />
          <span>Your locations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-1 border border-gray-500 bg-gray-900 text-gray-100 text-[9px] font-semibold leading-none">
            72&deg;
          </span>
          <span>Weather stations (actual source data)</span>
        </div>
        {isLoading && (
          <span className="text-blue-500">Loading stations…</span>
        )}
        {error && <span className="text-red-500">{error}</span>}
        {!isLoading && !error && (
          <span className="text-gray-400 dark:text-gray-500">
            {stations.length} station{stations.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div
        className="w-full border border-gray-300 dark:border-gray-600"
        style={{ height: "70vh" }}
      >
        <MapContainer
          center={center}
          zoom={9}
          scrollWheelZoom
          style={{ height: "100%", width: "100%", background: "#1f2937" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <FitToLocations locations={locations} />
          <BoundsWatcher onViewportChange={onViewportChange} />

          {/* Actual Open-Meteo grid cells ("weather stations") */}
          {stations.map((station) => {
            const hourData =
              station.hours.find((h) => h.hour === selectedHour) ?? null;
            if (!hourData) return null;
            // Stations have no preferred wind direction, so "good" here means
            // warm/calm/dry enough — same thresholds as the table.
            const good = isGoodWeatherHour(hourData, preferences);
            const color = good
              ? "#f0fdf4"
              : tempColor(hourData.temperature, preferences.temperatureThreshold);
            return (
              <Marker
                key={`station-${station.lat},${station.lon}`}
                position={[station.lat, station.lon]}
                icon={stationIcon(
                  hourData.temperature,
                  color,
                  hourData.windDirectionDegrees,
                  hourData.precipChance,
                  good
                    ? "#dcfce7"
                    : hourData.precipChance !== null
                    ? precipColor(
                        hourData.precipChance,
                        preferences.precipThreshold
                      )
                    : "#9ca3af",
                  good
                )}
                zIndexOffset={good ? 200 : 100}
              >
                <Popup>
                  <div className="text-xs leading-snug">
                    <div className="font-semibold mb-1">
                      Weather station {getWeatherEmoji(hourData.weatherCode)}
                    </div>
                    <div className="text-gray-600">
                      {station.lat.toFixed(4)}, {station.lon.toFixed(4)}
                      {typeof station.elevation === "number" && (
                        <> · {Math.round(station.elevation)} m</>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <div>{hourData.time}</div>
                      <div>
                        {hourData.temperature}° · {hourData.shortForecast}
                      </div>
                      <div>
                        Wind {hourData.windSpeed} {hourData.windDirection}
                      </div>
                      {hourData.precipChance !== null && (
                        <div>Precip {hourData.precipChance}%</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* User's table input locations (reference) */}
          {locations.map((location) => (
            <Marker
              key={`loc-${location.id}`}
              position={[location.lat, location.lon]}
              icon={locIcon}
              zIndexOffset={500}
            >
              <Popup>
                <div className="text-xs leading-snug">
                  <div className="font-semibold">{location.name}</div>
                  {location.subtitle && (
                    <div className="text-gray-600">{location.subtitle}</div>
                  )}
                  <div className="text-gray-600 mt-0.5">
                    {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
