"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface AnimatedHeroTitleProps {
  text: string;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

export function AnimatedHeroTitle({ text }: AnimatedHeroTitleProps) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  useEffect(() => {
    const totalDuration = 400;
    // Full 60 FPS on all devices
    const frameRate = 60;
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
  }, [text, getRandomGlyph]);

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
              isComplete ? "animate-glow" : ""
            }`}
            style={{
              opacity: isRevealed ? 1 : 0.7,
              filter: isRevealed ? "none" : "blur(1px)",
              // Stagger animation delay using CSS custom property
              animationDelay: isComplete ? `${i * 0.15}s` : "0s",
            }}
          >
            {char}
          </span>
        );
      })}
    </motion.h1>
  );
}
