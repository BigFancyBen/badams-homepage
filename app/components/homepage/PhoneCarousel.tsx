"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

interface Screenshot {
  src: string;
  label: string;
  bg?: string;
}

interface PhoneCarouselProps {
  screenshots: Screenshot[];
  autoPlayInterval?: number;
  autoPlayDelay?: number;
}

export function PhoneCarousel({ screenshots, autoPlayInterval = 2000, autoPlayDelay = 0 }: PhoneCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [userClicked, setUserClicked] = useState(false);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % screenshots.length);
  }, [screenshots.length]);

  const prev = useCallback(() => {
    setCurrent((i) => (i - 1 + screenshots.length) % screenshots.length);
  }, [screenshots.length]);

  useEffect(() => {
    if (userClicked) return;
    let intervalId: ReturnType<typeof setInterval>;
    const delayId = setTimeout(() => {
      next();
      intervalId = setInterval(next, autoPlayInterval);
    }, autoPlayDelay);
    return () => { clearTimeout(delayId); clearInterval(intervalId); };
  }, [userClicked, next, autoPlayInterval, autoPlayDelay]);

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
    <div className="flex flex-col items-center">
      {/* Phone frame with arrows */}
      <div className="relative w-[200px] sm:w-[240px]" style={{ aspectRatio: "320/660" }}>
        <Image
          src="/radiance/phone-frame.svg"
          alt=""
          width={320}
          height={660}
          className="relative z-10 pointer-events-none w-full h-auto select-none"
          priority
        />

        {/* Screen area positioned inside the frame */}
        <div
          className="absolute z-20 overflow-hidden cursor-pointer"
          style={{
            top: "1.8%",
            left: "3.75%",
            width: "92.5%",
            height: "96.4%",
            borderRadius: "7.5%",
            background: screenshots[current].bg ?? "#161616",
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
              transition={{ duration: 0.1 }}
            >
              <Image
                src={screenshots[current].src}
                alt={screenshots[current].label}
                fill
                className="object-contain"
                sizes="280px"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Left arrow */}
        <button
          onClick={handlePrev}
          className="absolute top-1/2 -translate-y-1/2 z-30 text-gray-400 hover:text-white transition-colors p-1"
          style={{ left: "-24px" }}
          aria-label="Previous screenshot"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={handleNext}
          className="absolute top-1/2 -translate-y-1/2 z-30 text-gray-400 hover:text-white transition-colors p-1"
          style={{ right: "-24px" }}
          aria-label="Next screenshot"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Label below frame */}
      <p className="text-xs text-gray-500 font-mono mt-3">
        {screenshots[current].label}
      </p>
    </div>
  );
}
