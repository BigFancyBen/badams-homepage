"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { BentoCard } from "./BentoCard";
import { TabletCarousel } from "./TabletCarousel";
import { PhoneCarousel } from "./PhoneCarousel";
import { ShotGallery } from "./ShotGallery";
import { DiscordFeed } from "./DiscordFeed";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  MFRS,
  PROGNOSTICATOR_SCREENSHOTS,
  WAREHOUSE_SCENE,
  SM64_SCENE,
  TESTQ,
  RADIANCE_SCREENSHOTS,
  MTG_SCREENSHOTS,
  SCRANDLE_SHOTS,
  SCRANBOT_MESSAGES,
  YUT_MESSAGES,
  OSRS_MESSAGES,
} from "./projects";

const ACCENT = "#81a1c1";

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-1.5 py-0.5 text-[10px]"
          style={{
            color: ACCENT,
            borderWidth: 1,
            borderColor: `${ACCENT}30`,
            backgroundColor: `${ACCENT}12`,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

interface BentoSectionProps {
  dimmed: boolean;
  onHover: () => void;
  onMouseLeave?: () => void;
  delay?: number;
  children: React.ReactNode;
}

/** A full-width frosted group, for projects that need more room than a card. */
function BentoSection({ dimmed, onHover, onMouseLeave, delay = 0.15, children }: BentoSectionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="col-span-1 md:col-span-2 lg:col-span-4 p-4 md:p-6"
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
      animate={{ opacity: dimmed ? 0.55 : 1 }}
      onMouseEnter={onHover}
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
  const [hoveredIndex, setHoveredIndex] = useState<number | string | null>(null);

  const handleProgSlideChange = useCallback((index: number) => {
    setProgSlide(index);
  }, []);

  const handleGridMouseLeave = () => setHoveredIndex(null);
  const isDimmed = (key: number | string) => hoveredIndex !== null && hoveredIndex !== key;

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ gridAutoRows: "minmax(180px, auto)" }}
      onMouseLeave={handleGridMouseLeave}
    >
      {/* MFRS — full-width feature */}
      <BentoSection dimmed={isDimmed("mfrs")} onHover={() => setHoveredIndex("mfrs")} delay={0}>
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
            <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">{MFRS.title}</h3>
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
              <SectionLink href="/river">Meet at the put-in &rarr;</SectionLink>
              <SectionLink href={MFRS.itchUrl}>itch.io page</SectionLink>
            </div>
          </div>
        </div>
      </BentoSection>

      {/* Prognosticator — 3 col, 2 row */}
      <BentoCard
        title="Prognosticator"
        subtitle={PROGNOSTICATOR_SCREENSHOTS[progSlide].label}
        description={PROGNOSTICATOR_SCREENSHOTS[progSlide].description}
        accentColor={ACCENT}
        colSpan={3}
        rowSpan={2}
        index={0}
        fixedDescriptionHeight="7.5rem"
        dimmed={isDimmed(0)}
        onHover={() => setHoveredIndex(0)}
        tags={["Electron", "React", "TypeScript", "Node", "Godot", "DMX", "OBS", "Tailwind", "VirtualDJ"]}
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
        title="hobbit.house"
        description="Phone control app for a living room mini PC. Launch games and streaming apps, run a music visualizer on the TV, and control lights, Kodi and cameras. A QR code turns a guest's phone into a game controller."
        href="https://github.com/BigFancyBen/hobbit-ccp"
        accentColor={ACCENT}
        rowSpan={2}
        index={1}
        dimmed={isDimmed(1)}
        onHover={() => setHoveredIndex(1)}
        tags={["React", "Docker", "Linux", "MQTT"]}
      >
        <PhoneCarousel screenshots={RADIANCE_SCREENSHOTS} autoPlayInterval={4500} autoPlayDelay={1500} />
      </BentoCard>

      {/* Prognosticator's visualizer scenes */}
      <BentoSection dimmed={isDimmed("scenes")} onHover={() => setHoveredIndex("scenes")}>
        <h3 className="text-sm font-bold text-white">Prognosticator: visualizer scenes</h3>
        <p className="text-gray-400 text-xs mb-4 mt-1">
          The lighting rig has a second home. Prognosticator sends its beat grid and DMX output to a Godot
          visualizer, so every light cue also plays in a venue that does not exist.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[WAREHOUSE_SCENE, SM64_SCENE].map((scene, i) => (
            <div key={scene.title} className="flex flex-col gap-3">
              <ShotGallery shots={scene.shots} accentColor={ACCENT} autoPlayInterval={5000} autoPlayDelay={i * 2500} />
              <div>
                <h4 className="text-base font-bold text-white">{scene.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed mt-1 mb-3">{scene.description}</p>
                <Tags tags={scene.tags} />
              </div>
            </div>
          ))}
        </div>
      </BentoSection>

      {/* testq — the queue the scenes above are tested and captured through */}
      <BentoSection dimmed={isDimmed("testq")} onHover={() => setHoveredIndex("testq")}>
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
            <h3 className="text-lg font-bold text-white font-mono">{TESTQ.title}</h3>
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
              <SectionLink href={TESTQ.repoUrl}>Source on GitHub &rarr;</SectionLink>
            </div>
          </div>
        </div>
      </BentoSection>

      {/* Scrandle + Scranbot row */}
      <BentoCard
        title="Scrandle"
        description="A weekly game built from my friends' dinner photos. Ten pairs of plates: pick the one the channel rated higher, then see the ratings and who cooked each."
        href="/scrandle/play"
        accentColor={ACCENT}
        colSpan={2}
        index={2}
        dimmed={isDimmed(2)}
        onHover={() => setHoveredIndex(2)}
        tags={["Next.js", "TypeScript", "Tailwind", "Cloudflare R2"]}
      >
        <ShotGallery shots={SCRANDLE_SHOTS} accentColor={ACCENT} aspect="16 / 10" autoPlayInterval={4500} />
      </BentoCard>

      <BentoCard
        title="Scranbot"
        description="The Discord bot behind Scrandle. It posts a daily food photo matchup in a friends' channel, keeps votes private until the round closes, reveals the result, and posts weekly standings with rank changes."
        accentColor={ACCENT}
        colSpan={2}
        index={3}
        dimmed={isDimmed(3)}
        onHover={() => setHoveredIndex(3)}
        tags={["Cloudflare Workers", "D1", "R2", "Discord", "TypeScript"]}
      >
        <DiscordFeed botName="Scranbot" messages={SCRANBOT_MESSAGES} maxHeight="26rem" />
      </BentoCard>

      {/* Yut Hut */}
      <BentoSection dimmed={isDimmed("yut")} onHover={() => setHoveredIndex("yut")}>
        <div className="flex flex-col md:flex-row gap-5 md:gap-8">
          <div className="w-full md:w-[38%] flex flex-col">
            <h3 className="text-lg font-bold text-white">Yut Hut</h3>
            <p className="text-gray-400 text-sm leading-relaxed mt-2">
              A Discord bot that turns workout check-ins into Old School RuneScape progress for a friend
              group. Each check-in is a Slayer session run on the game&apos;s real XP table and drop tables,
              and the results come back as OSRS-style cards.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-xs leading-relaxed text-gray-400">
              <li>
                <span className="text-white font-medium">Two a week.</span> The first two check-ins count in
                full, then half, then a fifth. A rest day is written down and never punished.
              </li>
              <li>
                <span className="text-white font-medium">The bot asks.</span> Every morning it posts one
                question with a Yes and a No, and edits the roll call into the post as people answer.
              </li>
              <li>
                <span className="text-white font-medium">Numbers from the wiki.</span> Monsters, Slayer
                masters, drop rates and gear come from the OSRS Wiki. Only the session length is tuned.
              </li>
              <li>
                <span className="text-white font-medium">Something to chase.</span> Clue caskets, a pick of
                three spoils, gear drops, an Achievement Diary, a quest and a group boss each week.
              </li>
            </ul>
            <div className="mt-4">
              <Tags tags={["Cloudflare Workers", "D1", "R2", "Discord", "Next.js", "TypeScript"]} />
            </div>
            <div className="mt-auto pt-5">
              <SectionLink href="/yut-hut">Read the rules &rarr;</SectionLink>
            </div>
          </div>
          <div className="w-full md:w-[62%] flex">
            <DiscordFeed botName="Yut Hut" messages={YUT_MESSAGES} maxHeight="34rem" imageWidth={440} />
          </div>
        </div>
      </BentoSection>

      {/* MTG section — frosted glass group */}
      <BentoSection
        dimmed={isDimmed("mtg")}
        onHover={() => setHoveredIndex("mtg")}
        onMouseLeave={() => setMtgControlledIndex(null)}
      >
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-bold text-white">Magic: The Gathering</h3>
          <Tags tags={["Next.js", "React", "Vercel"]} />
        </div>
        <p className="text-gray-400 text-xs mb-4">Tools for Commander players and deck builders</p>

        <div className="flex flex-col md:flex-row gap-4">
          {/* Left — 3 individual MTG cards */}
          <div className="w-full md:w-[30%] flex flex-col gap-4">
            <BentoCard
              title="MTG Commander Scorekeeper"
              description="Touch-friendly scorekeeper for Commander. Four-player quadrant layout with life, poison, and commander damage tracking."
              href="/commander"
              accentColor={ACCENT}
              index={4}
              onHover={() => setMtgControlledIndex(1)}
            />
            <BentoCard
              title="Magic Tutor Helper"
              description="Import a decklist from Archidekt and filter it by mana cost and card type, with Scryfall card images."
              href="/tutor-helper"
              accentColor={ACCENT}
              index={5}
              onHover={() => setMtgControlledIndex(0)}
            />
            <BentoCard
              title="MTG Token Helper"
              description="Import a deck and it finds every token the deck can make. Track them on the battlefield with tap/untap, counters, and buffs."
              href="/token-helper"
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
        title="FloatWise"
        description="Float trip planner. Hourly forecast tables for multiple locations with the live Yellowstone River flow, and a map for pinning put-ins, take-outs, and swim spots."
        href="/floatwise"
        accentColor={ACCENT}
        colSpan={2}
        index={7}
        dimmed={isDimmed(7)}
        onHover={() => setHoveredIndex(7)}
        tags={["Next.js", "Leaflet", "Open-Meteo", "USGS"]}
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
        title="Dota 2 Randomizer"
        description="Spin two wheels to get a random hero and a random item to build. Canvas-animated wheels fed by live OpenDota data, with sound and confetti."
        href="/dota-randomizer"
        accentColor={ACCENT}
        colSpan={2}
        index={8}
        dimmed={isDimmed(8)}
        onHover={() => setHoveredIndex(8)}
        tags={["Next.js", "Canvas", "OpenDota"]}
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
          title="IRLScape"
          description="Old School RuneScape streaming overlay. Game UI on a live camera feed with Twitch chat integration and Joycon controls."
          href="https://www.youtube.com/watch?v=gCofVhR5HUQ"
          accentColor={ACCENT}
          colSpan={2}
          index={9}
          dimmed={isDimmed(9)}
          onHover={() => setHoveredIndex(9)}
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
        description="API for generating progress report images for Old School RuneScape players. Collection log items, OSRS Wiki integration."
        accentColor={ACCENT}
        colSpan={2}
        index={10}
        dimmed={isDimmed(10)}
        onHover={() => setHoveredIndex(10)}
      >
        <DiscordFeed botName="OSRS Progress" messages={OSRS_MESSAGES} />
      </BentoCard>
    </div>
  );
}
