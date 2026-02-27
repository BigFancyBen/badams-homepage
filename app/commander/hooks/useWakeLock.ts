import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'commander-wake-lock';

function getSupportError(): string | null {
  if (!window.isSecureContext) return 'Requires HTTPS or localhost';
  if (!('wakeLock' in navigator)) {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'Not supported in Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Not supported in Safari';
    return 'Not supported in this browser';
  }
  return null;
}

export function useWakeLock(isClient: boolean) {
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const hasLoadedPreference = useRef(false);

  // Derive support from isClient prop (no setState needed)
  const isWakeLockSupported = isClient && 'wakeLock' in navigator && window.isSecureContext;
  const supportError = isClient && !isWakeLockSupported ? getSupportError() : null;

  // Load preference from localStorage (one-time)
  useEffect(() => {
    if (!isClient || hasLoadedPreference.current) return;
    hasLoadedPreference.current = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time initialization from localStorage
        setWakeLockEnabled(true);
      }
    } catch {
      // localStorage may be unavailable
    }
  }, [isClient]);

  // Request the wake lock
  const requestWakeLock = useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) return;

    try {
      setRuntimeError(null);
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;

      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
      });
    } catch (error) {
      sentinelRef.current = null;
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            // Silently ignore - happens when page is hidden, will retry on visibility change
            break;
          case 'NotSupportedError':
            setRuntimeError('Not supported on this device');
            break;
          default:
            setRuntimeError(`Error: ${error.message}`);
        }
      }
    }
  }, []);

  // Acquire lock when preference is enabled
  useEffect(() => {
    if (wakeLockEnabled && isWakeLockSupported) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Interacting with Wake Lock platform API
      requestWakeLock();
    }
  }, [wakeLockEnabled, isWakeLockSupported, requestWakeLock]);

  // Re-acquire when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockEnabled && isWakeLockSupported) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLockEnabled, isWakeLockSupported, requestWakeLock]);

  // Release on unmount
  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Toggle preference and acquire/release accordingly
  const toggleWakeLock = useCallback(async () => {
    if (!isWakeLockSupported) return;

    const newEnabled = !wakeLockEnabled;
    setWakeLockEnabled(newEnabled);

    try {
      localStorage.setItem(STORAGE_KEY, String(newEnabled));
    } catch {
      // localStorage may be unavailable
    }

    if (!newEnabled) {
      setRuntimeError(null);
      if (sentinelRef.current) {
        try {
          await sentinelRef.current.release();
        } catch {
          // ignore release errors
        }
        sentinelRef.current = null;
      }
    }
    // Enabling is handled by the useEffect above
  }, [isWakeLockSupported, wakeLockEnabled]);

  return {
    wakeLockEnabled,
    isWakeLockSupported,
    wakeLockError: supportError || runtimeError,
    toggleWakeLock,
  };
}
