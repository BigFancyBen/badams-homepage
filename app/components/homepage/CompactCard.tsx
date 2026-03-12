"use client";

import { useState } from "react";
import { motion } from "motion/react";

interface CompactCardProps {
  title: string;
  description: string;
  href?: string;
  tags?: string;
  accentColor: string;
}

export function CompactCard({
  title,
  description,
  href,
  tags,
  accentColor,
}: CompactCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const content = (
    <motion.div
      className="relative h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Folder tab */}
      <div
        className="absolute -top-[18px] left-3 h-[20px] w-[90px]"
        style={{
          background: "#1a1a1a",
          borderTop: "2px solid #404040",
          borderLeft: "2px solid #404040",
          borderRight: "2px solid #0a0a0a",
          clipPath:
            "polygon(0 100%, 0 30%, 15% 0, 85% 0, 100% 30%, 100% 100%)",
        }}
      />

      {/* Main folder body */}
      <div
        className="relative h-full overflow-hidden flex flex-col"
        style={{
          background: "#1a1a1a",
          borderTop: "2px solid #404040",
          borderLeft: "2px solid #404040",
          borderRight: "2px solid #0a0a0a",
          borderBottom: "2px solid #0a0a0a",
          boxShadow: isHovered
            ? `inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a, 0 0 12px ${accentColor}40`
            : "inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a",
          transition: "box-shadow 0.2s ease",
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

        {/* Title bar */}
        <div
          className="px-3 py-1.5 flex items-center gap-2"
          style={{
            background: `linear-gradient(90deg, ${accentColor}33 0%, ${accentColor}55 50%, ${accentColor}33 100%)`,
            borderBottom: "1px solid #0a0a0a",
          }}
        >
          <div className="shrink-0">
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
              <path
                d="M0 2V12C0 13.1 0.9 14 2 14H14C15.1 14 16 13.1 16 12V4C16 2.9 15.1 2 14 2H8L6 0H2C0.9 0 0 0.9 0 2Z"
                fill="#f5c542"
              />
              <path
                d="M0 4H16V12C16 13.1 15.1 14 14 14H2C0.9 14 0 13.1 0 12V4Z"
                fill="#f5d442"
              />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white truncate">{title}</h3>
        </div>

        {/* Content area */}
        <div className="p-3 relative flex flex-col grow">
          <div className="grow">
            <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
              {description}
            </p>
          </div>

          {/* Status bar */}
          <div
            className="text-xs text-gray-400 pt-2 mt-3 flex items-center gap-1"
            style={{ borderTop: "1px solid #0a0a0a" }}
          >
            <span className="inline-block w-2 h-2 bg-green-500 mr-1" />
            {href ? "Click to open" : tags}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full pt-[18px] cursor-pointer">
        {content}
      </a>
    );
  }

  return <div className="h-full pt-[18px]">{content}</div>;
}
