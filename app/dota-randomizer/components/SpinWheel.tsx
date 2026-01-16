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

      const sliceAngle = (2 * Math.PI) / wheelItems.length;

      // Draw outer glow ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, 2 * Math.PI);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.restore();

      // Draw each slice
      wheelItems.forEach((item, i) => {
        const startAngle = rotation + i * sliceAngle - Math.PI / 2; // Start from top
        const endAngle = startAngle + sliceAngle;
        const midAngle = startAngle + sliceAngle / 2;

        // Draw slice background with gradient
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        // Alternate darker/lighter backgrounds for contrast
        const baseHue = (i * 137.5) % 360;
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, radius
        );
        gradient.addColorStop(0, `hsl(${baseHue}, 40%, 12%)`);
        gradient.addColorStop(0.7, `hsl(${baseHue}, 50%, 18%)`);
        gradient.addColorStop(1, `hsl(${baseHue}, 60%, 22%)`);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw slice border
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Draw image in the slice - make it larger and more visible
        const img = imageCache.current[item.name];
        if (img) {
          ctx.save();

          // Clip to slice
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius - 4, startAngle, endAngle);
          ctx.closePath();
          ctx.clip();

          // Calculate image position and size based on number of items
          const numItems = wheelItems.length;
          let imgSize: number;
          let imgDistance: number;

          if (numItems <= 4) {
            imgSize = radius * 0.6;
            imgDistance = radius * 0.55;
          } else if (numItems <= 8) {
            imgSize = radius * 0.5;
            imgDistance = radius * 0.58;
          } else if (numItems <= 16) {
            imgSize = radius * 0.4;
            imgDistance = radius * 0.6;
          } else {
            // Many items - show smaller images
            imgSize = Math.max(30, radius * 0.35);
            imgDistance = radius * 0.62;
          }

          const imgX = centerX + Math.cos(midAngle) * imgDistance;
          const imgY = centerY + Math.sin(midAngle) * imgDistance;

          // Draw image with slight shadow for visibility
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 4;
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

        // Draw item name if few items remain (readable)
        if (wheelItems.length <= 6) {
          ctx.save();
          const textDistance = radius * 0.35;
          const textX = centerX + Math.cos(midAngle) * textDistance;
          const textY = centerY + Math.sin(midAngle) * textDistance;

          ctx.font = "bold 10px Inter, sans-serif";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 3;

          // Truncate long names
          const displayText = item.displayName.length > 12
            ? item.displayName.slice(0, 10) + "..."
            : item.displayName;
          ctx.fillText(displayText, textX, textY);
          ctx.restore();
        }
      });

      // Draw center circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
      const centerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 25
      );
      centerGradient.addColorStop(0, "#2d1f4e");
      centerGradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = centerGradient;
      ctx.fill();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw pointer/indicator at top
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

      // Enhanced easing: starts fast, slows down dramatically at the end
      // Using a combination of exponential and quintic easing for dramatic slowdown
      const easeOutQuint = 1 - Math.pow(1 - progress, 5);
      const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const easeOut = (easeOutQuint + easeOutExpo) / 2;

      // Calculate rotation speed - starts at max, ends near zero
      const maxSpeed = 0.25;
      const minSpeed = 0.001;
      const speedRange = maxSpeed - minSpeed;
      const currentSpeed = minSpeed + speedRange * (1 - easeOut);
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
      canvas.width = 400 * dpr;
      canvas.height = 400 * dpr;
      ctx.scale(dpr, dpr);

      // Draw with current remaining items
      drawWheel(ctx, remainingItemsRef.current, rotationRef.current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - ensure only winner remains
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
