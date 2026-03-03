"use client";

interface EndOfTurnBannerProps {
  visible: boolean;
  onEndTurn: () => void;
}

export function EndOfTurnBanner({ visible, onEndTurn }: EndOfTurnBannerProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a1a] border-t-2 border-[#fbbf24]/40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span className="text-sm text-[#fbbf24]">
          Temporary buffs are active
        </span>
        <button
          onClick={onEndTurn}
          className="px-6 py-2 bg-[#fbbf24] text-black font-bold text-sm hover:bg-[#f59e0b] transition-colors"
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
