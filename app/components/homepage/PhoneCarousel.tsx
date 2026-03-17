"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

interface Screenshot {
  src: string;
  label: string;
}

interface PhoneCarouselProps {
  screenshots: Screenshot[];
  accentColor: string;
}

const AUTO_PLAY_INTERVAL = 4000;

export function PhoneCarousel({ screenshots, accentColor }: PhoneCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % screenshots.length);
  }, [screenshots.length]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, AUTO_PLAY_INTERVAL);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Phone frame */}
      <div
        className="relative flex flex-col"
        style={{
          background: "#1a1a1a",
          borderTop: "4px solid #404040",
          borderLeft: "4px solid #404040",
          borderRight: "4px solid #0a0a0a",
          borderBottom: "4px solid #0a0a0a",
          boxShadow: "inset 2px 2px 0 #2a2a2a, inset -2px -2px 0 #0a0a0a",
        }}
      >
        {/* Inner bevel */}
        <div
          className="absolute inset-[4px] pointer-events-none z-10"
          style={{
            borderTop: "2px solid #0a0a0a",
            borderLeft: "2px solid #0a0a0a",
            borderRight: "2px solid #303030",
            borderBottom: "2px solid #303030",
          }}
        />

        {/* Screen area */}
        <div
          className="relative w-[240px] sm:w-[280px] overflow-hidden"
          style={{ aspectRatio: "1236 / 2796" }}
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
                src={screenshots[current].src}
                alt={screenshots[current].label}
                fill
                className="object-cover"
                sizes="280px"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators inside bezel */}
        <div className="flex justify-center gap-2 py-3 relative z-10">
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-2.5 h-2.5 transition-colors"
              style={{
                background: i === current ? accentColor : "#404040",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Label below frame */}
      <p className="text-xs text-gray-500 font-mono mt-3">
        {screenshots[current].label}
      </p>
    </div>
  );
}
