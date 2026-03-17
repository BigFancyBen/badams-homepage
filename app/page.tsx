"use client";

import { AnimatedHeroTitle } from "./components/homepage/AnimatedHeroTitle";
import { ParticleField } from "./components/homepage/ParticleField";
import {
  ProjectSection,
  ProjectGroup,
} from "./components/homepage/ProjectSection";
import { RadianceSection } from "./components/homepage/RadianceSection";

const projectGroups: ProjectGroup[] = [
  {
    title: "Magic: The Gathering",
    subtitle: "Tools for Commander players and deck builders",
    accentColor: "#a855f7",
    icon: <span>&#9876;</span>,
    projects: [
      {
        title: "MTG Commander Scorekeeper",
        description:
          "Full-screen, touch-friendly scorekeeper for Magic: The Gathering Commander format. Features 4-player quadrant layout, life tracking, commander damage, and mobile-optimized interface.",
        href: "/commander",
      },
      {
        title: "Magic Tutor Helper",
        description:
          "Advanced card filtering tool for Magic: The Gathering decklists. Import decklists, filter by mana cost and card types, and analyze your cards with Scryfall integration.",
        href: "/tutor-helper",
      },
      {
        title: "MTG Token Helper",
        description:
          "Import a deck, discover all tokens it can produce via Scryfall, and track them on the battlefield with tap/untap, counters, splitting, and temporary buffs.",
        href: "/token-helper",
      },
    ],
    screenshots: [
      { src: "/magic/tutor-helper.png", label: "Tutor Helper — 3-drop enchantments" },
      { src: "/magic/commander.png", label: "Commander — 4-player life tracker" },
      { src: "/magic/token-helper.png", label: "Token Helper — battlefield tokens" },
    ],
  },
  {
    title: "Gaming",
    subtitle: "Randomizers, overlays, and progress trackers",
    accentColor: "#f59e0b",
    icon: <span>&#127918;</span>,
    projects: [
      {
        title: "Dota 2 Randomizer",
        description:
          "Spin two wheels to get a random hero and item challenge for your next Dota 2 game. Features canvas-based animations and real-time data from the OpenDota API.",
        href: "/dota-randomizer",
      },
      {
        title: "RuneScape Progress Image Generator",
        description:
          "API endpoint for generating progress report images for Old School RuneScape players. Features collection log items, OSRS Wiki integration, and comprehensive game database.",
        tags: "API \u2022 OSRS Wiki \u2022 Image Generation",
      },
      {
        title: "IRLScape",
        description:
          "IRL streaming overlay system for Old School RuneScape. Overlays game UI elements like minimap, chat, inventory, and XP tracker onto real-world camera footage with Twitch chat integration and Joycon motion controls.",
        href: "https://www.youtube.com/watch?v=gCofVhR5HUQ",
      },
    ],
  },
  {
    title: "Tools & Apps",
    subtitle: "Utilities and desktop applications",
    accentColor: "#06b6d4",
    icon: <span>&#128736;</span>,
    projects: [
      {
        title: "FloatWise",
        description:
          "NOAA weather tracker for multiple locations. View detailed hourly forecasts from 10am-7pm, track temperature and wind conditions, and manage your favorite float trip destinations.",
        href: "/floatwise",
      },
      {
        title: "Prognosticator",
        description:
          "Cross-platform desktop app for DJs and music curators. Import Spotify playlists, download songs, fetch DJ metadata (key, BPM), and integrate with VirtualDJ and OBS.",
        tags: "Desktop App \u2022 VirtualDJ \u2022 OBS Integration",
      },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <ParticleField particleCount={45} />

      {/* Hero section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <AnimatedHeroTitle text="benadams.dev" />
      </div>

      {/* Project sections */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-24 space-y-24">
        <RadianceSection />
        {projectGroups.map((group, index) => (
          <ProjectSection key={group.title} group={group} index={index} />
        ))}
      </div>
    </div>
  );
}
