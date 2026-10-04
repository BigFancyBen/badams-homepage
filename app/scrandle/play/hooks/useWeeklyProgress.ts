"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Side } from "../types";

const STORAGE_KEY = "scrandle-weekly-progress";

/** One puzzle's worth. A new number makes whatever is stored stale. */
interface Stored {
  number: number;
  picks: Side[];
}

const EMPTY: Side[] = [];

// ── localStorage-backed store ───────────────────────────────────────
// Read through useSyncExternalStore so the server snapshot stays empty and
// hydration does not depend on what is in this browser.
let cache: Stored | null | undefined;
const listeners = new Set<() => void>();

function read(): Stored | null {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache =
      parsed && typeof parsed.number === "number" && Array.isArray(parsed.picks)
        ? (parsed as Stored)
        : null;
  } catch (error) {
    console.error("Failed to load scrandle progress:", error);
    cache = null;
  }
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cache = undefined;
  emit();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: Stored) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to save scrandle progress:", error);
  }
  emit();
}

function getServerSnapshot(): Side[] {
  return EMPTY;
}

/**
 * This browser's picks for one puzzle, in round order. Progress saved against
 * a different puzzle number reads as none, so last week's answers never leak
 * into this week's and there is nothing to clear when the puzzle changes.
 */
export function useWeeklyProgress(puzzleNumber: number, rounds: number) {
  const getSnapshot = useCallback((): Side[] => {
    const stored = read();
    return stored && stored.number === puzzleNumber ? stored.picks : EMPTY;
  }, [puzzleNumber]);

  const picks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const pick = useCallback(
    (side: Side) => {
      const current = getSnapshot();
      if (current.length >= rounds) return;
      write({ number: puzzleNumber, picks: [...current, side] });
    },
    [getSnapshot, puzzleNumber, rounds]
  );

  return { picks: picks.slice(0, rounds), pick };
}
