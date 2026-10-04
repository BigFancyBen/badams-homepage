"use client";

import Image from "next/image";
import { useState } from "react";
import { plateSrc } from "../../../api/scrandle/_lib/bucket";
import { answer, type Side, type WeeklyPuzzle } from "../types";
import { LOSS, WIN } from "./Plate";

const SHARE_URL = "https://benadams.dev/scrandle/play";

interface SummaryProps {
  puzzle: WeeklyPuzzle;
  picks: Side[];
  score: number;
}

/**
 * The score, as text to paste back into the channel. Squares rather than
 * numbers for the same reason as every game of this shape: it shows how the
 * run went without giving any of the answers away.
 */
function shareText(puzzle: WeeklyPuzzle, picks: Side[], score: number): string {
  const squares = puzzle.rounds
    .map((round, i) => (picks[i] === answer(round) ? "🟩" : "🟥"))
    .join("");
  return `Scrandle #${puzzle.number} — ${score}/${puzzle.rounds.length}\n${squares}\n${SHARE_URL}`;
}

export function Summary({ puzzle, picks, score }: SummaryProps) {
  const [copied, setCopied] = useState(false);
  const total = puzzle.rounds.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(puzzle, picks, score));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy the score:", error);
    }
  };

  return (
    <section aria-label="Your score">
      <div
        className="p-6 flex flex-wrap items-end justify-between gap-6"
        style={{
          border: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "#111111",
        }}
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            You got
          </p>
          <p className="mt-1 text-6xl md:text-7xl font-bold text-white tabular-nums">
            {score}
            <span className="text-gray-600">/{total}</span>
          </p>
          <p className="mt-3 text-sm text-gray-400">
            The bot says so in the channel when the next one goes up.
          </p>
        </div>

        <button
          type="button"
          onClick={copy}
          className="font-mono text-xs uppercase tracking-widest px-4 py-3 transition-colors hover:bg-white/10 cursor-pointer"
          style={{ color: "#ededed", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          <span aria-live="polite">{copied ? "Copied" : "Copy score"}</span>
        </button>
      </div>

      <h2 className="mt-10 mb-3 font-mono text-[10px] uppercase tracking-widest text-gray-500">
        How it went
      </h2>
      <ol className="flex flex-col gap-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
        {puzzle.rounds.map((round, i) => {
          const correct = answer(round);
          const right = picks[i] === correct;
          return (
            <li
              key={i}
              className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-3 p-3"
              style={{
                backgroundColor: "#0a0a0a",
                borderLeft: `3px solid ${right ? WIN : LOSS}`,
              }}
            >
              <span className="font-mono text-xs text-gray-600 tabular-nums">
                {i + 1}
              </span>
              {(["a", "b"] as const).map((side) => {
                const plate = round[side];
                const [x, y] = plate.focus ?? [0.5, 0.5];
                const higher = side === correct;
                return (
                  <div key={side} className="flex items-center gap-3 min-w-0">
                    <div
                      className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0"
                      style={{
                        outline:
                          picks[i] === side
                            ? `2px solid ${right ? WIN : LOSS}`
                            : "none",
                      }}
                    >
                      <Image
                        src={plateSrc(plate.image)}
                        alt=""
                        fill
                        // The same file the tile showed, already in the cache.
                        unoptimized
                        className="object-cover"
                        style={{
                          objectPosition: `${x * 100}% ${y * 100}%`,
                          opacity: higher ? 1 : 0.5,
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold tabular-nums"
                        style={{ color: higher ? WIN : "#8b8b8b" }}
                      >
                        {plate.rating}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {plate.name || "Untitled"}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600 truncate">
                        {plate.chef}
                      </p>
                    </div>
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
