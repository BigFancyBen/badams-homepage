"use client";

import { useMemo } from "react";
import {
  ACCENT,
  ACCENT_WARM,
  CHECKLIST,
  OPEN_QUESTIONS,
  PHASES,
  PLAIN_VARS,
  SCHEMA_NOTE,
  SCHEMA_SQL,
  SECRETS,
  SECTIONS,
  STACK,
  STACK_NOTE,
  VERSIONING_NOTE,
  VERSIONING_SNIPPET,
  VERSIONING_TAIL,
} from "../data";
import { useChecklist } from "../hooks/useChecklist";
import { useScrollSpy } from "../hooks/useScrollSpy";
import { renderInline } from "../utils";
import { CodeBlock } from "./CodeBlock";
import { ConstraintsTable } from "./ConstraintsTable";
import { DecisionGrid } from "./DecisionGrid";
import { PhaseTimeline } from "./PhaseTimeline";
import { PlanHeader } from "./PlanHeader";
import { PlanHero } from "./PlanHero";
import { Section } from "./Section";
import { SetupChecklist } from "./SetupChecklist";
import { TableOfContents } from "./TableOfContents";

const SECTION_IDS = SECTIONS.map((section) => section.id);
const TRACKED_IDS = [
  ...CHECKLIST.flatMap((group) => group.items.map((item) => item.id)),
  ...PHASES.map((phase) => phase.id),
];

/** Section index for the numbered headings, keyed off the table of contents. */
function indexOf(id: string): number {
  return SECTION_IDS.indexOf(id) + 1;
}

export function ScrandlePlan() {
  const trackedIds = useMemo(() => TRACKED_IDS, []);
  const { isChecked, toggle, reset, completed } = useChecklist(trackedIds);
  const activeId = useScrollSpy(SECTION_IDS);

  return (
    <div className="min-h-screen">
      <PlanHeader
        completed={completed}
        total={trackedIds.length}
        onReset={reset}
      />

      <div className="max-w-6xl mx-auto px-4">
        <PlanHero />

        <div className="flex gap-10 pb-24">
          {/* Sticky contents rail */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <TableOfContents activeId={activeId} />
            </div>
          </aside>

          <main className="min-w-0 flex-1 flex flex-col gap-16">
            <Section
              id="decisions"
              index={indexOf("decisions")}
              title="Design decisions already settled"
              lede="Read this before changing anything below. Each one was argued through and cost something to land on."
            >
              <DecisionGrid />
            </Section>

            <Section
              id="setup"
              index={indexOf("setup")}
              title="Accounts and registrations"
              lede="The code is written; this is what it needs before it can run. Everything here is free. Progress is kept in this browser."
            >
              <SetupChecklist isChecked={isChecked} toggle={toggle} />
            </Section>

            <Section id="stack" index={indexOf("stack")} title="Stack">
              <div className="flex flex-col gap-4">
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-px"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  {STACK.map((item) => (
                    <div
                      key={item.name}
                      className="p-4"
                      style={{ backgroundColor: "#0a0a0a" }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: ACCENT }}
                      >
                        {item.name}
                      </span>
                      <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {STACK_NOTE}
                </p>
              </div>
            </Section>

            <Section
              id="constraints"
              index={indexOf("constraints")}
              title="Free-tier constraints to design around"
            >
              <ConstraintsTable />
            </Section>

            <Section id="schema" index={indexOf("schema")} title="Schema">
              <div className="flex flex-col gap-4">
                <CodeBlock code={SCHEMA_SQL} lang="sql" maxHeight="34rem" />
                <p className="text-sm text-gray-400 leading-relaxed">
                  {renderInline(SCHEMA_NOTE)}
                </p>
              </div>
            </Section>

            <Section
              id="phases"
              index={indexOf("phases")}
              title="Build phases"
              lede="Seven phases built, one left. Mark them off as you verify them against your own deploy."
            >
              <PhaseTimeline isChecked={isChecked} toggle={toggle} />
            </Section>

            <Section
              id="versioning"
              index={indexOf("versioning")}
              title="Version announcements"
            >
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-400 leading-relaxed">
                  {VERSIONING_NOTE}
                </p>
                <CodeBlock code={VERSIONING_SNIPPET} lang="json" />
                <p className="text-sm text-gray-400 leading-relaxed">
                  {VERSIONING_TAIL}
                </p>
              </div>
            </Section>

            <Section id="secrets" index={indexOf("secrets")} title="Secrets">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {renderInline(
                      "Set with `wrangler secret put`, never in `wrangler.toml`:"
                    )}
                  </p>
                  <CodeBlock code={SECRETS.join("\n")} lang="secrets" />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {renderInline("Plain vars in `wrangler.toml`:")}
                  </p>
                  <CodeBlock code={PLAIN_VARS.join("\n")} lang="vars" />
                </div>
              </div>
            </Section>

            <Section
              id="questions"
              index={indexOf("questions")}
              title="Open questions for the build session"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {OPEN_QUESTIONS.map((question, i) => (
                  <div
                    key={question}
                    className="p-5 flex flex-col gap-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${ACCENT_WARM}30`,
                    }}
                  >
                    <span
                      className="font-mono text-xs"
                      style={{ color: ACCENT_WARM }}
                    >
                      Q{i + 1}
                    </span>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {question}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          </main>
        </div>
      </div>

      <footer
        className="py-6 px-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between text-gray-600 text-xs">
          <span>Scrandle build plan</span>
          <span className="font-mono">
            {completed}/{trackedIds.length} steps done
          </span>
        </div>
      </footer>
    </div>
  );
}
