"use client";

import { useRef, MouseEvent, TouchEvent, useState, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useGyroscope } from "@/app/hooks/useGyroscope";

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
  const [isTouched, setIsTouched] = useState(false);
  const {
    beta,
    gamma,
    isSupported: gyroSupported,
    permissionState,
    requestPermission,
  } = useGyroscope();
  const gyroPermissionRequestedRef = useRef(false);

  // Detect touch capability without setState-in-effect
  const isTouchDevice = useSyncExternalStore(
    () => () => {},
    () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
    () => false
  );

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const isHovered = useMotionValue(0);

  // Gyroscope-driven motion values for tilt
  const gyroX = useMotionValue(0);
  const gyroY = useMotionValue(0);

  // Update gyro motion values during render (motion values are mutable, not React state)
  if (gyroSupported && permissionState === "granted") {
    gyroX.set(gamma); // left-right tilt → rotateY
    gyroY.set(beta); // front-back tilt → rotateX
  }

  const springConfig = { stiffness: 150, damping: 20 };

  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);
  const smoothGyroX = useSpring(gyroX, springConfig);
  const smoothGyroY = useSpring(gyroY, springConfig);

  // Mouse-driven rotation (desktop)
  const rotateXMouse = useTransform(smoothMouseY, [-0.5, 0.5], [8, -8]);
  const rotateYMouse = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);

  // Gyroscope-driven rotation (mobile)
  const rotateXGyro = useTransform(smoothGyroY, [-0.5, 0.5], [8, -8]);
  const rotateYGyro = useTransform(smoothGyroX, [-0.5, 0.5], [-8, 8]);

  // Use gyro when available and granted, otherwise use mouse/touch
  const useGyro = gyroSupported && permissionState === "granted";
  const rotateX = useGyro ? rotateXGyro : rotateXMouse;
  const rotateY = useGyro ? rotateYGyro : rotateYMouse;

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
    if (!cardRef.current || reducedMotion) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const normalizedX = (e.clientX - centerX) / rect.width;
    const normalizedY = (e.clientY - centerY) / rect.height;

    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseEnter = () => {
    if (!reducedMotion) {
      isHovered.set(1);
    }
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    isHovered.set(0);
  };

  // Touch handlers — track finger position for glow + tilt fallback
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    setIsTouched(true);
    isHovered.set(1);

    // Request gyroscope permission on first touch (iOS)
    if (
      gyroSupported &&
      permissionState === "prompt" &&
      !gyroPermissionRequestedRef.current
    ) {
      gyroPermissionRequestedRef.current = true;
      requestPermission();
    }

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const normalizedX = (touch.clientX - rect.left) / rect.width - 0.5;
      const normalizedY = (touch.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(normalizedX);
      mouseY.set(normalizedY);
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const normalizedX = (touch.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (touch.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
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
        perspective: reducedMotion ? "none" : "800px",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <motion.div
        className="relative h-full will-change-transform"
        style={
          reducedMotion
            ? {}
            : {
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }
        }
        // Touch scale feedback
        animate={
          isTouched && !reducedMotion ? { scale: 0.98 } : { scale: 1 }
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
                  background: glowBackground,
                  opacity: borderGlow,
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
              {href ? (isTouchDevice ? "Tap to open" : "Double-click to open") : tags}
            </div>
          </div>
        </div>

        {/* Outer glow on hover/touch */}
        {!reducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none will-change-auto"
            style={{
              boxShadow: glowBoxShadow,
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block h-full pt-[18px] cursor-pointer"
      >
        {content}
      </a>
    );
  }

  return <div className="h-full pt-[18px]">{content}</div>;
}
