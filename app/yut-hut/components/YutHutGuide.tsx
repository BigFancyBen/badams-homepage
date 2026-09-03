"use client";

import { SECTIONS } from "../data";
import { useScrollSpy } from "../hooks/useScrollSpy";
import { Blocks } from "./Blocks";
import { GuideHeader } from "./GuideHeader";
import { GuideHero } from "./GuideHero";
import { Section } from "./Section";
import { TableOfContents } from "./TableOfContents";

const SECTION_IDS = SECTIONS.map((section) => section.id);

export function YutHutGuide() {
  const activeId = useScrollSpy(SECTION_IDS);

  return (
    <div className="min-h-screen">
      <GuideHeader />

      <div className="max-w-6xl mx-auto px-4">
        <GuideHero />

        <div className="flex gap-10 pb-24">
          {/* Sticky contents rail */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <TableOfContents activeId={activeId} />
            </div>
          </aside>

          <main className="min-w-0 flex-1 flex flex-col gap-16">
            {SECTIONS.map((section, i) => (
              <Section
                key={section.id}
                id={section.id}
                index={i + 1}
                title={section.title}
                lede={section.lede}
                badge={section.badge}
              >
                <Blocks blocks={section.blocks} />
              </Section>
            ))}
          </main>
        </div>
      </div>

      <footer
        className="py-6 px-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between text-gray-600 text-xs">
          <span>Yut Hut rules</span>
          <span className="font-mono">Two a week is the whole game</span>
        </div>
      </footer>
    </div>
  );
}
