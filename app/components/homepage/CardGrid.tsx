"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import { AnimatedCard } from "./AnimatedCard";

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

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [bootedCards, setBootedCards] = useState<Set<number>>(
    () => reducedMotion ? new Set(projects.map((_, i) => i)) : new Set()
  );

  useEffect(() => {
    if (!isInView || reducedMotion) return;

    const timeouts: NodeJS.Timeout[] = [];

    projects.forEach((_, index) => {
      const bootCompleteTime = (index * STAGGER_DELAY + BOOT_DURATION + CONTENT_FADE_DURATION) * 1000;

      const timeout = setTimeout(() => {
        setBootedCards((prev) => new Set(prev).add(index));
      }, bootCompleteTime);

      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [isInView, projects, reducedMotion]);

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
}

function CRTBootCard({ project, index, isInView, reducedMotion, isBooted }: CRTBootCardProps) {
  const delay = index * STAGGER_DELAY;
  const shouldAnimate = isInView && !reducedMotion;

  return (
    <div className="h-full relative">
      {/* CRT Power-on glow */}
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
            filter: "blur(20px)",
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
          animate={{
            scaleX: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            delay: delay,
            duration: BOOT_DURATION,
            times: [0, 0.3, 0.7, 1],
            ease: "easeOut",
          }}
        />
      )}

      {/* Card reveal with CRT expand effect */}
      <motion.div
        className="h-full"
        initial={reducedMotion ? { opacity: 1 } : {
          clipPath: "polygon(0% 50%, 100% 50%, 100% 50%, 0% 50%)",
          opacity: 0,
        }}
        animate={shouldAnimate ? {
          clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
          opacity: 1,
        } : { opacity: 1 }}
        transition={{
          delay: delay + 0.15,
          duration: BOOT_DURATION,
          ease: [0.25, 0.1, 0.25, 1],
          opacity: { delay: delay + 0.1, duration: 0.2 },
        }}
      >
        {/* Scanline overlay during boot */}
        {shouldAnimate && !isBooted && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ delay: delay + BOOT_DURATION, duration: CONTENT_FADE_DURATION }}
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
          isLoading={!isBooted}
        />
      </motion.div>
    </div>
  );
}
