"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  href: string;
  /** Stay, Esc, or a click on the backdrop. */
  onStay(): void;
  /** Open project was chosen (the link itself opens the new tab). */
  onLeave(): void;
}

const FOCUSABLE = "button:not([disabled]), a[href]";
const ACTION =
  "flex min-h-11 flex-1 items-center justify-center border px-4 text-sm font-bold uppercase tracking-widest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * "Leave the game?" before any link out of the 3D view. Portalled to the body so it sits above the
 * mute button; traps Tab, closes on Esc or a backdrop click, and puts focus on Stay (the safe
 * choice). The caller returns focus to what opened it.
 */
export function LeaveModal({ title, href, onStay, onLeave }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayRef.current?.focus({ preventScroll: true });
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onStay();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onStay();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="museum-leave-title"
        aria-describedby="museum-leave-body"
        onKeyDown={onKey}
        className="w-full max-w-sm border border-white/15 bg-black p-5 text-gray-200"
      >
        <h2 id="museum-leave-title" className="text-base font-bold text-white">
          Leave the game?
        </h2>
        <p id="museum-leave-body" className="mt-2 text-sm text-gray-300">
          Opens {title} in a new tab.
        </p>
        <div className="mt-5 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLeave}
            className={`${ACTION} border-white bg-white text-black hover:border-[#ff2a2a] hover:bg-[#ff2a2a] hover:text-white`}
          >
            Open project
          </a>
          <button ref={stayRef} type="button" onClick={onStay} className={`${ACTION} border-white/30 text-gray-200 hover:border-white hover:text-white`}>
            Stay
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
