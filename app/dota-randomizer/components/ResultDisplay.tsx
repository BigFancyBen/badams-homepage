"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { WheelItem } from "../types";

interface ResultDisplayProps {
  hero: WheelItem | null;
  item: WheelItem | null;
  show: boolean;
}

export default function ResultDisplay({ hero, item, show }: ResultDisplayProps) {
  const confettiFired = useRef(false);

  useEffect(() => {
    // Reset when hiding
    if (!show) {
      confettiFired.current = false;
      return;
    }

    // Fire confetti when results are shown
    if (confettiFired.current) return;
    confettiFired.current = true;

    // Fire confetti from multiple angles
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: ["#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ["#8b5cf6", "#f59e0b", "#10b981"],
    });

    frame();
  }, [show]);

  if (!show || !hero || !item) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex flex-col items-center gap-8">
        {/* Hero Result */}
        <div className="animate-slide-in-hero">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-purple-500/30 blur-3xl animate-pulse" />

            {/* Hero card */}
            <div className="relative bg-gradient-to-b from-purple-900/90 to-purple-950/90 border-2 border-purple-500 p-6 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-sm text-purple-300 uppercase tracking-widest mb-2">
                  Your Hero
                </div>
                <div className="animate-fade-in-delay">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hero.imageUrl}
                    alt={hero.displayName}
                    className="w-32 h-20 object-cover mx-auto mb-3"
                  />
                </div>
                <h3
                  className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-purple-300 animate-text-glow-purple"
                >
                  {hero.displayName}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="animate-scale-in">
          <span className="text-4xl font-black text-amber-500 animate-bounce">
            +
          </span>
        </div>

        {/* Item Result */}
        <div className="animate-slide-in-item">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-amber-500/30 blur-3xl animate-pulse" />

            {/* Item card */}
            <div className="relative bg-gradient-to-b from-amber-900/90 to-amber-950/90 border-2 border-amber-500 p-6 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-sm text-amber-300 uppercase tracking-widest mb-2">
                  Your Item
                </div>
                <div className="animate-fade-in-delay-long">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.displayName}
                    className="w-20 h-20 object-contain mx-auto mb-3"
                  />
                </div>
                <h3
                  className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-amber-300 animate-text-glow-amber"
                >
                  {item.displayName}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
