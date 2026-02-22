"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";

interface GyroscopeState {
  /** Normalized -0.5 to 0.5 (front-back tilt, maps to rotateX) */
  beta: number;
  /** Normalized -0.5 to 0.5 (left-right tilt, maps to rotateY) */
  gamma: number;
  isSupported: boolean;
  permissionState: "prompt" | "granted" | "denied" | "unavailable";
  requestPermission: () => Promise<boolean>;
}

// Sensitivity range: how many degrees of tilt maps to the full -0.5..0.5 range
const BETA_RANGE = 30; // ±30° front-back
const GAMMA_RANGE = 30; // ±30° left-right
const THROTTLE_MS = 16; // ~60fps

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Static capability detection via useSyncExternalStore (no setState in effects)
const noopSubscribe = () => () => {};

function getGyroSupported(): boolean {
  return "DeviceOrientationEvent" in window;
}

function getGyroNeedsPermission(): boolean {
  if (!("DeviceOrientationEvent" in window)) return false;
  return (
    typeof (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      }
    ).requestPermission === "function"
  );
}

export function useGyroscope(): GyroscopeState {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    getGyroSupported,
    () => false
  );
  const needsPermission = useSyncExternalStore(
    noopSubscribe,
    getGyroNeedsPermission,
    () => false
  );

  // Only set via user interaction (requestPermission callback), never in an effect
  const [permissionOverride, setPermissionOverride] = useState<
    "granted" | "denied" | null
  >(null);

  // Derive permissionState from capabilities + user override
  const permissionState: GyroscopeState["permissionState"] = permissionOverride
    ? permissionOverride
    : !isSupported
      ? "unavailable"
      : needsPermission
        ? "prompt"
        : "granted";

  const [beta, setBeta] = useState(0);
  const [gamma, setGamma] = useState(0);
  const baselineRef = useRef<{ beta: number; gamma: number } | null>(null);
  const lastUpdateRef = useRef(0);
  const listenerAttachedRef = useRef(false);

  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const now = performance.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      lastUpdateRef.current = now;

      const rawBeta = event.beta ?? 0; // front-back
      const rawGamma = event.gamma ?? 0; // left-right

      // Set baseline on first reading (device resting position)
      if (!baselineRef.current) {
        baselineRef.current = { beta: rawBeta, gamma: rawGamma };
      }

      const deltaBeta = rawBeta - baselineRef.current.beta;
      const deltaGamma = rawGamma - baselineRef.current.gamma;

      // Normalize to -0.5..0.5 range
      const normalizedBeta = clamp(deltaBeta / BETA_RANGE, -0.5, 0.5);
      const normalizedGamma = clamp(deltaGamma / GAMMA_RANGE, -0.5, 0.5);

      setBeta(normalizedBeta);
      setGamma(normalizedGamma);
    },
    []
  );

  const attachListener = useCallback(() => {
    if (!listenerAttachedRef.current) {
      window.addEventListener("deviceorientation", handleOrientation);
      listenerAttachedRef.current = true;
    }
  }, [handleOrientation]);

  // Auto-attach on Android / older iOS where permission is pre-granted
  useEffect(() => {
    if (permissionState === "granted" && isSupported) {
      attachListener();
    }
    return () => {
      if (listenerAttachedRef.current) {
        window.removeEventListener("deviceorientation", handleOrientation);
        listenerAttachedRef.current = false;
      }
    };
  }, [permissionState, isSupported, attachListener, handleOrientation]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    const DevOrientEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DevOrientEvent.requestPermission === "function") {
      try {
        const result = await DevOrientEvent.requestPermission();
        if (result === "granted") {
          setPermissionOverride("granted");
          attachListener();
          return true;
        } else {
          setPermissionOverride("denied");
          return false;
        }
      } catch {
        setPermissionOverride("denied");
        return false;
      }
    } else {
      // No permission needed
      setPermissionOverride("granted");
      attachListener();
      return true;
    }
  }, [isSupported, attachListener]);

  return { beta, gamma, isSupported, permissionState, requestPermission };
}
