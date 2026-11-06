"use client";

import type { CSSProperties, ReactNode } from "react";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")";

/* Beam colours over near-black: what shows while the poster images are absent,
   and underneath them always. */
const BEAMS = [
  "radial-gradient(ellipse 60% 50% at 18% 20%, rgba(255,26,26,0.42), transparent 70%)",
  "radial-gradient(ellipse 55% 45% at 85% 25%, rgba(200,0,20,0.36), transparent 70%)",
  "radial-gradient(ellipse 70% 40% at 55% 100%, rgba(255,60,40,0.30), transparent 70%)",
  "radial-gradient(ellipse at center, #1a0a0c 0%, #06070a 75%)",
].join(", ");

/**
 * The game's poster: beams, grain, the poster picture, and the gradient (no title: the poster's own neon carries the name, and each page has its own h1)
 * with the page's controls as children.
 * Fills its positioned parent. Used by the homepage's game section and as the museum page's
 * loading backdrop, so the one reads as the next step of the other.
 */
export function GamePoster({
  children,
  className = "",
  style,
  lift = false,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Raise the picture (more in landscape, where the neon sits lower) so the neon clears a tall block of
      controls below it; its bottom edge then fades out instead of ending in a line. */
  lift?: boolean;
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ background: BEAMS, ...style }}>
      <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: GRAIN }} aria-hidden="true" />
      <picture
        className={`absolute inset-0 ${lift ? "-translate-y-[14%] landscape:-translate-y-[22%]" : ""}`}
        style={lift ? { maskImage: "linear-gradient(to bottom, #000 78%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 78%, transparent 100%)" } : undefined}
      >
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
            "linear-gradient(to top, rgba(6,7,10,0.9) 0%, rgba(6,7,10,0.35) 14%, rgba(6,7,10,0) 26%), radial-gradient(ellipse at center, transparent 60%, rgba(6,7,10,0.6) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="relative flex h-full flex-col items-center justify-end px-6 text-center"
        style={{ paddingBottom: "max(1.75rem, calc(env(safe-area-inset-bottom) + 1rem))" }}
      >
        {children}
      </div>
    </div>
  );
}
