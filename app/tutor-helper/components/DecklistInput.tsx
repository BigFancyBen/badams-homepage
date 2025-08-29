"use client";

import { useState } from "react";
import { parseDecklist, ParsedDecklist } from "../utils/decklistParser";

interface DecklistInputProps {
  onDecklistParsed: (decklist: ParsedDecklist, originalInput?: string) => void;
  initialInput?: string;
}

export function DecklistInput({
  onDecklistParsed,
  initialInput,
}: DecklistInputProps) {
  const [input, setInput] = useState(initialInput || "");
  const [lastParsed, setLastParsed] = useState<ParsedDecklist | null>(null);

  const handleParse = () => {
    const parsed = parseDecklist(input);
    setLastParsed(parsed);
    onDecklistParsed(parsed, input);
  };

  const handleClear = () => {
    setInput("");
    setLastParsed(null);
    onDecklistParsed({ cards: [], errors: [], totalCards: 0 });
  };

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="decklist-input"
          className="block text-lg font-semibold text-[#e5e5e5] mb-3"
        >
          Paste your decklist below:
        </label>
        <div className="text-sm text-[#cccccc] mb-4 bg-[#2a2a2a] border border-[#404040] p-4">
          <p className="mb-2 font-medium">Supported formats:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Moxfield, Archidekt, TappedOut URLs (coming soon)</li>
            <li>Line format: "1 Card Name" or "2x Card Name"</li>
            <li>Comma separated: "Card One, Card Two, Card Three"</li>
            <li>Handles double-faced cards: "Card Name // Other Side"</li>
          </ul>
        </div>

        <textarea
          id="decklist-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your decklist here...

Examples:
1 Lightning Bolt
2 Forest
1 Jace, the Mind Sculptor

Or: Lightning Bolt, Forest, Jace the Mind Sculptor

Or: https://www.moxfield.com/decks/your-deck-id"
          className="w-full h-16 p-4 border-2 border-[#404040] bg-[#2a2a2a] text-[#e5e5e5] font-mono text-sm resize-y focus:ring-2 focus:ring-[#4ade80] focus:border-[#4ade80] transition-colors"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleParse}
          disabled={!input.trim()}
          className="px-6 py-3 bg-[#4ade80] text-black font-semibold hover:bg-[#22c55e] disabled:bg-[#374151] disabled:text-[#6b7280] disabled:cursor-not-allowed transition-colors"
        >
          Parse Decklist
        </button>

        {(input || lastParsed) && (
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-[#991b1b] text-white font-semibold hover:bg-[#b91c1b] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {lastParsed && (
        <div className="p-4 bg-[#2a2a2a] border-2 border-[#404040]">
          {lastParsed.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-red-400 mb-2">Issues found:</h4>
              <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
                {lastParsed.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {lastParsed.cards.length > 0 && (
            <div>
              <h4 className="font-semibold text-green-400 mb-3">
                Successfully parsed {lastParsed.cards.length} unique cards (
                {lastParsed.totalCards} total cards)
              </h4>
              <div className="text-sm text-[#cccccc] max-h-40 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {lastParsed.cards.slice(0, 30).map((card, index) => (
                    <div
                      key={index}
                      className="flex justify-between bg-[#1a1a1a] p-2 border border-[#404040]"
                    >
                      <span className="truncate font-medium text-[#e5e5e5]">
                        {card.name}
                      </span>
                      <span className="text-[#cccccc] ml-2 font-semibold">
                        ×{card.quantity}
                      </span>
                    </div>
                  ))}
                </div>
                {lastParsed.cards.length > 30 && (
                  <p className="text-[#cccccc] mt-3 text-center font-medium">
                    ... and {lastParsed.cards.length - 30} more cards
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
