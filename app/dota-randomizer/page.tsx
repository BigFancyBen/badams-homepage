"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useDotaData } from "./hooks/useDotaData";
import { useSoundEffects } from "./hooks/useSoundEffects";
import SpinWheel from "./components/SpinWheel";
import ResultDisplay from "./components/ResultDisplay";
import CowardDisplay from "./components/CowardDisplay";
import { WheelItem, SpinState } from "./types";

const SPIN_DURATION = 10000; // 10 seconds

function useWheelSize() {
  const [wheelSize, setWheelSize] = useState(400);

  useEffect(() => {
    const calculateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // For mobile/small screens (single column), use nearly full width
      if (width < 1024) {
        // Leave minimal padding - wheels stack vertically
        const maxWidth = width - 16;
        setWheelSize(maxWidth);
      } else {
        // For larger screens (side by side), maximize both dimensions
        // Each wheel gets roughly half the width minus gap
        const gap = 32; // Gap between wheels
        const horizontalPadding = 16; // Minimal side padding
        const availableWidth = (width - gap - horizontalPadding * 2) / 2;

        // Use most of vertical space - account for header (~100px) and button area (~120px)
        const availableHeight = height - 220;

        // Use the smaller of width/height to keep wheels circular and maximize size
        const maxSize = Math.min(availableWidth, availableHeight);
        setWheelSize(Math.max(300, maxSize));
      }
    };

    calculateSize();
    window.addEventListener("resize", calculateSize);
    return () => window.removeEventListener("resize", calculateSize);
  }, []);

  return wheelSize;
}

export default function DotaRandomizerPage() {
  const { heroes, items, loading, error } = useDotaData();
  const wheelSize = useWheelSize();
  const [isMuted, setIsMuted] = useState(false);
  const [showCoward, setShowCoward] = useState(false);
  const { playTick, playDing, playFanfare } = useSoundEffects(isMuted);
  const [spinState, setSpinState] = useState<SpinState>({
    isSpinning: false,
    selectedHero: null,
    selectedItem: null,
    showResult: false,
  });

  const [completedCount, setCompletedCount] = useState(0);

  const handleSpin = useCallback(() => {
    if (spinState.isSpinning) return;

    setSpinState({
      isSpinning: true,
      selectedHero: null,
      selectedItem: null,
      showResult: false,
    });
    setCompletedCount(0);
  }, [spinState.isSpinning]);

  const handleHeroComplete = useCallback((hero: WheelItem) => {
    setSpinState((prev) => ({ ...prev, selectedHero: hero }));
    setCompletedCount((c) => c + 1);
  }, []);

  const handleItemComplete = useCallback((item: WheelItem) => {
    setSpinState((prev) => ({ ...prev, selectedItem: item }));
    setCompletedCount((c) => c + 1);
  }, []);

  // Show results when both wheels complete
  const bothComplete = completedCount >= 2;
  if (bothComplete && !spinState.showResult) {
    setTimeout(() => {
      setSpinState((prev) => ({
        ...prev,
        isSpinning: false,
        showResult: true,
      }));
    }, 100);
  }

  const handleReset = useCallback(() => {
    setSpinState({
      isSpinning: false,
      selectedHero: null,
      selectedItem: null,
      showResult: false,
    });
    setCompletedCount(0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (!isMuted) {
      setShowCoward(true);
    }
    setIsMuted((prev) => !prev);
  }, [isMuted]);

  const handleCowardDismiss = useCallback(() => {
    setShowCoward(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-400">Loading Dota 2 data...</p>
          <p className="text-gray-500 text-sm mt-2">
            Fetching heroes and items from OpenDota API
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">
            Failed to load Dota 2 data
          </h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-purple-950/20 via-transparent to-amber-950/20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 text-center pt-4 pb-2">
        <Link
          href="/"
          className="absolute top-2 left-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-amber-400">
          Dota 2 Randomizer
        </h1>
      </header>

      {/* Main content */}
      <main className="relative z-10 w-full px-2 py-2">
        {/* Wheels container */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-2 lg:gap-8">
          <SpinWheel
            items={heroes}
            title="Heroes"
            isSpinning={spinState.isSpinning}
            selectedItem={spinState.selectedHero}
            onSpinComplete={handleHeroComplete}
            spinDuration={SPIN_DURATION}
            size={wheelSize}
            onTick={playTick}
            onSelectionComplete={playDing}
          />

          <SpinWheel
            items={items}
            title="Items"
            isSpinning={spinState.isSpinning}
            selectedItem={spinState.selectedItem}
            onSpinComplete={handleItemComplete}
            spinDuration={SPIN_DURATION}
            size={wheelSize}
            onTick={playTick}
            onSelectionComplete={playDing}
          />
        </div>

        {/* Spin button */}
        <div className="text-center mt-4">
          {!spinState.showResult ? (
            <button
              onClick={handleSpin}
              disabled={spinState.isSpinning}
              className={`
                px-12 py-4 text-xl font-black uppercase tracking-wider
                transition-all duration-300 transform
                ${
                  spinState.isSpinning
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-linear-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30"
                }
              `}
            >
              {spinState.isSpinning ? (
                <span className="flex items-center gap-3">
                  <span className="animate-spin w-6 h-6 border-2 border-white border-t-transparent" />
                  Spinning...
                </span>
              ) : (
                "Spin the Wheels!"
              )}
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="px-12 py-4 text-xl font-black uppercase tracking-wider bg-linear-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white transition-all duration-300 transform hover:scale-105"
            >
              Spin Again
            </button>
          )}
        </div>
      </main>

      {/* Result overlay */}
      <ResultDisplay
        hero={spinState.selectedHero}
        item={spinState.selectedItem}
        show={spinState.showResult}
        onFanfare={playFanfare}
      />

      {/* Click anywhere to dismiss result */}
      {spinState.showResult && (
        <div
          className="fixed inset-0 z-40 cursor-pointer"
          onClick={handleReset}
        />
      )}

      {/* Mute button */}
      <button
        onClick={handleMuteToggle}
        className={`
          fixed bottom-4 right-4 z-30 p-3
          transition-all duration-300 transform hover:scale-110
          ${isMuted
            ? "bg-red-900/80 border-2 border-red-500 text-red-300"
            : "bg-gray-800/80 border-2 border-gray-600 text-gray-300 hover:border-gray-400"
          }
        `}
        title={isMuted ? "Unmute sounds" : "Mute sounds"}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {/* Coward display overlay */}
      <CowardDisplay show={showCoward} onComplete={handleCowardDismiss} />
    </div>
  );
}
