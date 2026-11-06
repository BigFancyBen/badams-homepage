"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/app/hooks/useReducedMotion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

// ── Glitch text component ──────────────────────────────────────────

interface GlitchTextProps {
  text: string;
  started: boolean;
  duration?: number;
  glowOffsetStart: number;
  isComplete: boolean;
  onComplete: () => void;
}

function GlitchText({
  text,
  started,
  duration = 400,
  glowOffsetStart,
  isComplete,
  onComplete,
}: GlitchTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set()
  );
  const [selfComplete, setSelfComplete] = useState(false);
  const rafRef = useRef<number | null>(null);

  const getRandomGlyph = useCallback(() => {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }, []);

  useEffect(() => {
    if (!started) return;

    const frameRate = 60;
    const frameTime = 1000 / frameRate;
    const totalFrames = (duration / 1000) * frameRate;
    const revealInterval = totalFrames / text.length;

    let frame = 0;
    const currentRevealed = new Set<number>();
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
          setRevealedIndices(new Set(text.split("").map((_, i) => i)));
          setSelfComplete(true);
          onComplete();
          return;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [started, text, duration, getRandomGlyph, onComplete]);

  if (!started) return null;

  return (
    <>
      {displayText.split("").map((char, i) => {
        const isRevealed = revealedIndices.has(i);
        return (
          <span
            key={i}
            className={`inline-block will-change-transform text-white ${
              isComplete || selfComplete ? "animate-glow" : ""
            }`}
            style={{
              opacity: isRevealed ? 1 : 0.7,
              filter: isRevealed ? "none" : "blur(1px)",
              animationDelay:
                isComplete || selfComplete
                  ? `${(glowOffsetStart + i) * 0.15}s`
                  : "0s",
            }}
          >
            {char}
          </span>
        );
      })}
    </>
  );
}

// ── Animated dot component ─────────────────────────────────────────

interface AnimatedDotProps {
  visible: boolean;
  reducedMotion: boolean;
  glowIndex: number;
  isComplete: boolean;
  onLanded: () => void;
}

function AnimatedDot({
  visible,
  reducedMotion,
  glowIndex,
  isComplete,
  onLanded,
}: AnimatedDotProps) {
  const hasLanded = useRef(false);

  if (!visible) {
    return (
      <span
        className="inline-block will-change-transform text-white"
        style={{ opacity: 0 }}
      >
        .
      </span>
    );
  }

  return (
    <motion.span
      className={`inline-block will-change-transform text-white ${
        isComplete ? "animate-glow" : ""
      }`}
      initial={reducedMotion ? false : { opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 15,
        mass: 0.8,
      }}
      onAnimationComplete={() => {
        if (!hasLanded.current) {
          hasLanded.current = true;
          onLanded();
        }
      }}
      style={{
        animationDelay: isComplete ? `${glowIndex * 0.15}s` : "0s",
      }}
    >
      .
    </motion.span>
  );
}

// ── Main hero title ────────────────────────────────────────────────

interface AnimatedHeroTitleProps {
  text: string;
  onComplete?: () => void;
}

export function AnimatedHeroTitle({ text, onComplete }: AnimatedHeroTitleProps) {
  const [prefixDone, setPrefixDone] = useState(false);
  const [dotTimerFired, setDotTimerFired] = useState(false);
  const [dotLanded, setDotLanded] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const reducedMotion = useReducedMotion();

  const dotIndex = text.indexOf(".");
  const prefix = text.slice(0, dotIndex);
  const suffix = text.slice(dotIndex + 1);

  // After prefix completes, show dot after a brief pause (non-reduced-motion only)
  useEffect(() => {
    if (!prefixDone || reducedMotion) return;
    const timer = setTimeout(() => setDotTimerFired(true), 150);
    return () => clearTimeout(timer);
  }, [prefixDone, reducedMotion]);

  // Derive visibility: reduced motion skips the timer
  const dotVisible = prefixDone && (reducedMotion || dotTimerFired);
  const suffixStarted = reducedMotion ? dotVisible : dotLanded;

  const handlePrefixComplete = useCallback(() => {
    setPrefixDone(true);
  }, []);

  const handleDotLanded = useCallback(() => {
    setDotLanded(true);
  }, []);

  const handleSuffixComplete = useCallback(() => {
    setAllComplete(true);
    onComplete?.();
  }, [onComplete]);

  return (
    <motion.h1
      className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center font-mono tracking-tight"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <GlitchText
        text={prefix}
        started={true}
        duration={400}
        glowOffsetStart={0}
        isComplete={allComplete}
        onComplete={handlePrefixComplete}
      />
      <AnimatedDot
        visible={dotVisible}
        reducedMotion={reducedMotion}
        glowIndex={dotIndex}
        isComplete={allComplete}
        onLanded={handleDotLanded}
      />
      <GlitchText
        text={suffix}
        started={suffixStarted}
        duration={300}
        glowOffsetStart={dotIndex + 1}
        isComplete={allComplete}
        onComplete={handleSuffixComplete}
      />
    </motion.h1>
  );
}
