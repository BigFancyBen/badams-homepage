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

          // Calculate max image size based on number of items
          let maxImgSize: number;
          let imgDistance: number;

          if (numItems === 1) {
            maxImgSize = outerRadius * 1.4;
            imgDistance = 0;
          } else if (numItems <= 4) {
            maxImgSize = outerRadius * 0.65;
            imgDistance = outerRadius * 0.5;
          } else if (numItems <= 8) {
            maxImgSize = outerRadius * 0.5;
            imgDistance = outerRadius * 0.58;
          } else if (numItems <= 16) {
            maxImgSize = outerRadius * 0.4;
            imgDistance = outerRadius * 0.65;
          } else {
            maxImgSize = Math.max(20, outerRadius * 0.3);
            imgDistance = outerRadius * 0.72;
          }

          // Calculate actual image dimensions preserving aspect ratio
          const imgAspect = img.naturalWidth / img.naturalHeight;
          let imgWidth: number;
          let imgHeight: number;

          if (imgAspect > 1) {
            // Wider than tall - fit width to maxImgSize
            imgWidth = maxImgSize;
            imgHeight = maxImgSize / imgAspect;
          } else {
            // Taller than wide - fit height to maxImgSize
            imgHeight = maxImgSize;
            imgWidth = maxImgSize * imgAspect;
          }

          // Position at outer edge of slice
          const imgX = centerX + Math.cos(midAngle) * imgDistance;
          const imgY = centerY + Math.sin(midAngle) * imgDistance;

          // Draw image with shadow, preserving aspect ratio
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          ctx.drawImage(
            img,
            imgX - imgWidth / 2,
            imgY - imgHeight / 2,
            imgWidth,
            imgHeight
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

    // Elimination phase: eliminate down to 4 items
    // Takes 60% of total time
    const itemsToEliminate = Math.max(0, totalItems - 4);
    const eliminationDuration = spinDuration * 0.6;
    const spinOnlyDuration = spinDuration * 0.4;

    // Create elimination schedule
    const eliminationTimes: number[] = [];
    if (itemsToEliminate > 0) {
      for (let i = 0; i < itemsToEliminate; i++) {
        // Accelerate eliminations over time
        const progress = (i + 1) / itemsToEliminate;
        eliminationTimes.push(progress * eliminationDuration);
      }
    }

    // Find winner's index in the final items (determined dynamically during spin)
    let winnerFinalIndex = 0;

    // Calculate base rotations for spinning effect
    // Add several full rotations plus offset to land on winner
    const extraRotations = 5 + Math.random() * 3; // 5-8 full spins during spin phase
    const baseSpinRotation = extraRotations * 2 * Math.PI;

    let startTime: number | null = null;
    let eliminationsComplete = 0;
    let spinPhaseStartRotation = 0;
    let targetRotation = 0;
    let spinPhaseStartTime = 0;

    // Initial rotation speed during elimination
    const eliminationSpeed = 0.3;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const dpr = window.devicePixelRatio || 1;

      // Phase 1: Elimination (0 to eliminationDuration)
      if (elapsed < eliminationDuration && itemsToEliminate > 0) {
        // Handle eliminations
        while (
          eliminationsComplete < eliminationTimes.length &&
          elapsed >= eliminationTimes[eliminationsComplete]
        ) {
          const currentItems = remainingItemsRef.current;
          const nonWinners = currentItems.filter((item) => item.id !== winner.id);

          if (nonWinners.length > 0 && currentItems.length > 4) {
            const toRemove =
              nonWinners[Math.floor(Math.random() * nonWinners.length)];
            remainingItemsRef.current = currentItems.filter(
              (item) => item.id !== toRemove.id
            );
          }
          eliminationsComplete++;
        }

        // Continuous rotation during elimination
        rotationRef.current += eliminationSpeed;

        // Redraw
        canvas.width = 400 * dpr;
        canvas.height = 400 * dpr;
        ctx.scale(dpr, dpr);
        drawWheel(ctx, remainingItemsRef.current, rotationRef.current);

        animationRef.current = requestAnimationFrame(animate);
      }
      // Phase 2: Spin to winner (eliminationDuration to end)
      else {
        // Initialize spin phase once
        if (spinPhaseStartTime === 0) {
          spinPhaseStartTime = timestamp;
          spinPhaseStartRotation = rotationRef.current;

          // Find winner's index in remaining items
          const remaining = remainingItemsRef.current;
          winnerFinalIndex = remaining.findIndex((item) => item.id === winner.id);
          if (winnerFinalIndex === -1) winnerFinalIndex = 0;

          // Calculate target rotation to land pointer on winner
          // Pointer is at top (angle 0 from our draw perspective which starts at -PI/2)
          // Each segment starts at: rotation + i * segmentAngle - PI/2
          // We want winner's segment center under the pointer
          const segmentAngle = (2 * Math.PI) / remaining.length;
          const winnerCenterAngle = winnerFinalIndex * segmentAngle + segmentAngle / 2;

          // Target: winner center should be at angle PI/2 (top, where pointer is)
          // rotation + winnerCenterAngle - PI/2 = -PI/2 (mod 2PI for top)
          // rotation = -winnerCenterAngle
          // Add full rotations for spinning effect
          const targetOffset = -winnerCenterAngle;
          targetRotation = spinPhaseStartRotation + baseSpinRotation + targetOffset;

          // Normalize so we're always spinning forward
          while (targetRotation < spinPhaseStartRotation + 2 * Math.PI) {
            targetRotation += 2 * Math.PI;
          }
        }

        const spinElapsed = timestamp - spinPhaseStartTime;
        const spinProgress = Math.min(spinElapsed / spinOnlyDuration, 1);

        // Cubic ease-out for natural deceleration
        const easedProgress = 1 - Math.pow(1 - spinProgress, 3);

        // Interpolate rotation
        rotationRef.current =
          spinPhaseStartRotation +
          (targetRotation - spinPhaseStartRotation) * easedProgress;

        // Redraw
        canvas.width = 400 * dpr;
        canvas.height = 400 * dpr;
        ctx.scale(dpr, dpr);
        drawWheel(ctx, remainingItemsRef.current, rotationRef.current);

        if (spinProgress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - winner is now under pointer
          onSpinComplete(winner);
        }
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
    </div>
  );
}
