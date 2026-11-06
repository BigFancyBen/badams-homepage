"use client";

import { DOWNLOAD_MB, ENGINE_SCRIPT } from "./constants";

/** "lost" is a WebGL context loss after the museum was up (iOS memory pressure, GPU reset). */
export type PosterStatus = "manual" | "loading" | "ready" | "failed" | "lost";

/** download: fetching the engine; build: Godot is up and building the hall behind the poster. */
export type LoadPhase = "download" | "build";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")";

/* Beam colours over near-black: what shows while the poster images are absent,
   and underneath them always. */
const BEAMS = [
  "radial-gradient(ellipse 60% 50% at 18% 20%, rgba(255,26,26,0.42), transparent 70%)",
  "radial-gradient(ellipse 55% 45% at 85% 25%, rgba(200,0,20,0.36), transparent 70%)",
  "radial-gradient(ellipse 70% 40% at 55% 100%, rgba(255,60,40,0.30), transparent 70%)",
  "radial-gradient(ellipse at 50% 40%, #1a0a0c 0%, #06070a 75%)",
].join(", ");

let prefetched = false;
/** Warm the cache with the small loader script while the pointer is on its
    way to the button. Only the script: Chrome fails a large download with
    ERR_CACHE_WRITE_FAILURE when a prefetch of the same .wasm or .pck is still
    in flight as the engine requests it. */
function prefetchEngine() {
  if (prefetched) return;
  prefetched = true;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = ENGINE_SCRIPT;
  document.head.appendChild(link);
}

/** The shop window: call to action, loading bar and closed sign over one poster. */
export function Poster({
  status,
  detail,
  progress,
  phase,
  onEnter,
  onCancel,
  onReload,
}: {
  status: PosterStatus;
  /** Failure reason; shown only when the URL carries ?museumdebug. */
  detail?: string;
  progress: number;
  phase: LoadPhase;
  onEnter: () => void;
  onCancel: () => void;
  onReload: () => void;
}) {
  const closed = status === "failed";
  const lost = status === "lost";
  const loading = status === "loading";
  const gone = status === "ready";
  return (
    <div
      className={`absolute inset-0 z-10 overflow-hidden transition-[opacity,visibility] duration-700 ${gone ? "pointer-events-none invisible opacity-0" : "opacity-100"}`}
      style={{ background: BEAMS }}
    >
      <div
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
        aria-hidden="true"
      />
      <picture>
        <source media="(orientation: portrait)" srcSet="/museum/poster-portrait.webp" />
        <img
          src="/museum/poster-landscape.webp"
          alt=""
          className="museum-drift absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </picture>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(6,7,10,0.95) 0%, rgba(6,7,10,0.6) 35%, rgba(6,7,10,0) 65%), radial-gradient(ellipse at center, transparent 55%, rgba(6,7,10,0.7) 100%)",
        }}
        aria-hidden="true"
      />

      <div
        className="relative flex h-full flex-col items-center justify-end px-6 text-center sm:pb-20"
        style={{ paddingBottom: "max(3.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))" }}
      >
        <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-8xl">Ben Adams</h1>

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
            <div
              className="h-full bg-white transition-[width] duration-200"
              style={{ width: `${Math.max(4, progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-gray-300" aria-live="polite">
            {phase === "download" ? `Downloading, about ${DOWNLOAD_MB} MB` : "Setting up the hall"} · {Math.round(progress * 100)}%
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 inline-flex min-h-11 items-center px-4 text-sm text-gray-300 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Cancel
          </button>
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

        {status === "manual" && (
          <>
            <button
              type="button"
              onClick={onEnter}
              onPointerEnter={prefetchEngine}
              onFocus={prefetchEngine}
              className="mt-8 h-14 min-w-64 bg-white px-8 text-base font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#ff2a2a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Game version
            </button>
            <p className="mt-2 text-xs text-gray-400">About {DOWNLOAD_MB} MB download</p>
          </>
        )}

      </div>
    </div>
  );
}
