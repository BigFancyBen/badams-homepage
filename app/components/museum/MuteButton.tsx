"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { getSongClock } from "./songClock";

/** The pointer-lock prompt beside the button: locked ("Press Esc to show cursor"), or the unlocked
    hint ("Click to aim"), which is fading out. Null shows none. */
export type AimPrompt = "locked" | "hint" | "hint-out" | null;

/** How long the "Turn on the music" callout stays up if nobody taps. */
const CALLOUT_MS = 6000;

/**
 * Fixed top-left, inset for notches, 44 px touch target. Muted on every visit; sound only starts
 * from a click here. Once the game is ready and while it is still muted, the button pulses on the
 * song's beat (a red ring; none under reduced motion) and a callout points at it. The callout goes
 * on a tap on either, or after a few seconds; the pulse stays, fainter, until the first unmute.
 */
export function MuteButton({ ready = false, aim = null }: { ready?: boolean; aim?: AimPrompt }) {
  const clock = getSongClock();
  const { audible, loading } = useSyncExternalStore(
    clock.subscribe,
    clock.getState,
    clock.getState,
  );
  const ref = useRef<HTMLButtonElement>(null);
  const [unmutedOnce, setUnmutedOnce] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  /* Once the music has been on, none of the hint comes back this session. */
  if (audible && !unmutedOnce) setUnmutedOnce(true);

  const callout = ready && !audible && !unmutedOnce && !dismissed;
  useEffect(() => {
    if (!callout) return;
    const id = window.setTimeout(() => setDismissed(true), CALLOUT_MS);
    return () => window.clearTimeout(id);
  }, [callout]);

  const hinting = ready && !audible && !loading && !unmutedOnce;
  const strong = useRef(false);
  useEffect(() => {
    strong.current = callout;
  }, [callout]);

  /* The unmute hint: a red ring that swells on each beat, stronger while the callout is up. */
  useEffect(() => {
    const el = ref.current;
    if (!el || !hinting) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      const phase = ((((clock.time() * clock.bpm) / 60) % 1) + 1) % 1;
      const k = Math.exp(-phase * 5) * (strong.current ? 1 : 0.55);
      el.style.boxShadow = `0 0 ${Math.round(4 + 12 * k)}px ${Math.round(k * 4)}px rgba(255,42,42,${(0.15 + 0.6 * k).toFixed(3)})`;
      el.style.borderColor = `rgba(255,${Math.round(255 * (1 - k))},${Math.round(255 * (1 - k))},${0.2 + 0.6 * k})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.boxShadow = "";
      el.style.borderColor = "";
    };
  }, [hinting, clock]);

  /* Pulse on the beat while audible. Written straight to the element: a state
     update per frame would re-render for no reason. */
  useEffect(() => {
    const el = ref.current;
    if (!el || !audible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      const phase = ((clock.time() * clock.bpm) / 60) % 1;
      const k = Math.exp(-phase * 6);
      el.style.transform = `scale(${1 + 0.1 * k})`;
      el.style.borderColor = `rgba(255,${Math.round(255 * (1 - k))},${Math.round(255 * (1 - k))},${0.15 + 0.5 * k})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.borderColor = "";
    };
  }, [audible, clock]);

  const label = audible ? "Mute music" : "Play music";
  const inset = {
    top: "max(1rem, env(safe-area-inset-top))",
    left: "max(1rem, env(safe-area-inset-left))",
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-pressed={audible}
        aria-label={label}
        title={label}
        onClick={() => {
          setDismissed(true);
          void clock.toggle();
        }}
        style={inset}
        className="fixed z-50 flex h-11 min-w-11 items-center justify-center border border-white/15 bg-black/60 px-3 text-gray-200 backdrop-blur hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : audible ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      {/* Always mounted so the live region exists before its text arrives. The music callout is the
          first row, level with the button; the aim prompt takes that row alone, or sits under the callout. */}
      <div
        role="status"
        className="pointer-events-none fixed z-50 flex flex-col items-start"
        style={{
          top: inset.top,
          left: "calc(max(1rem, env(safe-area-inset-left)) + 2.75rem + 0.625rem)",
          right: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {callout && (
          <div className="flex h-11 items-center">
            <div
              onClick={() => {
                setDismissed(true);
                void clock.toggle();
              }}
              className="pointer-events-auto relative cursor-pointer border border-white/25 bg-black/85 px-3 py-2 text-xs font-medium tracking-wide text-white backdrop-blur"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[5px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-white/25 bg-black"
              />
              Turn on the music
            </div>
          </div>
        )}
        {aim && (
          <div className={`flex items-center ${callout ? "mt-1" : "h-11"}`}>
            <div
              data-aim={aim}
              className={`border px-3 py-2 text-xs tracking-wide backdrop-blur transition-opacity duration-700 ${
                aim === "locked" ? "border-white/25 bg-black/85 font-medium text-white" : "border-white/15 bg-black/60 text-gray-300"
              } ${aim === "hint-out" ? "opacity-0" : "opacity-100"}`}
            >
              {aim === "locked" ? "Press Esc to show cursor" : "Click to aim"}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
