"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "scrandle-plan-progress";

type Progress = Record<string, boolean>;

const EMPTY: Progress = {};

// ── localStorage-backed store ───────────────────────────────────────
// Read through useSyncExternalStore so the server snapshot stays empty and
// hydration does not depend on what is in this browser.
let cache: Progress | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && typeof parsed === "object" ? (parsed as Progress) : EMPTY;
  } catch (error) {
    console.error("Failed to load scrandle plan progress:", error);
    cache = EMPTY;
  }
  return cache;
}

function getServerSnapshot(): Progress {
  return EMPTY;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cache = null;
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

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to save scrandle plan progress:", error);
  }
  emit();
}

export interface ChecklistState {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
  reset: () => void;
  completed: number;
}

export function useChecklist(allIds: string[]): ChecklistState {
  const checked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isChecked = useCallback((id: string) => Boolean(checked[id]), [checked]);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    write({ ...current, [id]: !current[id] });
  }, []);

  const reset = useCallback(() => write({}), []);

  const completed = useMemo(
    () => allIds.filter((id) => checked[id]).length,
    [allIds, checked]
  );

  return { isChecked, toggle, reset, completed };
}
