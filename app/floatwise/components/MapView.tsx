"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FloatTrip, Location, UserPreferences } from "../types";
import { OpenMeteoStation } from "../sources/open-meteo";
import { GeoBounds, getWeatherEmoji, isGoodWeatherHour } from "../utils";
import { useFloatRecorder } from "../hooks/useFloatRecorder";

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

/** Escape user-provided text before inlining it into marker HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the pin for a user's table location (reference point), with a
 * permanent name label so each location is identifiable on the map without
 * having to click it.
 */
function locationIcon(name: string): L.DivIcon {
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="width:14px;height:14px;background:#2563eb;border:2px solid #ffffff;box-shadow:0 0 0 1px #1e3a8a, 0 1px 3px rgba(0,0,0,0.5);flex:0 0 auto;"></div>
      <span style="margin-left:4px;background:rgba(17,24,39,0.92);border:1px solid #2563eb;color:#f3f4f6;font-size:11px;font-weight:600;line-height:1.2;padding:1px 5px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${escapeHtml(name)}</span>
    </div>`;
  // No iconSize so the pill auto-sizes to the name; anchor stays on the pin
  // center (7,7) so the dot — not the label — marks the coordinate.
  return L.divIcon({
    html,
    className: "fw-location-icon",
    iconAnchor: [7, 7],
  });
}

/**
 * The "you are here" blue dot for the device's current location, styled like
 * the familiar maps marker. When a heading is known we overlay a rotating arrow
 * showing the direction of travel; otherwise it's a plain dot.
 */
function userLocationIcon(heading: number | null): L.DivIcon {
  const arrow =
    heading != null
      ? `<svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;left:-9px;top:-9px;transform:rotate(${heading}deg);">
           <path d="M17 2 L21 11 L17 8.5 L13 11 Z" fill="#3b82f6" stroke="#ffffff" stroke-width="1" stroke-linejoin="round"/>
         </svg>`
      : "";
  const html = `
    <div style="position:relative;width:16px;height:16px;">
      ${arrow}
      <div style="width:16px;height:16px;border-radius:9999px;background:#3b82f6;border:3px solid #ffffff;box-shadow:0 0 0 1.5px rgba(59,130,246,0.7), 0 0 10px 2px rgba(59,130,246,0.6);"></div>
    </div>`;
  return L.divIcon({
    html,
    className: "fw-user-location-icon",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Green flag marking where a float was put in (its start). */
function putInIcon(): L.DivIcon {
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="width:12px;height:12px;border-radius:9999px;background:#22c55e;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>
      <span style="margin-left:4px;background:rgba(21,128,61,0.92);border:1px solid #22c55e;color:#f0fdf4;font-size:10px;font-weight:600;padding:0 4px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">Put-in</span>
    </div>`;
  return L.divIcon({ html, className: "fw-putin-icon", iconAnchor: [6, 6] });
}

/** Checkered marker for where a float was taken out (its end). */
function takeOutIcon(): L.DivIcon {
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="width:12px;height:12px;background:#f59e0b;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>
      <span style="margin-left:4px;background:rgba(180,83,9,0.92);border:1px solid #f59e0b;color:#fffbeb;font-size:10px;font-weight:600;padding:0 4px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">Take-out</span>
    </div>`;
  return L.divIcon({ html, className: "fw-takeout-icon", iconAnchor: [6, 6] });
}

/** Pause marker for a detected stop (pull-over / lunch break). */
function stopIcon(durationLabel: string): L.DivIcon {
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:rgba(17,24,39,0.92);border:1px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,0.5);">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="#f59e0b"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
      </div>
      <span style="margin-left:4px;background:rgba(17,24,39,0.92);border:1px solid #f59e0b;color:#fde68a;font-size:10px;font-weight:600;padding:0 4px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${durationLabel}</span>
    </div>`;
  return L.divIcon({ html, className: "fw-stop-icon", iconAnchor: [9, 9] });
}

const METERS_PER_MILE = 1609.344;

/** Distance in miles, 2 sig figs-ish. */
function formatMiles(meters: number): string {
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
}

/** Duration as "1h 24m" / "47m" / "8m". */
function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "1:24 PM" style local clock time. */
function formatClock(t: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
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

/** Tracks the current zoom level so marker density can scale with it. */
function ZoomTracker({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onZoom(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Thin out stations so the on-screen density stays roughly constant at any zoom.
 * Stations are snapped to a global lat/lon grid whose cell size grows as you
 * zoom out (Leaflet's degrees-per-pixel doubles per zoom level out), and only
 * one station is kept per grid cell. Zooming back in shrinks the cells and
 * reveals more — all from the already-cached data, so it's instant.
 */
function decimateByZoom(
  stations: OpenMeteoStation[],
  zoom: number
): OpenMeteoStation[] {
  // Target ~one marker per ~55px. 360°/(256·2^zoom) is degrees-per-pixel.
  const bucketDeg = (55 * 360) / (256 * Math.pow(2, zoom));
  if (!isFinite(bucketDeg) || bucketDeg <= 0) return stations;

  const seen = new Set<string>();
  const out: OpenMeteoStation[] = [];
  for (const s of stations) {
    const key = `${Math.round(s.lat / bucketDeg)},${Math.round(s.lon / bucketDeg)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Renders a saved float on the map: solid trail + put-in/take-out + stops. */
function SavedTripOverlay({ trip }: { trip: FloatTrip }) {
  const positions = trip.track.map(
    (p) => [p.lat, p.lon] as [number, number]
  );
  return (
    <>
      {positions.length >= 2 && (
        <Polyline
          positions={positions}
          pathOptions={{ color: "#a855f7", weight: 3, opacity: 0.9 }}
        />
      )}
      <Marker position={[trip.putIn.lat, trip.putIn.lon]} icon={putInIcon()}>
        <Popup>
          <div className="text-xs leading-snug">
            <div className="font-semibold">Put-in</div>
            <div className="text-gray-600 mt-0.5">
              {formatClock(trip.startedAt)}
            </div>
          </div>
        </Popup>
      </Marker>
      {trip.takeOut && (
        <Marker
          position={[trip.takeOut.lat, trip.takeOut.lon]}
          icon={takeOutIcon()}
        >
          <Popup>
            <div className="text-xs leading-snug">
              <div className="font-semibold">Take-out</div>
              {trip.endedAt && (
                <div className="text-gray-600 mt-0.5">
                  {formatClock(trip.endedAt)}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
      {trip.stops.map((s) => (
        <Marker
          key={`trip-stop-${s.startT}`}
          position={[s.lat, s.lon]}
          icon={stopIcon(formatDuration(s.durationMs))}
        >
          <Popup>
            <div className="text-xs leading-snug">
              <div className="font-semibold">Stopped here</div>
              <div className="text-gray-600 mt-0.5">
                {formatClock(s.startT)}–{formatClock(s.endT)} ·{" "}
                {formatDuration(s.durationMs)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
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

  // Initial zoom matches the MapContainer's zoom prop below.
  const [zoom, setZoom] = useState(9);
  const visibleStations = useMemo(
    () => decimateByZoom(stations, zoom),
    [stations, zoom]
  );

  // Float recording: a continuous position stream (native background service on
  // the Capacitor build, foreground watchPosition + wake lock on the web) that
  // accumulates a breadcrumb track and persists finished floats. The live blue
  // dot follows the user as they drift; the dotted trail shows where they've
  // been, back to the put-in.
  const mapRef = useRef<L.Map | null>(null);
  // After the first fix we recenter once; further updates move only the dot so
  // the user can still pan/zoom freely without the map yanking back each tick.
  const hasCenteredOnUser = useRef(false);
  const {
    trips,
    isRecording,
    acquiring,
    track,
    latest,
    heading,
    liveSummary,
    error: trackError,
    isNative,
    toggle,
    deleteTrip,
  } = useFloatRecorder();

  // Which saved trip (if any) is overlaid on the map.
  const [shownTripId, setShownTripId] = useState<string | null>(null);
  const shownTrip = useMemo(
    () => trips.find((t) => t.id === shownTripId) ?? null,
    [trips, shownTripId]
  );

  // Reset the "recenter once" latch each time a new recording begins.
  useEffect(() => {
    if (isRecording) hasCenteredOnUser.current = false;
  }, [isRecording]);

  // Recenter on the first fix of a recording; afterwards just let the dot move.
  useEffect(() => {
    const map = mapRef.current;
    if (map && latest && !hasCenteredOnUser.current) {
      map.setView([latest.lat, latest.lon], Math.max(map.getZoom(), 13));
      hasCenteredOnUser.current = true;
    }
  }, [latest]);

  const trailPositions = useMemo(
    () => track.map((p) => [p.lat, p.lon] as [number, number]),
    [track]
  );

  return (
    <div className="w-full">
      {(isLoading || error) && (
        <div className="mb-2 px-1 text-[11px]">
          {isLoading && <span className="text-blue-500">Loading stations…</span>}
          {error && <span className="text-red-500">{error}</span>}
        </div>
      )}

      <div
        className="relative w-full border border-gray-300 dark:border-gray-600"
        style={{ height: "70vh" }}
      >
        <div className="absolute right-2 top-2 z-[1000] flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={toggle}
            title={isRecording ? "Stop recording float" : "Start recording float"}
            aria-label={
              isRecording ? "Stop recording float" : "Start recording float"
            }
            aria-pressed={isRecording}
            className={`flex h-9 items-center justify-center gap-1.5 border px-2.5 text-xs font-semibold shadow ${
              isRecording
                ? "border-red-400 bg-red-600 text-white hover:bg-red-500"
                : "border-gray-600 bg-gray-900/90 text-gray-100 hover:bg-gray-800"
            }`}
          >
            {acquiring ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : isRecording ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="1" />
              </svg>
            ) : (
              <span className="h-3 w-3 rounded-full bg-red-500" />
            )}
            <span>{isRecording ? "Stop float" : "Start float"}</span>
          </button>
          {!isNative && (
            <span className="max-w-[190px] bg-gray-900/90 px-2 py-1 text-right text-[10px] text-amber-300/90 shadow">
              Web mode: keep this screen on. Install the app for hands-off
              background tracking.
            </span>
          )}
          {trackError && (
            <span className="max-w-[190px] bg-gray-900/90 px-2 py-1 text-right text-[10px] text-red-400 shadow">
              {trackError}
            </span>
          )}
        </div>

        {/* Live float stats while recording (or just after a fix lands). */}
        {(isRecording || track.length > 0) && (
          <div className="absolute left-2 top-2 z-[1000] bg-gray-900/90 px-2.5 py-1.5 text-[11px] leading-tight text-gray-100 shadow">
            <div className="flex items-center gap-1.5 font-semibold">
              {isRecording && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
              <span>{acquiring ? "Acquiring GPS…" : "Recording float"}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-300">
              <span>Dist</span>
              <span className="text-right text-gray-100">
                {formatMiles(liveSummary.distanceMeters)}
              </span>
              <span>Elapsed</span>
              <span className="text-right text-gray-100">
                {formatDuration(liveSummary.totalMs)}
              </span>
              <span>Moving</span>
              <span className="text-right text-gray-100">
                {formatDuration(liveSummary.movingMs)}
              </span>
              {liveSummary.stoppedMs > 0 && (
                <>
                  <span>Stopped</span>
                  <span className="text-right text-amber-300">
                    {formatDuration(liveSummary.stoppedMs)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <MapContainer
          ref={mapRef}
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
          <ZoomTracker onZoom={setZoom} />

          {/* A previously saved float, overlaid for review. */}
          {shownTrip && <SavedTripOverlay trip={shownTrip} />}

          {/* Live float: dotted breadcrumb back to the put-in. */}
          {trailPositions.length >= 2 && (
            <Polyline
              positions={trailPositions}
              pathOptions={{
                color: "#3b82f6",
                weight: 3,
                opacity: 0.85,
                dashArray: "1 7",
                lineCap: "round",
              }}
            />
          )}

          {/* Put-in marker (where this recording started). */}
          {track.length > 0 && (
            <Marker
              position={[track[0].lat, track[0].lon]}
              icon={putInIcon()}
              zIndexOffset={800}
            >
              <Popup>
                <div className="text-xs leading-snug">
                  <div className="font-semibold">Put-in</div>
                  <div className="text-gray-600 mt-0.5">
                    Started {formatClock(track[0].t)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Detected stops on the live track (pull-overs / breaks). */}
          {liveSummary.stops.map((s) => (
            <Marker
              key={`live-stop-${s.startT}`}
              position={[s.lat, s.lon]}
              icon={stopIcon(formatDuration(s.durationMs))}
              zIndexOffset={700}
            >
              <Popup>
                <div className="text-xs leading-snug">
                  <div className="font-semibold">Stopped here</div>
                  <div className="text-gray-600 mt-0.5">
                    {formatClock(s.startT)}–{formatClock(s.endT)} ·{" "}
                    {formatDuration(s.durationMs)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Device's current location: blue dot (+ heading) + accuracy radius */}
          {latest && (
            <>
              {latest.accuracy != null && (
                <Circle
                  center={[latest.lat, latest.lon]}
                  radius={latest.accuracy}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.12,
                    weight: 1,
                  }}
                />
              )}
              <Marker
                position={[latest.lat, latest.lon]}
                icon={userLocationIcon(heading)}
                zIndexOffset={1000}
              >
                <Popup>
                  <div className="text-xs leading-snug">
                    <div className="font-semibold">
                      Your location{isRecording ? " (live)" : ""}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {latest.lat.toFixed(4)}, {latest.lon.toFixed(4)}
                    </div>
                    {latest.accuracy != null && (
                      <div className="text-gray-600">
                        Accuracy ±{Math.round(latest.accuracy)} m
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Actual Open-Meteo grid cells ("weather stations") */}
          {visibleStations.map((station) => {
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
              icon={locationIcon(location.name)}
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

      {/* Past floats */}
      {trips.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Past floats ({trips.length})
          </h3>
          <ul className="divide-y divide-gray-200 border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {trips.map((trip) => {
              const isShown = trip.id === shownTripId;
              return (
                <li
                  key={trip.id}
                  className="flex items-center justify-between gap-2 px-2 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {trip.name ??
                        new Date(trip.startedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                    </div>
                    <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                      {formatMiles(trip.distanceMeters)} ·{" "}
                      {formatDuration(trip.totalMs)} total
                      {trip.stoppedMs > 0 && (
                        <>
                          {" "}
                          · {formatDuration(trip.movingMs)} moving ·{" "}
                          {trip.stops.length} stop
                          {trip.stops.length === 1 ? "" : "s"} (
                          {formatDuration(trip.stoppedMs)})
                        </>
                      )}
                    </div>
                    <div className="mt-0.5 text-gray-400 dark:text-gray-500">
                      {formatClock(trip.startedAt)}
                      {trip.endedAt && <> → {formatClock(trip.endedAt)}</>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setShownTripId(isShown ? null : trip.id)
                      }
                      className={`border px-2 py-1 font-medium ${
                        isShown
                          ? "border-purple-400 bg-purple-600 text-white"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {isShown ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isShown) setShownTripId(null);
                        deleteTrip(trip.id);
                      }}
                      aria-label="Delete float"
                      className="border border-gray-300 px-2 py-1 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-red-950/40"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
