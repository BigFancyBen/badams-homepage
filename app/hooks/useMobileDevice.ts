"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function getSnapshot(): boolean {
  // Check both viewport width and touch capability
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isNarrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
  return isTouchDevice || isNarrowViewport;
}

function getServerSnapshot(): boolean {
  // Assume mobile-first for SSR
  return true;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

export function useMobileDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
