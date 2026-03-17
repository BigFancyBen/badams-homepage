"use client";

import { useRef, MouseEvent, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Link from "next/link";

interface Technology {
  name: string;
  logo: string;
  tier: 1 | 2 | 3;
  accentColor: string;
}

const TECHNOLOGIES: Technology[] = [
  // Tier 1 — Large cells
  { name: "React", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg", tier: 1, accentColor: "#61dafb" },
  { name: "TypeScript", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg", tier: 1, accentColor: "#3178c6" },
  { name: "Next.js", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg", tier: 1, accentColor: "#ffffff" },
  { name: "Tailwind CSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg", tier: 1, accentColor: "#06b6d4" },
  // Tier 2 — Medium cells
  { name: "JavaScript", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg", tier: 2, accentColor: "#f7df1e" },
  { name: "GraphQL", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg", tier: 2, accentColor: "#e10098" },
  { name: "Node.js", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg", tier: 2, accentColor: "#339933" },
  { name: "PostgreSQL", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg", tier: 2, accentColor: "#4169e1" },
  { name: "Vercel", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg", tier: 2, accentColor: "#ffffff" },
  { name: "Redux", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redux/redux-original.svg", tier: 2, accentColor: "#764abc" },
  // Tier 3 — Standard cells
  { name: "Zustand", logo: "https://raw.githubusercontent.com/pmndrs/zustand/main/bear.jpg", tier: 3, accentColor: "#443e38" },
  { name: "TanStack", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/reactrouter/reactrouter-original.svg", tier: 3, accentColor: "#ef4444" },
  { name: "Apollo", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg", tier: 3, accentColor: "#311c87" },
  { name: "Supabase", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/supabase/supabase-original.svg", tier: 3, accentColor: "#3ecf8e" },
  { name: "Express", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg", tier: 3, accentColor: "#ffffff" },
  { name: "SCSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/sass/sass-original.svg", tier: 3, accentColor: "#cc6699" },
  { name: "HTML", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg", tier: 3, accentColor: "#e34f26" },
  { name: "CSS", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg", tier: 3, accentColor: "#1572b6" },
  { name: "Cypress", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cypressio/cypressio-original.svg", tier: 3, accentColor: "#69d3a7" },
  { name: "Playwright", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/playwright/playwright-original.svg", tier: 3, accentColor: "#2ead33" },
  { name: "Jest", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg", tier: 3, accentColor: "#c21325" },
  { name: "Storybook", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/storybook/storybook-original.svg", tier: 3, accentColor: "#ff4785" },
  { name: "Webpack", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/webpack/webpack-original.svg", tier: 3, accentColor: "#8dd6f9" },
  { name: "Babel", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/babel/babel-original.svg", tier: 3, accentColor: "#f9dc3e" },
  { name: "Git", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg", tier: 3, accentColor: "#f05032" },
  { name: "Figma", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg", tier: 3, accentColor: "#f24e1e" },
  { name: "Python", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg", tier: 3, accentColor: "#3776ab" },
  { name: "Angular", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angular/angular-original.svg", tier: 3, accentColor: "#dd0031" },
  { name: "Django", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg", tier: 3, accentColor: "#092e20" },
  { name: "Flask", logo: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg", tier: 3, accentColor: "#ffffff" },
];

function TechCard({ tech, index }: { tech: Technology; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const hoverValue = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 20 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const glowX = useTransform(smoothX, [0, 1], [0, 100]);
  const glowY = useTransform(smoothY, [0, 1], [0, 100]);

  const borderGlow = useSpring(useTransform(hoverValue, [0, 1], [0, 1]), {
    stiffness: 200,
    damping: 20,
  });

  const glowBackground = useTransform(
    [glowX, glowY],
    ([x, y]) =>
      `radial-gradient(circle at ${x}% ${y}%, ${tech.accentColor}25, transparent 60%)`
  );

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const colSpanClass = tech.tier === 1 ? "md:col-span-2" : "";
  const rowSpanClass = tech.tier === 1 ? "md:row-span-2" : "";
  const iconSize = tech.tier === 1 ? "w-16 h-16" : tech.tier === 2 ? "w-12 h-12" : "w-8 h-8";
  const textSize = tech.tier === 1 ? "text-lg font-bold" : tech.tier === 2 ? "text-sm font-semibold" : "text-xs font-medium";

  return (
    <motion.div
      ref={cardRef}
      className={`relative ${colSpanClass} ${rowSpanClass}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => { setIsHovered(true); hoverValue.set(1); }}
      onMouseLeave={() => { setIsHovered(false); hoverValue.set(0); mouseX.set(0.5); mouseY.set(0.5); }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div
        className="relative h-full overflow-hidden flex flex-col items-center justify-center gap-3 p-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${isHovered ? tech.accentColor : "rgba(255,255,255,0.06)"}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "border-color 0.3s ease, transform 0.3s ease",
          transform: isHovered ? "translateY(-2px)" : "translateY(0)",
          minHeight: tech.tier === 1 ? "200px" : tech.tier === 2 ? "140px" : "100px",
        }}
      >
        {/* Mouse glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: glowBackground, opacity: borderGlow }}
        />

        {/* Logo */}
        <div className={`relative z-10 ${iconSize}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tech.logo}
            alt={tech.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>

        {/* Name */}
        <span className={`relative z-10 text-white ${textSize}`}>
          {tech.name}
        </span>
      </div>
    </motion.div>
  );
}

export default function ResumePage() {
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

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-24">
        <h1 className="text-3xl font-bold text-white mb-2">Technologies</h1>
        <p className="text-gray-400 text-sm mb-10">Tools and frameworks I work with</p>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          style={{ gridAutoRows: "minmax(100px, auto)" }}
        >
          {TECHNOLOGIES.map((tech, i) => (
            <TechCard key={tech.name} tech={tech} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
