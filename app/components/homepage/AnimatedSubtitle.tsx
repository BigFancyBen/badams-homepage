"use client";

import { isValidElement } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";

interface AnimatedSubtitleProps {
  text: React.ReactNode;
  startDelay?: number;
}

type SubtitleToken =
  | { type: "char"; char: string }
  | { type: "br"; className?: string };

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

function tokenizeSubtitleText(node: React.ReactNode): SubtitleToken[] {
  const tokens: SubtitleToken[] = [];

  const walk = (value: React.ReactNode) => {
    if (value === null || value === undefined || typeof value === "boolean") {
      return;
    }

    if (typeof value === "string" || typeof value === "number") {
      const stringValue = String(value);
      for (const char of stringValue) {
        tokens.push({ type: "char", char });
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (isValidElement(value)) {
      const element = value as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;

      if (element.type === "br") {
        tokens.push({
          type: "br",
          className:
            typeof element.props?.className === "string"
              ? element.props.className
              : undefined,
        });
        return;
      }

      walk(element.props?.children);
    }
  };

  walk(node);
  return tokens;
}

function countChars(tokens: SubtitleToken[]): number {
  return tokens.reduce((count, token) => {
    return token.type === "char" ? count + 1 : count;
  }, 0);
}

export function AnimatedSubtitle({
  text,
  startDelay = 1200,
}: AnimatedSubtitleProps) {
  const tokens = tokenizeSubtitleText(text);
  const plainText = tokens
    .filter((token) => token.type === "char")
    .map((token) => token.char)
    .join("");

  const mainTokens: SubtitleToken[] = [];
  const parenTokens: SubtitleToken[] = [];
  let hasFoundParen = false;

  tokens.forEach((token) => {
    if (!hasFoundParen && token.type === "char" && token.char === "(") {
      hasFoundParen = true;
    }

    if (hasFoundParen) {
      parenTokens.push(token);
    } else {
      mainTokens.push(token);
    }
  });

  const mainCharCount = countChars(mainTokens);

  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [started, setStarted] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    new Set()
  );
  const rafRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (plainText.length === 0) {
      setIsComplete(true);
      return;
    }

    const totalDuration = 500;
    const frameRate = 60;
    const frameTime = 1000 / frameRate;
    const totalFrames = (totalDuration / 1000) * frameRate;
    const revealInterval = totalFrames / plainText.length;

    let frame = 0;
    let currentRevealed = new Set<number>();
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - lastTime;

      if (elapsed >= frameTime) {
        frame++;
        lastTime = currentTime - (elapsed % frameTime);

        const shouldRevealCount = Math.floor(frame / revealInterval);

        for (let i = 0; i < shouldRevealCount && i < plainText.length; i++) {
          currentRevealed.add(i);
        }

        const newText = plainText
          .split("")
          .map((char, i) => {
            if (char === " ") return " ";
            if (currentRevealed.has(i)) return char;
            return getRandomGlyph();
          })
          .join("");

        setDisplayText(newText);
        setRevealedIndices(new Set(currentRevealed));

        if (currentRevealed.size >= plainText.length) {
          setDisplayText(plainText);
          setIsComplete(true);
          setRevealedIndices(new Set(plainText.split("").map((_, i) => i)));
          return;
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [started, plainText, getRandomGlyph]);

  if (!started) return null;

  const renderTokens = (
    tokenList: SubtitleToken[],
    startIndex: number,
    className: string
  ) => {
    let charIndex = startIndex;

    return tokenList.map((token, tokenIndex) => {
      if (token.type === "br") {
        return (
          <br
            key={`br-${startIndex}-${tokenIndex}`}
            className={token.className}
          />
        );
      }

      const i = charIndex;
      charIndex++;
      const isRevealed = revealedIndices.has(i);
      const displayChar = displayText[i] ?? token.char;

      return (
        <span
          key={`char-${i}`}
          className={`inline-block will-change-transform ${className} ${
            isComplete ? "animate-glow" : ""
          }`}
          style={{
            opacity: isRevealed ? 1 : 0.7,
            filter: isRevealed ? "none" : "blur(1px)",
            animationDelay: isComplete ? `${i * 0.15}s` : "0s",
          }}
        >
          {displayChar === " " ? "\u00A0" : displayChar}
        </span>
      );
    });
  };

  return (
    <motion.div
      className="text-center font-mono tracking-tight italic py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <p className="text-lg sm:text-xl md:text-2xl font-bold text-white text-balance sm:whitespace-nowrap">
        {renderTokens(mainTokens, 0, "text-white")}
      </p>
      {parenTokens.length > 0 && (
        <p className="text-sm sm:text-base md:text-lg font-medium text-white/60 mt-1">
          {renderTokens(parenTokens, mainCharCount, "text-white/60")}
        </p>
      )}
    </motion.div>
  );
}
