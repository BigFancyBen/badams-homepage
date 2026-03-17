"use client";

import Link from "next/link";
import { AnimatedHeroTitle } from "./components/homepage/AnimatedHeroTitle";
import { AnimatedSubtitle } from "./components/homepage/AnimatedSubtitle";
import { ScrollDownArrow } from "./components/homepage/ScrollDownArrow";
import { ParticleField } from "./components/homepage/ParticleField";
import { BentoGrid } from "./components/homepage/BentoGrid";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <ParticleField particleCount={45} />

      {/* Resume link — fixed top-right */}
      <Link
        href="/resume"
        className="fixed top-4 right-4 z-50 text-sm text-gray-400 hover:text-white transition-colors"
      >
        Resume
      </Link>

      {/* Hero section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <AnimatedHeroTitle text="benadams.dev" />
        <AnimatedSubtitle text={<div>These are some of<br className="inline sm:hidden" /> the things I&apos;ve built<br />(that weren&apos;t my job)</div>} />
        <ScrollDownArrow />
      </div>

      {/* Bento grid */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-24">
        <BentoGrid />
      </div>
    </div>
  );
}
