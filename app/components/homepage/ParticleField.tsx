"use client";

import { useMemo } from "react";

interface Particle {
  id: number;
  x: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.4 + 0.1,
    duration: Math.random() * 25 + 20,
    delay: Math.random() * 20,
    drift: (Math.random() - 0.5) * 100,
  }));
}

interface ParticleFieldProps {
  particleCount?: number;
}

export function ParticleField({ particleCount = 40 }: ParticleFieldProps) {
  const particles = useMemo(
    () => generateParticles(particleCount),
    [particleCount]
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/10 via-transparent to-amber-950/5" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* CSS-animated particles - GPU composited via transform3d */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bg-purple-400 animate-particle-float"
          style={
            {
              left: `${p.x}%`,
              bottom: "-5%",
              width: p.size,
              height: p.size,
              "--p-drift": `${p.drift}px`,
              "--p-opacity": p.opacity,
              "--p-duration": `${p.duration}s`,
              "--p-delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Sweeping scanline */}
      <div
        className="absolute inset-x-0 h-[1px] animate-scanline-sweep"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.4) 20%, rgba(139, 92, 246, 0.4) 80%, transparent 100%)",
          boxShadow: "0 0 15px 2px rgba(139, 92, 246, 0.15)",
        }}
      />

      {/* Subtle scanline texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139, 92, 246, 0.5) 2px, rgba(139, 92, 246, 0.5) 3px)",
        }}
      />
    </div>
  );
}
