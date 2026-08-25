"use client";

import { useState } from "react";
import { MONO } from "../typography";

/**
 * The trip code, and a button that copies it.
 *
 * This is the fallback under the fallback. If the `mfrs://` handoff fails on a
 * machine that does have the game — an old build that predates the scheme, a
 * Linux desktop that never ran `update-desktop-database`, a browser that blocks
 * the navigation — the player still needs the code, because typing it into the
 * trip board is how joining worked before any of this existed and still works.
 */
export function CodeChip({ code }: { code: string }) {
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

  return (
    <span className="inline-flex items-stretch border border-[#f2efe3]/30">
      <span className={`${MONO} bg-[#f2efe3]/5 px-4 py-2 text-lg text-[#e2650f] select-all`}>
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className={`${MONO} border-l border-[#f2efe3]/30 px-4 py-2 text-xs tracking-widest uppercase transition-colors hover:bg-[#f2efe3]/10`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
