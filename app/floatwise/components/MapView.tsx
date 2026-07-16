"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Waypoint,
  WAYPOINT_CATEGORIES,
  WAYPOINT_CATEGORY_MAP,
} from "../types";
import { generateWaypointId } from "../utils";
import { WaypointEditor } from "./WaypointEditor";
import { CategoryGlyph } from "./CategoryGlyph";

interface MapViewProps {
  waypoints: Waypoint[];
  onAddWaypoint: (waypoint: Waypoint) => void;
  onUpdateWaypoint: (id: string, updates: Partial<Waypoint>) => void;
  onRemoveWaypoint: (id: string) => void;
  /** True when the shown waypoints came from a shared link (read-only view). */
  isViewingSharedLink?: boolean;
  /** Copies a share link for the current waypoints to the clipboard. */
  onShare?: () => Promise<void>;
}

/** Escape user-provided text before inlining it into marker HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap a category's stored lucide paths in a full <svg> string. */
function glyphSvg(iconPaths: string, size: number, stroke: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</svg>`;
}

/**
 * Build the marker for a waypoint. A single-category waypoint gets a square pin
 * filled with that category's color and a white icon; a multi-category waypoint
 * gets a distinct strip of per-category color chips (each with its own white
 * icon) so "belongs to several groups" reads at a glance.
 */
function waypointIcon(waypoint: Waypoint): L.DivIcon {
  const cats = waypoint.categories
    .map((id) => WAYPOINT_CATEGORY_MAP[id])
    .filter(Boolean);
  const multi = cats.length > 1;
  const label = waypoint.name
    ? `<span style="margin-left:4px;background:rgba(17,24,39,0.92);border:1px solid #4b5563;color:#f3f4f6;font-size:10px;font-weight:600;line-height:1.2;padding:1px 4px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${escapeHtml(
        waypoint.name
      )}</span>`
    : "";

  if (multi) {
    // Chip strip geometry (must match the inline styles below) so the map point
    // sits at the visual center of the strip.
    const chip = 20;
    const gap = 2;
    const pad = 2;
    const border = 2;
    const stripInner = cats.length * chip + (cats.length - 1) * gap;
    const totalW = 2 * border + 2 * pad + stripInner;
    const totalH = 2 * border + 2 * pad + chip;

    const chips = cats
      .map(
        (c) =>
          `<span style="display:inline-flex;align-items:center;justify-content:center;width:${chip}px;height:${chip}px;background:${c.color};">${glyphSvg(
            c.iconPaths,
            14,
            "#ffffff"
          )}</span>`
      )
      .join("");
    const html = `
      <div style="display:flex;align-items:center;white-space:nowrap;">
        <div style="display:inline-flex;align-items:center;gap:${gap}px;padding:${pad}px;background:rgba(17,24,39,0.95);border:${border}px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.6);">
          ${chips}
        </div>
        ${label}
      </div>`;
    return L.divIcon({
      html,
      className: "fw-waypoint-icon",
      iconAnchor: [totalW / 2, totalH / 2],
    });
  }

  const color = cats[0]?.color ?? "#9ca3af";
  const paths = cats[0]?.iconPaths ?? "";
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${color};border:2px solid rgba(255,255,255,0.92);box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.6);">
        ${glyphSvg(paths, 17, "#ffffff")}
      </div>
      ${label}
    </div>`;
  return L.divIcon({
    html,
    className: "fw-waypoint-icon",
    iconAnchor: [16, 16],
  });
}

/**
 * The "you are here" marker. When a heading is known (from the GPS course over
 * ground while drifting), a translucent beam fans out in the direction of
 * travel — like the familiar maps compass cone — otherwise it's just the dot.
 */
function userLocationIcon(heading: number | null): L.DivIcon {
  const beam =
    heading !== null && !Number.isNaN(heading)
      ? `<div style="position:absolute;left:50%;top:50%;width:44px;height:44px;margin-left:-22px;margin-top:-22px;transform:rotate(${heading}deg);">
           <div style="position:absolute;left:50%;top:-2px;margin-left:-13px;width:26px;height:24px;background:conic-gradient(from 165deg at 50% 100%, rgba(59,130,246,0) 0deg, rgba(59,130,246,0.55) 15deg, rgba(59,130,246,0) 30deg);clip-path:polygon(50% 100%, 0 0, 100% 0);"></div>
         </div>`
      : "";
  const html = `
    <div style="position:relative;width:16px;height:16px;">
      ${beam}
      <div style="position:absolute;left:0;top:0;width:16px;height:16px;border-radius:9999px;background:#3b82f6;border:3px solid #ffffff;box-shadow:0 0 0 1.5px rgba(59,130,246,0.7), 0 0 10px 2px rgba(59,130,246,0.6);"></div>
    </div>`;
  return L.divIcon({
    html,
    className: "fw-user-location-icon",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * On first data availability, frame the map to contain the user's waypoints. If
 * there are none, center on the current location (once known) at a reasonable
 * zoom. Runs once so it never fights the user's own panning afterwards.
 */
function InitialFit({
  waypoints,
  userLocation,
}: {
  waypoints: Waypoint[];
  userLocation: { lat: number; lon: number } | null;
}) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;

    if (waypoints.length > 0) {
      if (waypoints.length === 1) {
        map.setView([waypoints[0].lat, waypoints[0].lon], 14);
      } else {
        const bounds = L.latLngBounds(
          waypoints.map((w) => [w.lat, w.lon] as [number, number])
        );
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
      }
      fitted.current = true;
      return;
    }

    // No waypoints: wait for a location fix, then zoom in on the user.
    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lon], 14);
      fitted.current = true;
    }
  }, [map, waypoints, userLocation]);

  return null;
}

/**
 * Reports when the user pans the map themselves (drag), so auto-centering on
 * new location fixes can stand down and stop fighting their navigation. Only
 * user drags count — programmatic setView doesn't fire `dragstart`.
 */
function UserPanTracker({ onUserPan }: { onUserPan: () => void }) {
  useMapEvents({ dragstart: onUserPan });
  return null;
}

/** Fires when the map is clicked while "add waypoint" mode is active. */
function MapClickHandler({
  active,
  onPick,
}: {
  active: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (active) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapView({
  waypoints,
  onAddWaypoint,
  onUpdateWaypoint,
  onRemoveWaypoint,
  isViewingSharedLink,
  onShare,
}: MapViewProps) {
  const readOnly = !!isViewingSharedLink;

  // Default center: geographic center of the contiguous US until we know better.
  const center = useMemo<[number, number]>(() => {
    if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lon];
    return [39.5, -98.35];
  }, [waypoints]);

  const mapRef = useRef<L.Map | null>(null);

  // ── Live location + heading tracking ──────────────────────────────────────
  const watchId = useRef<number | null>(null);
  // Accuracy (metres) of the fix we last auto-centered on, or null if we haven't
  // centered yet. Lets us re-center when a noticeably better fix arrives — e.g.
  // a coarse network fix on Firefox refined once GPS locks on — instead of
  // locking onto the first, possibly-inaccurate, fix.
  const centeredAccuracy = useRef<number | null>(null);
  // Set once the user pans the map themselves, after which we stop auto-
  // centering so we never fight their navigation.
  const userMovedMap = useRef(false);
  // Whether the next fix should recenter the map on the user. False when we're
  // deliberately framing the waypoints instead (see the auto-locate effect).
  const recenterOnFix = useRef(false);
  // Whether we've received at least one position fix on the current watch. Once
  // true, later transient errors (a momentary timeout while watching) are
  // ignored so a good, live location isn't torn down.
  const hasFix = useRef(false);
  // Whether the current watch has already fallen back to coarse accuracy after
  // a high-accuracy request failed. Prevents an infinite retry loop.
  const triedLowAccuracy = useRef(false);
  // Watchdog: some browsers (notably Firefox) can leave a geolocation request
  // hanging with neither a fix nor an error/timeout callback. If no fix arrives
  // in time we stop and surface a message so the button never spins forever.
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
    heading: number | null;
  } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (watchdog.current !== null) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
    setTracking(false);
    setAcquiring(false);
  }, []);

  // Start locating the device. `autoCenter` decides whether fixes recenter the
  // map (true when the user asked to be located). `highAccuracy` starts true; if
  // a GPS fix fails we retry once with coarse (network) accuracy.
  //
  // Uses watchPosition, which delivers the first (often coarse network) fix
  // quickly and then refines — this is what reliably produces a location on
  // Firefox. A watchdog guards against the request hanging with no callback at
  // all. Safe to call repeatedly — any existing watch/watchdog is cleared first.
  const startTracking = useCallback(
    (autoCenter: boolean, highAccuracy = true) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setLocateError("Location isn't supported by this browser.");
        return;
      }
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        setLocateError("Location needs a secure (HTTPS) connection.");
        return;
      }
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (watchdog.current !== null) {
        clearTimeout(watchdog.current);
        watchdog.current = null;
      }
      setLocateError(null);
      setAcquiring(true);
      setTracking(true);
      centeredAccuracy.current = null;
      userMovedMap.current = false;
      recenterOnFix.current = autoCenter;
      hasFix.current = false;

      // Apply a fix: drop the dot and recenter when appropriate.
      const applyPosition = (position: GeolocationPosition) => {
        if (watchdog.current !== null) {
          clearTimeout(watchdog.current);
          watchdog.current = null;
        }
        const { latitude, longitude, accuracy, heading } = position.coords;
        hasFix.current = true;
        setUserLocation({
          lat: latitude,
          lon: longitude,
          accuracy,
          // heading is NaN/null when stationary or unsupported.
          heading:
            heading !== null && heading !== undefined && !Number.isNaN(heading)
              ? heading
              : null,
        });
        setAcquiring(false);
        setLocateError(null);
        const map = mapRef.current;
        // Auto-center until the user pans the map themselves. Re-center when a
        // noticeably better (smaller-radius) fix arrives, so an initial coarse
        // network fix — common on Firefox — is corrected once GPS locks on,
        // rather than leaving the map parked on the first, rough estimate.
        const betterFix =
          centeredAccuracy.current === null ||
          accuracy <= centeredAccuracy.current * 0.6;
        if (map && recenterOnFix.current && !userMovedMap.current && betterFix) {
          map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
          centeredAccuracy.current = accuracy;
        }
      };

      // One locate attempt at the given accuracy. Recurses once to coarse
      // accuracy if a high-accuracy fix times out or is unavailable.
      const attempt = (high: boolean) => {
        triedLowAccuracy.current = !high;
        const options: PositionOptions = {
          // A GPS (high-accuracy) fix can take a while on a cold start, but
          // watchPosition delivers a quicker coarse fix in the meantime, so a
          // moderate timeout is fine. Coarse fixes come from the network.
          enableHighAccuracy: high,
          timeout: high ? 20000 : 25000,
          maximumAge: 10000,
        };
        const handleError = (err: GeolocationPositionError) => {
          // Once we have a fix, ignore transient errors (a momentary timeout
          // while watching) unless the permission itself was revoked.
          if (hasFix.current && err.code !== err.PERMISSION_DENIED) {
            return;
          }
          setAcquiring(false);
          if (err.code === err.PERMISSION_DENIED) {
            stopTracking();
            setLocateError(
              "Location permission denied. Tap the button and choose Allow — if there's no prompt, clear this site's blocked permission in your browser settings."
            );
          } else if (high) {
            // High-accuracy (GPS) timed out or was unavailable — common on
            // desktop Firefox and other GPS-less devices. Fall back once to a
            // coarse, network-based fix before giving up.
            attempt(false);
          } else if (err.code === err.TIMEOUT) {
            stopTracking();
            setLocateError("Location timed out — tap the button to try again.");
          } else {
            stopTracking();
            setLocateError(
              "Couldn't get your location. Make sure location is enabled, then tap the button to try again."
            );
          }
        };
        watchId.current = navigator.geolocation.watchPosition(
          applyPosition,
          handleError,
          options
        );
      };

      // Belt-and-suspenders: if neither a fix nor an error arrives (some Firefox
      // builds silently stall a granted request), give up after a while with a
      // clear message so the button doesn't spin forever.
      watchdog.current = setTimeout(() => {
        watchdog.current = null;
        if (!hasFix.current) {
          stopTracking();
          setLocateError(
            "Couldn't get your location. Make sure location is on for your browser, then tap the button to try again."
          );
        }
      }, 35000);

      attempt(highAccuracy);
    },
    [stopTracking]
  );

  // Records that the user has taken over navigation; auto-centering stands down.
  const handleUserPan = useCallback(() => {
    userMovedMap.current = true;
  }, []);

  // The locate button. If we already have a fix, just recenter on it. Otherwise
  // (re)start a fresh request — always, even if a previous attempt is still
  // "acquiring", so a stalled request can never leave the button doing nothing.
  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (userLocation && map) {
      // We have a location — recenter and resume following better fixes until
      // the user pans away again.
      userMovedMap.current = false;
      recenterOnFix.current = true;
      centeredAccuracy.current = userLocation.accuracy;
      map.setView(
        [userLocation.lat, userLocation.lon],
        Math.max(map.getZoom(), 15)
      );
      return;
    }
    startTracking(true);
  }, [userLocation, startTracking]);

  // Clean up any active location watch when the map unmounts. We deliberately
  // do NOT request location automatically on load: a non-gesture geolocation
  // request is unreliable (and on Firefox can leave the prompt in a confused
  // state that breaks the later button-driven request). The user starts
  // locating by tapping the locate button.
  useEffect(() => {
    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (watchdog.current !== null) {
        clearTimeout(watchdog.current);
        watchdog.current = null;
      }
    };
  }, []);

  // ── Add / edit waypoint state ─────────────────────────────────────────────
  const [addMode, setAddMode] = useState(false);
  // The waypoint currently open in the editor, plus whether it's brand new.
  const [editing, setEditing] = useState<{
    waypoint: Waypoint;
    isNew: boolean;
  } | null>(null);

  const handlePickLocation = useCallback((lat: number, lon: number) => {
    setAddMode(false);
    setEditing({
      waypoint: {
        id: generateWaypointId(lat, lon),
        lat,
        lon,
        // Start with nothing selected; the editor's Save stays disabled until
        // the user picks at least one category.
        categories: [],
      },
      isNew: true,
    });
  }, []);

  const handleSaveWaypoint = useCallback(
    (wp: Waypoint) => {
      if (editing?.isNew) {
        onAddWaypoint(wp);
      } else {
        onUpdateWaypoint(wp.id, {
          name: wp.name,
          note: wp.note,
          categories: wp.categories,
        });
      }
      setEditing(null);
    },
    [editing, onAddWaypoint, onUpdateWaypoint]
  );

  const handleDeleteWaypoint = useCallback(
    (id: string) => {
      onRemoveWaypoint(id);
      setEditing(null);
    },
    [onRemoveWaypoint]
  );

  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = useCallback(async () => {
    if (!onShare) return;
    await onShare();
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [onShare]);

  return (
    <div className="w-full">
      <div
        className="relative w-full border border-gray-300 dark:border-gray-600"
        style={{ height: "70vh" }}
      >
        {/* Top-right controls */}
        <div className="absolute right-2 top-2 z-[1000] flex flex-col items-end gap-1">
          {/* Locate / track */}
          <button
            type="button"
            onClick={handleLocate}
            title={tracking ? "Center on my location" : "Find my location"}
            aria-label={
              tracking ? "Center on my location" : "Find my location"
            }
            aria-pressed={tracking}
            className={`flex h-9 w-9 items-center justify-center border shadow ${
              tracking
                ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500"
                : "border-gray-600 bg-gray-900/90 text-gray-100 hover:bg-gray-800"
            }`}
          >
            {acquiring ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>

          {/* Share waypoints */}
          {onShare && waypoints.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={handleShare}
                title="Share these waypoints"
                aria-label="Share these waypoints"
                className="flex h-9 w-9 items-center justify-center border border-gray-600 bg-gray-900/90 text-gray-100 shadow hover:bg-gray-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
              </button>
              {shareCopied && (
                <div className="absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap bg-gray-800 px-2 py-1 text-xs text-white shadow dark:bg-gray-700">
                  Link copied!
                </div>
              )}
            </div>
          )}

          {locateError && (
            <span className="max-w-[180px] bg-gray-900/90 px-2 py-1 text-right text-[10px] text-red-400 shadow">
              {locateError}
            </span>
          )}
        </div>

        {/* Add-waypoint control (bottom-left) */}
        {!readOnly && (
          <div className="absolute bottom-4 left-2 z-[1000] flex flex-col items-start gap-1">
            {addMode && (
              <span className="bg-gray-900/90 px-2 py-1 text-[11px] text-gray-100 shadow">
                Tap the map to drop a waypoint
              </span>
            )}
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              aria-pressed={addMode}
              className={`flex h-11 items-center gap-1.5 border px-3 text-sm font-medium shadow ${
                addMode
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500"
                  : "border-gray-600 bg-gray-900/90 text-gray-100 hover:bg-gray-800"
              }`}
            >
              {addMode ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
              {addMode ? "Cancel" : "Add waypoint"}
            </button>
          </div>
        )}

        {/* Legend (bottom-right) */}
        <div className="absolute bottom-4 right-2 z-[1000] max-w-[46%] border border-gray-700 bg-gray-900/85 p-1.5 shadow">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {WAYPOINT_CATEGORIES.map((c) => (
              <div key={c.id} className="flex items-center gap-1 text-[10px] text-gray-200">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center"
                  style={{ backgroundColor: c.color }}
                >
                  <CategoryGlyph meta={c} size={11} color="#ffffff" />
                </span>
                <span className="truncate">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <MapContainer
          ref={mapRef}
          center={center}
          zoom={waypoints.length > 0 ? 12 : 5}
          scrollWheelZoom
          style={{
            height: "100%",
            width: "100%",
            background: "#1f2937",
            cursor: addMode ? "crosshair" : "",
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <InitialFit
            waypoints={waypoints}
            userLocation={
              userLocation
                ? { lat: userLocation.lat, lon: userLocation.lon }
                : null
            }
          />
          <MapClickHandler active={addMode} onPick={handlePickLocation} />
          <UserPanTracker onUserPan={handleUserPan} />

          {/* Device location: accuracy ring + heading dot */}
          {userLocation && (
            <>
              <Circle
                center={[userLocation.lat, userLocation.lon]}
                radius={userLocation.accuracy}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.12,
                  weight: 1,
                }}
              />
              <Marker
                position={[userLocation.lat, userLocation.lon]}
                icon={userLocationIcon(userLocation.heading)}
                zIndexOffset={1000}
              />
            </>
          )}

          {/* Waypoints */}
          {waypoints.map((wp) => (
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lon]}
              icon={waypointIcon(wp)}
              zIndexOffset={500}
              eventHandlers={{
                click: () => {
                  if (addMode) return;
                  if (readOnly) return;
                  setEditing({ waypoint: wp, isNew: false });
                },
              }}
            />
          ))}
        </MapContainer>
      </div>

      {editing && (
        <WaypointEditor
          key={editing.waypoint.id}
          waypoint={editing.waypoint}
          isNew={editing.isNew}
          onSave={handleSaveWaypoint}
          onDelete={editing.isNew ? undefined : handleDeleteWaypoint}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
