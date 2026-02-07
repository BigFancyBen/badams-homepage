"use client";

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

const STAGGER_DELAY = 0.15;

export function CardGrid({ projects, reducedMotion = false }: CardGridProps) {
  const isMobile = useMobileDevice();

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
              isMobile={isMobile}
            />
          </div>
        ))}
      </div>
    );
  }

  // Animated version - animation is handled inside AnimatedCard
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project, index) => (
        <AnimatedCard
          key={project.title}
          title={project.title}
          description={project.description}
          href={project.href}
          tags={project.tags}
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          animationDelay={1.2 + index * STAGGER_DELAY}
        />
      ))}
    </div>
  );
}
