"use client";

import { useRef, MouseEvent, TouchEvent, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface AnimatedCardProps {
  title: string;
  description: string;
  href?: string;
  tags?: string;
  reducedMotion?: boolean;
  isMobile?: boolean;
  animationDelay?: number;
}

export function AnimatedCard({
  title,
  description,
  href,
  tags,
  reducedMotion = false,
  isMobile = false,
  animationDelay = 0,
}: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isTouched, setIsTouched] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const isHovered = useMotionValue(0);

  // Lighter spring config for better mobile performance
  const springConfig = isMobile
    ? { stiffness: 200, damping: 30 }
    : { stiffness: 150, damping: 20 };

  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);

  const glowX = useTransform(smoothMouseX, [-0.5, 0.5], [0, 100]);
  const glowY = useTransform(smoothMouseY, [-0.5, 0.5], [0, 100]);

  const borderGlow = useSpring(useTransform(isHovered, [0, 1], [0, 1]), {
    stiffness: 200,
    damping: 20,
  });

  const glowBackground = useTransform(
    [glowX, glowY],
    ([x, y]) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(139, 92, 246, 0.15), transparent 60%)`
  );

  const glowBoxShadow = useTransform(
    borderGlow,
    (v) => `0 0 ${v * 20}px rgba(139, 92, 246, ${v * 0.4})`
  );

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || reducedMotion || isMobile) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / rect.width;
    const normalizedY = (e.clientY - centerY) / rect.height;

    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseEnter = () => {
    if (!reducedMotion && !isMobile) {
      isHovered.set(1);
    }
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    isHovered.set(0);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    setIsTouched(true);
    isHovered.set(1);

    // Set glow position to touch point
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const normalizedX = (touch.clientX - rect.left) / rect.width - 0.5;
      const normalizedY = (touch.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(normalizedX);
      mouseY.set(normalizedY);
    }
  };

  const handleTouchEnd = () => {
    setIsTouched(false);
    isHovered.set(0);
    mouseX.set(0);
    mouseY.set(0);
  };

  const content = (
    <motion.div
      ref={cardRef}
      className="relative h-full"
      style={{
        // Disable 3D perspective on mobile for better performance
        perspective: reducedMotion || isMobile ? "none" : "800px",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        className="relative h-full will-change-transform"
        style={
          reducedMotion || isMobile
            ? {}
            : {
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }
        }
        // Simple scale animation for mobile touch
        animate={
          isMobile && isTouched
            ? { scale: 0.98 }
            : { scale: 1 }
        }
        transition={{ duration: 0.15 }}
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
          className="relative h-full overflow-hidden flex flex-col"
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
            {!reducedMotion && (
              <motion.div
                className="absolute inset-0 pointer-events-none will-change-opacity"
                style={{
                  background: isMobile
                    ? isTouched
                      ? "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15), transparent 60%)"
                      : "transparent"
                    : glowBackground,
                  opacity: isMobile ? (isTouched ? 1 : 0) : borderGlow,
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
              {href ? (isMobile ? "Tap to open" : "Double-click to open") : tags}
            </div>
          </div>
        </div>

        {/* Outer glow on hover/touch */}
        {!reducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none will-change-auto"
            style={{
              boxShadow: isMobile
                ? isTouched
                  ? "0 0 20px rgba(139, 92, 246, 0.4)"
                  : "0 0 0px rgba(139, 92, 246, 0)"
                : glowBoxShadow,
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );

  // Entry animation - same pattern as AnimatedHeroTitle
  const entryAnimation = reducedMotion ? {} : {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: animationDelay,
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  };

  if (href) {
    return (
      <motion.a
        href={href}
        className="block h-full pt-[18px] cursor-pointer"
        {...entryAnimation}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.div
      className="h-full pt-[18px]"
      {...entryAnimation}
    >
      {content}
    </motion.div>
  );
}
