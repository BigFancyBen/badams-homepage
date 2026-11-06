"use client";

import { useSyncExternalStore, type KeyboardEvent, type Ref } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { getSongClock } from "./songClock";
import { SONGS, dropLeadIn } from "./songs";

export interface MenuEntry {
  id: string;
  title: string;
  active: boolean;
}

/* The new song comes in on its build, like the first visit does, so a switch is heard at its best. */
const SWITCH_LEAD_SECONDS = 8.5;

const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * The project menu: a dark vitrine panel with a red rule along its top and corner brackets, that
 * rises out of the icon bar. Its rows slide in one after another; the current view has a red bar
 * that glides from row to row. Below the projects, the music: the five house tracks, the playing
 * one marked with a little equalizer (moving while the music is on). Picking a track switches the
 * song (and the lights) and leaves the menu open, so the visitor can hear it.
 *
 * On phones (`modal`) there is no room for it beside the view, so it is a modal instead: the scene
 * dims behind it, the panel rises into the middle of the screen below the music button, and a
 * close button, a tap on the dimmed scene or Esc puts it away.
 */
export function MuseumMenu({
  entries,
  onGo,
  onSong,
  onKeyDown,
  onClose,
  modal,
  menuRef,
}: {
  entries: MenuEntry[];
  onGo: (id: string) => void;
  /** The song changed: Godot takes the new cue sheet. */
  onSong: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onClose: () => void;
  /** Phones: a centred modal over a dimmed scene rather than a panel over the icon bar. */
  modal: boolean;
  menuRef: Ref<HTMLDivElement>;
}) {
  const reduced = useReducedMotion();
  const clock = getSongClock();
  const { songId, audible } = useSyncExternalStore(clock.subscribe, clock.getState, clock.getState);
  const stagger = reduced ? 0 : 0.022;
  const row = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, x: -10 },
          animate: { opacity: 1, x: 0, transition: { delay: 0.08 + i * stagger, duration: 0.22, ease: EASE } },
        };

  const panel = (
    <motion.div
      ref={menuRef}
      role="dialog"
      aria-label="Projects"
      aria-modal={modal ? true : undefined}
      onKeyDown={onKeyDown}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: modal ? 28 : 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: reduced ? 0.01 : 0.26, ease: EASE }}
      style={{ transformOrigin: modal ? "center" : "bottom center" }}
      className={`pointer-events-auto flex flex-col border border-white/15 bg-[#07080b]/90 pb-3 shadow-[0_0_40px_rgba(255,42,42,0.12)] backdrop-blur-md ${
        modal
          ? "relative max-h-full w-full max-w-sm"
          : "absolute bottom-full left-1/2 mb-3 max-h-[72svh] w-80 -ml-40 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:w-72 [@media(max-height:500px)]:-ml-36"
      }`}
    >
      {/* the red rule draws itself across the top as the panel opens */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 -top-px h-[2px] origin-left bg-[#ff2a2a] shadow-[0_0_12px_rgba(255,42,42,0.8)]"
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
      />
      {/* corner brackets, like a display case */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b border-l border-white/30" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r border-white/30"
      />

      {modal && (
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className={`overflow-y-auto overscroll-contain ${modal ? "pb-2" : "py-2"}`}>
        <ul>
          {entries.map((e, i) => (
            <motion.li key={e.id} {...row(i)}>
              <button
                type="button"
                aria-current={e.active ? "true" : undefined}
                onClick={() => onGo(e.id)}
                className={`group relative flex min-h-11 w-full items-center gap-3 px-5 text-left text-sm transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${
                  e.active ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {e.active && (
                  <motion.span
                    layoutId={reduced ? undefined : "museum-menu-here"}
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-[3px] bg-[#ff2a2a] shadow-[0_0_10px_rgba(255,42,42,0.9)]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="transition-transform duration-200 group-hover:translate-x-1">{e.title}</span>
              </button>
            </motion.li>
          ))}
        </ul>

        <motion.div {...row(entries.length)} className="mx-5 mt-2 border-t border-white/10 pt-3">
          <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Music</p>
        </motion.div>
        <ul>
          {SONGS.map((s, i) => {
            const on = s.id === songId;
            return (
              <motion.li key={s.id} {...row(entries.length + 1 + i)}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (on) return;
                    clock.switchTo(s, dropLeadIn(s, SWITCH_LEAD_SECONDS));
                    onSong();
                  }}
                  className={`group flex min-h-10 w-full items-center gap-3 px-5 text-left text-[13px] transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${
                    on ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span aria-hidden="true" className={`flex h-3 w-3 items-end gap-[2px] ${on ? "" : "opacity-30 group-hover:opacity-70"}`}>
                    {[0, 1, 2].map((b) => (
                      <span
                        key={b}
                        className={`h-full w-[3px] origin-bottom ${on ? "bg-[#ff2a2a]" : "bg-white"} ${on && audible ? "museum-eq" : ""}`}
                        style={{ transform: `scaleY(${[0.5, 0.9, 0.7][b]})`, animationDelay: `${b * -0.23}s` }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 transition-transform duration-200 group-hover:translate-x-1">{s.title}</span>
                  <span className="font-mono text-[10px] text-white/35">{s.bpm} BPM</span>
                </button>
              </motion.li>
            );
          })}
        </ul>

        <motion.div {...row(entries.length + 1 + SONGS.length)} className="mx-5 mt-2 border-t border-white/10">
          {/* Same site, so no leave modal; let go of the pointer first so the next page is not stuck locked. */}
          <Link
            href="/"
            onClick={() => document.exitPointerLock?.()}
            className="-mx-5 flex min-h-11 items-center px-5 text-left text-sm text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          >
            Back to the homepage
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );

  if (!modal) return panel;
  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-[2px]"
      style={{
        /* below the music button row at the top, clear of the notch and the home bar */
        paddingTop: "calc(max(1rem, env(safe-area-inset-top)) + 3.75rem)",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.01 : 0.22 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {panel}
    </motion.div>
  );
}
