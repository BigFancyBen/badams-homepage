"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { type MotionValue, useMotionValue } from "motion/react";

interface GyroscopeState {
  /** MotionValue normalized -0.5 to 0.5 (front-back tilt, maps to rotateX) */
  beta: MotionValue<number>;
  /** MotionValue normalized -0.5 to 0.5 (left-right tilt, maps to rotateY) */
  gamma: MotionValue<number>;
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

// ── Singleton orientation listener ──────────────────────────────────
// One DeviceOrientation listener feeds all hook instances via MotionValues.
// Writes directly to MotionValues → zero React re-renders from orientation data.
type OrientationSubscriber = (beta: number, gamma: number) => void;
const subscribers = new Set<OrientationSubscriber>();
let singletonAttached = false;
let baseline: { beta: number; gamma: number } | null = null;
let lastUpdate = 0;

function handleOrientationEvent(event: DeviceOrientationEvent) {
  const now = performance.now();
  if (now - lastUpdate < THROTTLE_MS) return;
  lastUpdate = now;

  const rawBeta = event.beta ?? 0;
  const rawGamma = event.gamma ?? 0;

  if (!baseline) {
    baseline = { beta: rawBeta, gamma: rawGamma };
  }

  const normalizedBeta = clamp((rawBeta - baseline.beta) / BETA_RANGE, -0.5, 0.5);
  const normalizedGamma = clamp((rawGamma - baseline.gamma) / GAMMA_RANGE, -0.5, 0.5);

  for (const sub of subscribers) {
    sub(normalizedBeta, normalizedGamma);
  }
}

function attachSingletonListener() {
  if (!singletonAttached) {
    window.addEventListener("deviceorientation", handleOrientationEvent);
    singletonAttached = true;
  }
}

// ── Static capability detection (SSR-safe, no setState in effects) ──
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

  const [permissionOverride, setPermissionOverride] = useState<
    "granted" | "denied" | null
  >(null);

  const permissionState: GyroscopeState["permissionState"] = permissionOverride
    ? permissionOverride
    : !isSupported
      ? "unavailable"
      : needsPermission
        ? "prompt"
        : "granted";

  // MotionValues instead of useState — orientation updates bypass React entirely
  const beta = useMotionValue(0);
  const gamma = useMotionValue(0);

  // Subscribe to the singleton listener when permission is granted
  useEffect(() => {
    if (permissionState !== "granted" || !isSupported) return;

    // Subscriber writes directly to MotionValues — zero React re-renders
    const sub: OrientationSubscriber = (b, g) => {
      beta.set(b);
      gamma.set(g);
    };

    subscribers.add(sub);
    attachSingletonListener();

    return () => {
      subscribers.delete(sub);
      // Detach singleton when no subscribers remain
      if (subscribers.size === 0 && singletonAttached) {
        window.removeEventListener("deviceorientation", handleOrientationEvent);
        singletonAttached = false;
        baseline = null;
      }
    };
  }, [permissionState, isSupported, beta, gamma]);

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
      setPermissionOverride("granted");
      return true;
    }
  }, [isSupported]);

  return { beta, gamma, isSupported, permissionState, requestPermission };
}
