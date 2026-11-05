"use client";

import { motion, AnimatePresence } from "motion/react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface BentoCardProps {
  title: string;
  subtitle?: string;
  description: string;
  href?: string;
  accentColor: string;
  colSpan?: number;
  rowSpan?: number;
  children?: React.ReactNode;
  index?: number;
  fixedDescriptionHeight?: string;
  onHover?: () => void;
  tags?: string[];
  /** 2 for a card that stands alone in the grid, 3 for one nested under a group heading. */
  headingLevel?: 2 | 3;
}

export function BentoCard({
  title,
  subtitle,
  description,
  href,
  accentColor,
  colSpan = 1,
  rowSpan = 1,
  children,
  index = 0,
  fixedDescriptionHeight,
  onHover,
  tags,
  headingLevel = 2,
}: BentoCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const reducedMotion = useReducedMotion();

  // Typography sizing based on card dimensions
  const isLarge = colSpan >= 3 && rowSpan >= 2;
  const isMedium = colSpan >= 2 || rowSpan >= 2;
  const titleClass = isLarge ? "text-lg" : isMedium ? "text-base" : "text-sm";
  const descClass = isLarge ? "text-sm" : isMedium ? "text-sm" : "text-xs";

  const spanClasses = [
    colSpan === 2 ? "md:col-span-2" : "",
    colSpan === 3 ? "lg:col-span-3" : "",
    rowSpan === 2 ? "md:row-span-2" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const card = (
    <motion.div
      className={`relative h-full ${spanClasses}`}
      onMouseEnter={onHover}
      initial={reducedMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              delay: index * 0.08,
              duration: 0.5,
              ease: [0.25, 0.1, 0.25, 1],
            }
      }
    >
      <div
        className="relative h-full"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Content */}
        <div className="p-5 h-full flex flex-col">
          {/* Header */}
          <div className="mb-2">
            <Heading className={`${titleClass} font-bold text-white`}>{title}</Heading>
            {subtitle && (
              <AnimatePresence mode="wait">
                <motion.p
                  key={subtitle}
                  className="text-gray-400 text-xs mt-0.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {subtitle}
                </motion.p>
              </AnimatePresence>
            )}
          </div>

          {/* Description */}
          <div
            className="mb-3 overflow-hidden"
            style={fixedDescriptionHeight ? { height: fixedDescriptionHeight } : undefined}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={description}
                className={`text-gray-400 ${descClass} leading-relaxed`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {description}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Tech stack tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px]"
                  style={{
                    color: accentColor,
                    borderWidth: 1,
                    borderColor: `${accentColor}30`,
                    backgroundColor: `${accentColor}12`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Embedded content (carousels, etc.) */}
          {children && <div className="flex-1">{children}</div>}

          {/* Link CTA */}
          {href && (
            <div className={`mt-auto pt-2 ${href.startsWith("http") ? "text-center" : "text-left"}`}>
              <a
                href={href}
                className="group/link text-xs font-medium text-white inline-flex items-center gap-1.5 relative z-20"
                {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {href.startsWith("http") ? (
                  href.includes("youtube.com") || href.includes("youtu.be") ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    Watch on YouTube
                  </>
                  ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    View on GitHub
                  </>
                  )
                ) : (
                  <>View project &rarr;</>
                )}
                <span className="absolute bottom-0 left-0 h-px w-0 bg-white transition-all duration-300 ease-out group-hover/link:w-full" />
              </a>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  return <div className={`h-full ${spanClasses}`}>{card}</div>;
}
