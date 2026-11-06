"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { ACCENT, Tags } from "../homepage/Tags";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { PROJECT_DETAILS, type DetailLink, type ProjectDetail } from "./projectDetails";

/* A beat before the panel opens, so it doesn't flash while the camera flies past an exhibit. */
const OPEN_DELAY_MS = 400;
/* The desktop panel's width and its gap to the viewport's right edge, in CSS px. */
const PANEL_WIDTH = 380;
const PANEL_MARGIN = 16;

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

function Links({ title, links, onOpenLink }: { title: string; links: DetailLink[]; onOpenLink: Props["onOpenLink"] }) {
  if (!links.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
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
          className="inline-flex min-h-9 items-center text-xs font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

function Features({ features }: { features: ProjectDetail["features"] }) {
  if (!features.length) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {features.map((f) => (
        <li key={f.label} className="text-xs leading-relaxed text-gray-400">
          <span className="font-medium text-white">{f.label}.</span> {f.text}
        </li>
      ))}
    </ul>
  );
}

function Body({ detail, onOpenLink }: { detail: ProjectDetail; onOpenLink: Props["onOpenLink"] }) {
  return (
    <>
      {detail.kicker && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: ACCENT }}>
          {detail.kicker}
        </p>
      )}
      {detail.tagline && <p className="text-sm text-gray-300">{detail.tagline}</p>}
      {detail.description.map((p) => (
        <p key={p} className="mt-3 text-sm leading-relaxed text-gray-400">
          {p}
        </p>
      ))}
      <Features features={detail.features} />
      {detail.tags.length > 0 && (
        <div className="mt-4">
          <Tags tags={detail.tags} />
        </div>
      )}
      <Links title={detail.title} links={detail.links} onOpenLink={onOpenLink} />
      {detail.sections.map((s) => (
        <section key={s.heading} className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-sm font-bold text-white">{s.heading}</h3>
          {s.text.map((p) => (
            <p key={p} className="mt-1 text-sm leading-relaxed text-gray-400">
              {p}
            </p>
          ))}
          {s.features && <Features features={s.features} />}
          {s.tags && s.tags.length > 0 && (
            <div className="mt-3">
              <Tags tags={s.tags} />
            </div>
          )}
          {s.links && <Links title={s.heading} links={s.links} onOpenLink={onOpenLink} />}
        </section>
      ))}
    </>
  );
}

/**
 * The homepage's copy for the project the camera is at. Opens by itself a moment after the camera
 * arrives, slides away when it moves on, never pauses the tour, and is not a dialog: no focus trap.
 * Closing it with the x or Esc keeps it shut until the camera goes to another exhibit.
 */
export function MuseumDetails({ exhibitId, mode, onOpenLink, rightInsetRef, suspended }: Props) {
  const reduced = useReducedMotion();
  /* The exhibit the delay has elapsed for. The panel is open while this is the exhibit in view. */
  const [armed, setArmed] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const detail = exhibitId ? PROJECT_DETAILS[exhibitId] : undefined;
  const open = !!exhibitId && !!detail && armed === exhibitId && !suspended;

  useEffect(() => {
    if (!exhibitId) return;
    const t = window.setTimeout(() => setArmed(exhibitId), OPEN_DELAY_MS);
    return () => {
      window.clearTimeout(t);
      /* Moving on shuts the panel and clears a close, so the next arrival opens it. */
      setArmed(null);
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

  const side = mode === "side";
  const hidden = reduced ? { opacity: 0 } : side ? { opacity: 0, x: 32 } : { opacity: 0, y: 48 };
  const shown = { opacity: 1, x: 0, y: 0 };
  const transition = reduced ? { duration: 0 } : { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as const };

  return (
    <AnimatePresence>
      {open && detail && (
        <motion.aside
          key={exhibitId}
          ref={panelRef}
          role="complementary"
          aria-label={`${detail.title}: project details`}
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={transition}
          className={
            side
              ? "pointer-events-auto absolute top-4 bottom-[5.5rem] flex flex-col border border-white/15 bg-black/80 text-gray-200 backdrop-blur-md"
              : "pointer-events-auto relative flex max-h-[45svh] flex-col border-t border-white/15 bg-black/85 text-gray-200 backdrop-blur-md"
          }
          style={
            side
              ? { width: PANEL_WIDTH, maxWidth: `calc(100% - ${PANEL_MARGIN * 2}px)`, right: `max(${PANEL_MARGIN}px, env(safe-area-inset-right))` }
              : undefined
          }
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
