"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Side } from "../types";

const STORAGE_KEY = "scrandle-weekly-results";
/** Where a single puzzle's picks used to live, before results were kept. */
const LEGACY_KEY = "scrandle-weekly-progress";

/**
 * One puzzle's worth. Right and wrong are stored next to the picks because
 * only the current puzzle is ever loaded: an earlier one's answers are not
 * around to mark it against.
 */
interface Result {
  picks: Side[];
  right: boolean[];
}

/** Every puzzle this browser has played, by number. */
type Results = Record<string, Result>;

export interface PastResult {
  number: number;
  right: boolean[];
}

const EMPTY: Side[] = [];
const NONE: Results = {};

// ── localStorage-backed store ───────────────────────────────────────
// Read through useSyncExternalStore so the server snapshot stays empty and
// hydration does not depend on what is in this browser.
let cache: Results | undefined;
const listeners = new Set<() => void>();

function parse(raw: string | null): Results {
  const parsed: unknown = raw ? JSON.parse(raw) : null;
  if (typeof parsed !== "object" || parsed === null) return {};
  const results: Results = {};
  for (const [number, value] of Object.entries(parsed)) {
    if (!Array.isArray(value?.picks)) continue;
    results[number] = {
      picks: value.picks,
      right: Array.isArray(value.right) ? value.right : [],
    };
  }
  return results;
}

/** The old single-puzzle shape, carried over so nobody loses a game to this. */
function migrate(): Results {
  const raw = localStorage.getItem(LEGACY_KEY);
  const legacy = raw ? JSON.parse(raw) : null;
  if (!legacy || typeof legacy.number !== "number" || !Array.isArray(legacy.picks)) {
    return {};
  }
  const results: Results = {
    [legacy.number]: { picks: legacy.picks, right: [] },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  localStorage.removeItem(LEGACY_KEY);
  return results;
}

function read(): Results {
  if (cache !== undefined) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw === null ? migrate() : parse(raw);
  } catch (error) {
    console.error("Failed to load scrandle results:", error);
    cache = {};
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

function write(next: Results) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to save scrandle results:", error);
  }
  emit();
}

function save(puzzleNumber: number, picks: Side[], answers: Side[]) {
  write({
    ...read(),
    [puzzleNumber]: {
      picks,
      right: picks.map((side, i) => side === answers[i]),
    },
  });
}

function getServerSnapshot(): Results {
  return NONE;
}

/**
 * This browser's picks for one puzzle, in round order, and how the puzzles
 * before it went. Results are kept by puzzle number, so last week's answers
 * never leak into this week's and a new puzzle does not cost anyone the old
 * one's score.
 */
export function useWeeklyProgress(puzzleNumber: number, answers: Side[]) {
  const results = useSyncExternalStore(subscribe, read, getServerSnapshot);
  const rounds = answers.length;
  const current = results[puzzleNumber];

  const pick = useCallback(
    (side: Side) => {
      const picks = read()[puzzleNumber]?.picks ?? EMPTY;
      if (picks.length >= rounds) return;
      save(puzzleNumber, [...picks, side], answers);
    },
    [puzzleNumber, rounds, answers]
  );

  // Picks carried over from the old shape have no marks yet. Mark them while
  // this puzzle's answers are still the ones on hand.
  useEffect(() => {
    if (current && current.right.length !== current.picks.length) {
      save(puzzleNumber, current.picks, answers);
    }
  }, [current, puzzleNumber, answers]);

  const picks = useMemo(
    () => (current?.picks ?? EMPTY).slice(0, rounds),
    [current, rounds]
  );

  /** Earlier puzzles that were played, newest first. */
  const past = useMemo<PastResult[]>(
    () =>
      Object.entries(results)
        .map(([number, result]) => ({
          number: Number(number),
          right: result.right,
        }))
        .filter((each) => each.number !== puzzleNumber && each.right.length > 0)
        .sort((x, y) => y.number - x.number),
    [results, puzzleNumber]
  );

  return { picks, pick, past };
}
