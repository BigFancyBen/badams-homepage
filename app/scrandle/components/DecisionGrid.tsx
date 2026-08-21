"use client";

import { useState } from "react";
import { ACCENT, DECISIONS } from "../data";
import { renderInline } from "../utils";

export function DecisionGrid() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      onMouseLeave={() => setHovered(null)}
    >
      {DECISIONS.map((decision, i) => {
        const active = hovered === decision.id;
        return (
          <article
            key={decision.id}
            className="relative p-5 flex flex-col gap-3 transition-all duration-300"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? `${ACCENT}55` : "rgba(255,255,255,0.06)"}`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: active ? `0 8px 32px ${ACCENT}18` : "none",
              opacity: hovered && !active ? 0.6 : 1,
            }}
            onMouseEnter={() => setHovered(decision.id)}
          >
            <div className="flex items-baseline gap-3">
              <span
                className="font-mono text-[10px] shrink-0"
                style={{ color: `${ACCENT}99` }}
              >
                D{String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-sm font-semibold text-white leading-snug">
                {decision.title}
              </h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {renderInline(decision.body)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
