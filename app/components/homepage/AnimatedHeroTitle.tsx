"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

interface AnimatedHeroTitleProps {
  text: string;
  reducedMotion?: boolean;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

export function AnimatedHeroTitle({ text, reducedMotion = false }: AnimatedHeroTitleProps) {
  const [displayText, setDisplayText] = useState(reducedMotion ? text : "");
  const [isComplete, setIsComplete] = useState(reducedMotion);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    reducedMotion ? new Set(text.split("").map((_, i) => i)) : new Set()
  );

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    const totalDuration = 2000;
    const frameRate = 60;
    const totalFrames = (totalDuration / 1000) * frameRate;
    const revealInterval = totalFrames / text.length;

    let frame = 0;
    let currentRevealed = new Set<number>();

    const interval = setInterval(() => {
      frame++;

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
        clearInterval(interval);
        setDisplayText(text);
        setIsComplete(true);
        setRevealedIndices(new Set(text.split("").map((_, i) => i)));
      }
    }, 1000 / frameRate);

    return () => clearInterval(interval);
  }, [text, getRandomGlyph, reducedMotion]);

  return (
    <motion.h1
      className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center font-mono tracking-tight"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {displayText.split("").map((char, i) => {
        const isRevealed = revealedIndices.has(i);
        const isDot = text[i] === ".";

        return (
          <motion.span
            key={i}
            className={`inline-block ${isDot ? "text-purple-400" : "text-white"}`}
            animate={
              isComplete && !reducedMotion
                ? {
                    textShadow: [
                      "0 0 0px rgba(139, 92, 246, 0)",
                      "0 0 20px rgba(139, 92, 246, 0.8)",
                      "0 0 0px rgba(139, 92, 246, 0)",
                    ],
                  }
                : {}
            }
            transition={
              isComplete
                ? {
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }
                : {}
            }
            style={{
              opacity: isRevealed || reducedMotion ? 1 : 0.7,
              filter: isRevealed || reducedMotion ? "none" : "blur(1px)",
            }}
          >
            {char}
          </motion.span>
        );
      })}
    </motion.h1>
  );
}
