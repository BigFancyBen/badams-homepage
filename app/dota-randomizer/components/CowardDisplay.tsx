"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface CowardDisplayProps {
  show: boolean;
  onComplete: () => void;
}

export default function CowardDisplay({ show, onComplete }: CowardDisplayProps) {
  const animationFired = useRef(false);

  useEffect(() => {
    if (!show) {
      animationFired.current = false;
      return;
    }

    if (animationFired.current) return;
    animationFired.current = true;

    // Fire shame confetti - darker colors
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.5 },
        colors: ["#4a4a4a", "#666666", "#888888", "#333333"],
        gravity: 1.5,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.5 },
        colors: ["#4a4a4a", "#666666", "#888888", "#333333"],
        gravity: 1.5,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Big burst
    confetti({
      particleCount: 150,
      spread: 180,
      origin: { y: 0.5 },
      colors: ["#1a1a1a", "#333333", "#4a4a4a", "#666666"],
      gravity: 2,
    });

    frame();

    // Auto-dismiss after animation
    const timeout = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 cursor-pointer"
      onClick={onComplete}
    >
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-red-900/50 blur-[100px] animate-pulse" />

        {/* Main COWARD text */}
        <div className="animate-coward-slam relative">
          <h1 className="text-[8rem] md:text-[12rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 via-red-600 to-red-900 animate-text-glow-coward tracking-tighter select-none">
            COWARD
          </h1>

          {/* Shadow text for depth */}
          <h1
            className="absolute inset-0 text-[8rem] md:text-[12rem] font-black text-red-950/50 tracking-tighter select-none blur-sm -z-10"
            style={{ transform: "translate(8px, 8px)" }}
          >
            COWARD
          </h1>
        </div>

        {/* Subtitle */}
        <div className="animate-fade-in-coward-subtitle text-center mt-4">
          <p className="text-gray-400 text-xl md:text-2xl uppercase tracking-[0.5em] font-bold">
            Sound Disabled
          </p>
        </div>
      </div>
    </div>
  );
}
