import { useState, useEffect } from 'react';
import { Waypoint } from '../types';

const STORAGE_KEY = 'floatwise-waypoints';

/**
 * Persist river waypoints in localStorage, mirroring useLocationStorage.
 *
 * When `urlWaypoints` is provided (someone opened a shared link) those are shown
 * read-through and are NOT written back to localStorage, so viewing a friend's
 * waypoints never clobbers your own saved set.
 */
export function useWaypointStorage(urlWaypoints?: Waypoint[] | null) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const isViewingSharedLink = !!urlWaypoints && urlWaypoints.length > 0;

  // Load from URL params or localStorage on mount.
  useEffect(() => {
    try {
      if (urlWaypoints && urlWaypoints.length > 0) {
        setWaypoints(urlWaypoints);
      } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setWaypoints(JSON.parse(stored));
        }
      }
    } catch (error) {
      console.error('Error loading waypoints from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount; urlWaypoints intentionally not a dependency.

  // Save to localStorage unless viewing a shared link.
  useEffect(() => {
    if (isLoaded && !isViewingSharedLink) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
      } catch (error) {
        console.error('Error saving waypoints to localStorage:', error);
      }
    }
  }, [waypoints, isLoaded, isViewingSharedLink]);

  const addWaypoint = (waypoint: Waypoint) => {
    setWaypoints((prev) => {
      if (prev.some((w) => w.id === waypoint.id)) return prev;
      return [...prev, waypoint];
    });
  };

  const updateWaypoint = (id: string, updates: Partial<Waypoint>) => {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const removeWaypoint = (id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
  };

  const importWaypoints = (incoming: Waypoint[]) => {
    setWaypoints((prev) => {
      const next = [...prev];
      for (const wp of incoming) {
        const dup = next.some(
          (w) =>
            Math.abs(w.lat - wp.lat) < 1e-5 && Math.abs(w.lon - wp.lon) < 1e-5
        );
        if (!dup) next.push(wp);
      }
      return next;
    });
  };

  const clearWaypoints = () => setWaypoints([]);

  return {
    waypoints,
    isLoaded,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    importWaypoints,
    clearWaypoints,
    isViewingSharedLink,
  };
}
