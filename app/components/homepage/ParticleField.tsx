"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { useMobileDevice } from "@/app/hooks/useMobileDevice";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

interface ParticleFieldProps {
  particleCount?: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100 + 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.4 + 0.1,
    duration: Math.random() * 25 + 20,
    delay: Math.random() * 15,
    drift: (Math.random() - 0.5) * 150,
  }));
}

export function ParticleField({ particleCount = 40 }: ParticleFieldProps) {
  const isMobile = useMobileDevice();

  // Significantly reduce particle count on mobile for performance
  const effectiveCount = isMobile ? Math.min(particleCount, 18) : particleCount;

  const [particles] = useState<Particle[]>(() => generateParticles(50)); // Generate max upfront

  // Only render the effective count
  const visibleParticles = useMemo(
    () => particles.slice(0, effectiveCount),
    [particles, effectiveCount]
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/10 via-transparent to-amber-950/5" />

      {visibleParticles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute bg-purple-400 will-change-transform"
          style={{
            width: particle.size,
            height: particle.size,
            // Use transform for initial position (GPU accelerated)
            transform: `translate3d(${particle.x}vw, ${particle.y}vh, 0)`,
            opacity: particle.opacity,
          }}
          animate={{
            // Use transform-based animation for GPU acceleration
            y: [`0vh`, `-120vh`],
            x: isMobile
              ? [`0px`, `${particle.drift * 0.5}px`, `0px`] // Reduce drift on mobile
              : [`0px`, `${particle.drift}px`, `0px`],
            opacity: [particle.opacity, particle.opacity * 1.5, particle.opacity, 0],
          }}
          transition={{
            y: {
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
              delay: particle.delay,
            },
            x: {
              duration: particle.duration / 3,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: particle.delay,
            },
            opacity: {
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
              delay: particle.delay,
            },
          }}
        />
      ))}

      {/* Scanline overlay - simplified on mobile */}
      {!isMobile && (
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139, 92, 246, 0.5) 2px, rgba(139, 92, 246, 0.5) 3px)",
          }}
        />
      )}
    </div>
  );
}
