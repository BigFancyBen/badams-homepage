"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { BentoCard } from "./BentoCard";
import { TabletCarousel } from "./TabletCarousel";
import { PhoneCarousel } from "./PhoneCarousel";
import { useReducedMotion } from "../../hooks/useReducedMotion";

const PROGNOSTICATOR_SCREENSHOTS = [
  {
    src: "/prognosticator/01-dashboard.webp",
    label: "Command Center Dashboard",
    bg: "#1a1a2e",
    description: "The dashboard links to your Spotify playlists, tag collections, and performance tools: Now Playing, Beat Visualizer, Scene Controls, DMX lighting. Import a playlist and Prognosticator downloads each track from YouTube, then pulls BPM and musical key from VirtualDJ.",
  },
  {
    src: "/prognosticator/02-tags-collections.webp",
    label: "Smart Tag Collections",
    bg: "#1a1a2e",
    description: "Tag songs by genre, mood, energy level, or custom categories, then browse filtered collections showing album art, BPM, key, and duration. Filter and search within tags to narrow results. Tags span playlists, so one song can belong to multiple collections.",
  },
  {
    src: "/prognosticator/03-playlist-view.webp",
    label: "Playlist Browser",
    bg: "#1a1a2e",
    description: "Browse imported Spotify playlists as a grid of album art. Each song shows its musical key, BPM, and duration, pulled from VirtualDJ. Filter by key or BPM for harmonically compatible tracks, or search by title and artist. Click a song to see details, edit tags, or preview.",
  },
  {
    src: "/prognosticator/05-all-songs.webp",
    label: "Full Library View",
    bg: "#1a1a2e",
    description: "All songs across your playlists in one searchable grid. Sort by key or BPM, search by name. Songs show metadata overlays with Camelot key notation and BPM values.",
  },
  {
    src: "/prognosticator/06-now-playing.webp",
    label: "Live DJ Integration",
    bg: "#1a1a2e",
    description: "Prognosticator connects to VirtualDJ in real-time, showing what's loaded on Deck 1 and Deck 2 with live BPM, key, and playback status. Below the decks, browse your library to plan your next track. It reads from VirtualDJ's TCP beat-sync protocol, so deck info updates as you mix.",
  },
  {
    src: "/prognosticator/07-smart-recommendations.webp",
    label: "Smart Track Recommendations",
    bg: "#1a1a2e",
    description: "Click a deck to filter your library. Prognosticator highlights tracks that are harmonically compatible and BPM-matched with what's playing. Compatible keys follow Camelot wheel logic, and BPM ranges keep transitions smooth.",
  },
  {
    src: "/prognosticator/08-scene-controls.webp",
    label: "Beat-Synced Scene Controls",
    bg: "#1a1a2e",
    description: "Control your live stream production from one panel. Toggle OBS scenes, camera angles, and visual effects, all synced to the beat. Choose timing intervals (1 beat, 1 bar, 2 bars, 4 bars) for automatic scene switching. Includes Fourside 3D visualizer controls, webcam probability for camera cuts, and DMX beat-sync patterns.",
  },
  {
    src: "/prognosticator/09-dmx-lighting.webp",
    label: "DMX Lighting Control",
    bg: "#1a1a2e",
    description: "DMX lighting control with a Quick Command Pad for sending commands to any fixture or universe, plus per-channel sliders for fine adjustments. Supports Art-Net, ENTTEC USB, and virtual backends. The fixture library has 2000+ OpenFixtureLibrary definitions with named channels, so you use readable names instead of raw channel numbers.",
  },
];

const RADIANCE_SCREENSHOTS = [
  { src: "/radiance/lights.webp", label: "Smart light controls", bg: "#161616" },
  { src: "/radiance/games-idle.webp", label: "Game launcher", bg: "#161616" },
  { src: "/radiance/games-playing.webp", label: "Game touchpad", bg: "#161616" },
  { src: "/radiance/games-kodi.webp", label: "Kodi remote", bg: "#161616" },
  { src: "/radiance/tunes.webp", label: "Music player", bg: "#161616" },
  { src: "/radiance/settings-system.webp", label: "System settings", bg: "#080808" },
  { src: "/radiance/settings-stats.webp", label: "System stats", bg: "#080808" },
  { src: "/radiance/settings-camera.webp", label: "Camera", bg: "#080808" },
  { src: "/radiance/wifi.webp", label: "Wi-Fi settings", bg: "#161616" },
];

const MTG_SCREENSHOTS = [
  { src: "/magic/tutor-helper.webp", label: "Tutor Helper", bg: "#1a1a1a" },
  { src: "/magic/commander.webp", label: "Commander", bg: "#1a1a1a" },
  { src: "/magic/token-helper.webp", label: "Token Helper", bg: "#1a1a1a" },
];

export function BentoGrid() {
  const [progSlide, setProgSlide] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | string | null>(null);
  const reducedMotion = useReducedMotion();

  const handleProgSlideChange = useCallback((index: number) => {
    setProgSlide(index);
  }, []);

  const handleGridMouseLeave = () => setHoveredIndex(null);

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ gridAutoRows: "minmax(180px, auto)" }}
      onMouseLeave={handleGridMouseLeave}
    >
      {/* Prognosticator — 3 col, 2 row */}
      <BentoCard
        title="Prognosticator"
        subtitle={PROGNOSTICATOR_SCREENSHOTS[progSlide].label}
        description={PROGNOSTICATOR_SCREENSHOTS[progSlide].description}
        accentColor="#81a1c1"
        colSpan={3}
        rowSpan={2}
        index={0}
        fixedDescriptionHeight="7.5rem"
        dimmed={hoveredIndex !== null && hoveredIndex !== 0}
        onHover={() => setHoveredIndex(0)}
        tags={["Electron", "React", "TypeScript", "Node", "C++", "DMX", "Tailwind", "VirtualDJ"]}
      >
        <TabletCarousel screenshots={PROGNOSTICATOR_SCREENSHOTS} autoPlayInterval={4500} autoPlayDelay={0} onSlideChange={handleProgSlideChange} />
      </BentoCard>

      {/* hobbit.house — 1 col, 2 row */}
      <BentoCard
        title="hobbit.house"
        description="Mobile control app for a living room mini PC. Launch games, manage Kodi, adjust smart lights, and monitor IoT devices (laundry, security cameras)."
        href="https://github.com/BigFancyBen/hobbit-ccp"
        accentColor="#81a1c1"
        rowSpan={2}
        index={1}
        dimmed={hoveredIndex !== null && hoveredIndex !== 1}
        onHover={() => setHoveredIndex(1)}
        tags={["React", "Docker", "Linux"]}
      >
        <PhoneCarousel screenshots={RADIANCE_SCREENSHOTS} autoPlayInterval={4500} autoPlayDelay={1500} />
      </BentoCard>

      {/* MTG section — frosted glass group */}
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
            : { delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
        }
        animate={{ opacity: hoveredIndex !== null && hoveredIndex !== "mtg" ? 0.55 : 1 }}
        onMouseEnter={() => setHoveredIndex("mtg")}
      >
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-bold text-white">Magic: The Gathering</h3>
          <div className="flex flex-wrap gap-1.5">
            {["Next.js", "React", "Vercel"].map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px]"
                style={{
                  color: "#81a1c1",
                  borderWidth: 1,
                  borderColor: "#81a1c130",
                  backgroundColor: "#81a1c112",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-gray-400 text-xs mb-4">Tools for Commander players and deck builders</p>

        <div className="flex flex-col md:flex-row gap-4">
          {/* Left — 3 individual MTG cards */}
          <div className="w-full md:w-[30%] flex flex-col gap-4">
            <BentoCard
              title="MTG Commander Scorekeeper"
              description="Full-screen, touch-friendly scorekeeper for Commander format. 4-player quadrant layout, life tracking, and commander damage."
              href="/commander"
              accentColor="#81a1c1"
              index={2}
            />
            <BentoCard
              title="Magic Tutor Helper"
              description="Card filtering tool for decklists. Import decks, filter by mana cost and card types with Scryfall integration."
              href="/tutor-helper"
              accentColor="#81a1c1"
              index={3}
            />
            <BentoCard
              title="MTG Token Helper"
              description="Import a deck, discover all tokens it produces, and track them on the battlefield with tap/untap, counters, and buffs."
              href="/token-helper"
              accentColor="#81a1c1"
              index={4}
            />
          </div>

          {/* Right — Wider tablet carousel */}
          <div className="w-full md:w-[70%] flex items-center justify-center">
            <TabletCarousel screenshots={MTG_SCREENSHOTS} autoPlayInterval={4500} autoPlayDelay={3000} />
          </div>
        </div>
      </motion.div>

      {/* FloatWise + Dota row */}
      <BentoCard
        title="FloatWise"
        description="NOAA weather tracker for multiple locations. Hourly forecasts, temperature and wind tracking for float trip planning."
        href="/floatwise"
        accentColor="#81a1c1"
        colSpan={2}
        index={5}
        dimmed={hoveredIndex !== null && hoveredIndex !== 5}
        onHover={() => setHoveredIndex(5)}
      />

      <BentoCard
        title="Dota 2 Randomizer"
        description="Spin two wheels for a random hero and item challenge. Canvas-based animations with real-time OpenDota API data."
        href="/dota-randomizer"
        accentColor="#81a1c1"
        colSpan={2}
        index={6}
        dimmed={hoveredIndex !== null && hoveredIndex !== 6}
        onHover={() => setHoveredIndex(6)}
      />

      {/* IRLScape */}
      <div className="md:col-span-2 self-start">
        <BentoCard
          title="IRLScape"
          description="Old School RuneScape streaming overlay. Game UI on a live camera feed with Twitch chat integration and Joycon controls."
          href="https://www.youtube.com/watch?v=gCofVhR5HUQ"
          accentColor="#81a1c1"
          colSpan={2}
          index={7}
          dimmed={hoveredIndex !== null && hoveredIndex !== 7}
          onHover={() => setHoveredIndex(7)}
        >
          <div className="relative aspect-video w-full overflow-hidden">
            <Image
              src="/irlscape/thumbnail.webp"
              alt="IRLScape YouTube video thumbnail"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </BentoCard>
      </div>

      {/* OSRS Progress */}
      <BentoCard
        title="OSRS Progress Generator"
        description="API for generating progress report images for Old School RuneScape players. Collection log items, OSRS Wiki integration."
        accentColor="#81a1c1"
        colSpan={2}
        index={8}
        dimmed={hoveredIndex !== null && hoveredIndex !== 8}
        onHover={() => setHoveredIndex(8)}
      >
        <div className="flex flex-col gap-0.5 flex-1" style={{ backgroundColor: "#313338", padding: "8px 0" }}>
          {[
            { src: "/osrsprogs/progresspic.webp", alt: "OSRS progress report", w: 330, h: 285 },
            { src: "/osrsprogs/collectionlog.webp", alt: "OSRS collection log", w: 396, h: 221 },
          ].map((img, i) => (
            <div key={img.src} className="flex gap-2 px-3 py-1 hover:bg-[#2e3035]">
              {/* Avatar */}
              <div className="w-10 h-10 shrink-0 mt-0.5" style={{ backgroundColor: "#5865f2", borderRadius: "50%" }}>
                <svg viewBox="0 0 127.14 96.36" className="w-5 h-5 m-2.5" fill="white">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
              </div>
              {/* Message */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium" style={{ color: "#5865f2" }}>OSRS Progress</span>
                  <span className="text-[9px] font-medium px-1 py-px" style={{ backgroundColor: "#5865f2", color: "white", borderRadius: "3px" }}>BOT</span>
                  <span className="text-[10px] text-gray-500">{i === 0 ? "01/08/2025 9:14 PM" : "10/14/2025 11:11 PM"}</span>
                </div>
                <div className="mt-1">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    width={img.w}
                    height={img.h}
                    unoptimized
                    style={{ borderRadius: "8px" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}
