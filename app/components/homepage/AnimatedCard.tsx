"use client";

import { useRef, useState } from "react";

interface AnimatedCardProps {
  title: string;
  description: string;
  href?: string;
  tags?: string;
  reducedMotion?: boolean;
}

export function AnimatedCard({
  title,
  description,
  href,
  tags,
  reducedMotion = false,
}: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const updateGlowPosition = (clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setGlowPos({
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => {
    if (!reducedMotion) setIsActive(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!reducedMotion) updateGlowPosition(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    setIsActive(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (reducedMotion || !e.touches[0]) return;
    setIsActive(true);
    updateGlowPosition(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    setIsActive(false);
  };

  const content = (
    <div
      ref={cardRef}
      className="relative h-full transition-transform duration-150"
      style={{ transform: isActive ? "scale(0.98)" : "scale(1)" }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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

      {/* Main folder body - Win98 beveled style */}
      <div
        className="relative h-full overflow-hidden flex flex-col transition-shadow duration-300"
        style={{
          background: "#1a1a1a",
          borderTop: "2px solid #404040",
          borderLeft: "2px solid #404040",
          borderRight: "2px solid #0a0a0a",
          borderBottom: "2px solid #0a0a0a",
          boxShadow: isActive
            ? "inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a, 0 0 20px rgba(139, 92, 246, 0.4)"
            : "inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #0a0a0a",
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

        {/* Title bar - Win98 style */}
        <div
          className="px-3 py-1.5 flex items-center gap-2"
          style={{
            background:
              "linear-gradient(90deg, #1a1a4a 0%, #2a2a6a 50%, #1a1a4a 100%)",
            borderBottom: "1px solid #0a0a0a",
          }}
        >
          {/* Folder icon */}
          <div className="flex-shrink-0">
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
        <div className="p-4 relative flex flex-col flex-grow">
          {/* Glow follow effect - works on both mouse and touch */}
          {!reducedMotion && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(139, 92, 246, 0.15), transparent 60%)`,
                opacity: isActive ? 1 : 0,
              }}
            />
          )}

          <div className="flex-grow">
            <p className="text-gray-300 text-sm leading-relaxed">
              {description}
            </p>
          </div>

          {/* Status bar style footer */}
          <div
            className="text-xs text-gray-400 pt-2 mt-4 flex items-center gap-1"
            style={{
              borderTop: "1px solid #0a0a0a",
            }}
          >
            <span className="inline-block w-2 h-2 bg-green-500 mr-1" />
            {href ? "Open" : tags}
          </div>
        </div>
      </div>

      {/* Outer glow on hover/touch */}
      {!reducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-shadow duration-300"
          style={{
            boxShadow: isActive
              ? "0 0 20px rgba(139, 92, 246, 0.4)"
              : "0 0 0px rgba(139, 92, 246, 0)",
          }}
        />
      )}
    </div>
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
