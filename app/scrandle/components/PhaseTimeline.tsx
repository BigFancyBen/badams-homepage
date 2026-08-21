"use client";

import { ACCENT, ACCENT_WARM, PHASES } from "../data";
import { Blocks } from "./Blocks";

const BUILT = "#a3be8c";

interface PhaseTimelineProps {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
}

export function PhaseTimeline({ isChecked, toggle }: PhaseTimelineProps) {
  return (
    <ol className="relative flex flex-col gap-4">
      {/* Spine */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-5 top-6 bottom-6 w-px"
        style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
      />

      {PHASES.map((phase) => {
        const done = isChecked(phase.id);
        const color = phase.optional ? ACCENT_WARM : ACCENT;

        return (
          <li key={phase.id} id={phase.id} className="relative scroll-mt-28 md:pl-16">
            {/* Node */}
            <div
              aria-hidden="true"
              className="hidden md:flex absolute left-0 top-4 w-10 h-10 items-center justify-center font-mono text-sm transition-colors"
              style={{
                border: `1px solid ${done ? color : "rgba(255,255,255,0.12)"}`,
                backgroundColor: done ? `${color}22` : "#0a0a0a",
                color: done ? color : "#6b7280",
              }}
            >
              {phase.number}
            </div>

            <article
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${done ? `${color}45` : "rgba(255,255,255,0.06)"}`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                transition: "border-color 0.3s ease",
              }}
            >
              <div
                className="flex items-start justify-between gap-4 px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="md:hidden font-mono text-xs"
                      style={{ color }}
                    >
                      {phase.number}
                    </span>
                    <h3 className="text-base font-semibold text-white">
                      {phase.title}
                    </h3>
                    {phase.shipped ? (
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5"
                        style={{
                          color: BUILT,
                          border: `1px solid ${BUILT}40`,
                          backgroundColor: `${BUILT}12`,
                        }}
                      >
                        Built
                      </span>
                    ) : null}
                    {phase.optional ? (
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5"
                        style={{
                          color: ACCENT_WARM,
                          border: `1px solid ${ACCENT_WARM}40`,
                          backgroundColor: `${ACCENT_WARM}12`,
                        }}
                      >
                        Not yet
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{phase.tagline}</p>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(phase.id)}
                  aria-pressed={done}
                  className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 shrink-0 transition-colors"
                  style={{
                    color: done ? color : "#9ca3af",
                    border: `1px solid ${done ? `${color}55` : "rgba(255,255,255,0.08)"}`,
                    backgroundColor: done ? `${color}14` : "rgba(255,255,255,0.02)",
                  }}
                >
                  {done ? "Done" : "Mark done"}
                </button>
              </div>

              <div className="px-5 py-4">
                <Blocks blocks={phase.blocks} />
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
