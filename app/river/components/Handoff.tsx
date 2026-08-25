"use client";

import { useCallback, useEffect, useState } from "react";
import { RIVER } from "../config";
import { MONO } from "../typography";

/**
 * The one thing this page does that a poster could not.
 *
 * Somebody clicked Join on a friend's trip. If the game is on this machine it
 * registered `mfrs://` at first run, and handing the code to that scheme puts
 * them in the boat — the browser tab is left behind and nothing here matters.
 * If it is not, nothing takes the URL, the page stays where it is, and after a
 * beat this strip stops promising a game and starts offering one.
 *
 * A browser will not tell you whether a scheme is registered, so the elapsed
 * time and the tab going hidden are the only two signals available. Both are
 * used: hidden means something took it, still visible after `handoffMs` means
 * nothing did.
 *
 * The marketing underneath is rendered on the server and is on screen from the
 * first paint, whichever way this goes. Nobody waits on this to see the game.
 */
type Phase = "trying" | "handed-off" | "settled";

/** iOS has no build to hand off to, and an unknown scheme there is a modal. */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function Handoff({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("trying");

  const open = useCallback(() => {
    window.location.href = `${RIVER.scheme}://join/${code}`;
  }, [code]);

  useEffect(() => {
    // On iOS there is nothing to hand off to, so skip straight to the offer
    // rather than making the browser refuse a scheme it has never heard of.
    const ios = isIOS();
    if (!ios) open();
    const timer = window.setTimeout(() => setPhase("settled"), ios ? 0 : RIVER.handoffMs);

    // The tab going away is the game coming up. Say so rather than telling
    // somebody who comes back to close the tab that nothing happened.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        setPhase("handed-off");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  if (phase === "handed-off") {
    return (
      <Strip>
        <span className="text-[#f2efe3]">Opened. You can close this tab.</span>
      </Strip>
    );
  }

  if (phase === "trying") {
    return (
      <Strip>
        <span className="inline-flex items-center gap-2 text-[#f2efe3]/80">
          <span className="h-1.5 w-1.5 bg-[#e2650f] motion-safe:animate-pulse" />
          Opening the game…
        </span>
      </Strip>
    );
  }

  return (
    <Strip>
      <span className="text-[#f2efe3]/80">Nothing opened.</span>{" "}
      <button
        type="button"
        onClick={open}
        className="underline decoration-[#e2650f] decoration-2 underline-offset-4 text-[#f2efe3] hover:text-[#e2650f] transition-colors"
      >
        Try again
      </button>
    </Strip>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`${MONO} border-l-2 border-[#e2650f] bg-black/40 py-2 pr-4 pl-3 text-[13px] tracking-tight backdrop-blur-sm`}
    >
      {children}
    </p>
  );
}
