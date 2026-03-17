"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

const ACCENT_COLOR = "#10b981";
const AUTO_PLAY_INTERVAL = 4000;

const SCREENSHOTS = [
  {
    src: "/prognosticator/01-dashboard.webp",
    title: "Command Center Dashboard",
    description:
      "Your home base for everything. One-click access to Spotify playlists, custom tag collections, and live performance tools. Import playlists from Spotify, and Prognosticator automatically downloads each track and fetches DJ metadata like BPM and musical key.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/02-tags-collections.webp",
    title: "Smart Tag Collections",
    description:
      "Organize your library with custom tags — genre, mood, energy level, or anything you want. Browse filtered collections with album art, BPM, key, and duration at a glance. Tags work across playlists, so one song can live in multiple collections.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/03-playlist-view.webp",
    title: "Playlist Browser",
    description:
      "Browse imported Spotify playlists as a visual grid of album art. Every song displays its musical key, BPM, and duration — essential DJ metadata pulled automatically from VirtualDJ. Filter by key or BPM to find harmonically compatible tracks.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/05-all-songs.webp",
    title: "Full Library View",
    description:
      "See every song across all your playlists in one searchable, filterable grid. Sort by key, BPM, or search by name — perfect for building sets or finding that one track you know you have somewhere.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/06-now-playing.webp",
    title: "Live DJ Integration",
    description:
      "Connects to VirtualDJ in real-time, showing what's loaded on Deck 1 and Deck 2 with live BPM, key, and playback status. Reads directly from VirtualDJ's TCP beat-sync protocol, so deck info updates instantly as you mix.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/07-smart-recommendations.webp",
    title: "Smart Track Recommendations",
    description:
      "Activate intelligent filtering — highlights tracks that are harmonically compatible and BPM-matched with what's currently playing. Compatible keys use Camelot wheel logic, and BPM ranges ensure smooth transitions.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/08-scene-controls.webp",
    title: "Beat-Synced Scene Controls",
    description:
      "Control your entire live stream production from one panel. Toggle OBS scenes, camera angles, and visual effects — all synced to the beat. Includes 3D visualizer controls, webcam probability for dynamic camera cuts, and DMX beat-sync patterns.",
    bg: "#1a1a2e",
  },
  {
    src: "/prognosticator/09-dmx-lighting.webp",
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

      {/* Title/description above, tablet below, all within one screen */}
      <div className="flex flex-col max-h-screen">
        {/* Slide title & description */}
        <div className="mb-4 h-[140px] md:h-[120px] flex items-start justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="max-w-[512px] text-center"
            >
              <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                {SCREENSHOTS[current].title}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {SCREENSHOTS[current].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Tablet carousel */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-3 w-full max-w-[480px] mx-auto md:max-w-none h-full">
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
            <div className="relative min-w-0 flex-1 h-full">
              <Image
                src="/magic/tablet-frame.svg"
                alt=""
                width={660}
                height={440}
                className="relative z-10 pointer-events-none w-full h-auto select-none max-h-full object-contain"
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
                      sizes="(max-width: 1024px) 100vw, 1120px"
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

        {/* Dot indicators centered below tablet */}
        <div className="flex gap-2 justify-center mt-4">
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
      </div>
    </motion.section>
  );
}
