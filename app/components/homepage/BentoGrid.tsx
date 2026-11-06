"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { BentoCard } from "./BentoCard";
import { TabletCarousel } from "./TabletCarousel";
import { PhoneCarousel } from "./PhoneCarousel";
import { ShotGallery } from "./ShotGallery";
import { DiscordFeed } from "./DiscordFeed";
import { ACCENT, Tags } from "./Tags";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  MFRS,
  PROGNOSTICATOR_SCREENSHOTS,
  WAREHOUSE_SCENE,
  SM64_SCENE,
  MK64_SCENE,
  OATHKEEP,
  TESTQ,
  RADIANCE_SCREENSHOTS,
  MTG_SCREENSHOTS,
  SCRANDLE_SHOTS,
  SCRANBOT_MESSAGES,
  YUT_MESSAGES,
  OSRS_MESSAGES,
  SUMMARIES,
  PROGNOSTICATOR_CARD,
  HOBBIT_HOUSE,
  VISUALIZER_SCENES,
  MFRS_LINKS,
  TESTQ_LINK,
  SCRANDLE,
  SCRANBOT,
  YUT_HUT,
  MTG_GROUP,
  FLOATWISE,
  DOTA_RANDOMIZER,
  IRLSCAPE,
} from "./projects";

interface BentoSectionProps {
  /** Anchor for /#id links. */
  id?: string;
  onMouseLeave?: () => void;
  delay?: number;
  children: React.ReactNode;
}

/** A full-width frosted group, for projects that need more room than a card. */
function BentoSection({ id, onMouseLeave, delay = 0.15, children }: BentoSectionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      id={id}
      className="col-span-1 md:col-span-2 lg:col-span-4 p-4 md:p-6 scroll-mt-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { delay, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
      }
      onMouseLeave={onMouseLeave}
    >
      {children}
    </motion.div>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      className="group/link text-xs font-medium text-white inline-flex items-center gap-1.5 relative"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
      <span className="absolute bottom-0 left-0 h-px w-0 bg-white transition-all duration-300 ease-out group-hover/link:w-full" />
    </a>
  );
}

export function BentoGrid() {
  const [progSlide, setProgSlide] = useState(0);
  const [progControlledIndex, setProgControlledIndex] = useState<number | null>(null);
  const [mtgControlledIndex, setMtgControlledIndex] = useState<number | null>(null);

  const handleProgSlideChange = useCallback((index: number) => {
    setProgSlide(index);
  }, []);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ gridAutoRows: "minmax(180px, auto)" }}
    >
      {/* MFRS — full-width feature */}
      <BentoSection delay={0}>
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
          <div className="w-full lg:w-[62%]">
            <ShotGallery
              shots={MFRS.shots}
              accentColor={ACCENT}
              autoPlayInterval={5000}
            />
          </div>
          <div className="w-full lg:w-[38%] flex flex-col">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
              {MFRS.kicker}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{MFRS.title}</h2>
            <p className="text-gray-300 text-sm mt-2">{MFRS.tagline}</p>
            <p className="text-gray-400 text-sm leading-relaxed mt-3">{MFRS.description}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {MFRS.features.map((f) => (
                <li key={f.label} className="text-xs leading-relaxed text-gray-400">
                  <span className="text-white font-medium">{f.label}.</span> {f.text}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Tags tags={MFRS.tags} />
            </div>
            <div className="mt-auto pt-5 flex flex-wrap gap-x-6 gap-y-2">
              <SectionLink href={MFRS_LINKS.river.href}>{`${MFRS_LINKS.river.label} →`}</SectionLink>
              <SectionLink href={MFRS_LINKS.itch.href}>{MFRS_LINKS.itch.label}</SectionLink>
            </div>
          </div>
        </div>
      </BentoSection>

      {/* Oathkeep — full-width feature, portrait phone captures */}
      <BentoSection id="oathkeep">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
          <div className="w-full lg:w-[42%] flex flex-col">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
              {OATHKEEP.kicker}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{OATHKEEP.title}</h2>
            <p className="text-gray-300 text-sm mt-2">{OATHKEEP.tagline}</p>
            <p className="text-gray-400 text-sm leading-relaxed mt-3">{OATHKEEP.description}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {OATHKEEP.features.map((f) => (
                <li key={f.label} className="text-xs leading-relaxed text-gray-400">
                  <span className="text-white font-medium">{f.label}.</span> {f.text}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Tags tags={OATHKEEP.tags} />
            </div>
          </div>
          <div className="w-full lg:w-[58%] grid grid-cols-2 gap-4 md:gap-6 max-w-2xl lg:max-w-none mx-auto">
            <ShotGallery shots={OATHKEEP.fights} accentColor={ACCENT} aspect="9 / 16" />
            <ShotGallery shots={OATHKEEP.screens} accentColor={ACCENT} aspect="9 / 16" autoPlayInterval={4500} autoPlayDelay={2000} />
          </div>
        </div>
      </BentoSection>

      {/* Prognosticator — 3 col, 2 row */}
      <BentoCard
        id="prognosticator"
        title={PROGNOSTICATOR_CARD.title}
        subtitle={PROGNOSTICATOR_SCREENSHOTS[progSlide].label}
        description={PROGNOSTICATOR_SCREENSHOTS[progSlide].description}
        accentColor={ACCENT}
        colSpan={3}
        rowSpan={2}
        index={0}
        fixedDescriptionHeight="7.5rem"
       
       
        tags={PROGNOSTICATOR_CARD.tags}
      >
        <div className="flex flex-col gap-3 flex-1">
          <TabletCarousel
            screenshots={PROGNOSTICATOR_SCREENSHOTS}
            autoPlayInterval={4500}
            autoPlayDelay={0}
            onSlideChange={handleProgSlideChange}
            controlledIndex={progControlledIndex}
          />
          <div
            className="flex flex-wrap gap-1.5 justify-center"
            onMouseLeave={() => setProgControlledIndex(null)}
          >
            {PROGNOSTICATOR_SCREENSHOTS.map((s, i) => {
              const active = progSlide === i;
              return (
                <button
                  key={s.src}
                  type="button"
                  onMouseEnter={() => setProgControlledIndex(i)}
                  onFocus={() => setProgControlledIndex(i)}
                  onBlur={() => setProgControlledIndex(null)}
                  className="px-2 py-1 text-[10px] font-mono transition-colors"
                  style={{
                    borderWidth: 1,
                    color: active ? ACCENT : "#9ca3af",
                    borderColor: active ? `${ACCENT}60` : "rgba(255,255,255,0.08)",
                    backgroundColor: active ? `${ACCENT}18` : "rgba(255,255,255,0.02)",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </BentoCard>

      {/* hobbit.house — 1 col, 2 row */}
      <BentoCard
        title={HOBBIT_HOUSE.title}
        description={SUMMARIES.hobbitHouse}
        href={HOBBIT_HOUSE.href}
        accentColor={ACCENT}
        rowSpan={2}
        index={1}
       
       
        tags={HOBBIT_HOUSE.tags}
      >
        <PhoneCarousel screenshots={RADIANCE_SCREENSHOTS} autoPlayInterval={4500} autoPlayDelay={1500} />
      </BentoCard>

      {/* Prognosticator's visualizer scenes */}
      <BentoSection id="warehouse">
        <h2 className="text-sm font-bold text-white">{VISUALIZER_SCENES.title}</h2>
        <p className="text-gray-400 text-xs mb-4 mt-1">
          {VISUALIZER_SCENES.description}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[WAREHOUSE_SCENE, SM64_SCENE, MK64_SCENE].map((scene, i) => (
            <div key={scene.title} className="flex flex-col gap-3">
              <ShotGallery shots={scene.shots} accentColor={ACCENT} autoPlayInterval={5000} autoPlayDelay={i * 1700} />
              <div>
                <h3 className="text-base font-bold text-white">{scene.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mt-1 mb-3">{scene.description}</p>
                <Tags tags={scene.tags} />
              </div>
            </div>
          ))}
        </div>
      </BentoSection>

      {/* testq — the queue the scenes above are tested and captured through */}
      <BentoSection>
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
          <div className="w-full lg:w-[62%]">
            <Image
              src={TESTQ.image.src}
              alt={TESTQ.image.alt}
              width={TESTQ.image.width}
              height={TESTQ.image.height}
              className="w-full h-auto"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              unoptimized
            />
          </div>
          <div className="w-full lg:w-[38%] flex flex-col">
            <h2 className="text-lg font-bold text-white font-mono">{TESTQ.title}</h2>
            <p className="text-gray-300 text-sm mt-2">{TESTQ.tagline}</p>
            <p className="text-gray-400 text-sm leading-relaxed mt-3">{TESTQ.description}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {TESTQ.features.map((f) => (
                <li key={f.label} className="text-xs leading-relaxed text-gray-400">
                  <span className="text-white font-medium">{f.label}.</span> {f.text}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Tags tags={TESTQ.tags} />
            </div>
            <div className="mt-auto pt-5">
              <SectionLink href={TESTQ_LINK.href}>{`${TESTQ_LINK.label} →`}</SectionLink>
            </div>
          </div>
        </div>
      </BentoSection>

      {/* Scrandle + Scranbot row */}
      <BentoCard
        title={SCRANDLE.title}
        description={SUMMARIES.scrandle}
        href={SCRANDLE.href}
        accentColor={ACCENT}
        colSpan={2}
        index={2}
       
       
        tags={SCRANDLE.tags}
      >
        <ShotGallery shots={SCRANDLE_SHOTS} accentColor={ACCENT} aspect="16 / 10" autoPlayInterval={4500} />
      </BentoCard>

      <BentoCard
        title={SCRANBOT.title}
        description={SUMMARIES.scranbot}
        accentColor={ACCENT}
        colSpan={2}
        index={3}
       
       
        tags={SCRANBOT.tags}
      >
        <DiscordFeed botName="Scranbot" messages={SCRANBOT_MESSAGES} maxHeight="26rem" />
      </BentoCard>

      {/* Yut Hut */}
      <BentoSection>
        <div className="flex flex-col md:flex-row gap-5 md:gap-8">
          <div className="w-full md:w-[38%] flex flex-col">
            <h2 className="text-lg font-bold text-white">{YUT_HUT.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mt-2">
              {SUMMARIES.yutHut}
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-xs leading-relaxed text-gray-400">
              {YUT_HUT.features.map((f) => (
                <li key={f.label}>
                  <span className="text-white font-medium">{f.label}.</span> {f.text}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Tags tags={YUT_HUT.tags} />
            </div>
            <div className="mt-auto pt-5">
              <SectionLink href={YUT_HUT.rulesLink.href}>{`${YUT_HUT.rulesLink.label} →`}</SectionLink>
            </div>
          </div>
          <div className="w-full md:w-[62%] flex">
            <DiscordFeed botName="Yut Hut" messages={YUT_MESSAGES} maxHeight="34rem" imageWidth={440} />
          </div>
        </div>
      </BentoSection>

      {/* MTG section — frosted glass group */}
      <BentoSection
       
       
        onMouseLeave={() => setMtgControlledIndex(null)}
      >
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-sm font-bold text-white">{MTG_GROUP.title}</h2>
          <Tags tags={MTG_GROUP.tags} />
        </div>
        <p className="text-gray-400 text-xs mb-4">{MTG_GROUP.tagline}</p>

        <div className="flex flex-col md:flex-row gap-4">
          {/* Left — 3 individual MTG cards */}
          <div className="w-full md:w-[30%] flex flex-col gap-4">
            <BentoCard
              title={MTG_GROUP.apps[0].title}
              headingLevel={3}
              description={MTG_GROUP.apps[0].description}
              href={MTG_GROUP.apps[0].href}
              accentColor={ACCENT}
              index={4}
              onHover={() => setMtgControlledIndex(1)}
            />
            <BentoCard
              title={MTG_GROUP.apps[1].title}
              headingLevel={3}
              description={MTG_GROUP.apps[1].description}
              href={MTG_GROUP.apps[1].href}
              accentColor={ACCENT}
              index={5}
              onHover={() => setMtgControlledIndex(0)}
            />
            <BentoCard
              title={MTG_GROUP.apps[2].title}
              headingLevel={3}
              description={MTG_GROUP.apps[2].description}
              href={MTG_GROUP.apps[2].href}
              accentColor={ACCENT}
              index={6}
              onHover={() => setMtgControlledIndex(2)}
            />
          </div>

          {/* Right — Wider tablet carousel */}
          <div className="w-full md:w-[70%] flex items-center justify-center">
            <TabletCarousel
              screenshots={MTG_SCREENSHOTS}
              autoPlayInterval={4500}
              autoPlayDelay={3000}
              controlledIndex={mtgControlledIndex}
            />
          </div>
        </div>
      </BentoSection>

      {/* FloatWise + Dota row */}
      <BentoCard
        title={FLOATWISE.title}
        description={SUMMARIES.floatwise}
        href={FLOATWISE.href}
        accentColor={ACCENT}
        colSpan={2}
        index={7}
       
       
        tags={FLOATWISE.tags}
      >
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src="/floatwise/forecast.webp"
            alt="FloatWise forecast table with hourly temperature, wind, and precipitation for eight Yellowstone River towns, plus the live river flow"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </BentoCard>

      <BentoCard
        title={DOTA_RANDOMIZER.title}
        description={SUMMARIES.dotaRandomizer}
        href={DOTA_RANDOMIZER.href}
        accentColor={ACCENT}
        colSpan={2}
        index={8}
       
       
        tags={DOTA_RANDOMIZER.tags}
      >
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src="/dota-randomizer/wheels.webp"
            alt="Dota 2 Randomizer showing the hero and item wheels with Phantom Lancer and Urn of Shadows selected"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </BentoCard>

      {/* IRLScape */}
      <div className="md:col-span-2 self-start">
        <BentoCard
          title={IRLSCAPE.title}
          description={SUMMARIES.irlscape}
          href={IRLSCAPE.href}
          accentColor={ACCENT}
          colSpan={2}
          index={9}
         
         
        >
          <div className="relative aspect-video w-full overflow-hidden">
            <Image
              src="/irlscape/thumbnail.webp"
              alt="IRLScape YouTube video thumbnail"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </BentoCard>
      </div>

      {/* OSRS Progress */}
      <BentoCard
        title="OSRS Progress Generator"
        description={SUMMARIES.osrsProgress}
        accentColor={ACCENT}
        colSpan={2}
        index={10}
       
       
      >
        <DiscordFeed botName="OSRS Progress" messages={OSRS_MESSAGES} />
      </BentoCard>
    </div>
  );
}
