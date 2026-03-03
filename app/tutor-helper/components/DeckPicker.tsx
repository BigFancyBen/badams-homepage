"use client";

import { useState, useRef, useEffect } from "react";
import { SavedDeck } from "../hooks/useDeckStorage";

interface DeckPickerProps {
  decks: SavedDeck[];
  activeDeckId: string | null;
  onSelectDeck: (deckId: string) => void;
  onManageDecks: () => void;
}

export function DeckPicker({
  decks,
  activeDeckId,
  onSelectDeck,
  onManageDecks,
}: DeckPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // No decks: just show the "+" button
  if (decks.length === 0) {
    return (
      <button
        onClick={onManageDecks}
        className="p-1.5 bg-[#4ade80] text-black hover:bg-[#22c55e] transition-colors"
        title="Manage Decks"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    );
  }

  const activeDeck = decks.find((d) => d.id === activeDeckId);

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-sm text-[#cccccc] px-3 py-1.5 bg-[#2a2a2a] border border-[#404040] hover:bg-[#333333] transition-colors max-w-[180px] sm:max-w-[240px]"
        >
          <span className="truncate">
            {activeDeck?.name ?? "Select deck"}
          </span>
          <svg
            className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-[#2a2a2a] border border-[#404040] shadow-lg z-50 max-h-64 overflow-y-auto">
            {decks.map((deck) => (
              <button
                key={deck.id}
                onClick={() => {
                  onSelectDeck(deck.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                  deck.id === activeDeckId
                    ? "text-[#4ade80] bg-[#333333] border-l-2 border-l-[#4ade80]"
                    : "text-[#cccccc] hover:bg-[#333333] border-l-2 border-l-transparent"
                }`}
              >
                {deck.name}
              </button>
            ))}
            <div className="border-t border-[#404040]">
              <button
                onClick={() => {
                  setOpen(false);
                  onManageDecks();
                }}
                className="w-full text-left px-3 py-2 text-sm text-[#9ca3af] hover:bg-[#333333] hover:text-[#cccccc] transition-colors"
              >
                Manage Decks...
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manage button */}
      <button
        onClick={onManageDecks}
        className="p-1.5 bg-[#4ade80] text-black hover:bg-[#22c55e] transition-colors"
        title="Manage Decks"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
}
