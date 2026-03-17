"use client";

import { motion } from "motion/react";
import { PhoneCarousel } from "./PhoneCarousel";

const ACCENT_COLOR = "#ef4444";

const RADIANCE_SCREENSHOTS = [
  { src: "/radiance/lights.png", label: "Smart light controls" },
  { src: "/radiance/games-idle.png", label: "Game launcher" },
  { src: "/radiance/games-playing.png", label: "Game touchpad" },
  { src: "/radiance/games-kodi.png", label: "Kodi remote" },
  { src: "/radiance/tunes.png", label: "Music player" },
  { src: "/radiance/settings-system.png", label: "System settings" },
  { src: "/radiance/settings-stats.png", label: "System stats" },
  { src: "/radiance/settings-camera.png", label: "Camera" },
  { src: "/radiance/wifi.png", label: "Wi-Fi settings" },
];

export function RadianceSection() {
  return (
    <motion.section
      className="w-full"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-10 items-center">
        {/* Left — Phone carousel */}
        <div className="w-full md:w-[45%] flex justify-center">
          <PhoneCarousel screenshots={RADIANCE_SCREENSHOTS} />
        </div>

        {/* Right — Copy block */}
        <div className="w-full md:w-[55%] flex flex-col gap-6">
          {/* Section header */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              hobbit.house
            </h2>
            <p className="text-gray-400 mt-1 text-sm">
              MiniPC control center for your living room
            </p>
            <div
              className="h-0.5 w-16 mt-3"
              style={{ background: ACCENT_COLOR }}
            />
          </div>

          {/* Description */}
          <p className="text-gray-300 leading-relaxed">
            A mobile control app for a living room mini PC. Launch and control
            games with a virtual touchpad, manage Kodi playback, adjust smart
            lights, browse and play music, and monitor system stats — all from
            your phone.
          </p>

          {/* GitHub button */}
          <div>
            <a
              href="https://github.com/BigFancyBen/hobbit-ccp"
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
