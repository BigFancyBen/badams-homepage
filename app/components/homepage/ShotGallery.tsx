"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export interface Shot {
  src: string;
  label: string;
  caption?: string;
  alt: string;
  /** A muted loop to play in place of the still, which becomes its poster. */
  video?: string;
}

interface ShotGalleryProps {
  shots: Shot[];
  accentColor: string;
  autoPlayInterval?: number;
  autoPlayDelay?: number;
  /** CSS aspect-ratio of the frame. The stills are cropped to cover it. */
  aspect?: string;
  sizes?: string;
  priority?: boolean;
}

/** How long a loop holds the frame before the gallery moves on. */
const VIDEO_HOLD_MS = 10000;

/**
 * A 16:9 still with a row of label chips under it. Hovering or focusing a chip
 * previews that shot, clicking one (or the image halves) stops the autoplay.
 */
export function ShotGallery({
  shots,
  accentColor,
  autoPlayInterval = 5000,
  autoPlayDelay = 0,
  aspect = "16 / 9",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: ShotGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const [userClicked, setUserClicked] = useState(false);
  const reducedMotion = useReducedMotion();

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % shots.length);
  }, [shots.length]);

  const active = preview ?? current;
  const shot = shots[active];
  const [started, setStarted] = useState(autoPlayDelay === 0);

  useEffect(() => {
    if (started) return;
    const delayId = setTimeout(() => setStarted(true), autoPlayDelay);
    return () => clearTimeout(delayId);
  }, [started, autoPlayDelay]);

  useEffect(() => {
    if (!started || userClicked || preview !== null || reducedMotion || shots.length < 2) return;
    const hold = shots[current].video ? VIDEO_HOLD_MS : autoPlayInterval;
    const timeoutId = setTimeout(next, hold);
    return () => clearTimeout(timeoutId);
  }, [started, userClicked, preview, reducedMotion, shots, current, next, autoPlayInterval]);

  const select = (index: number) => {
    setUserClicked(true);
    setCurrent(index);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const forward = e.clientX - rect.left >= rect.width / 2;
    select((active + (forward ? 1 : shots.length - 1)) % shots.length);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        className="relative w-full overflow-hidden cursor-pointer bg-black"
        style={{ aspectRatio: aspect, border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={handleImageClick}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={shot.video ?? shot.src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.35 }}
          >
            {shot.video && !reducedMotion ? (
              <video
                src={shot.video}
                poster={shot.src}
                aria-label={shot.alt}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                className="object-cover"
                sizes={sizes}
                priority={priority && active === 0}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {shot.caption && (
        <p className="text-gray-400 text-xs leading-relaxed min-h-[2.5rem]">{shot.caption}</p>
      )}

      <div className="flex flex-wrap gap-1.5" onMouseLeave={() => setPreview(null)}>
        {shots.map((s, i) => {
          const isActive = active === i;
          return (
            <button
              key={s.video ?? s.src}
              type="button"
              onClick={() => select(i)}
              onMouseEnter={() => setPreview(i)}
              onFocus={() => setPreview(i)}
              onBlur={() => setPreview(null)}
              aria-pressed={isActive}
              className="px-2 py-1 text-[10px] font-mono transition-colors"
              style={{
                borderWidth: 1,
                color: isActive ? accentColor : "#9ca3af",
                borderColor: isActive ? `${accentColor}60` : "rgba(255,255,255,0.08)",
                backgroundColor: isActive ? `${accentColor}18` : "rgba(255,255,255,0.02)",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
