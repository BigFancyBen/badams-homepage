"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AnimatedCard } from "./AnimatedCard";
import { useMobileDevice } from "@/app/hooks/useMobileDevice";

interface Project {
  title: string;
  description: string;
  href?: string;
  tags?: string;
}

interface CardGridProps {
  projects: Project[];
  reducedMotion?: boolean;
}

const STAGGER_DELAY = 0.12;
const BOOT_DURATION = 0.4;

// Faster timings for mobile
const MOBILE_STAGGER_DELAY = 0.08;
const MOBILE_BOOT_DURATION = 0.3;

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  const isMobile = useMobileDevice();
  const [mounted, setMounted] = useState(false);

  // Trigger animation after mount
  useEffect(() => {
    // Small delay to ensure hydration is complete
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const shouldAnimate = mounted && !reducedMotion;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project, index) => (
        <CRTBootCard
          key={project.title}
          project={project}
          index={index}
          shouldAnimate={shouldAnimate}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

interface CRTBootCardProps {
  project: Project;
  index: number;
  shouldAnimate: boolean;
  reducedMotion: boolean;
  isMobile: boolean;
}

function CRTBootCard({ project, index, shouldAnimate, reducedMotion, isMobile }: CRTBootCardProps) {
  const staggerDelay = isMobile ? MOBILE_STAGGER_DELAY : STAGGER_DELAY;
  const bootDuration = isMobile ? MOBILE_BOOT_DURATION : BOOT_DURATION;
  const delay = index * staggerDelay;

  // CRT animation for both mobile and desktop
  // Mobile optimizations: no blur filter, slightly faster timing
  return (
    <div className="h-full relative">
      {/* CRT Power-on glow - no blur on mobile for performance */}
      {shouldAnimate && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{
            delay: delay,
            duration: 0.3,
            times: [0, 0.3, 1],
          }}
          style={{
            background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
            filter: isMobile ? undefined : "blur(20px)",
          }}
        />
      )}

      {/* Horizontal boot line */}
      {shouldAnimate && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: "50%",
            height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(139, 92, 246, 1), rgba(255,255,255,0.9), transparent)",
            boxShadow: "0 0 20px rgba(139, 92, 246, 1), 0 0 40px rgba(139, 92, 246, 0.5)",
            transformOrigin: "center",
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
          transition={{
            delay: delay,
            duration: bootDuration,
            times: [0, 0.3, 0.7, 1],
            ease: "easeOut",
          }}
        />
      )}

      {/* Card reveal with CRT expand effect */}
      {/* Key forces remount when shouldAnimate changes, so initial state is applied fresh */}
      <motion.div
        key={shouldAnimate ? "animating" : "static"}
        className="h-full"
        initial={shouldAnimate ? {
          clipPath: "polygon(0% 50%, 100% 50%, 100% 50%, 0% 50%)",
          opacity: 0,
        } : undefined}
        animate={{
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          opacity: 1,
        }}
        transition={shouldAnimate ? {
          delay: delay + 0.1,
          duration: bootDuration,
          ease: [0.25, 0.1, 0.25, 1],
        } : { duration: 0 }}
      >
        {/* Phosphor glow effect */}
        {shouldAnimate && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{
              delay: delay + 0.2,
              duration: 0.6,
              ease: "easeOut",
            }}
            style={{
              background: "rgba(139, 92, 246, 1)",
              mixBlendMode: "overlay",
            }}
          />
        )}

        <AnimatedCard
          title={project.title}
          description={project.description}
          href={project.href}
          tags={project.tags}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
        />
      </motion.div>
    </div>
  );
}
