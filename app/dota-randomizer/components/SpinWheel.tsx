"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { WheelItem } from "../types";

interface SpinWheelProps {
  items: WheelItem[];
  title: string;
  isSpinning: boolean;
  selectedItem: WheelItem | null;
  onSpinComplete: (item: WheelItem) => void;
  spinDuration: number;
}

interface ImageCache {
  [key: string]: HTMLImageElement | null;
}

export default function SpinWheel({
  items,
  title,
  isSpinning,
  selectedItem,
  onSpinComplete,
  spinDuration,
}: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const imageCache = useRef<ImageCache>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Current animation state
  const rotationRef = useRef(0);
  const remainingItemsRef = useRef<WheelItem[]>([]);

  // Preload images
  useEffect(() => {
    if (items.length === 0) return;

    let loadedCount = 0;
    const totalImages = items.length;

    // Reset loading state
    setImagesLoaded(false);
    setLoadingProgress(0);

    items.forEach((item) => {
      // Skip if already cached
      if (imageCache.current[item.name]) {
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
        if (loadedCount === totalImages) setImagesLoaded(true);
        return;
      }

      const img = new Image();
      // Don't set crossOrigin - OpenDota CDN handles CORS properly
      img.onload = () => {
        imageCache.current[item.name] = img;
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
        if (loadedCount === totalImages) setImagesLoaded(true);
      };
      img.onerror = () => {
        // On error, still mark as processed but with null
        imageCache.current[item.name] = null;
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / totalImages) * 100));
        if (loadedCount === totalImages) setImagesLoaded(true);
      };
      img.src = item.imageUrl;
    });
  }, [items]);

  const drawWheel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      wheelItems: WheelItem[],
      rotation: number
    ) => {
      const size = 400;
      const centerX = size / 2;
      const centerY = size / 2;
      const outerRadius = size / 2 - 20;
      const innerRadius = 25;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      if (wheelItems.length === 0) return;

      const numItems = wheelItems.length;
      const sliceAngle = (2 * Math.PI) / numItems;

      // Draw outer glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.restore();

      // Draw each slice
      wheelItems.forEach((item, i) => {
        const startAngle = rotation + i * sliceAngle - Math.PI / 2;
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + sliceAngle / 2;

        // Draw slice background
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.closePath();

        // Alternating colors for contrast
        const hue = (i * 137.5) % 360;
        ctx.fillStyle = `hsl(${hue}, 45%, 15%)`;
        ctx.fill();

        ctx.strokeStyle = "#6d28d9";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // Draw image at OUTER edge of slice
        const img = imageCache.current[item.name];
        if (img) {
          ctx.save();

          // Clip to slice shape
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
          ctx.closePath();
          ctx.clip();

          // Calculate image size and position at outer edge
          // Image should be as large as possible while fitting in the slice
          let imgSize: number;
          let imgDistance: number;

          if (numItems === 1) {
            imgSize = outerRadius * 1.4;
            imgDistance = 0;
          } else if (numItems <= 4) {
            imgSize = outerRadius * 0.65;
            imgDistance = outerRadius * 0.5;
          } else if (numItems <= 8) {
            imgSize = outerRadius * 0.5;
            imgDistance = outerRadius * 0.58;
          } else if (numItems <= 16) {
            imgSize = outerRadius * 0.4;
            imgDistance = outerRadius * 0.65;
          } else {
            // Many items - smaller images at outer edge
            imgSize = Math.max(20, outerRadius * 0.3);
            imgDistance = outerRadius * 0.72;
          }

          // Position at outer edge of slice
          const imgX = centerX + Math.cos(midAngle) * imgDistance;
          const imgY = centerY + Math.sin(midAngle) * imgDistance;

          // Draw image with shadow
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          ctx.drawImage(
            img,
            imgX - imgSize / 2,
            imgY - imgSize / 2,
            imgSize,
            imgSize
          );
          ctx.restore();
        }

        // Draw text near CENTER (inner edge) when few items
        if (numItems <= 10) {
          ctx.save();
          // Position text closer to center
          const textDistance = innerRadius + 25;
          const textX = centerX + Math.cos(midAngle) * textDistance;
          const textY = centerY + Math.sin(midAngle) * textDistance;

          // Rotate text to follow the slice angle
          ctx.translate(textX, textY);
          ctx.rotate(midAngle + Math.PI / 2);

          const fontSize = numItems <= 4 ? 10 : 8;
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 3;

          const maxLen = numItems <= 4 ? 12 : 8;
          const displayText =
            item.displayName.length > maxLen
              ? item.displayName.slice(0, maxLen - 1) + "…"
              : item.displayName;

          ctx.fillText(displayText, 0, 0);
          ctx.restore();
        }
      });

      // Draw center circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a1a2e";
      ctx.fill();
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw pointer at top
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, 8);
      ctx.lineTo(centerX - 12, 28);
      ctx.lineTo(centerX + 12, 28);
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.strokeStyle = "#fcd34d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagesLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 400 * dpr;
    canvas.height = 400 * dpr;
    ctx.scale(dpr, dpr);

    drawWheel(ctx, items, rotationRef.current);
  }, [items, imagesLoaded, drawWheel]);

  // Spin animation
  useEffect(() => {
    if (!isSpinning || items.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize
    remainingItemsRef.current = [...items];
    const totalItems = items.length;

    // Select winner at start
    const winnerIndex = Math.floor(Math.random() * totalItems);
    const winner = items[winnerIndex];

    // Elimination schedule: fast at start, slow at end
    // Last 5 items take last 40% of time
    const fastPhaseItems = Math.max(0, totalItems - 5);
    const slowPhaseItems = Math.min(4, totalItems - 1);
    const fastPhaseDuration = spinDuration * 0.6;
    const slowPhaseDuration = spinDuration * 0.4;

    const eliminationTimes: number[] = [];
    for (let i = 0; i < fastPhaseItems; i++) {
      eliminationTimes.push(((i + 1) / fastPhaseItems) * fastPhaseDuration);
    }
    for (let i = 0; i < slowPhaseItems; i++) {
      eliminationTimes.push(
        fastPhaseDuration + ((i + 1) / slowPhaseItems) * slowPhaseDuration
      );
    }

    let startTime: number | null = null;
    let eliminationsComplete = 0;

    // Initial rotation speed (radians per frame at 60fps)
    const initialSpeed = 0.4;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Smooth deceleration using quintic ease-out
      // Speed = initialSpeed * (1 - progress)^5
      // This gives a smooth, consistent slowdown
      const speedMultiplier = Math.pow(1 - progress, 5);
      const currentSpeed = initialSpeed * speedMultiplier + 0.001; // Small minimum to keep moving

      rotationRef.current += currentSpeed;

      // Handle eliminations
      while (
        eliminationsComplete < eliminationTimes.length &&
        elapsed >= eliminationTimes[eliminationsComplete]
      ) {
        const currentItems = remainingItemsRef.current;
        const nonWinners = currentItems.filter((item) => item.id !== winner.id);

        if (nonWinners.length > 0) {
          const toRemove =
            nonWinners[Math.floor(Math.random() * nonWinners.length)];
          remainingItemsRef.current = currentItems.filter(
            (item) => item.id !== toRemove.id
          );
        }
        eliminationsComplete++;
      }

      // Redraw
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 400 * dpr;
      canvas.height = 400 * dpr;
      ctx.scale(dpr, dpr);

      drawWheel(ctx, remainingItemsRef.current, rotationRef.current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        remainingItemsRef.current = [winner];
        drawWheel(ctx, [winner], rotationRef.current);
        onSpinComplete(winner);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpinning, items, spinDuration, onSpinComplete, drawWheel]);

  // Reset wheel
  useEffect(() => {
    if (!isSpinning && !selectedItem) {
      remainingItemsRef.current = items;
      const canvas = canvasRef.current;
      if (!canvas || !imagesLoaded) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = 400 * dpr;
      canvas.height = 400 * dpr;
      ctx.scale(dpr, dpr);

      drawWheel(ctx, items, rotationRef.current);
    }
  }, [isSpinning, selectedItem, items, imagesLoaded, drawWheel]);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4 text-purple-400">{title}</h2>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] md:w-[400px] md:h-[400px]"
          style={{ width: 400, height: 400 }}
        />
        {!imagesLoaded && items.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center">
              <div className="text-white mb-2">Loading images...</div>
              <div className="text-purple-400 text-sm">{loadingProgress}%</div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 text-gray-400 text-sm">{items.length} options</div>
    </div>
  );
}
