"use client";

import { motion } from "motion/react";
import { AnimatedHeroTitle } from "./components/homepage/AnimatedHeroTitle";
import { ParticleField } from "./components/homepage/ParticleField";
import { CardGrid } from "./components/homepage/CardGrid";
import { useReducedMotion } from "./hooks/useReducedMotion";

const projects = [
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
  {
    title: "RuneScape Progress Image Generator",
    description:
      "API endpoint for generating progress report images for Old School RuneScape players. Features collection log items, OSRS Wiki integration, and comprehensive game database.",
    tags: "API \u2022 OSRS Wiki \u2022 Image Generation",
  },
  {
    title: "Dota 2 Randomizer",
    description:
      "Spin two wheels to get a random hero and item challenge for your next Dota 2 game. Features canvas-based animations and real-time data from the OpenDota API.",
    href: "/dota-randomizer",
  },
  {
    title: "IRLScape",
    description:
      "IRL streaming overlay system for Old School RuneScape. Overlays game UI elements like minimap, chat, inventory, and XP tracker onto real-world camera footage with Twitch chat integration and Joycon motion controls.",
    href: "https://www.youtube.com/watch?v=gCofVhR5HUQ",
  },
];

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {!prefersReducedMotion && <ParticleField particleCount={45} />}

      <div className="relative z-10 flex flex-col items-center">
        <AnimatedHeroTitle text="benadams.dev" reducedMotion={prefersReducedMotion} />

        <motion.div
          className="mt-16 w-full max-w-7xl"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          <motion.h2
            className="text-2xl md:text-3xl font-bold text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: prefersReducedMotion ? 0 : 1.2,
              duration: 0.25,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            Projects
          </motion.h2>

          <CardGrid projects={projects} reducedMotion={prefersReducedMotion} />
        </motion.div>
      </div>
    </div>
  );
}
