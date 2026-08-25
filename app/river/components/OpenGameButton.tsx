"use client";

import { openTrip } from "../open-trip";

/**
 * The button for a browser that would not let the automatic handoff through.
 *
 * Chrome and Safari both allow a click to reach a custom scheme that they would
 * refuse on page load, so a visitor who owns the game and saw nothing happen has
 * one thing to press. `docs/app-links.md` in the game repo asks for it by name.
 */
export function OpenGameButton({ code }: { code: string }) {
  return (
    <button
      type="button"
      onClick={() => openTrip(code)}
      className="border border-[#f2efe3]/40 px-7 py-3.5 text-base tracking-wide uppercase transition-colors hover:border-[#f2efe3] hover:bg-[#f2efe3]/10"
    >
      Open the game
    </button>
  );
}
