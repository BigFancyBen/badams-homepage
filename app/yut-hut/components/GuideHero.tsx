"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { ACCENT, ACCENT_WARM, STAT_LINE, SUMMARY } from "../data";

const TAGS = ["Discord bot", "Check-ins", "RuneScape XP", "Streaks", "One camp"];

export function GuideHero() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="overview" className="scroll-mt-28 pt-12 md:pt-20 pb-12">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }
        }
      >
        <div className="flex items-center gap-3 mb-5">
          <span
            className="font-mono text-[10px] uppercase tracking-widest px-2 py-1"
            style={{
              color: ACCENT_WARM,
              border: `1px solid ${ACCENT_WARM}40`,
              backgroundColor: `${ACCENT_WARM}12`,
            }}
          >
            The rules
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            Season one · 52 weeks
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
          Yut Hut
        </h1>
        <p
          className="mt-2 text-lg md:text-xl font-medium"
          style={{ color: ACCENT }}
        >
          A workout-accountability campaign for the yut-hut channel
        </p>

        <p className="mt-6 max-w-3xl text-sm md:text-base text-gray-400 leading-relaxed">
          {SUMMARY}
        </p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 text-[10px] font-mono"
              style={{
                color: ACCENT,
                border: `1px solid ${ACCENT}30`,
                backgroundColor: `${ACCENT}12`,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <dl
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          {STAT_LINE.map((stat) => (
            <div
              key={stat.label}
              className="p-4"
              style={{ backgroundColor: "#0a0a0a" }}
            >
              <dt className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
                {stat.label}
              </dt>
              <dd className="mt-1 text-xl font-bold text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </section>
  );
}
