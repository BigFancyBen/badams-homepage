"use client";

import Link from "next/link";
import { DOWNLOAD_MB } from "./constants";
import { GamePoster } from "./GamePoster";

/** "lost" is a WebGL context loss after the museum was up (iOS memory pressure, GPU reset). */
export type PosterStatus = "manual" | "loading" | "ready" | "failed" | "lost";

/** download: fetching the engine; build: Godot is up and building the hall behind the poster. */
export type LoadPhase = "download" | "build";

/** The museum page's loading backdrop: the homepage's poster with the loading bar, the closed sign
    or the reload button over it. The game starts as the page opens, so there is no enter button. */
export function Poster({
  status,
  detail,
  progress,
  phase,
  onReload,
}: {
  status: PosterStatus;
  /** Failure reason; shown only when the URL carries ?museumdebug. */
  detail?: string;
  progress: number;
  phase: LoadPhase;
  onReload: () => void;
}) {
  const closed = status === "failed";
  const lost = status === "lost";
  const loading = status === "loading" || status === "manual";
  const gone = status === "ready";
  return (
    <GamePoster
      className={`z-10 transition-[opacity,visibility] duration-700 ${gone ? "pointer-events-none invisible opacity-0" : "opacity-100"}`}
    >
      {(closed || lost) && (
        <p className="mt-4 max-w-md text-sm text-gray-300 sm:text-base">
          {closed ? "The game version couldn't start on this device." : "The browser dropped the 3D view. Reload to bring it back."}
          {closed && detail && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("museumdebug") && (
            <span className="mt-2 block break-all font-mono text-[11px] text-gray-400">{detail}</span>
          )}
        </p>
      )}

      {loading && (
        <>
          <div
            className="mt-8 h-1 w-64 bg-white/15"
            role="progressbar"
            aria-label="Loading the museum"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-gray-300" aria-live="polite">
            {phase === "download" ? `Downloading, about ${DOWNLOAD_MB} MB` : "Setting up the hall"} · {Math.round(progress * 100)}%
          </p>
          <Link
            href="/"
            className="mt-3 inline-flex min-h-11 items-center px-4 text-sm text-gray-300 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Cancel
          </Link>
        </>
      )}

      {lost && (
        <button
          type="button"
          onClick={onReload}
          className="mt-8 h-14 min-w-64 bg-white px-8 text-base font-bold uppercase tracking-widest text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Tap to reload the museum
        </button>
      )}

      {closed && (
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center px-4 text-sm text-gray-300 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Back to the homepage
        </Link>
      )}
    </GamePoster>
  );
}
