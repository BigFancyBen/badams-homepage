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

  // Current animation state
  const rotationRef = useRef(0);
  const remainingItemsRef = useRef<WheelItem[]>([]);

  // Preload images
  useEffect(() => {
    if (items.length === 0) return;

    let loadedCount = 0;
    const totalImages = items.length;

    items.forEach((item) => {
      if (imageCache.current[item.name]) {
        loadedCount++;
        if (loadedCount === totalImages) setImagesLoaded(true);
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCache.current[item.name] = img;
        loadedCount++;
        if (loadedCount === totalImages) setImagesLoaded(true);
      };
      img.onerror = () => {
        imageCache.current[item.name] = null;
        loadedCount++;
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
      const displayWidth = 400;
      const displayHeight = 400;
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      const radius = Math.min(centerX, centerY) - 15;

      // Clear canvas
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      if (wheelItems.length === 0) return;

      const numItems = wheelItems.length;
      const sliceAngle = (2 * Math.PI) / numItems;

      // Draw outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 20;
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
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        // Alternate colors for contrast
        const baseHue = (i * 137.5) % 360;
        const gradient = ctx.createRadialGradient(
          centerX, centerY, radius * 0.3,
          centerX, centerY, radius
        );
        gradient.addColorStop(0, `hsl(${baseHue}, 30%, 8%)`);
        gradient.addColorStop(0.5, `hsl(${baseHue}, 40%, 12%)`);
        gradient.addColorStop(1, `hsl(${baseHue}, 50%, 18%)`);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw slice border
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Draw image at outer edge of slice for maximum visibility
        const img = imageCache.current[item.name];
        if (img) {
          ctx.save();

          // Clip to slice
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius - 2, startAngle, endAngle);
          ctx.closePath();
          ctx.clip();

          // Calculate image size based on number of items
          // Position at outer edge, size to fill the arc width
          let imgSize: number;
          let imgDistance: number;

          if (numItems === 1) {
            // Single item - show large in center
            imgSize = radius * 1.2;
            imgDistance = 0;
          } else if (numItems <= 3) {
            imgSize = radius * 0.7;
            imgDistance = radius * 0.45;
          } else if (numItems <= 6) {
            imgSize = radius * 0.55;
            imgDistance = radius * 0.55;
          } else if (numItems <= 12) {
            imgSize = radius * 0.45;
            imgDistance = radius * 0.62;
          } else if (numItems <= 24) {
            imgSize = radius * 0.38;
            imgDistance = radius * 0.68;
          } else {
            // Many items - position at very outer edge
            imgSize = Math.max(25, radius * 0.32);
            imgDistance = radius * 0.72;
          }

          const imgX = centerX + Math.cos(midAngle) * imgDistance;
          const imgY = centerY + Math.sin(midAngle) * imgDistance;

          // Draw shadow for depth
          ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          ctx.drawImage(
            img,
            imgX - imgSize / 2,
            imgY - imgSize / 2,
            imgSize,
            imgSize
          );
          ctx.restore();
        }

        // Draw item name when few items remain
        if (numItems <= 8 && numItems > 1) {
          ctx.save();
          const textDistance = radius * 0.28;
          const textX = centerX + Math.cos(midAngle) * textDistance;
          const textY = centerY + Math.sin(midAngle) * textDistance;

          const fontSize = numItems <= 4 ? 11 : 9;
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 4;

          const maxLen = numItems <= 4 ? 14 : 10;
          const displayText = item.displayName.length > maxLen
            ? item.displayName.slice(0, maxLen - 2) + "..."
            : item.displayName;
          ctx.fillText(displayText, textX, textY);
          ctx.restore();
        }
      });

      // Draw center circle (smaller to show more of the slices)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
      const centerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 20
      );
      centerGradient.addColorStop(0, "#3d2f5e");
      centerGradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = centerGradient;
      ctx.fill();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw pointer at top
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, 6);
      ctx.lineTo(centerX - 14, 30);
      ctx.lineTo(centerX + 14, 30);
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
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

  // Spin animation with non-linear elimination timing
  useEffect(() => {
    if (!isSpinning || items.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize remaining items
    remainingItemsRef.current = [...items];
    const totalItems = items.length;

    // Select winner at start
    const winnerIndex = Math.floor(Math.random() * totalItems);
    const winner = items[winnerIndex];

    // Create elimination schedule: last 5 items take last 4 seconds
    // This means we need to eliminate (totalItems - 5) items in first 6 seconds
    // and eliminate 4 items in last 4 seconds
    const fastPhaseItems = Math.max(0, totalItems - 5);
    const slowPhaseItems = Math.min(4, totalItems - 1);
    const fastPhaseDuration = spinDuration * 0.6; // First 6 seconds
    const slowPhaseDuration = spinDuration * 0.4; // Last 4 seconds

    // Build elimination timestamps
    const eliminationTimes: number[] = [];

    // Fast phase eliminations (evenly spaced in first 6 seconds)
    for (let i = 0; i < fastPhaseItems; i++) {
      eliminationTimes.push((i + 1) * (fastPhaseDuration / fastPhaseItems));
    }

    // Slow phase eliminations (evenly spaced in last 4 seconds)
    for (let i = 0; i < slowPhaseItems; i++) {
      eliminationTimes.push(fastPhaseDuration + (i + 1) * (slowPhaseDuration / slowPhaseItems));
    }

    let startTime: number | null = null;
    let eliminationsComplete = 0;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Very aggressive easing for dramatic slowdown
      // Combines multiple easing functions for extreme deceleration
      const t = progress;
      const easeOutSeventh = 1 - Math.pow(1 - t, 7);
      const easeOutExpo = t === 1 ? 1 : 1 - Math.pow(2, -12 * t);
      const combined = (easeOutSeventh * 0.4 + easeOutExpo * 0.6);

      // Rotation speed: very fast start, crawling at end
      const maxSpeed = 0.35;
      const minSpeed = 0.0005;
      const currentSpeed = minSpeed + (maxSpeed - minSpeed) * (1 - combined);
      rotationRef.current += currentSpeed;

      // Handle eliminations based on schedule
      while (
        eliminationsComplete < eliminationTimes.length &&
        elapsed >= eliminationTimes[eliminationsComplete]
      ) {
        const currentItems = remainingItemsRef.current;
        const nonWinners = currentItems.filter((item) => item.id !== winner.id);

        if (nonWinners.length > 0) {
          const toRemove = nonWinners[Math.floor(Math.random() * nonWinners.length)];
          remainingItemsRef.current = currentItems.filter(
            (item) => item.id !== toRemove.id
          );
        }
        eliminationsComplete++;
      }

      // Set up canvas for drawing
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 400 * dpr;
      canvas.height = 400 * dpr;
      ctx.scale(dpr, dpr);

      drawWheel(ctx, remainingItemsRef.current, rotationRef.current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
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

  // Reset wheel when not spinning and no selection
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white">Loading...</div>
          </div>
        )}
      </div>
      <div className="mt-2 text-gray-400 text-sm">
        {items.length} options
      </div>
    </div>
  );
}
