"use client";

import { motion } from "motion/react";

interface GroupShowcaseProps {
  groupTitle: string;
  accentColor: string;
  icon: React.ReactNode;
}

export function GroupShowcase({
  groupTitle,
  accentColor,
  icon,
}: GroupShowcaseProps) {
  return (
    <div
      className="relative w-full h-full min-h-[250px] md:min-h-[300px] overflow-hidden flex items-center justify-center"
      style={{
        background: "#1a1a1a",
        borderTop: "2px solid #404040",
        borderLeft: "2px solid #404040",
        borderRight: "2px solid #0a0a0a",
        borderBottom: "2px solid #0a0a0a",
        boxShadow: "inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a",
      }}
    >
      {/* Inner bevel */}
      <div
        className="absolute inset-[3px] pointer-events-none"
        style={{
          borderTop: "1px solid #0a0a0a",
          borderLeft: "1px solid #0a0a0a",
          borderRight: "1px solid #303030",
          borderBottom: "1px solid #303030",
        }}
      />

      {/* Accent gradient background */}
      <div
        className="absolute inset-[4px]"
        style={{
          background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 70%)`,
        }}
      />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-[4px] opacity-10"
        style={{
          backgroundImage: `radial-gradient(${accentColor}80 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ color: accentColor }}
          className="text-5xl md:text-6xl"
        >
          {icon}
        </motion.div>
        <p className="text-gray-500 text-sm font-mono">
          {groupTitle} — screenshot coming soon
        </p>
      </div>
    </div>
  );
}
