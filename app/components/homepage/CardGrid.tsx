"use client";

import { useRef } from "react";
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.85,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
      mass: 0.8,
    },
  },
};

const reducedVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const variants = reducedMotion ? reducedVariants : cardVariants;
  const container = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : containerVariants;

  return (
    <motion.div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      variants={container}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {projects.map((project) => (
        <motion.div key={project.title} variants={variants} className="h-full">
          <AnimatedCard
            title={project.title}
            description={project.description}
            href={project.href}
            tags={project.tags}
            reducedMotion={reducedMotion}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
