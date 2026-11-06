"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronUp, X } from "lucide-react";
import { ACCENT, Tags } from "../homepage/Tags";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { PROJECT_DETAILS, type DetailLink, type ProjectDetail } from "./projectDetails";

/* A beat before the panel opens, so it doesn't flash while the camera flies past an exhibit. */
const OPEN_DELAY_MS = 400;
/* The desktop panel's width and its gap to the viewport's right edge, in CSS px. */
const PANEL_WIDTH = 380;
const PANEL_MARGIN = 16;
/* The phone sheet's slim bar, in CSS px (h-16). */
const BAR_HEIGHT = 64;
/* How far a drag on the bar has to travel to count as a swipe. */
const SWIPE_PX = 24;

interface Props {
  /** The exhibit the camera is at, or null at the stage, the entrance and while walking. */
  exhibitId: string | null;
  /** "side": a right-hand panel on wide screens. "sheet": a bottom sheet in the overlay's flow, on phones. */
  mode: "side" | "sheet";
  /** A link was chosen; the overlay asks "Leave the game?" before opening it. */
  onOpenLink: (title: string, href: string) => void;
  /** Filled with a function returning the CSS px the open side panel covers at the right, else 0. */
  rightInsetRef?: MutableRefObject<() => number>;
  /** Hide the panel without forgetting it was open or closed (the phone menu takes the sheet's room). */
  suspended?: boolean;
}

function Links({ title, links, onOpenLink, compact }: { title: string; links: DetailLink[]; onOpenLink: Props["onOpenLink"]; compact?: boolean }) {
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-x-5 ${compact ? "mt-2 gap-y-0" : "mt-4 gap-x-6 gap-y-1"}`}>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            onOpenLink(title, l.href);
          }}
          className={`inline-flex items-center text-xs font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${compact ? "min-h-8" : "min-h-9"}`}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

function Features({ features, compact }: { features: ProjectDetail["features"]; compact?: boolean }) {
  if (!features.length) return null;
  return (
    <ul className={`flex flex-col ${compact ? "mt-2 gap-1" : "mt-4 gap-2"}`}>
      {features.map((f) => (
        <li key={f.label} className={`text-xs text-gray-400 ${compact ? "leading-snug" : "leading-relaxed"}`}>
          <span className="font-medium text-white">{f.label}.</span> {f.text}
        </li>
      ))}
    </ul>
  );
}

function Body({ detail, onOpenLink, compact }: { detail: ProjectDetail; onOpenLink: Props["onOpenLink"]; compact?: boolean }) {
  const para = compact ? "mt-2 text-[13px] leading-snug text-gray-400" : "mt-3 text-sm leading-relaxed text-gray-400";
  return (
    <>
      {/* On phones the folded bar already shows the tagline (or, without one, the kicker);
          don't repeat it at the top of the unfolded body. */}
      {detail.kicker && !(compact && !detail.tagline) && (
        <p className={`font-mono text-[10px] uppercase tracking-widest ${compact ? "mb-1" : "mb-2"}`} style={{ color: ACCENT }}>
          {detail.kicker}
        </p>
      )}
      {detail.tagline && !compact && <p className={compact ? "text-[13px] leading-snug text-gray-300" : "text-sm text-gray-300"}>{detail.tagline}</p>}
      {detail.description.map((p) => (
        <p key={p} className={para}>
          {p}
        </p>
      ))}
      <Features features={detail.features} compact={compact} />
      {detail.tags.length > 0 && (
        <div className={compact ? "mt-2" : "mt-4"}>
          <Tags tags={detail.tags} />
        </div>
      )}
      <Links title={detail.title} links={detail.links} onOpenLink={onOpenLink} compact={compact} />
      {detail.sections.map((s) => (
        <section key={s.heading} className={`border-t border-white/10 ${compact ? "mt-3 pt-2" : "mt-5 pt-4"}`}>
          <h3 className="text-sm font-bold text-white">{s.heading}</h3>
          {s.text.map((p) => (
            <p key={p} className={compact ? "mt-1 text-[13px] leading-snug text-gray-400" : "mt-1 text-sm leading-relaxed text-gray-400"}>
              {p}
            </p>
          ))}
          {s.features && <Features features={s.features} compact={compact} />}
          {s.tags && s.tags.length > 0 && (
            <div className={compact ? "mt-2" : "mt-3"}>
              <Tags tags={s.tags} />
            </div>
          )}
          {s.links && <Links title={s.heading} links={s.links} onOpenLink={onOpenLink} compact={compact} />}
        </section>
      ))}
    </>
  );
}

/**
 * The homepage's copy for the project the camera is at. Opens by itself a moment after the camera
 * arrives, slides away when it moves on, never pauses the tour, and is not a dialog: no focus trap.
 * Closing it with the x or Esc keeps it shut until the camera goes to another exhibit.
 * On phones it opens as a slim bar (title and tagline) that a tap or a swipe up unfolds.
 */
export function MuseumDetails({ exhibitId, mode, onOpenLink, rightInsetRef, suspended }: Props) {
  const reduced = useReducedMotion();
  /* The exhibit the delay has elapsed for. The panel is open while this is the exhibit in view. */
  const [armed, setArmed] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /* Phones: the sheet starts as a slim bar and unfolds on a tap or a swipe up. Each exhibit starts folded. */
  const [expanded, setExpanded] = useState(false);
  const detail = exhibitId ? PROJECT_DETAILS[exhibitId] : undefined;
  const open = !!exhibitId && !!detail && armed === exhibitId && !suspended;

  useEffect(() => {
    if (!exhibitId) return;
    const t = window.setTimeout(() => setArmed(exhibitId), OPEN_DELAY_MS);
    return () => {
      window.clearTimeout(t);
      /* Moving on shuts the panel and clears a close, so the next arrival opens it. */
      setArmed(null);
      setExpanded(false);
    };
  }, [exhibitId]);

  const close = useCallback(() => {
    /* Hand the keys back to the game rather than dropping focus on the page. */
    if (panelRef.current?.contains(document.activeElement)) document.getElementById("museum-canvas")?.focus({ preventScroll: true });
    setArmed(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!rightInsetRef || mode !== "side") return;
    rightInsetRef.current = () => {
      const el = panelRef.current;
      return open && el ? el.offsetWidth + PANEL_MARGIN : 0;
    };
    return () => {
      rightInsetRef.current = () => 0;
    };
  }, [rightInsetRef, mode, open]);

  /* The sheet scrolls itself and nothing else: its touches and wheel never reach the canvas or Godot
     (whose listeners sit on the canvas, not the window), and a drag that runs out of scroll, or that
     starts on the bar, is swallowed instead of moving the page. */
  useEffect(() => {
    const el = panelRef.current;
    if (!open || mode !== "sheet" || !el) return;
    let lastY = 0;
    const onStart = (e: TouchEvent) => {
      e.stopPropagation();
      lastY = e.touches[0]?.clientY ?? 0;
    };
    const blocked = (target: EventTarget | null, dy: number) => {
      const sc = scrollerRef.current;
      if (!sc || !(target instanceof Node) || !sc.contains(target)) return true;
      const max = sc.scrollHeight - sc.clientHeight;
      return max <= 0 || (dy > 0 && sc.scrollTop <= 0) || (dy < 0 && sc.scrollTop >= max - 1);
    };
    const onMove = (e: TouchEvent) => {
      e.stopPropagation();
      const y = e.touches[0]?.clientY ?? lastY;
      const dy = y - lastY;
      lastY = y;
      if (e.cancelable && blocked(e.target, dy)) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      if (e.cancelable && blocked(e.target, -e.deltaY)) e.preventDefault();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("wheel", onWheel);
    };
  }, [open, mode, exhibitId]);

  /* Swipes on the bar: up unfolds, down folds. The click a swipe ends with is ignored. */
  const swipe = useRef<{ y: number; done: boolean } | null>(null);
  const onBarDown = (e: ReactPointerEvent) => {
    swipe.current = { y: e.clientY, done: false };
  };
  const onBarUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) < SWIPE_PX) {
      swipe.current = null;
      return;
    }
    s.done = true;
    setExpanded(dy < 0);
    window.setTimeout(() => {
      swipe.current = null;
    }, 100);
  };
  const toggle = () => {
    if (swipe.current?.done) return;
    setExpanded((x) => !x);
  };

  const side = mode === "side";
  const hidden = reduced ? { opacity: 0 } : side ? { opacity: 0, x: 32 } : { opacity: 0, y: 48 };
  const shown = { opacity: 1, x: 0, y: 0 };
  const transition = reduced ? { duration: 0 } : { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as const };
  const unfold = reduced ? { duration: 0 } : { duration: 0.24, ease: [0.25, 0.1, 0.25, 1] as const };
  const peek = detail ? (detail.tagline ?? detail.kicker ?? "") : "";

  return (
    <AnimatePresence>
      {open && detail && !side && (
        <motion.aside
          key={exhibitId}
          ref={panelRef}
          role="complementary"
          aria-label={`${detail.title}: project details`}
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={transition}
          className="pointer-events-auto relative flex flex-col border-t-2 border-white/30 bg-[#0b0c10] text-gray-200 shadow-[0_-10px_24px_rgba(0,0,0,0.7)]"
          style={{ maxHeight: "40svh" }}
        >
          <div
            className="flex shrink-0 touch-none select-none items-stretch"
            style={{ height: BAR_HEIGHT }}
            onPointerDown={onBarDown}
            onPointerUp={onBarUp}
            onPointerCancel={() => {
              swipe.current = null;
            }}
          >
            <div className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center pl-4 pr-1" onClick={toggle}>
              <h2 className="truncate text-base font-bold leading-tight text-white">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="museum-sheet-body"
                  className="max-w-full truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                >
                  {detail.title}
                </button>
              </h2>
              {peek && <p className="mt-0.5 truncate text-xs text-gray-400">{peek}</p>}
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={expanded ? "Collapse project details" : "Expand project details"}
              className="flex h-full w-11 shrink-0 items-center justify-center text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            >
              <ChevronUp className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Close project details"
              className="flex h-full w-11 shrink-0 items-center justify-center text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <motion.div
            id="museum-sheet-body"
            inert={!expanded}
            initial={false}
            animate={{ height: expanded ? "auto" : 0 }}
            transition={unfold}
            className="overflow-hidden border-t border-white/10"
          >
            <div
              ref={scrollerRef}
              className="overflow-y-auto overscroll-contain px-4 pb-3 pt-2"
              style={{ maxHeight: `calc(40svh - ${BAR_HEIGHT}px - 2px)`, overscrollBehavior: "contain", touchAction: "pan-y" }}
            >
              <Body detail={detail} onOpenLink={onOpenLink} compact />
            </div>
          </motion.div>
        </motion.aside>
      )}
      {open && detail && side && (
        <motion.aside
          key={exhibitId}
          ref={panelRef}
          role="complementary"
          aria-label={`${detail.title}: project details`}
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={transition}
          className="pointer-events-auto absolute top-4 bottom-[5.5rem] flex flex-col border border-white/15 bg-black/80 text-gray-200 backdrop-blur-md"
          style={{ width: PANEL_WIDTH, maxWidth: `calc(100% - ${PANEL_MARGIN * 2}px)`, right: `max(${PANEL_MARGIN}px, env(safe-area-inset-right))` }}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 py-2 pl-4 pr-1">
            <h2 className="py-1.5 text-lg font-bold leading-tight text-white">{detail.title}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close project details"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
            <Body detail={detail} onOpenLink={onOpenLink} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
