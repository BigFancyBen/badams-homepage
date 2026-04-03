"use client";

import { useState, useCallback } from "react";
import { AnimatedHeroTitle } from "./AnimatedHeroTitle";
import { AnimatedSubtitle } from "./AnimatedSubtitle";
import { ScrollDownArrow } from "./ScrollDownArrow";

export function HeroSection() {
  const [heroComplete, setHeroComplete] = useState(false);
  const handleHeroComplete = useCallback(() => setHeroComplete(true), []);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <AnimatedHeroTitle text="benadams.dev" onComplete={handleHeroComplete} />
      <AnimatedSubtitle
        startDelay={400}
        parenStarted={heroComplete}
        text={
          <div>
            These are some of
            <br className="inline sm:hidden" /> the things I&apos;ve built
            <br />
            (that weren&apos;t my job)
          </div>
        }
      />
      <ScrollDownArrow />
    </div>
  );
}
