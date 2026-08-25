"use client";

import { useState } from "react";
import { MONO } from "../typography";

/**
 * The trip code, and a button that copies it.
 *
 * This is the thing on the page that works everywhere. A scheme can be
 * unregistered, an App Link unverified, a browser can block the handoff — and a
 * code typed into the trip board under **Another trip** still puts somebody on
 * the river, which is the door this game has always had. `docs/app-links.md` in
 * the game repo puts it first for that reason, so it is set large by default.
 */
export function CodeChip({ code, size = "lg" }: { code: string; size?: "lg" | "sm" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The code is on screen, so selecting it still works.
    }
  }

  const big = size === "lg";

  return (
    // `min-w-0` on both halves or a long code from a wordlist-less meetup
    // server sets the width of the whole hero and pushes the page sideways on a
    // phone. The code scrolls inside the chip instead.
    <span className="inline-flex min-w-0 max-w-full items-stretch border border-[#f2efe3]/30 bg-black/30">
      <span
        className={`${MONO} min-w-0 px-4 ${big ? "py-3 text-xl sm:text-3xl" : "py-2 text-base sm:text-lg"} overflow-x-auto whitespace-nowrap text-[#e2650f] select-all`}
      >
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className={`${MONO} shrink-0 border-l border-[#f2efe3]/30 px-4 text-xs tracking-widest uppercase transition-colors hover:bg-[#f2efe3]/10`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
