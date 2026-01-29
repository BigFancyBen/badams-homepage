"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
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
const CONTENT_FADE_DURATION = 0.3;

// Faster timings for mobile
const MOBILE_STAGGER_DELAY = 0.08;
const MOBILE_BOOT_DURATION = 0.3;

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const isMobile = useMobileDevice();
  const [bootedCards, setBootedCards] = useState<Set<number>>(
    () => reducedMotion ? new Set(projects.map((_, i) => i)) : new Set()
  );

  const staggerDelay = isMobile ? MOBILE_STAGGER_DELAY : STAGGER_DELAY;
  const bootDuration = isMobile ? MOBILE_BOOT_DURATION : BOOT_DURATION;

  useEffect(() => {
    if (!isInView || reducedMotion) return;

    const timeouts: NodeJS.Timeout[] = [];

    projects.forEach((_, index) => {
      const bootCompleteTime = (index * staggerDelay + bootDuration + CONTENT_FADE_DURATION) * 1000;

      const timeout = setTimeout(() => {
        setBootedCards((prev) => new Set(prev).add(index));
      }, bootCompleteTime);

      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [isInView, projects, reducedMotion, staggerDelay, bootDuration]);

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {projects.map((project, index) => (
        <CRTBootCard
          key={project.title}
          project={project}
          index={index}
          isInView={isInView}
          reducedMotion={reducedMotion}
          isBooted={bootedCards.has(index)}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

interface CRTBootCardProps {
  project: Project;
  index: number;
  isInView: boolean;
  reducedMotion: boolean;
  isBooted: boolean;
  isMobile: boolean;
}

function CRTBootCard({ project, index, isInView, reducedMotion, isBooted, isMobile }: CRTBootCardProps) {
  const staggerDelay = isMobile ? MOBILE_STAGGER_DELAY : STAGGER_DELAY;
  const bootDuration = isMobile ? MOBILE_BOOT_DURATION : BOOT_DURATION;
  const delay = index * staggerDelay;
  const shouldAnimate = isInView && !reducedMotion;

  // Same CRT animation for both mobile and desktop
  // Mobile optimizations: no blur filter, slightly faster timing
  return (
    <div className="h-full relative">
      {/* CRT Power-on glow - no blur on mobile for performance */}
      {shouldAnimate && (
        <motion.div
          className="absolute inset-0 pointer-events-none will-change-opacity"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{
            delay: delay,
            duration: 0.3,
            times: [0, 0.3, 1],
          }}
          style={{
            background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
            // Only use blur on desktop - expensive on mobile
            filter: isMobile ? undefined : "blur(20px)",
          }}
        />
      )}

      {/* Horizontal boot line */}
      {shouldAnimate && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none will-change-transform"
          style={{
            top: "50%",
            height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), rgba(139, 92, 246, 1), rgba(255,255,255,0.9), transparent)",
            boxShadow: "0 0 20px rgba(139, 92, 246, 1), 0 0 40px rgba(139, 92, 246, 0.5)",
            transformOrigin: "center",
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{
            scaleX: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            delay: delay,
            duration: bootDuration,
            times: [0, 0.3, 0.7, 1],
            ease: "easeOut",
          }}
        />
      )}

      {/* Card reveal with CRT expand effect */}
      <motion.div
        className="h-full will-change-transform"
        {...(shouldAnimate ? {
          initial: {
            clipPath: "polygon(0% 50%, 100% 50%, 100% 50%, 0% 50%)",
            opacity: 0,
          },
          animate: {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            opacity: 1,
          },
          transition: {
            delay: delay + 0.15,
            duration: bootDuration,
            ease: [0.25, 0.1, 0.25, 1],
            opacity: { delay: delay + 0.1, duration: 0.2 },
          },
        } : {})}
      >
        {/* Scanline overlay during boot - skip on mobile for performance */}
        {shouldAnimate && !isBooted && !isMobile && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-10 will-change-opacity"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ delay: delay + bootDuration, duration: CONTENT_FADE_DURATION }}
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 0, 0, 0.3) 2px,
                rgba(0, 0, 0, 0.3) 4px
              )`,
            }}
          />
        )}

        {/* Phosphor glow effect */}
        {shouldAnimate && (
          <motion.div
            className="absolute inset-0 pointer-events-none will-change-opacity"
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
          isLoading={!isBooted}
          isMobile={isMobile}
        />
      </motion.div>
    </div>
  );
}
