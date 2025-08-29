"use client";

interface ManaCostFilterProps {
  selectedCosts: number[];
  onToggleCost: (cost: number) => void;
}

export function ManaCostFilter({
  selectedCosts,
  onToggleCost,
}: ManaCostFilterProps) {
  const costs = [0, 1, 2, 3, 4, 5, 6, 7]; // 7+ will be handled as 7

  return (
    <>
      {costs.map((cost) => (
        <button
          key={cost}
          onClick={() => onToggleCost(cost)}
          className={`px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm border-2 transition-colors ${
            selectedCosts.includes(cost)
              ? "bg-[#4ade80] text-black border-[#4ade80]"
              : "bg-[#2a2a2a] text-[#e5e5e5] border-[#404040] hover:border-[#4ade80]"
          }`}
        >
          {cost === 7 ? "7+" : cost}
        </button>
      ))}
    </>
  );
}
