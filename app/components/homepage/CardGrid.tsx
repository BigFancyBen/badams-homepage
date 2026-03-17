"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AnimatedCard } from "./AnimatedCard";

interface Project {
  title: string;
  description: string;
  href?: string;
  tags?: string;
}

interface CardGridProps {
  projects: Project[];
}

const STAGGER_DELAY = 0.15;

export function CardGrid({ projects }: CardGridProps) {
  const [animatedCards, setAnimatedCards] = useState<Set<number>>(new Set());

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.title}
          className="h-full"
          style={animatedCards.has(index) ? undefined : { pointerEvents: "none" }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: index * STAGGER_DELAY,
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          onAnimationComplete={() => {
            setAnimatedCards((prev) => new Set(prev).add(index));
          }}
        >
          <AnimatedCard
            title={project.title}
            description={project.description}
            href={project.href}
            tags={project.tags}
          />
        </motion.div>
      ))}
    </div>
  );
}
