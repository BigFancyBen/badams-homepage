import { useCallback, useEffect, useRef, useState } from 'react';

const unsupportedReason = (): string | null => {
  if (!window.isSecureContext) return 'Requires HTTPS or localhost';
  if (!('wakeLock' in navigator)) return 'Not supported in this browser';
  return null;
};

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Permission denied - tap to try again';
      case 'NotSupportedError':
        return 'Not supported on this device';
      default:
        return `Error: ${error.message}`;
    }
  }
  return 'Failed to toggle wake lock';
};

// Keeps the screen on while the user wants it. The browser drops the lock
// whenever the page is hidden, so it is requested again when the page comes
// back. Client-only: reads navigator on first render.
export function useWakeLock() {
  const [isSupported] = useState(() => unsupportedReason() === null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(unsupportedReason);

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const wantedRef = useRef(false);

  const acquire = useCallback(async () => {
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);
      setError(null);
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        setIsActive(false);
      });
    } catch (err) {
      console.error('Wake lock error:', err);
      wantedRef.current = false;
      setIsActive(false);
      setError(describeError(err));
    }
  }, []);

  const toggle = useCallback(async () => {
    if (!isSupported) return;
    if (wantedRef.current) {
      wantedRef.current = false;
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      setIsActive(false);
      setError(null);
      await sentinel?.release().catch(() => {});
    } else {
      wantedRef.current = true;
      await acquire();
    }
  }, [isSupported, acquire]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !sentinelRef.current) {
        acquire();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sentinelRef.current?.release().catch(() => {});
    };
  }, [acquire]);

  return { isSupported, isActive, error, toggle };
}
