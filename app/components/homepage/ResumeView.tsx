"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
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

function TechCard({ tech, index, reducedMotion }: { tech: Technology; index: number; reducedMotion: boolean }) {
  const isLarge = tech.colSpan >= 2 && tech.rowSpan >= 2;
  const isMedium = tech.colSpan >= 2 || tech.rowSpan >= 2;
  const iconSize = isLarge ? "w-16 h-16" : isMedium ? "w-12 h-12" : "w-8 h-8";
  const textSize = isLarge ? "text-lg font-bold" : isMedium ? "text-sm font-semibold" : "text-xs font-medium";

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center gap-3 p-6"
      style={{
        gridColumn: `span ${tech.colSpan}`,
        gridRow: `span ${tech.rowSpan}`,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        minHeight: isLarge ? "200px" : isMedium ? "140px" : "100px",
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={reducedMotion ? { duration: 0 } : { delay: index * 0.03, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className={iconSize}>
        <Image src={tech.logo} alt={tech.name} width={64} height={64} unoptimized className="w-full h-full object-contain" />
      </div>
      <span className={`text-white ${textSize}`}>{tech.name}</span>
    </motion.div>
  );
}

export function ResumeView() {
  const reducedMotion = useReducedMotion();

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
            <TechCard key={tech.name} tech={tech} index={i} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
    </div>
  );
}
