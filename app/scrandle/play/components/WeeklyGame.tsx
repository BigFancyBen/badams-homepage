"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ACCENT } from "../../data";
import { useWeeklyProgress } from "../hooks/useWeeklyProgress";
import { answer, type Side, type WeeklyPuzzle } from "../types";
import { LOSS, Plate, WIN } from "./Plate";
import { Summary } from "./Summary";

interface WeeklyGameProps {
  puzzle: WeeklyPuzzle;
}

/**
 * The game: one pair at a time, pick the plate the channel rated higher, see
 * the ratings, move on. Ten of those and a score.
 *
 * Picks live in localStorage against the puzzle's number, so closing the tab
 * half way through picks up where it left off, a finished puzzle stays
 * finished, and a pick cannot be taken back by reloading. Coming back to a
 * finished one says so, and earlier puzzles' scores are kept alongside.
 */
export function WeeklyGame({ puzzle }: WeeklyGameProps) {
  const total = puzzle.rounds.length;
  const answers = useMemo(() => puzzle.rounds.map(answer), [puzzle]);
  const { picks, pick, past } = useWeeklyProgress(puzzle.number, answers);

  // Whether a pick was made on this visit. A finished puzzle without one was
  // finished some other time, which is worth telling the player.
  const [playedNow, setPlayedNow] = useState(false);

  // The round on screen. Null means "the first one not answered yet", which is
  // where a reload should land; it is pinned to a number only while a reveal
  // is being looked at, so answering does not yank the pair away.
  const [pinned, setPinned] = useState<number | null>(null);
  const index = pinned ?? picks.length;

  const score = picks.filter(
    (side, i) => side === answer(puzzle.rounds[i])
  ).length;

  const finished = index >= total;
  const round = finished ? null : puzzle.rounds[index];
  const picked: Side | undefined = picks[index];
  const correct = round ? answer(round) : null;

  const choose = (side: Side) => {
    if (picked !== undefined) return;
    setPinned(index);
    setPlayedNow(true);
    pick(side);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a" }}>
      <header
        className="sticky top-0 z-30"
        style={{
          background: "rgba(10,10,10,0.82)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono shrink-0"
          >
            &larr; benadams.dev
          </Link>

          <ol className="flex items-center gap-1" aria-label="Rounds">
            {puzzle.rounds.map((each, i) => {
              const side = picks[i];
              const color =
                side === undefined
                  ? "rgba(255,255,255,0.08)"
                  : side === answer(each)
                    ? WIN
                    : LOSS;
              return (
                <li
                  key={i}
                  className="w-3 h-3 sm:w-4 sm:h-4"
                  style={{
                    backgroundColor: color,
                    outline: i === index ? "1px solid #ededed" : "none",
                    outlineOffset: 2,
                  }}
                  aria-label={
                    side === undefined
                      ? `Round ${i + 1}: not played`
                      : `Round ${i + 1}: ${side === answer(each) ? "right" : "wrong"}`
                  }
                />
              );
            })}
          </ol>

          <span className="font-mono text-xs text-gray-400 tabular-nums shrink-0">
            {score}/{total}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Scrandle{" "}
            <span style={{ color: ACCENT }}>#{puzzle.number}</span>
          </h1>
          {round ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              Round {index + 1} of {total}
            </span>
          ) : null}
        </div>

        {round && correct ? (
          <>
            <p className="text-sm md:text-base text-gray-400 mb-4">
              Which plate did the channel rate higher?
            </p>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {(["a", "b"] as const).map((side) => (
                <Plate
                  key={`${index}-${side}`}
                  plate={round[side]}
                  label={side === "a" ? "1" : "2"}
                  reveal={
                    picked === undefined
                      ? null
                      : { higher: correct === side, picked: picked === side }
                  }
                  onPick={() => choose(side)}
                  priority={index === 0}
                />
              ))}
            </div>

            <div
              className="mt-4 flex items-center justify-between gap-4 min-h-[3rem]"
              aria-live="polite"
            >
              {picked === undefined ? (
                <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                  Pick one
                </span>
              ) : (
                <>
                  <span
                    className="text-lg font-bold"
                    style={{ color: picked === correct ? WIN : LOSS }}
                  >
                    {picked === correct ? "Right" : "Wrong"}
                    <span className="ml-2 font-mono text-xs font-normal text-gray-500">
                      {Math.abs(round.a.rating - round.b.rating)} points in it
                    </span>
                  </span>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setPinned(null)}
                    className="font-mono text-xs uppercase tracking-widest px-4 py-3 transition-colors hover:bg-white/10 cursor-pointer"
                    style={{
                      color: "#ededed",
                      border: "1px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    {index + 1 >= total ? "See your score" : "Next"} &rarr;
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <Summary
            puzzle={puzzle}
            picks={picks}
            score={score}
            past={past}
            returning={!playedNow}
          />
        )}
      </main>
    </div>
  );
}
