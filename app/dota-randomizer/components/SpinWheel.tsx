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
  size?: number;
  onTick?: () => void;
  onSelectionComplete?: () => void;
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
  size = 400,
  onTick,
  onSelectionComplete,
}: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const imageCache = useRef<ImageCache>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // CSS rotation state for GPU-accelerated transforms
  const [cssRotation, setCssRotation] = useState(0);

  // Current animation state
  const rotationRef = useRef(0);
  const remainingItemsRef = useRef<WheelItem[]>([]);
  const lastSliceIndexRef = useRef(-1);

  // Cache DPR and context to avoid repeated lookups
  const dprRef = useRef(1);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Track if we need to redraw (only when items change)
  const needsRedrawRef = useRef(true);

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

  // Draw the wheel at rotation=0 (CSS transform handles rotation for GPU acceleration)
  const drawWheel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      wheelItems: WheelItem[],
      canvasSize: number
    ) => {
      const centerX = canvasSize / 2;
      const centerY = canvasSize / 2;
      const outerRadius = canvasSize / 2 - 20;
      const innerRadius = Math.max(20, canvasSize * 0.06);

      // Clear canvas
      ctx.clearRect(0, 0, canvasSize, canvasSize);

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

      // Draw each slice (at rotation=0, CSS transform rotates the canvas)
      wheelItems.forEach((item, i) => {
        const startAngle = i * sliceAngle - Math.PI / 2;
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

      });

      // Draw center circle (this rotates with the wheel, which is fine)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#1a1a2e";
      ctx.fill();
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Note: Pointer is drawn separately as an overlay so it doesn't rotate
    },
    []
  );

  // Set up canvas size and context once (not on every frame)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // Only resize if dimensions actually changed
    const targetWidth = size * dpr;
    const targetHeight = size * dpr;
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Reset transform and apply DPR scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
  }, [size]);

  // Initial draw and redraw when items change
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !imagesLoaded) return;

    // Draw wheel at rotation=0 (CSS transform handles visual rotation)
    drawWheel(ctx, items, size);
    needsRedrawRef.current = false;
  }, [items, imagesLoaded, drawWheel, size]);

  // Spin animation using GPU-accelerated CSS transforms
  useEffect(() => {
    if (!isSpinning || items.length === 0) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    // Initialize
    remainingItemsRef.current = [...items];
    const totalItems = items.length;
    lastSliceIndexRef.current = -1;

    // Select winner at start
    const winnerIndex = Math.floor(Math.random() * totalItems);
    const winner = items[winnerIndex];

    // Elimination phase: eliminate down to 6 items
    // Takes 60% of total time
    const finalItemCount = 6;
    const itemsToEliminate = Math.max(0, totalItems - finalItemCount);
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

    // State for spin phase
    let spinPhaseInitialized = false;
    let spinPhaseStartRotation = 0;
    let targetRotation = 0;
    let spinPhaseStartTime = 0;

    let startTime: number | null = null;
    let eliminationsComplete = 0;
    let lastEliminationCount = 0;

    // Initial rotation speed during elimination (radians per frame at ~60fps)
    const eliminationSpeed = 0.3;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;

      // Phase 1: Elimination (0 to eliminationDuration)
      if (elapsed < eliminationDuration && itemsToEliminate > 0) {
        // Handle eliminations
        while (
          eliminationsComplete < eliminationTimes.length &&
          elapsed >= eliminationTimes[eliminationsComplete]
        ) {
          const currentItems = remainingItemsRef.current;
          const nonWinners = currentItems.filter((item) => item.id !== winner.id);

          if (nonWinners.length > 0 && currentItems.length > finalItemCount) {
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

        // Play tick sound when passing a slice boundary
        if (onTick && remainingItemsRef.current.length > 0) {
          const sliceAngle = (2 * Math.PI) / remainingItemsRef.current.length;
          const currentSliceIndex = Math.floor(
            ((rotationRef.current % (2 * Math.PI)) + 2 * Math.PI) / sliceAngle
          ) % remainingItemsRef.current.length;

          if (currentSliceIndex !== lastSliceIndexRef.current) {
            lastSliceIndexRef.current = currentSliceIndex;
            onTick();
          }
        }

        // Only redraw canvas when items are eliminated (expensive operation)
        if (eliminationsComplete > lastEliminationCount) {
          lastEliminationCount = eliminationsComplete;
          drawWheel(ctx, remainingItemsRef.current, size);
        }

        // Update CSS rotation for GPU-accelerated transform
        setCssRotation(rotationRef.current);

        animationRef.current = requestAnimationFrame(animate);
      }
      // Phase 2: Spin to winner (eliminationDuration to end)
      else {
        // Initialize spin phase once
        if (!spinPhaseInitialized) {
          spinPhaseInitialized = true;
          spinPhaseStartTime = timestamp;
          spinPhaseStartRotation = rotationRef.current;

          // Ensure final wheel state is drawn
          drawWheel(ctx, remainingItemsRef.current, size);

          // Get the final remaining items and find winner's index
          const remaining = remainingItemsRef.current;
          const winnerFinalIndex = remaining.findIndex(
            (item) => item.id === winner.id
          );

          // Safety check - winner must be in remaining items
          if (winnerFinalIndex === -1) {
            console.error("Winner not found in remaining items!");
            onSpinComplete(winner);
            return;
          }

          const numRemaining = remaining.length;
          const segmentAngle = (2 * Math.PI) / numRemaining;

          // Calculate the rotation needed to put the winner's center at the pointer
          // Pointer is at top of canvas (-π/2 in standard canvas coordinates)
          // Segment i's center angle = rotation + (i + 0.5) * segmentAngle - π/2
          // For center to be at -π/2: rotation = -(i + 0.5) * segmentAngle
          const targetAngleForWinner = -(winnerFinalIndex + 0.5) * segmentAngle;

          // Normalize current rotation to [0, 2π)
          const currentNormalized =
            ((rotationRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

          // Normalize target to [0, 2π)
          const targetNormalized =
            ((targetAngleForWinner % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

          // Calculate the forward distance to target (always positive)
          let forwardDistance = targetNormalized - currentNormalized;
          if (forwardDistance <= 0) {
            forwardDistance += 2 * Math.PI;
          }

          // Add 5-8 extra FULL rotations for visual effect (must be integer!)
          const extraRotations = 5 + Math.floor(Math.random() * 4);
          const totalSpinAmount = extraRotations * 2 * Math.PI + forwardDistance;

          targetRotation = spinPhaseStartRotation + totalSpinAmount;
        }

        const spinElapsed = timestamp - spinPhaseStartTime;
        const spinProgress = Math.min(spinElapsed / spinOnlyDuration, 1);

        // Cubic ease-out for natural deceleration
        const easedProgress = 1 - Math.pow(1 - spinProgress, 3);

        // Interpolate rotation
        rotationRef.current =
          spinPhaseStartRotation +
          (targetRotation - spinPhaseStartRotation) * easedProgress;

        // Play tick sound when passing a slice boundary during spin-down
        if (onTick && remainingItemsRef.current.length > 0) {
          const sliceAngle = (2 * Math.PI) / remainingItemsRef.current.length;
          const currentSliceIndex = Math.floor(
            ((rotationRef.current % (2 * Math.PI)) + 2 * Math.PI) / sliceAngle
          ) % remainingItemsRef.current.length;

          if (currentSliceIndex !== lastSliceIndexRef.current) {
            lastSliceIndexRef.current = currentSliceIndex;
            onTick();
          }
        }

        // Update CSS rotation for GPU-accelerated transform (no canvas redraw needed!)
        setCssRotation(rotationRef.current);

        if (spinProgress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - winner is now under pointer
          if (onSelectionComplete) {
            onSelectionComplete();
          }
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
  }, [isSpinning, items, spinDuration, onSpinComplete, onTick, onSelectionComplete, drawWheel, size]);

  // Reset wheel
  useEffect(() => {
    if (!isSpinning && !selectedItem) {
      remainingItemsRef.current = items;
      const ctx = ctxRef.current;
      if (!ctx || !imagesLoaded) return;

      // Redraw wheel at rotation=0 and reset CSS rotation
      drawWheel(ctx, items, size);
      setCssRotation(rotationRef.current);
    }
  }, [isSpinning, selectedItem, items, imagesLoaded, drawWheel, size]);

  // Calculate pointer dimensions based on size
  const pointerHeight = size * 0.07;
  const pointerWidth = size * 0.06;

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-lg sm:text-xl font-bold mb-1 text-pink-400">
        {title}
      </h2>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Rotating wheel canvas - GPU accelerated via CSS transform */}
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{
            width: size,
            height: size,
            // Clip to circle so rotating square background isn't visible
            borderRadius: "50%",
            // GPU acceleration hints
            willChange: "transform",
            transform: `translateZ(0) rotate(${cssRotation}rad)`,
            // Ensure smooth rendering
            backfaceVisibility: "hidden",
            perspective: 1000,
          }}
        />
        {/* Fixed pointer overlay - does not rotate */}
        <svg
          className="absolute pointer-events-none"
          style={{
            top: size * 0.02,
            left: "50%",
            transform: "translateX(-50%)",
            width: pointerWidth,
            height: pointerHeight,
            filter: "drop-shadow(0 0 10px #f59e0b)",
          }}
          viewBox="0 0 60 70"
          fill="none"
        >
          <polygon
            points="30,0 0,70 60,70"
            fill="#f59e0b"
            stroke="#fcd34d"
            strokeWidth="4"
          />
        </svg>
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
