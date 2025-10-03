"use client";

import { useState } from "react";
import { SavedDeck } from "../hooks/useDeckStorage";
import { parseDecklist, ParsedDecklist } from "../utils/decklistParser";

interface DeckManagerProps {
  decks: SavedDeck[];
  activeDeckId: string | null;
  onSelectDeck: (deckId: string) => void;
  onAddDeck: (name: string, decklist: ParsedDecklist, originalInput: string) => void;
  onRemoveDeck: (deckId: string) => void;
  onClose: () => void;
}

export function DeckManager({
  decks,
  activeDeckId,
  onSelectDeck,
  onAddDeck,
  onRemoveDeck,
  onClose,
}: DeckManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckInput, setNewDeckInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const handleAddDeck = () => {
    if (!newDeckName.trim()) {
      setParseError("Please enter a deck name");
      return;
    }

    if (!newDeckInput.trim()) {
      setParseError("Please paste a decklist");
      return;
    }

    try {
      const parsed = parseDecklist(newDeckInput);
      
      if (parsed.cards.length === 0) {
        setParseError("No valid cards found in the decklist");
        return;
      }

      onAddDeck(newDeckName.trim(), parsed, newDeckInput);
      setNewDeckName("");
      setNewDeckInput("");
      setParseError(null);
      setIsAdding(false);
      onClose();
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse decklist");
    }
  };

  const handleSelectDeck = (deckId: string) => {
    onSelectDeck(deckId);
    onClose();
  };

  return (
    <div className="space-y-4">
      {/* Deck List */}
      {!isAdding && decks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[#e5e5e5] mb-3">Your Decks</h3>
          <div className="space-y-2">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className={`flex items-center justify-between p-4 border-2 transition-colors ${
                  deck.id === activeDeckId
                    ? "bg-[#2a2a2a] border-[#4ade80]"
                    : "bg-[#1a1a1a] border-[#404040] hover:border-[#606060]"
                }`}
              >
                <button
                  onClick={() => handleSelectDeck(deck.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-semibold text-[#e5e5e5]">{deck.name}</div>
                  <div className="text-sm text-[#cccccc]">
                    {deck.decklist.cards.length} unique cards ({deck.decklist.totalCards} total)
                  </div>
                </button>
                <button
                  onClick={() => onRemoveDeck(deck.id)}
                  className="ml-4 p-2 text-[#991b1b] hover:text-white hover:bg-[#991b1b] transition-colors"
                  title="Remove deck"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Deck Section */}
      {isAdding ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="deck-name" className="block text-lg font-semibold text-[#e5e5e5] mb-2">
              Deck Name
            </label>
            <input
              id="deck-name"
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="e.g., Mono Red Aggro"
              className="w-full p-3 border-2 border-[#404040] bg-[#2a2a2a] text-[#e5e5e5] focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="deck-input" className="block text-lg font-semibold text-[#e5e5e5] mb-2">
              Decklist
            </label>
            <textarea
              id="deck-input"
              value={newDeckInput}
              onChange={(e) => setNewDeckInput(e.target.value)}
              placeholder="Paste your decklist here...

Examples:
1 Lightning Bolt
2 Forest
1 Jace, the Mind Sculptor

Or: Lightning Bolt, Forest, Jace the Mind Sculptor"
              className="w-full h-48 p-4 border-2 border-[#404040] bg-[#2a2a2a] text-[#e5e5e5] font-mono text-sm resize-y focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-colors"
            />
          </div>

          {parseError && (
            <div className="p-3 bg-[#991b1b] bg-opacity-20 border border-[#991b1b] text-red-300">
              {parseError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAddDeck}
              className="px-6 py-3 bg-[#4ade80] text-black font-semibold hover:bg-[#22c55e] transition-colors"
            >
              Add Deck
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewDeckName("");
                setNewDeckInput("");
                setParseError(null);
              }}
              className="px-6 py-3 bg-[#404040] text-white font-semibold hover:bg-[#606060] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full px-6 py-3 bg-[#4ade80] text-black font-semibold hover:bg-[#22c55e] transition-colors"
        >
          + Add New Deck
        </button>
      )}

      {/* Empty State */}
      {!isAdding && decks.length === 0 && (
        <div className="text-center py-8">
          <div className="text-[#6b7280] mb-4">
            <svg
              className="mx-auto h-16 w-16 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[#cccccc] mb-2">
            No Decks Saved
          </h3>
          <p className="text-[#9ca3af] mb-6">
            Add your first deck to get started with the tutor helper.
          </p>
        </div>
      )}
    </div>
  );
}
