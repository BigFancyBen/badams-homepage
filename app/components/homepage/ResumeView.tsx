"use client";

import { useRef, useEffect, MouseEvent, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useAmbientGlow } from "@/app/hooks/useAmbientGlow";
import { useReducedMotion } from "@/app/hooks/useReducedMotion";

interface Technology {
  name: string;
  logo: string;
  accentColor: string;
  colSpan: number;
  rowSpan: number;
}

const TECHNOLOGIES: Technology[] = [
  // Row 1-2: Big hitters
  { name: "React", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg", accentColor: "#61dafb", colSpan: 3, rowSpan: 2 },
  { name: "TypeScript", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg", accentColor: "#3178c6", colSpan: 2, rowSpan: 3 },
  { name: "GraphQL", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg", accentColor: "#e10098", colSpan: 1, rowSpan: 3 },
  // Row 2-3
  { name: "Next.js", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg", accentColor: "#ffffff", colSpan: 2, rowSpan: 2 },
  { name: "Node.js", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg", accentColor: "#339933", colSpan: 1, rowSpan: 2 },
  // Row 3-4
  { name: "Tailwind CSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg", accentColor: "#06b6d4", colSpan: 3, rowSpan: 2 },
  { name: "JavaScript", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg", accentColor: "#f7df1e", colSpan: 1, rowSpan: 1 },
  { name: "PostgreSQL", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg", accentColor: "#4169e1", colSpan: 1, rowSpan: 1 },
  { name: "Redux", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redux/redux-original.svg", accentColor: "#764abc", colSpan: 1, rowSpan: 1 },
  // Row 5+: Smaller techs in varied sizes
  { name: "Vercel", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg", accentColor: "#ffffff", colSpan: 2, rowSpan: 1 },
  { name: "Zustand", logo: "https://raw.githubusercontent.com/pmndrs/zustand/main/bear.jpg", accentColor: "#443e38", colSpan: 1, rowSpan: 1 },
  { name: "Supabase", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg", accentColor: "#3ecf8e", colSpan: 2, rowSpan: 2 },
  { name: "TanStack", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/reactrouter/reactrouter-original.svg", accentColor: "#ef4444", colSpan: 1, rowSpan: 1 },
  { name: "Apollo", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg", accentColor: "#311c87", colSpan: 1, rowSpan: 1 },
  { name: "Express", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg", accentColor: "#ffffff", colSpan: 1, rowSpan: 1 },
  { name: "Python", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg", accentColor: "#3776ab", colSpan: 1, rowSpan: 2 },
  { name: "SCSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg", accentColor: "#cc6699", colSpan: 1, rowSpan: 1 },
  { name: "HTML", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg", accentColor: "#e34f26", colSpan: 1, rowSpan: 1 },
  { name: "CSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg", accentColor: "#1572b6", colSpan: 1, rowSpan: 1 },
  { name: "Playwright", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/playwright/playwright-original.svg", accentColor: "#2ead33", colSpan: 2, rowSpan: 1 },
  { name: "Cypress", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cypressio/cypressio-original.svg", accentColor: "#69d3a7", colSpan: 1, rowSpan: 1 },
  { name: "Jest", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg", accentColor: "#c21325", colSpan: 1, rowSpan: 1 },
  { name: "Storybook", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/storybook/storybook-original.svg", accentColor: "#ff4785", colSpan: 1, rowSpan: 1 },
  { name: "Angular", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angular/angular-original.svg", accentColor: "#dd0031", colSpan: 1, rowSpan: 1 },
  { name: "Webpack", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/webpack/webpack-original.svg", accentColor: "#8dd6f9", colSpan: 1, rowSpan: 1 },
  { name: "Git", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg", accentColor: "#f05032", colSpan: 2, rowSpan: 1 },
  { name: "Figma", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg", accentColor: "#f24e1e", colSpan: 1, rowSpan: 1 },
  { name: "Babel", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/babel/babel-original.svg", accentColor: "#f9dc3e", colSpan: 1, rowSpan: 1 },
  { name: "Django", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg", accentColor: "#092e20", colSpan: 1, rowSpan: 1 },
  { name: "Flask", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg", accentColor: "#ffffff", colSpan: 1, rowSpan: 1 },
];

function TechCard({
  tech,
  index,
  isAmbientActive,
  onHoverChange,
}: {
  tech: Technology;
  index: number;
  isAmbientActive: boolean;
  onHoverChange: (index: number, hovered: boolean) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const hoverValue = useMotionValue(0);

  const springConfig = { stiffness: 200, damping: 20 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const glowX = useTransform(smoothX, [0, 1], [0, 100]);
  const glowY = useTransform(smoothY, [0, 1], [0, 100]);

  const rotateX = useTransform(smoothY, [0, 1], [8, -8]);
  const rotateY = useTransform(smoothX, [0, 1], [-8, 8]);

  const borderGlow = useSpring(useTransform(hoverValue, [0, 1], [0, 1]), {
    stiffness: 200,
    damping: 20,
  });

  const glowBackground = useTransform(
    [glowX, glowY],
    ([x, y]) =>
      `radial-gradient(circle at ${x}% ${y}%, ${tech.accentColor}40, ${tech.accentColor}10 40%, transparent 70%)`
  );

  // Ambient glow drift effect - slowly oscillate mouse position when ambient-active
  useEffect(() => {
    if (!isAmbientActive || isHovered) return;

    hoverValue.set(0.5);
    let frame: number;
    const startTime = Date.now();

    const drift = () => {
      const t = (Date.now() - startTime) / 1000;
      mouseX.set(0.5 + 0.3 * Math.sin(t * 0.7));
      mouseY.set(0.5 + 0.3 * Math.cos(t * 0.5));
      frame = requestAnimationFrame(drift);
    };
    frame = requestAnimationFrame(drift);

    return () => {
      cancelAnimationFrame(frame);
      if (!isHovered) {
        hoverValue.set(0);
        mouseX.set(0.5);
        mouseY.set(0.5);
      }
    };
  }, [isAmbientActive, isHovered, hoverValue, mouseX, mouseY]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const isLarge = tech.colSpan >= 2 && tech.rowSpan >= 2;
  const isMedium = tech.colSpan >= 2 || tech.rowSpan >= 2;
  const iconSize = isLarge ? "w-16 h-16" : isMedium ? "w-12 h-12" : "w-8 h-8";
  const textSize = isLarge ? "text-lg font-bold" : isMedium ? "text-sm font-semibold" : "text-xs font-medium";

  const isActive = isHovered || isAmbientActive;
  const intensity = isHovered ? 1 : isAmbientActive ? 0.5 : 0;

  return (
    <motion.div
      ref={cardRef}
      className="relative"
      style={{
        perspective: 600,
        gridColumn: `span ${tech.colSpan}`,
        gridRow: `span ${tech.rowSpan}`,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { setIsHovered(true); onHoverChange(index, true); hoverValue.set(1); }}
      onMouseLeave={() => { setIsHovered(false); onHoverChange(index, false); hoverValue.set(isAmbientActive ? 0.5 : 0); mouseX.set(0.5); mouseY.set(0.5); }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.div
        className="relative h-full overflow-hidden flex flex-col items-center justify-center gap-3 p-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${isActive ? `${tech.accentColor}${isHovered ? "80" : "40"}` : "rgba(255,255,255,0.06)"}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
          boxShadow: isActive
            ? `0 8px 32px ${tech.accentColor}${isHovered ? "20" : "10"}, 0 0 0 1px ${tech.accentColor}${isHovered ? "15" : "08"}, inset 0 1px 0 ${tech.accentColor}${isHovered ? "10" : "06"}`
            : "0 0 0 0 transparent",
          minHeight: isLarge ? "200px" : isMedium ? "140px" : "100px",
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Mouse glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: glowBackground, opacity: borderGlow }}
        />

        {/* Logo */}
        <motion.div
          className={`relative z-10 ${iconSize}`}
          animate={{ scale: isHovered ? 1.15 : isAmbientActive ? 1.075 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Image
            src={tech.logo}
            alt={tech.name}
            width={64}
            height={64}
            unoptimized
            className="w-full h-full object-contain drop-shadow-none"
            style={{
              filter: isActive
                ? `drop-shadow(0 0 ${isHovered ? "8px" : "5px"} ${tech.accentColor}${isHovered ? "60" : "30"})`
                : "none",
              transition: "filter 0.3s ease",
            }}
          />
        </motion.div>

        {/* Name */}
        <span
          className={`relative z-10 text-white ${textSize}`}
          style={{
            textShadow: isActive
              ? `0 0 12px ${tech.accentColor}${intensity >= 1 ? "50" : "28"}`
              : "none",
            transition: "text-shadow 0.3s ease",
          }}
        >
          {tech.name}
        </span>
      </motion.div>
    </motion.div>
  );
}

export function ResumeView() {
  const reducedMotion = useReducedMotion();
  const [anyHovered, setAnyHovered] = useState(false);
  const hoverCountRef = useRef(0);

  const ambientActiveIndices = useAmbientGlow(
    TECHNOLOGIES.length,
    reducedMotion,
    anyHovered
  );

  const handleHoverChange = useCallback((_index: number, hovered: boolean) => {
    hoverCountRef.current += hovered ? 1 : -1;
    setAnyHovered(hoverCountRef.current > 0);
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: "#0a0a0a" }}>
      {/* Back link */}
      <div className="fixed top-4 left-4 z-50">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Home
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-20 pb-24">
        <h1 className="text-3xl font-bold text-white mb-2">Technologies</h1>
        <p className="text-gray-400 text-sm mb-10">Tools and frameworks I work with</p>

        <div
          className="grid grid-cols-3 md:grid-cols-6 gap-3"
          style={{ gridAutoRows: "minmax(80px, auto)" }}
        >
          {TECHNOLOGIES.map((tech, i) => (
            <TechCard
              key={tech.name}
              tech={tech}
              index={i}
              isAmbientActive={ambientActiveIndices.has(i)}
              onHoverChange={handleHoverChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
