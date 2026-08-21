"use client";

import { ACCENT, CHECKLIST, NOTHING_ELSE } from "../data";
import { renderInline } from "../utils";
import { CheckBox } from "./CheckBox";

interface SetupChecklistProps {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
}

export function SetupChecklist({ isChecked, toggle }: SetupChecklistProps) {
  return (
    <div className="flex flex-col gap-4">
      {CHECKLIST.map((group) => {
        const done = group.items.filter((item) => isChecked(item.id)).length;
        const complete = done === group.items.length;

        return (
          <section
            key={group.id}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${complete ? `${ACCENT}45` : "rgba(255,255,255,0.06)"}`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              transition: "border-color 0.3s ease",
            }}
          >
            <div
              className="flex items-center justify-between gap-4 px-5 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{group.blurb}</p>
              </div>
              <span
                className="font-mono text-xs tabular-nums shrink-0"
                style={{ color: complete ? ACCENT : "#6b7280" }}
              >
                {done}/{group.items.length}
              </span>
            </div>

            <ul>
              {group.items.map((item) => {
                const checked = isChecked(item.id);
                return (
                  <li
                    key={item.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-pressed={checked}
                      className="w-full text-left flex gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    >
                      <CheckBox checked={checked} />
                      <span
                        className="text-sm leading-relaxed transition-colors"
                        style={{ color: checked ? "#6b7280" : "#9ca3af" }}
                      >
                        {renderInline(item.text)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p
        className="text-sm text-gray-400 leading-relaxed p-4"
        style={{
          borderLeft: `2px solid ${ACCENT}60`,
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <span className="text-white font-semibold">Nothing else. </span>
        {NOTHING_ELSE}
      </p>
    </div>
  );
}
