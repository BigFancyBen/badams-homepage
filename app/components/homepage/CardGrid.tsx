"use client";

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
  reducedMotion?: boolean;
}

const STAGGER_DELAY = 0.15;

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  // If reduced motion, render without animations
  if (reducedMotion) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <div key={project.title} className="h-full">
            <AnimatedCard
              title={project.title}
              description={project.description}
              href={project.href}
              tags={project.tags}
              reducedMotion={reducedMotion}
            />
          </div>
        ))}
      </div>
    );
  }

  // Animated version
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.title}
          className="h-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 1.2 + index * STAGGER_DELAY,
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          <AnimatedCard
            title={project.title}
            description={project.description}
            href={project.href}
            tags={project.tags}
            reducedMotion={reducedMotion}
          />
        </motion.div>
      ))}
    </div>
  );
}
