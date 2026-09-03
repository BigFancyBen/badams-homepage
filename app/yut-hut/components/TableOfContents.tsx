"use client";

import { ACCENT, SECTIONS } from "../data";

interface TableOfContentsProps {
  activeId: string;
}

export function TableOfContents({ activeId }: TableOfContentsProps) {
  return (
    <nav aria-label="Rules sections" className="flex flex-col gap-px">
      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600 mb-3">
        Contents
      </span>
      {SECTIONS.map((section, i) => {
        const active = activeId === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="group flex items-center gap-3 py-1.5 pl-3 text-xs transition-colors"
            style={{
              color: active ? "#ffffff" : "#6b7280",
              borderLeft: `2px solid ${active ? ACCENT : "rgba(255,255,255,0.08)"}`,
              backgroundColor: active ? "rgba(163,190,140,0.08)" : "transparent",
            }}
          >
            <span
              className="font-mono text-[10px]"
              style={{ color: active ? ACCENT : "#4b5563" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="group-hover:text-gray-300 transition-colors">
              {section.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
