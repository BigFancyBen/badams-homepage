"use client";

import { motion } from "motion/react";
import { CompactCard } from "./CompactCard";
import { GroupShowcase } from "./GroupShowcase";
import { TabletCarousel } from "./TabletCarousel";

interface Project {
  title: string;
  description: string;
  href?: string;
  tags?: string;
}

export interface ProjectGroup {
  title: string;
  subtitle: string;
  accentColor: string;
  icon: React.ReactNode;
  projects: Project[];
  screenshots?: { src: string; label: string; bg?: string }[];
}

interface ProjectSectionProps {
  group: ProjectGroup;
  index: number;
}

const CARD_STAGGER = 0.1;

export function ProjectSection({ group, index }: ProjectSectionProps) {
  const isReversed = index % 2 === 1;

  return (
    <motion.section
      className="w-full"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Section header */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          {group.title}
        </h2>
        <p className="text-gray-400 mt-1 text-sm">{group.subtitle}</p>
        <div
          className="h-0.5 w-16 mt-3"
          style={{ background: group.accentColor }}
        />
      </div>

      {group.screenshots ? (
        /* Two-column layout — cards on left, tablet on right */
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* Left — Project cards */}
          <div className="w-full md:w-[40%] grid grid-cols-1 gap-5">
            {group.projects.map((project, i) => (
              <motion.div
                key={project.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  delay: i * CARD_STAGGER,
                  duration: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <CompactCard
                  title={project.title}
                  description={project.description}
                  href={project.href}
                  tags={project.tags}
                  accentColor={group.accentColor}
                />
              </motion.div>
            ))}
          </div>

          {/* Right — Tablet carousel */}
          <div className="w-full md:w-[60%] flex justify-center">
            <TabletCarousel screenshots={group.screenshots} />
          </div>
        </div>
      ) : (
        /* Two-column layout */
        <div
          className={`flex flex-col md:flex-row gap-6 ${isReversed ? "md:flex-row-reverse" : ""}`}
        >
          {/* Showcase panel — 40% on desktop */}
          <div className="w-full md:w-[40%]">
            <GroupShowcase
              groupTitle={group.title}
              accentColor={group.accentColor}
              icon={group.icon}
            />
          </div>

          {/* Project cards — 60% on desktop */}
          <div className="w-full md:w-[60%] grid grid-cols-1 lg:grid-cols-2 gap-5">
            {group.projects.map((project, i) => (
              <motion.div
                key={project.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  delay: i * CARD_STAGGER,
                  duration: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <CompactCard
                  title={project.title}
                  description={project.description}
                  href={project.href}
                  tags={project.tags}
                  accentColor={group.accentColor}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
