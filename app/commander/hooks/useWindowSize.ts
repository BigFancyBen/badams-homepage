import { useState, useEffect, useSyncExternalStore } from 'react';
import { WindowSize } from '../types';

// Subscribe function for useSyncExternalStore (for isClient)
function subscribe(_callback: () => void) {
  // No-op since isClient never changes after initial render
  return () => {};
}

// Snapshot for client
function getSnapshot() {
  return true;
}

// Server snapshot
function getServerSnapshot() {
  return false;
}

// Custom hook for window dimensions with SSR safety
export function useWindowSize(): WindowSize {
  // Use useSyncExternalStore for SSR-safe isClient detection
  const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Set initial size (in case SSR gave 0)
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return { ...windowSize, isClient };
}

