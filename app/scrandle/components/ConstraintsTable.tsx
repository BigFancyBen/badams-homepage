"use client";

import { ACCENT, CONSTRAINTS, CRON_MITIGATIONS } from "../data";
import { renderInline } from "../utils";

export function ConstraintsTable() {
  return (
    <div className="flex flex-col gap-6">
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="hidden md:grid grid-cols-[1fr_1fr_2fr] gap-4 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {["Limit", "Value", "What it means here"].map((heading) => (
            <span
              key={heading}
              className="font-mono text-[10px] uppercase tracking-widest text-gray-600"
            >
              {heading}
            </span>
          ))}
        </div>

        {CONSTRAINTS.map((row) => (
          <div
            key={row.limit}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-1 md:gap-4 px-4 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <span className="text-sm font-medium text-white">{row.limit}</span>
            <span className="font-mono text-sm" style={{ color: ACCENT }}>
              {row.value}
            </span>
            <span className="text-sm text-gray-400 leading-relaxed">
              {renderInline(row.meaning)}
            </span>
          </div>
        ))}
      </div>

      <div>
        <p className="text-sm text-gray-400 leading-relaxed mb-3">
          Cron failures do not retry and do not alert. Two mitigations, both
          required:
        </p>
        <ul className="flex flex-col gap-2">
          {CRON_MITIGATIONS.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm text-gray-400 leading-relaxed"
            >
              <span aria-hidden="true" style={{ color: ACCENT }}>
                —
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
