"use client";

import { useState, useEffect, useRef, useMemo } from "react";

export function useAmbientGlow(
  cardCount: number,
  disabled: boolean,
  anyHovered: boolean
): Set<number> {
  const [slot0, setSlot0] = useState<number | null>(null);
  const [slot1, setSlot1] = useState<number | null>(null);
  const [slot2, setSlot2] = useState<number | null>(null);
  const nextIndexRef = useRef(0);

  const paused = disabled || cardCount === 0 || anyHovered;

  useEffect(() => {
    if (paused) return;

    const setters = [setSlot0, setSlot1, setSlot2];
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    const pickNext = (): number | null => {
      const idx = nextIndexRef.current;
      nextIndexRef.current = (idx + 1) % cardCount;
      return idx;
    };

    const scheduleSlot = (slotIndex: number) => {
      const setter = setters[slotIndex];
      const advance = () => {
        setter(pickNext());
        const delay = 3000 + Math.random() * 3000;
        timeoutIds[slotIndex] = setTimeout(advance, delay);
      };
      const initialDelay = 1000 + slotIndex * 1500;
      timeoutIds[slotIndex] = setTimeout(advance, initialDelay);
    };

    scheduleSlot(0);
    scheduleSlot(1);
    scheduleSlot(2);

    return () => {
      timeoutIds.forEach(clearTimeout);
      setSlot0(null);
      setSlot1(null);
      setSlot2(null);
    };
  }, [paused, cardCount]);

  return useMemo(() => {
    const set = new Set<number>();
    if (slot0 !== null) set.add(slot0);
    if (slot1 !== null) set.add(slot1);
    if (slot2 !== null) set.add(slot2);
    return set;
  }, [slot0, slot1, slot2]);
}
