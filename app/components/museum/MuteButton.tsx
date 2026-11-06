"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { getSongClock } from "./songClock";
import { getSong } from "./songs";

/** The pointer-lock prompt beside the button: locked ("Press Esc to show cursor"), or the unlocked
    hint ("Click to aim"), which is fading out. Null shows none. */
export type AimPrompt = "locked" | "hint" | "hint-out" | null;

const RED = "255,42,42";

/** How hard the hint flashes right now: full in a drop, a little less elsewhere (the song's own sections). */
function sectionBoost(time: number): number {
  const song = getSong();
  const bar = (time * song.bpm) / 240;
  const sec = song.sections.find((x) => bar >= x.from && bar < x.to);
  return sec?.name === "drop" ? 1 : sec?.name === "break" ? 0.65 : 0.8;
}

/**
 * Fixed top-left, inset for notches, 44 px touch target. Muted on every visit; sound only starts
 * from a click here. From the moment the museum page opens (during the download too, so the music
 * can already be playing when the hall appears) until the music is first turned on, the button is
 * filled red and, on every beat of the song, swells, glows and sends a ring out, harder in the drop.
 * Beside it the "Turn on the music" callout (red outline, glowing on the beat, equalizer bars
 * bouncing in time) stays up until the music is on; a tap on it turns the music on. Under reduced
 * motion both are shown still: the red fill and the callout, no movement.
 */
export function MuteButton({ prompt = false, aim = null }: { prompt?: boolean; aim?: AimPrompt }) {
  const clock = getSongClock();
  const { audible, loading } = useSyncExternalStore(
    clock.subscribe,
    clock.getState,
    clock.getState,
  );
  const ref = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLSpanElement>(null);
  const [unmutedOnce, setUnmutedOnce] = useState(false);
  /* A tap on the button or the callout: the callout has done its job (the button stays red if the song fails to load). */
  const [tapped, setTapped] = useState(false);
  /* Once the music has been on, none of the hint comes back this session. */
  if (audible && !unmutedOnce) setUnmutedOnce(true);

  /* The hint: until the music has been on once. No timeout: it stays until the visitor answers it. */
  const hinting = prompt && !audible && !unmutedOnce;
  const callout = hinting && !tapped;

  /* On the beat: the button swells and glows, a ring goes out from it, the callout glows and its bars bounce. */
  useEffect(() => {
    const el = ref.current;
    if (!el || !hinting || loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* The ring is mounted exactly while hinting, so it is the same element for the life of this effect. */
    const ring = ringRef.current;
    let raf = 0;
    const tick = () => {
      const t = clock.time();
      const beats = (t * clock.bpm) / 60;
      const phase = ((beats % 1) + 1) % 1;
      const boost = sectionBoost(t);
      const k = Math.exp(-phase * 4.5) * boost;
      el.style.transform = `scale(${(1 + 0.14 * k).toFixed(3)})`;
      el.style.boxShadow = `0 0 ${Math.round(10 + 26 * k)}px ${Math.round(2 + 7 * k)}px rgba(${RED},${(0.35 + 0.6 * k).toFixed(3)})`;
      if (ring) {
        ring.style.transform = `scale(${(1 + 1.1 * phase).toFixed(3)})`;
        ring.style.opacity = ((1 - phase) * 0.9 * boost).toFixed(3);
      }
      const c = calloutRef.current;
      if (c) {
        c.style.boxShadow = `0 0 ${Math.round(6 + 20 * k)}px ${Math.round(1 + 4 * k)}px rgba(${RED},${(0.25 + 0.55 * k).toFixed(3)})`;
        c.style.borderColor = `rgba(255,${Math.round(42 + 213 * k * 0.6)},${Math.round(42 + 213 * k * 0.6)},1)`;
      }
      const bars = barsRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          /* each bar on its own off-beat, so they read as a little meter */
          const p = (((beats * (i === 1 ? 2 : 1) + i * 0.33) % 1) + 1) % 1;
          (bars[i] as HTMLElement).style.transform = `scaleY(${(0.25 + 0.75 * Math.exp(-p * 3.5) * boost).toFixed(3)})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
      el.style.boxShadow = "";
      if (ring) ring.style.opacity = "0";
    };
  }, [hinting, loading, clock]);

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
          setTapped(true);
          void clock.toggle();
        }}
        style={inset}
        className={`fixed z-50 flex h-11 min-w-11 items-center justify-center border px-3 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
          hinting ? "border-[#ff2a2a] bg-[#ff2a2a] text-white" : "border-white/15 bg-black/60 text-gray-200 hover:text-white"
        }`}
      >
        {hinting && (
          <span ref={ringRef} aria-hidden="true" className="pointer-events-none absolute -inset-px border-2 border-[#ff2a2a] opacity-0" />
        )}
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
              ref={calloutRef}
              onClick={() => {
                setTapped(true);
                void clock.toggle();
              }}
              className="pointer-events-auto relative flex h-11 cursor-pointer items-center gap-2.5 border-2 border-[#ff2a2a] bg-black/90 pl-3 pr-4 text-sm font-bold uppercase tracking-wider text-white backdrop-blur"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-[#ff2a2a] bg-black"
              />
              <span ref={barsRef} aria-hidden="true" className="flex h-4 items-end gap-[3px]">
                <span className="h-full w-[3px] origin-bottom scale-y-50 bg-[#ff2a2a]" />
                <span className="h-full w-[3px] origin-bottom scale-y-90 bg-[#ff2a2a]" />
                <span className="h-full w-[3px] origin-bottom scale-y-75 bg-[#ff2a2a]" />
              </span>
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
