"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

interface Screenshot {
  src: string;
  label: string;
  bg?: string;
}

interface TabletCarouselProps {
  screenshots: Screenshot[];
  autoPlayInterval?: number;
  autoPlayDelay?: number;
  onSlideChange?: (index: number) => void;
}

export function TabletCarousel({ screenshots, autoPlayInterval = 2000, autoPlayDelay = 0, onSlideChange }: TabletCarouselProps) {
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

  useEffect(() => {
    onSlideChange?.(current);
  }, [current, onSlideChange]);

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
    <div className="flex flex-col items-center w-full max-w-[1024px]">
      {/* Tablet + arrows row */}
      <div className="flex items-center gap-3 w-full">
        {/* Left arrow — hidden on mobile, tap screen halves to navigate */}
        <button
          onClick={handlePrev}
          className="hidden sm:block text-gray-500 hover:text-white transition-colors p-1 shrink-0"
          aria-label="Previous screenshot"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Tablet frame with screenshot */}
        <div className="relative min-w-0 flex-1">
          {/* Tablet frame image */}
          <Image
            src="/magic/tablet-frame.svg"
            alt=""
            width={660}
            height={440}
            className="relative z-10 pointer-events-none w-full h-auto select-none"
            priority
          />

          {/* Screen area positioned inside the frame */}
          <div
            className="absolute z-20 overflow-hidden cursor-pointer"
            style={{
              top: "2.3%",
              left: "1.5%",
              width: "97%",
              height: "95.5%",
              borderRadius: "2.1%",
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
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={screenshots[current].src}
                  alt={screenshots[current].label}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 1024px"
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
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
