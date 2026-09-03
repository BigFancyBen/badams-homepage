"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { ACCENT, ACCENT_WARM } from "../data";
import { renderInline } from "../utils";

interface SectionProps {
  id: string;
  index: number;
  title: string;
  lede?: string;
  badge?: string;
  children: React.ReactNode;
}

export function Section({
  id,
  index,
  title,
  lede,
  badge,
  children,
}: SectionProps) {
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
        className="flex flex-wrap items-baseline gap-3 pb-3 mb-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span
          className="font-mono text-xs shrink-0"
          style={{ color: `${ACCENT}99` }}
        >
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
        {badge ? (
          <span
            className="font-mono text-[10px] uppercase tracking-widest px-2 py-1"
            style={{
              color: ACCENT_WARM,
              border: `1px solid ${ACCENT_WARM}40`,
              backgroundColor: `${ACCENT_WARM}12`,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      {lede ? (
        <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-2xl">
          {renderInline(lede)}
        </p>
      ) : null}

      {children}
    </motion.section>
  );
}
