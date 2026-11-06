"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MutableRefObject } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Menu, Pause, Play } from "lucide-react";
import { EXHIBITS } from "./exhibits";
import { FreeRoamButton } from "./FreeRoamButton";
import { LeaveModal } from "./LeaveModal";
import { MuseumDetails } from "./MuseumDetails";
import type { MuseumCommand, TourState } from "./museumBridge";

interface Props {
  focusId: string;
  tour: TourState | "";
  /** Free roam (walking) is on; off, the visitor scrolls between the views. */
  free: boolean;
  onToggleFree: () => void;
  /** A touch screen: the scroll hint says swipe. */
  touch: boolean;
  send: (cmd: MuseumCommand) => void;
  /** Filled with a function returning the CSS px the controls and menu cover at the bottom. */
  insetRef: MutableRefObject<() => number>;
  /** Filled with a function returning the CSS px the details panel covers at the right edge (0 on phones). */
  rightInsetRef: MutableRefObject<() => number>;
}

const BTN =
  "flex h-11 w-11 items-center justify-center border border-white/15 bg-black/60 text-gray-200 backdrop-blur hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-40";

const FOCUSABLE = "button:not([disabled]), a[href]";

/* Room for a side panel: not a phone, and not a phone on its side. Narrower or shorter gets the bottom sheet. */
const WIDE_QUERY = "(min-width: 640px) and (min-height: 501px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/**
 * The HTML on top of the canvas. The wrapper ignores pointer events so the
 * canvas still gets swipes and taps; only the controls catch them. No text
 * except the one Browse button and the menu's list of titles.
 */
export function MuseumOverlay({ focusId, tour, free, onToggleFree, touch, send, insetRef, rightInsetRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const wide = useWide();
  /* The exhibit whose link the visitor asked for; the modal asks before leaving the game. */
  const [leaving, setLeaving] = useState<{ title: string; href: string; resume: boolean } | null>(null);

  useEffect(() => {
    insetRef.current = () => {
      const root = rootRef.current;
      const bottom = bottomRef.current;
      if (!root || !bottom) return 0;
      return Math.max(0, Math.round(root.getBoundingClientRect().bottom - bottom.getBoundingClientRect().top));
    };
    return () => {
      insetRef.current = () => 0;
    };
  }, [insetRef]);

  /* Move focus into the menu on open; hand it back to the menu button on close. */
  useEffect(() => {
    if (!menuOpen) return;
    const menu = menuRef.current;
    (menu?.querySelector<HTMLElement>('[aria-current="true"]') ?? menu?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const btn = menuBtnRef.current;
    return () => btn?.focus({ preventScroll: true });
  }, [menuOpen]);

  const askToLeave = (title: string, href: string) => {
    const resume = tour === "touring";
    if (resume) send("tour:pause");
    setMenuOpen(false);
    setLeaving({ title, href, resume });
  };
  const closeLeave = (stay: boolean) => {
    if (stay && leaving?.resume) send("tour:play");
    setLeaving(null);
    /* After the modal unmounts, hand focus back to the control that opened it. */
    requestAnimationFrame(() => openBtnRef.current?.focus({ preventScroll: true }));
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setMenuOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const exhibit = EXHIBITS.find((e) => e.id === focusId);
  const browsing = tour === "touring" || tour === "paused" || tour === "end";
  const playing = tour === "touring";
  /* The details panel follows the camera: only at an exhibit, and only on a tour (not the stage hold). */
  const detailId = browsing && exhibit ? exhibit.id : null;
  /* The two framed shots bracket the exhibits: the stage hold first, the marquee view last. */
  const entries = [
    { id: "stage", title: "Stage", active: focusId === "stage" },
    ...EXHIBITS.map((e) => ({ id: e.id, title: e.title, active: e.id === focusId })),
    { id: "entrance", title: "Entrance", active: tour === "end" },
  ];
  const pad = { paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end">
      {wide && <MuseumDetails exhibitId={detailId} mode="side" onOpenLink={askToLeave} rightInsetRef={rightInsetRef} />}

      <div ref={bottomRef} className="relative flex flex-col">
        {tour === "stage" && (
          <div className="pointer-events-none flex flex-col items-center px-3" style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1rem))" }}>
            {!free && (
              <div aria-hidden="true" className="museum-scroll-hint mb-4 flex flex-col items-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
                {touch ? "Swipe up" : "Scroll"}
                <ChevronDown className="mt-0.5 h-4 w-4" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => send("browse")}
                className="pointer-events-auto h-11 min-w-44 bg-white px-6 text-sm font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#ff2a2a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Browse projects
              </button>
              <div className="pointer-events-auto">
                <FreeRoamButton on={free} onToggle={onToggleFree} />
              </div>
            </div>
          </div>
        )}

        {!wide && <MuseumDetails exhibitId={detailId} mode="sheet" onOpenLink={askToLeave} suspended={menuOpen} />}

        {browsing && menuOpen && (
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Projects"
            onKeyDown={onMenuKey}
            className="pointer-events-auto max-h-[60svh] overflow-y-auto overscroll-contain border-t border-white/15 bg-black/85 backdrop-blur-md sm:absolute sm:bottom-full sm:right-6 sm:mb-2 sm:w-80 sm:border sm:max-h-[70svh] [@media(max-height:500px)]:absolute [@media(max-height:500px)]:bottom-full [@media(max-height:500px)]:right-3 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:max-h-[70svh] [@media(max-height:500px)]:w-72 [@media(max-height:500px)]:border"
          >
            <ul>
              {entries.map((e) => {
                const active = e.active;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        send(`goto:${e.id}`);
                        setMenuOpen(false);
                      }}
                      className={`flex min-h-11 w-full items-center border-l-2 px-4 text-left text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white ${active ? "border-[#ff2a2a] text-white" : "border-transparent text-gray-300"}`}
                    >
                      {e.title}
                    </button>
                  </li>
                );
              })}
              <li className="border-t border-white/15">
                {/* Same site, so no leave modal; let go of the pointer first so the next page is not stuck locked. */}
                <Link
                  href="/"
                  onClick={() => document.exitPointerLock?.()}
                  className="flex min-h-11 w-full items-center border-l-2 border-transparent px-4 text-left text-sm text-gray-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                >
                  Back to the homepage
                </Link>
              </li>
            </ul>
          </div>
        )}

        {browsing && (
          <nav aria-label="Museum navigation" className="pointer-events-auto flex items-center justify-center gap-1 px-3 pt-2" style={pad}>
            <button type="button" className={BTN} aria-label="Previous exhibit" onClick={() => send("prev")}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={BTN}
              aria-label={playing ? "Pause tour" : "Play tour"}
              onClick={() => send(playing ? "tour:pause" : "tour:play")}
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button type="button" className={BTN} aria-label="Next exhibit" onClick={() => send("next")}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              ref={menuBtnRef}
              type="button"
              className={BTN}
              aria-label="Project menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              ref={openBtnRef}
              type="button"
              className={BTN}
              aria-label="Open this project in a new tab"
              aria-haspopup="dialog"
              disabled={!exhibit}
              onClick={() => exhibit && askToLeave(exhibit.title, exhibit.href)}
            >
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <FreeRoamButton on={free} onToggle={onToggleFree} compact />
          </nav>
        )}
      </div>
      {leaving && <LeaveModal title={leaving.title} href={leaving.href} onStay={() => closeLeave(true)} onLeave={() => closeLeave(false)} />}
    </div>
  );
}
