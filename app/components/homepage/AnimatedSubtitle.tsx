"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface AnimatedSubtitleProps {
  text: string;
  startDelay?: number;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

export function AnimatedSubtitle({
  text,
  startDelay = 1200,
}: AnimatedSubtitleProps) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set()
  );
  const rafRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Split main text and parenthetical
  const parenStart = text.indexOf("(");
  const mainText = parenStart !== -1 ? text.slice(0, parenStart).trimEnd() : text;
  const parenText = parenStart !== -1 ? text.slice(parenStart) : "";

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  useEffect(() => {
    delayRef.current = setTimeout(() => {
      setStarted(true);
    }, startDelay);

    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;

    const totalDuration = 500;
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
  }, [started, text, getRandomGlyph]);

  if (!started) return null;

  const renderChars = (str: string, startIndex: number, className: string) =>
    str.split("").map((char, j) => {
      const i = startIndex + j;
      const isRevealed = revealedIndices.has(i);
      return (
        <span
          key={i}
          className={`inline-block will-change-transform ${className} ${
            isComplete ? "animate-glow" : ""
          }`}
          style={{
            opacity: isRevealed ? 1 : 0.7,
            filter: isRevealed ? "none" : "blur(1px)",
            animationDelay: isComplete ? `${i * 0.15}s` : "0s",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      );
    });

  return (
    <motion.div
      className="text-center font-mono tracking-tight italic py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <p className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap">
        {renderChars(displayText.slice(0, mainText.length), 0, "text-white")}
      </p>
      {parenText && (
        <p className="text-sm sm:text-base md:text-lg font-medium text-white/60 mt-1">
          {renderChars(
            displayText.slice(mainText.length + 1),
            mainText.length + 1,
            "text-white/60"
          )}
        </p>
      )}
    </motion.div>
  );
}
