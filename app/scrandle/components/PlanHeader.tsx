"use client";

import Link from "next/link";
import { ACCENT } from "../data";

interface PlanHeaderProps {
  completed: number;
  total: number;
  onReset: () => void;
}

export function PlanHeader({ completed, total, onReset }: PlanHeaderProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(10,10,10,0.82)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono shrink-0"
        >
          &larr; benadams.dev
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Progress
          </span>
          <div
            className="w-24 sm:w-40 h-1.5"
            style={{ backgroundColor: "rgba(255,255,255,0.07)" }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Build plan progress"
          >
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: ACCENT }}
            />
          </div>
          <span className="font-mono text-xs text-gray-400 tabular-nums shrink-0">
            {completed}/{total}
          </span>
          <button
            type="button"
            onClick={onReset}
            disabled={completed === 0}
            className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 transition-colors disabled:opacity-30 disabled:cursor-default hover:text-gray-200"
            style={{
              color: "#9ca3af",
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
