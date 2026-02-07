"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface AnimatedHeroTitleProps {
  text: string;
  reducedMotion?: boolean;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

export function AnimatedHeroTitle({
  text,
  reducedMotion = false,
}: AnimatedHeroTitleProps) {
  const [displayText, setDisplayText] = useState(reducedMotion ? text : "");
  const [isComplete, setIsComplete] = useState(reducedMotion);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    reducedMotion ? new Set(text.split("").map((_, i) => i)) : new Set()
  );
  const [isGlitching, setIsGlitching] = useState(false);
  const rafRef = useRef<number | null>(null);
  const glitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  // Text scramble decode animation
  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    const frameTime = 1000 / 60;
    const totalFrames = 60;
    const revealInterval = totalFrames / text.length;

    let frame = 0;
    let currentRevealed = new Set<number>();
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTime;

      if (elapsed >= frameTime) {
        frame++;
        lastTime = currentTime - (elapsed % frameTime);

        const shouldRevealCount = Math.floor(frame / revealInterval);

        for (let i = 0; i < shouldRevealCount && i < text.length; i++) {
          currentRevealed.add(i);
        }

        const newText = text
          .split("")
          .map((char, i) => {
            if (char === " ") return " ";
            if (char === ".") return ".";
            if (currentRevealed.has(i)) return char;
            return getRandomGlyph();
          })
          .join("");

        setDisplayText(newText);
        setRevealedIndices(new Set(currentRevealed));

        if (currentRevealed.size >= text.length) {
          setDisplayText(text);
          setIsComplete(true);
          setRevealedIndices(new Set(text.split("").map((_, i) => i)));
          return;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, getRandomGlyph, reducedMotion]);

  // Periodic glitch bursts after scramble completes
  useEffect(() => {
    if (!isComplete || reducedMotion) return;

    const scheduleGlitch = () => {
      const delay = 3000 + Math.random() * 4000;
      glitchTimeoutRef.current = setTimeout(() => {
        setIsGlitching(true);
        setTimeout(() => {
          setIsGlitching(false);
          scheduleGlitch();
        }, 200 + Math.random() * 150);
      }, delay);
    };

    // First glitch after a shorter initial delay
    glitchTimeoutRef.current = setTimeout(() => {
      setIsGlitching(true);
      setTimeout(() => {
        setIsGlitching(false);
        scheduleGlitch();
      }, 250);
    }, 1500);

    return () => {
      if (glitchTimeoutRef.current) clearTimeout(glitchTimeoutRef.current);
    };
  }, [isComplete, reducedMotion]);

  const titleClasses =
    "text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center font-mono tracking-tight";

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Main text */}
      <h1
        className={`${titleClasses} relative ${isGlitching ? "animate-glitch-jitter" : ""}`}
      >
        {displayText.split("").map((char, i) => {
          const isRevealed = revealedIndices.has(i);
          const isDot = text[i] === ".";

          return (
            <span
              key={i}
              className={`inline-block ${isDot ? "text-purple-400" : "text-white"}`}
              style={{
                opacity: isRevealed || reducedMotion ? 1 : 0.7,
                filter: isRevealed || reducedMotion ? "none" : "blur(1px)",
              }}
            >
              {char}
            </span>
          );
        })}
      </h1>

      {/* Glitch RGB-split layers - only rendered during glitch bursts */}
      {isGlitching && !reducedMotion && (
        <>
          <span
            className={`${titleClasses} absolute inset-0 text-cyan-400 animate-glitch-slice-1 pointer-events-none select-none`}
            aria-hidden="true"
            style={{ mixBlendMode: "screen", opacity: 0.8 }}
          >
            {text}
          </span>
          <span
            className={`${titleClasses} absolute inset-0 text-red-400 animate-glitch-slice-2 pointer-events-none select-none`}
            aria-hidden="true"
            style={{ mixBlendMode: "screen", opacity: 0.8 }}
          >
            {text}
          </span>
        </>
      )}
    </motion.div>
  );
}
