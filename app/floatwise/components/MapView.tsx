"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  WaypointCategoryMeta,
  WAYPOINT_CATEGORIES,
  WAYPOINT_CATEGORY_MAP,
} from "../types";
import { generateWaypointId } from "../utils";
import { WaypointEditor } from "./WaypointEditor";
import { WaypointDetails } from "./WaypointDetails";
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
 * Build the marker for a waypoint: a square pin filled with its primary (first)
 * category's color and that category's icon. A waypoint only ever shows that one
 * icon; the details card lists the rest when tapped.
 */
function waypointIcon(
  primary: WaypointCategoryMeta | undefined,
  name: string | undefined,
  { selected, editable }: { selected: boolean; editable: boolean }
): L.DivIcon {
  const color = primary?.color ?? "#9ca3af";
  const paths = primary?.iconPaths ?? "";
  const label = name
    ? `<span style="margin-left:4px;background:rgba(17,24,39,0.92);border:1px solid #4b5563;color:#f3f4f6;font-size:10px;font-weight:600;line-height:1.2;padding:1px 4px;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${escapeHtml(
        name
      )}</span>`
    : "";
  const ring = selected
    ? "0 0 0 3px #111827, 0 0 0 5px #fbbf24, 0 2px 8px rgba(0,0,0,0.6)"
    : "0 0 0 1px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.6)";
  // Edit mode: a dashed amber outline marks the pin as draggable.
  const outline = editable
    ? "outline:2px dashed #fbbf24;outline-offset:3px;cursor:move;"
    : "";
  const html = `
    <div style="display:flex;align-items:center;white-space:nowrap;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${color};border:2px solid rgba(255,255,255,0.92);box-shadow:${ring};${outline}">
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

/** Placeholder pin for a waypoint that's being created but not saved yet. */
const draftIcon = L.divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#2563eb;border:2px dashed #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.6);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </div>`,
  className: "fw-waypoint-icon",
  iconAnchor: [16, 16],
});

/**
 * One waypoint on the map. Memoized, with a stable icon and position, so the
 * frequent re-renders from location tracking don't reset the marker — which
 * would otherwise yank it back mid-drag in edit mode.
 */
const WaypointMarker = memo(function WaypointMarker({
  waypoint,
  selected,
  editable,
  onSelect,
  onMove,
}: {
  waypoint: Waypoint;
  selected: boolean;
  editable: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lon: number) => void;
}) {
  const primaryId = waypoint.categories[0];
  const icon = useMemo(
    () =>
      waypointIcon(WAYPOINT_CATEGORY_MAP[primaryId], waypoint.name, {
        selected,
        editable,
      }),
    [primaryId, waypoint.name, selected, editable]
  );
  const position = useMemo<[number, number]>(
    () => [waypoint.lat, waypoint.lon],
    [waypoint.lat, waypoint.lon]
  );

  // Some browsers deliver a click at the end of a drag; don't treat it as a tap.
  const lastDragEnd = useRef(0);
  const eventHandlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
      click: () => {
        if (Date.now() - lastDragEnd.current < 400) return;
        onSelect(waypoint.id);
      },
      dragend: (e) => {
        lastDragEnd.current = Date.now();
        const { lat, lng } = (e.target as L.Marker).getLatLng();
        onMove(waypoint.id, lat, lng);
      },
    }),
    [waypoint.id, onSelect, onMove]
  );

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={editable}
      zIndexOffset={selected ? 900 : 500}
      eventHandlers={eventHandlers}
    />
  );
});

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

/** Forwards map clicks and pan/zoom start/end to the parent. */
function MapEvents({
  onClick,
  onMovingChange,
}: {
  onClick: (latlng: L.LatLng, map: L.Map) => void;
  onMovingChange: (moving: boolean) => void;
}) {
  const map = useMapEvents({
    click: (e) => onClick(e.latlng, map),
    movestart: () => onMovingChange(true),
    moveend: () => onMovingChange(false),
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
  const hasCenteredOnUser = useRef(false);
  // Whether the next fix should recenter the map on the user. False when we're
  // deliberately framing the waypoints instead (see the auto-locate effect).
  const recenterOnFix = useRef(false);
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
    setTracking(false);
    setAcquiring(false);
  }, []);

  // Start watching the device location. `autoCenter` decides whether the very
  // first fix should recenter the map (true when there's nothing else to frame;
  // false when we're keeping the waypoints in view). Safe to call repeatedly —
  // an existing watch is cleared first.
  const startTracking = useCallback(
    (autoCenter: boolean) => {
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
      }
      setLocateError(null);
      setAcquiring(true);
      setTracking(true);
      hasCenteredOnUser.current = false;
      recenterOnFix.current = autoCenter;
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading } = position.coords;
          setUserLocation({
            lat: latitude,
            lon: longitude,
            accuracy,
            // heading is NaN/null when stationary or unsupported.
            heading:
              heading !== null &&
              heading !== undefined &&
              !Number.isNaN(heading)
                ? heading
                : null,
          });
          setAcquiring(false);
          const map = mapRef.current;
          if (map && recenterOnFix.current && !hasCenteredOnUser.current) {
            map.setView([latitude, longitude], Math.max(map.getZoom(), 14));
            hasCenteredOnUser.current = true;
          }
        },
        (err) => {
          setAcquiring(false);
          if (err.code === err.PERMISSION_DENIED) {
            stopTracking();
            if (navigator.permissions?.query) {
              navigator.permissions
                .query({ name: "geolocation" })
                .then((status) => {
                  setLocateError(
                    status.state === "denied"
                      ? "Location is blocked. Allow it via the address-bar icon, then try again."
                      : "Location request dismissed — tap the button and choose Allow."
                  );
                })
                .catch(() => setLocateError("Location permission denied."));
            } else {
              setLocateError("Location permission denied.");
            }
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setLocateError("Location unavailable — searching…");
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    },
    [stopTracking]
  );

  // The locate button: recenter on the user if we're already tracking (with a
  // fix), otherwise (re)start tracking and center once a fix comes in.
  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (tracking && userLocation && map) {
      map.setView(
        [userLocation.lat, userLocation.lon],
        Math.max(map.getZoom(), 15)
      );
      return;
    }
    if (tracking) {
      // Tracking but no fix yet — center as soon as one arrives.
      recenterOnFix.current = true;
      return;
    }
    startTracking(true);
  }, [tracking, userLocation, startTracking]);

  // Request the device location as soon as the map opens, so the user's dot
  // shows without any interaction. When there are no waypoints to frame we also
  // recenter on the user; when waypoints exist we keep them in view (InitialFit)
  // and just drop the dot in place.
  useEffect(() => {
    startTracking(waypoints.length === 0);
    return () => {
      if (watchId.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
    // Run once on mount; startTracking/waypoints are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add / edit waypoint state ─────────────────────────────────────────────
  // Placing: a pin sits fixed at the map's center and the user pans the map
  // under it, then confirms — more precise than tapping under a fingertip.
  const [placing, setPlacing] = useState(false);
  // Edit mode: pins become draggable and tapping one opens the editor.
  const [editMode, setEditMode] = useState(false);
  // The waypoint whose details card is showing (view mode only).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The waypoint currently open in the editor, plus whether it's brand new.
  const [editing, setEditing] = useState<{
    waypoint: Waypoint;
    isNew: boolean;
  } | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapMoving, setMapMoving] = useState(false);

  const selected = selectedId
    ? waypoints.find((w) => w.id === selectedId) ?? null
    : null;

  const startPlacing = useCallback(() => {
    setSelectedId(null);
    setLegendOpen(false);
    setPlacing(true);
  }, []);

  const openNewWaypoint = useCallback((lat: number, lon: number) => {
    setPlacing(false);
    // On phones the editor is a bottom sheet over the lower map; slide the
    // spot up near the top so the draft pin stays visible above it.
    const map = mapRef.current;
    if (map && typeof window !== "undefined" && window.innerWidth < 640) {
      const at = map.latLngToContainerPoint([lat, lon]);
      map.panBy([at.x - map.getSize().x / 2, at.y - 72]);
    }
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

  const handlePlaceAtCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    openNewWaypoint(c.lat, c.lng);
  }, [openNewWaypoint]);

  const handlePlaceAtMe = useCallback(() => {
    if (userLocation) openNewWaypoint(userLocation.lat, userLocation.lon);
  }, [userLocation, openNewWaypoint]);

  const handleMapClick = useCallback(
    (latlng: L.LatLng, map: L.Map) => {
      // While placing, a tap slides the map so the pin lands on that spot.
      if (placing) map.panTo(latlng);
      else setSelectedId(null);
    },
    [placing]
  );

  const handleMarkerSelect = useCallback(
    (id: string) => {
      if (placing) return;
      const wp = waypoints.find((w) => w.id === id);
      if (!wp) return;
      if (editMode) {
        setEditing({ waypoint: wp, isNew: false });
      } else {
        setSelectedId((cur) => (cur === id ? null : id));
      }
    },
    [placing, editMode, waypoints]
  );

  const handleMarkerMove = useCallback(
    (id: string, lat: number, lon: number) => {
      onUpdateWaypoint(id, { lat, lon });
    },
    [onUpdateWaypoint]
  );

  const handleEditFromDetails = useCallback(() => {
    if (!selected) return;
    setSelectedId(null);
    setEditMode(true);
    setEditing({ waypoint: selected, isNew: false });
  }, [selected]);

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
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [onRemoveWaypoint]
  );

  // Escape backs out of whatever is open, innermost first. The editor modal
  // handles its own dismissal, so leave it alone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || editing) return;
      if (placing) setPlacing(false);
      else if (selectedId) setSelectedId(null);
      else if (legendOpen) setLegendOpen(false);
      else if (editMode) setEditMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, placing, selectedId, legendOpen, editMode]);

  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = useCallback(async () => {
    if (!onShare) return;
    await onShare();
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [onShare]);

  const banner = placing
    ? "Move the map to put the pin on the spot"
    : editMode
      ? "Editing — drag a pin to move it, tap it to change it"
      : null;

  return (
    <div className="w-full">
      <div
        className="relative w-full border border-gray-300 dark:border-gray-600"
        style={{ height: "70vh" }}
      >
        {/* Top-center mode banner */}
        {banner && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-[1000] isolate w-max max-w-[calc(100%-7rem)] -translate-x-1/2 transform-gpu border border-amber-400/60 bg-gray-900/90 px-2.5 py-1.5 text-center text-xs text-gray-100 shadow">
            {banner}
          </div>
        )}

        {/* Top-right controls */}
        <div className="absolute right-2 top-2 z-[1000] isolate flex flex-col items-end gap-1 transform-gpu">
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

        {/* Center pin while placing a new waypoint. Its tip marks the map
            center; it lifts while the map is moving, like a pin in hand. */}
        {placing && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] isolate transform-gpu">
            <div
              className="absolute bottom-0 left-0 flex flex-col items-center transition-transform duration-150"
              style={{
                transform: `translate(-50%, ${mapMoving ? -10 : 0}px)`,
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center border-2 border-white bg-blue-600 shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_3px_8px_rgba(0,0,0,0.5)]">
                <svg className="h-4 w-4" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div className="h-3 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" />
            </div>
            <div className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 border border-white bg-blue-600 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />
          </div>
        )}

        {/* Bottom: placing actions, the details card, or the regular controls */}
        {placing ? (
          <div className="absolute inset-x-2 bottom-4 z-[1000] isolate flex gap-2 transform-gpu">
            <button
              type="button"
              onClick={() => setPlacing(false)}
              className="flex h-11 items-center border border-gray-600 bg-gray-900/90 px-3 text-sm font-medium text-gray-100 shadow hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePlaceAtMe}
              disabled={!userLocation}
              title={userLocation ? "Drop the waypoint where you are" : "Waiting for your location"}
              className="flex h-11 items-center gap-1.5 border border-gray-600 bg-gray-900/90 px-3 text-sm font-medium text-gray-100 shadow hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {userLocation ? "Where I am" : acquiring ? "Locating…" : "No location"}
            </button>
            <button
              type="button"
              onClick={handlePlaceAtCenter}
              className="flex h-11 flex-1 items-center justify-center border border-blue-400 bg-blue-600 px-3 text-sm font-semibold text-white shadow hover:bg-blue-500"
            >
              Place pin here
            </button>
          </div>
        ) : selected ? (
          <div className="absolute inset-x-2 bottom-4 z-[1000] isolate mx-auto max-w-md transform-gpu">
            <WaypointDetails
              waypoint={selected}
              onEdit={readOnly ? undefined : handleEditFromDetails}
              onClose={() => setSelectedId(null)}
            />
          </div>
        ) : (
          <>
            {/* Add / edit controls (bottom-left) */}
            {!readOnly && (
              <div className="absolute bottom-4 left-2 z-[1000] isolate flex items-end gap-1.5 transform-gpu">
                <button
                  type="button"
                  onClick={startPlacing}
                  className="flex h-11 items-center gap-1.5 border border-gray-600 bg-gray-900/90 px-3 text-sm font-medium text-gray-100 shadow hover:bg-gray-800"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add
                </button>
                {(waypoints.length > 0 || editMode) && (
                  <button
                    type="button"
                    onClick={() => setEditMode((v) => !v)}
                    aria-pressed={editMode}
                    className={`flex h-11 items-center gap-1.5 border px-3 text-sm font-medium shadow ${
                      editMode
                        ? "border-amber-300 bg-amber-500 text-gray-900 hover:bg-amber-400"
                        : "border-gray-600 bg-gray-900/90 text-gray-100 hover:bg-gray-800"
                    }`}
                  >
                    {editMode ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536 9 17l.464-3.536z" />
                      </svg>
                    )}
                    {editMode ? "Done" : "Edit"}
                  </button>
                )}
              </div>
            )}

            {/* Legend (bottom-right), collapsed until tapped */}
            <div className="absolute bottom-4 right-2 z-[1000] isolate flex max-w-[60%] flex-col items-end transform-gpu">
              {legendOpen && (
                <div className="mb-1 border border-gray-700 bg-gray-900/90 p-1.5 shadow">
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
              )}
              <button
                type="button"
                onClick={() => setLegendOpen((v) => !v)}
                aria-expanded={legendOpen}
                className="flex h-11 items-center gap-1.5 border border-gray-600 bg-gray-900/90 px-3 text-sm font-medium text-gray-100 shadow hover:bg-gray-800"
              >
                <span className="flex">
                  {WAYPOINT_CATEGORIES.slice(0, 3).map((c) => (
                    <span
                      key={c.id}
                      className="-ml-1 h-3 w-3 border border-gray-900 first:ml-0"
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </span>
                Legend
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${legendOpen ? "" : "rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </>
        )}

        <MapContainer
          ref={mapRef}
          center={center}
          zoom={waypoints.length > 0 ? 12 : 5}
          scrollWheelZoom
          style={{
            height: "100%",
            width: "100%",
            background: "#1f2937",
          }}
        >
          {/* USGS Imagery Topo: aerial imagery with topo contours and labels.
              Tiles stop at z16, so deeper zooms upscale the z16 tiles. */}
          <TileLayer
            attribution='Tiles courtesy of the <a href="https://www.usgs.gov/">U.S. Geological Survey</a>'
            url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={16}
            maxZoom={19}
          />

          <InitialFit
            waypoints={waypoints}
            userLocation={
              userLocation
                ? { lat: userLocation.lat, lon: userLocation.lon }
                : null
            }
          />
          <MapEvents onClick={handleMapClick} onMovingChange={setMapMoving} />

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
            <WaypointMarker
              key={wp.id}
              waypoint={wp}
              selected={wp.id === selectedId}
              editable={editMode && !readOnly}
              onSelect={handleMarkerSelect}
              onMove={handleMarkerMove}
            />
          ))}

          {/* Where a waypoint being created will land */}
          {editing?.isNew && (
            <Marker
              position={[editing.waypoint.lat, editing.waypoint.lon]}
              icon={draftIcon}
              zIndexOffset={1100}
              interactive={false}
            />
          )}
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
