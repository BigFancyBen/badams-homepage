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
      rotation: number,
      canvas: HTMLCanvasElement
    ) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 10;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (wheelItems.length === 0) return;

      const sliceAngle = (2 * Math.PI) / wheelItems.length;

      // Draw wheel background glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI);
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "transparent";
      ctx.fill();
      ctx.restore();

      // Draw each slice
      wheelItems.forEach((item, i) => {
        const startAngle = rotation + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        // Draw slice background
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        // Alternate colors
        const hue = (i * 137.5) % 360;
        ctx.fillStyle = `hsl(${hue}, 60%, 15%)`;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Draw image in the slice
        const img = imageCache.current[item.name];
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, endAngle);
          ctx.closePath();
          ctx.clip();

          const midAngle = startAngle + sliceAngle / 2;
          const imgDistance = radius * 0.6;
          const imgX = centerX + Math.cos(midAngle) * imgDistance;
          const imgY = centerY + Math.sin(midAngle) * imgDistance;
          const imgSize = Math.min(60, radius * 0.4);

          ctx.globalAlpha = 0.9;
          ctx.drawImage(
            img,
            imgX - imgSize / 2,
            imgY - imgSize / 2,
            imgSize,
            imgSize
          );
          ctx.restore();
        }
      });

      // Draw center circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a1a2e";
      ctx.fill();
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw pointer at top
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, 5);
      ctx.lineTo(centerX - 15, 30);
      ctx.lineTo(centerX + 15, 30);
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
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

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    drawWheel(ctx, items, rotationRef.current, canvas);
  }, [items, imagesLoaded, drawWheel]);

  // Spin animation
  useEffect(() => {
    if (!isSpinning || items.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize remaining items
    remainingItemsRef.current = [...items];
    const totalItems = items.length;
    const eliminationsNeeded = totalItems - 1;
    const eliminationDelay = spinDuration / eliminationsNeeded;

    // Select winner at start (but don't reveal)
    const winnerIndex = Math.floor(Math.random() * totalItems);
    const winner = items[winnerIndex];

    let startTime: number | null = null;
    let lastEliminationTime = 0;
    let eliminationsComplete = 0;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
        lastEliminationTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      // Calculate rotation speed (fast at start, slow at end)
      const baseSpeed = 0.3;
      const currentSpeed = baseSpeed * (1 - easeOut * 0.95);
      rotationRef.current += currentSpeed;

      // Handle eliminations
      const timeSinceLastElimination = timestamp - lastEliminationTime;
      if (
        timeSinceLastElimination >= eliminationDelay &&
        eliminationsComplete < eliminationsNeeded
      ) {
        // Eliminate a random item that's not the winner
        const currentItems = remainingItemsRef.current;
        const nonWinners = currentItems.filter((item) => item.id !== winner.id);

        if (nonWinners.length > 0) {
          const toRemove = nonWinners[Math.floor(Math.random() * nonWinners.length)];
          remainingItemsRef.current = currentItems.filter(
            (item) => item.id !== toRemove.id
          );
        }

        lastEliminationTime = timestamp;
        eliminationsComplete++;
      }

      // Set up canvas for drawing
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Draw with current remaining items
      drawWheel(ctx, remainingItemsRef.current, rotationRef.current, canvas);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - ensure only winner remains
        remainingItemsRef.current = [winner];
        drawWheel(ctx, [winner], rotationRef.current, canvas);
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
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      drawWheel(ctx, items, rotationRef.current, canvas);
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
        {remainingItemsRef.current.length > 0
          ? `${items.length} options`
          : `${items.length} options`}
      </div>
    </div>
  );
}
