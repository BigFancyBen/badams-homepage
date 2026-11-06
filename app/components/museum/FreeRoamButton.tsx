"use client";

import { Footprints, X } from "lucide-react";

/**
 * Switches between scrolling through the views (off, the default) and walking freely (on: WASD, the
 * thumbstick, mouse aim). Sits beside the mute button; a toggle, so it says the same thing either
 * way and shows its state (aria-pressed, a red outline and a close mark while on).
 */
export function FreeRoamButton({ on, onToggle, compact = false }: { on: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      aria-label={compact ? "Free roam" : undefined}
      title={on ? "Back to scrolling" : "Walk around freely"}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 border ${compact ? "w-11" : "px-3"} text-xs font-medium tracking-wide backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
        on ? "border-[#ff2a2a] bg-[#ff2a2a]/20 text-white" : "border-white/15 bg-black/60 text-gray-200 hover:text-white"
      }`}
    >
      <Footprints className="h-4 w-4" aria-hidden="true" />
      {/* compact (the icon bar, which is all icons): the icon alone, named by aria-label, its state by the red outline */}
      {!compact && "Free roam"}
      {on && !compact && <X className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />}
    </button>
  );
}
