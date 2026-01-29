"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { useMobileDevice } from "@/app/hooks/useMobileDevice";

interface AnimatedHeroTitleProps {
  text: string;
  reducedMotion?: boolean;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

export function AnimatedHeroTitle({ text, reducedMotion = false }: AnimatedHeroTitleProps) {
  const isMobile = useMobileDevice();
  const [displayText, setDisplayText] = useState(reducedMotion ? text : "");
  const [isComplete, setIsComplete] = useState(reducedMotion);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    reducedMotion ? new Set(text.split("").map((_, i) => i)) : new Set()
  );
  const rafRef = useRef<number | null>(null);

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    const totalDuration = 1000;
    // Use lower frame rate on mobile for performance
    const frameRate = isMobile ? 30 : 60;
    const frameTime = 1000 / frameRate;
    const totalFrames = (totalDuration / 1000) * frameRate;
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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [text, getRandomGlyph, reducedMotion, isMobile]);

  return (
    <motion.h1
      className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center font-mono tracking-tight"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {displayText.split("").map((char, i) => {
        const isRevealed = revealedIndices.has(i);
        const isDot = text[i] === ".";

        return (
          <span
            key={i}
            className={`inline-block will-change-transform ${isDot ? "text-purple-400" : "text-white"} ${
              isComplete && !reducedMotion ? "animate-glow" : ""
            }`}
            style={{
              opacity: isRevealed || reducedMotion ? 1 : 0.7,
              filter: isRevealed || reducedMotion ? "none" : "blur(1px)",
              // Stagger animation delay using CSS custom property
              animationDelay: isComplete && !reducedMotion ? `${i * 0.15}s` : "0s",
            }}
          >
            {char}
          </span>
        );
      })}
    </motion.h1>
  );
}
