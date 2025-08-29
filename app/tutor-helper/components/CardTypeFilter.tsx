"use client";

import { CARD_TYPES } from "../types";

// Color mapping for each card type to match CardGrid
const getCardTypeColor = (
  cardType: string
): { bg: string; border: string; hover: string } => {
  switch (cardType.toLowerCase()) {
    case "land":
      return {
        bg: "bg-green-200",
        border: "border-green-300",
        hover: "hover:bg-green-300",
      };
    case "artifact":
      return {
        bg: "bg-gray-200",
        border: "border-gray-300",
        hover: "hover:bg-gray-300",
      };
    case "enchantment":
      return {
        bg: "bg-purple-200",
        border: "border-purple-300",
        hover: "hover:bg-purple-300",
      };
    case "creature":
      return {
        bg: "bg-orange-200",
        border: "border-orange-300",
        hover: "hover:bg-orange-300",
      };
    case "instant":
      return {
        bg: "bg-blue-200",
        border: "border-blue-300",
        hover: "hover:bg-blue-300",
      };
    case "sorcery":
      return {
        bg: "bg-red-200",
        border: "border-red-300",
        hover: "hover:bg-red-300",
      };
    case "planeswalker":
      return {
        bg: "bg-yellow-200",
        border: "border-yellow-300",
        hover: "hover:bg-yellow-300",
      };
    case "battle":
      return {
        bg: "bg-pink-200",
        border: "border-pink-300",
        hover: "hover:bg-pink-300",
      };
    default:
      return {
        bg: "bg-slate-200",
        border: "border-slate-300",
        hover: "hover:bg-slate-300",
      };
  }
};

interface CardTypeFilterProps {
  selectedTypes: string[];
  onToggleType: (type: string) => void;
}

export function CardTypeFilter({
  selectedTypes,
  onToggleType,
}: CardTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-2">
      {CARD_TYPES.map((type) => {
        const colors = getCardTypeColor(type);
        return (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm border-2 transition-colors ${
              selectedTypes.includes(type)
                ? `${colors.bg} text-gray-800 ${colors.border}`
                : `bg-[#2a2a2a] text-[#e5e5e5] border-[#404040] ${colors.hover}`
            }`}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
