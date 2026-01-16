"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useDotaData } from "./hooks/useDotaData";
import SpinWheel from "./components/SpinWheel";
import ResultDisplay from "./components/ResultDisplay";
import { WheelItem, SpinState } from "./types";

const SPIN_DURATION = 5000; // 5 seconds

export default function DotaRandomizerPage() {
  const { heroes, items, loading, error } = useDotaData();
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
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-amber-950/20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 text-center pt-8 pb-4">
        <Link
          href="/"
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400">
          Dota 2 Randomizer
        </h1>
        <p className="text-gray-400 mt-2">
          Spin to get a random hero and item challenge
        </p>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        {/* Wheels container */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
          <SpinWheel
            items={heroes}
            title="Heroes"
            isSpinning={spinState.isSpinning}
            selectedItem={spinState.selectedHero}
            onSpinComplete={handleHeroComplete}
            spinDuration={SPIN_DURATION}
          />

          <SpinWheel
            items={items}
            title="Items"
            isSpinning={spinState.isSpinning}
            selectedItem={spinState.selectedItem}
            onSpinComplete={handleItemComplete}
            spinDuration={SPIN_DURATION}
          />
        </div>

        {/* Spin button */}
        <div className="text-center mt-12">
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
                    : "bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30"
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
              className="px-12 py-4 text-xl font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white transition-all duration-300 transform hover:scale-105"
            >
              Spin Again
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>
            {heroes.length} heroes &bull; {items.length} items
          </p>
          <p className="mt-1">
            Data auto-updates from OpenDota API
          </p>
        </div>
      </main>

      {/* Result overlay */}
      <ResultDisplay
        hero={spinState.selectedHero}
        item={spinState.selectedItem}
        show={spinState.showResult}
      />

      {/* Click anywhere to dismiss result */}
      {spinState.showResult && (
        <div
          className="fixed inset-0 z-40 cursor-pointer"
          onClick={handleReset}
        />
      )}
    </div>
  );
}
