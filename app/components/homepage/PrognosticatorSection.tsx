"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

const ACCENT_COLOR = "#10b981";
const AUTO_PLAY_INTERVAL = 4000;

const SCREENSHOTS = [
  {
    src: "/prognosticator/01-dashboard.png",
    title: "Command Center Dashboard",
    description:
      "Your home base for everything. One-click access to Spotify playlists, custom tag collections, and live performance tools. Import playlists from Spotify, and Prognosticator automatically downloads each track and fetches DJ metadata like BPM and musical key.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/02-tags-collections.png",
    title: "Smart Tag Collections",
    description:
      "Organize your library with custom tags — genre, mood, energy level, or anything you want. Browse filtered collections with album art, BPM, key, and duration at a glance. Tags work across playlists, so one song can live in multiple collections.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/03-playlist-view.png",
    title: "Playlist Browser",
    description:
      "Browse imported Spotify playlists as a visual grid of album art. Every song displays its musical key, BPM, and duration — essential DJ metadata pulled automatically from VirtualDJ. Filter by key or BPM to find harmonically compatible tracks.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/05-all-songs.png",
    title: "Full Library View",
    description:
      "See every song across all your playlists in one searchable, filterable grid. Sort by key, BPM, or search by name — perfect for building sets or finding that one track you know you have somewhere.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/06-now-playing.png",
    title: "Live DJ Integration",
    description:
      "Connects to VirtualDJ in real-time, showing what's loaded on Deck 1 and Deck 2 with live BPM, key, and playback status. Reads directly from VirtualDJ's TCP beat-sync protocol, so deck info updates instantly as you mix.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/07-smart-recommendations.png",
    title: "Smart Track Recommendations",
    description:
      "Activate intelligent filtering — highlights tracks that are harmonically compatible and BPM-matched with what's currently playing. Compatible keys use Camelot wheel logic, and BPM ranges ensure smooth transitions.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/08-scene-controls.png",
    title: "Beat-Synced Scene Controls",
    description:
      "Control your entire live stream production from one panel. Toggle OBS scenes, camera angles, and visual effects — all synced to the beat. Includes 3D visualizer controls, webcam probability for dynamic camera cuts, and DMX beat-sync patterns.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/09-dmx-lighting.png",
    title: "DMX Lighting Control",
    description:
      "Full DMX lighting control built right in. Send commands to any fixture or universe with the Quick Command Pad, or use per-channel sliders for precise control. Supports Art-Net, ENTTEC USB, and 2000+ OpenFixtureLibrary definitions.",
    bg: "#1a1a2e",
  },
];

export function PrognosticatorSection() {
  const [current, setCurrent] = useState(0);
  const [userClicked, setUserClicked] = useState(false);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % SCREENSHOTS.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((i) => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length);
  }, []);

  useEffect(() => {
    if (userClicked) return;
    const id = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(id);
  }, [userClicked, next]);

  const handlePrev = () => {
    setUserClicked(true);
    prev();
  };

  const handleNext = () => {
    setUserClicked(true);
    next();
  };

  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setUserClicked(true);
    if (x < rect.width / 2) {
      prev();
    } else {
      next();
    }
  };

  return (
    <motion.section
      className="w-full"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Section header */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          Prognosticator
        </h2>
        <p className="text-gray-400 mt-1 text-sm">
          Desktop app for DJs and music curators
        </p>
        <div
          className="h-0.5 w-16 mt-3"
          style={{ background: ACCENT_COLOR }}
        />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-center">
        {/* Left — Tablet carousel */}
        <div className="w-full md:w-[55%]">
          <div className="flex items-center gap-3 w-full max-w-[480px] mx-auto md:max-w-none">
            {/* Left arrow — hidden on mobile */}
            <button
              onClick={handlePrev}
              className="hidden sm:block text-gray-500 hover:text-white transition-colors p-1 shrink-0"
              aria-label="Previous screenshot"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Tablet frame with screenshot */}
            <div className="relative min-w-0 flex-1">
              <Image
                src="/magic/tablet-frame.svg"
                alt=""
                width={660}
                height={440}
                className="relative z-10 pointer-events-none w-full h-auto select-none"
                priority
              />
              <div
                className="absolute z-20 overflow-hidden cursor-pointer"
                style={{
                  top: "2.3%",
                  left: "1.5%",
                  width: "97%",
                  height: "95.5%",
                  borderRadius: "2.1%",
                  background: SCREENSHOTS[current].bg,
                }}
                onClick={handleScreenClick}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Image
                      src={SCREENSHOTS[current].src}
                      alt={SCREENSHOTS[current].title}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 660px"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Right arrow — hidden on mobile */}
            <button
              onClick={handleNext}
              className="hidden sm:block text-gray-500 hover:text-white transition-colors p-1 shrink-0"
              aria-label="Next screenshot"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right — Dynamic text panel */}
        <div className="w-full md:w-[45%] flex flex-col gap-5">
          <div className="min-h-[200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-lg md:text-xl font-bold text-white mb-3">
                  {SCREENSHOTS[current].title}
                </h3>
                <p className="text-sm md:text-base text-gray-300 leading-relaxed">
                  {SCREENSHOTS[current].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dot indicators */}
          <div className="flex gap-2">
            {SCREENSHOTS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setUserClicked(true);
                  setCurrent(i);
                }}
                className="w-2 h-2 transition-colors"
                style={{
                  background: i === current ? ACCENT_COLOR : "#374151",
                }}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>

          {/* GitHub button */}
          <div>
            <a
              href="https://github.com/BigFancyBen/prognosticator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110"
              style={{
                background: "#1a1a1a",
                borderTop: "2px solid #404040",
                borderLeft: "2px solid #404040",
                borderRight: "2px solid #0a0a0a",
                borderBottom: "2px solid #0a0a0a",
                boxShadow:
                  "inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a",
              }}
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
