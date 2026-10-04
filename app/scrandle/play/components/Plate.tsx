"use client";

import Image from "next/image";
import { plateSrc } from "../../../api/scrandle/_lib/bucket";
import type { WeeklyPlate } from "../types";

export const WIN = "#a3be8c";
export const LOSS = "#d08770";

interface PlateProps {
  plate: WeeklyPlate;
  /** The number on the tile, 1 or 2 — the same numbering the bot's cards use. */
  label: string;
  /** Null until this round has been answered. */
  reveal: { higher: boolean; picked: boolean } | null;
  onPick: () => void;
  priority?: boolean;
}

/**
 * One photograph, as a button. Before the pick it shows the plate and what it
 * is; after, it adds what was being guessed at — the rating — and who cooked
 * it. The chef is held back until the reveal for the reason the bot holds it
 * back on a matchup: a name is a reason to pick that has nothing to do with
 * the plate.
 */
export function Plate({ plate, label, reveal, onPick, priority }: PlateProps) {
  const [x, y] = plate.focus ?? [0.5, 0.5];
  const edge = reveal
    ? reveal.higher
      ? WIN
      : "rgba(255,255,255,0.08)"
    : "rgba(255,255,255,0.08)";

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={reveal !== null}
      aria-label={
        reveal
          ? `${label}: ${plate.name || "plate"}, rated ${plate.rating}`
          : `Pick ${label}: ${plate.name || "plate"}`
      }
      className="group relative flex flex-col text-left transition-colors enabled:cursor-pointer enabled:hover:border-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ border: `2px solid ${edge}`, backgroundColor: "#111111" }}
    >
      <div className="relative w-full aspect-[3/4] sm:aspect-square overflow-hidden">
        <Image
          src={plateSrc(plate.image)}
          alt={plate.name || "A plate of food"}
          fill
          priority={priority}
          // One pre-sized copy per photograph, served by the site itself, so
          // none of these go through the image optimizer and its allowance.
          unoptimized
          className="object-cover transition-opacity duration-300"
          style={{
            objectPosition: `${x * 100}% ${y * 100}%`,
            opacity: reveal && !reveal.higher ? 0.45 : 1,
          }}
        />

        <span
          className="absolute top-0 left-0 px-2.5 py-1 font-mono text-sm font-bold"
          style={{ backgroundColor: "rgba(10,10,10,0.82)", color: "#ededed" }}
        >
          {label}
        </span>

        {reveal?.picked ? (
          <span
            className="absolute top-0 right-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest font-bold"
            style={{
              backgroundColor: reveal.higher ? WIN : LOSS,
              color: "#0a0a0a",
            }}
          >
            Your pick
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 p-3 min-h-[5.5rem]">
        {reveal ? (
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: reveal.higher ? WIN : "#ededed" }}
            >
              {plate.rating}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500 truncate">
              {plate.chef}
            </span>
          </div>
        ) : null}
        <span className="text-sm text-gray-300 leading-snug line-clamp-2">
          {plate.name || " "}
        </span>
      </div>
    </button>
  );
}
