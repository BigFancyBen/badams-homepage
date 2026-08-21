"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { ACCENT } from "../data";

interface SectionProps {
  id: string;
  index: number;
  title: string;
  lede?: string;
  children: React.ReactNode;
}

export function Section({ id, index, title, lede, children }: SectionProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className="scroll-mt-28"
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }
      }
    >
      <div
        className="flex items-baseline gap-3 pb-3 mb-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span
          className="font-mono text-xs shrink-0"
          style={{ color: `${ACCENT}99` }}
        >
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      </div>

      {lede ? (
        <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-2xl">
          {lede}
        </p>
      ) : null}

      {children}
    </motion.section>
  );
}
