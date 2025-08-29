"use client";

import Image from "next/image";
import { useState } from "react";
import { MagicCard } from "../types";
import { getPrimaryCardType } from "../utils/cardTypeUtils";

// Color mapping for each card type
const getCardTypeColor = (cardType: string): string => {
  switch (cardType.toLowerCase()) {
    case "land":
      return "bg-green-200 border-green-300"; // Green for lands
    case "artifact":
      return "bg-gray-200 border-gray-300"; // Gray for artifacts
    case "enchantment":
      return "bg-purple-200 border-purple-300"; // Purple for enchantments
    case "creature":
      return "bg-orange-200 border-orange-300"; // Orange for creatures
    case "instant":
      return "bg-blue-200 border-blue-300"; // Blue for instants
    case "sorcery":
      return "bg-red-200 border-red-300"; // Red for sorceries
    case "planeswalker":
      return "bg-yellow-200 border-yellow-300"; // Yellow for planeswalkers
    case "battle":
      return "bg-pink-200 border-pink-300"; // Pink for battles
    default:
      return "bg-slate-200 border-slate-300"; // Default gray
  }
};

interface CardGridProps {
  cards: MagicCard[];
  loading: boolean;
}

export function CardGrid({ cards, loading }: CardGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading cards...</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">No cards match your filters</p>
      </div>
    );
  }

  const getCardImage = (card: MagicCard) => {
    // Handle double-faced cards
    if (card.card_faces && card.card_faces[0]?.image_uris) {
      return card.card_faces[0].image_uris.normal;
    }
    return card.image_uris?.normal || "/placeholder-card.svg";
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1">
      {cards.map((card) => {
        return (
          <div
            key={card.id}
            className="hover:opacity-80 transition-opacity cursor-pointer"
            title={`${card.name} - ${card.type_line} (CMC: ${card.cmc})`}
          >
            <div className="aspect-[488/680] relative overflow-hidden">
              <Image
                src={getCardImage(card)}
                alt={card.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
