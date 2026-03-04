"use client";

import { useState } from "react";
import {
  isArchidektUrl,
  fetchArchidektDeck,
} from "../../tutor-helper/utils/archidektImport";
import { parseDecklist } from "../../tutor-helper/utils/decklistParser";

interface DeckImportFormProps {
  onImport: (deckName: string, cardNames: string[], originalInput: string, sourceUrl?: string) => void;
  loading?: boolean;
}

export function DeckImportForm({ onImport, loading }: DeckImportFormProps) {
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleArchidektImport = async () => {
    if (!urlInput.trim()) return;
    setImportError(null);
    setImporting(true);

    try {
      const { name, decklist, originalInput } =
        await fetchArchidektDeck(urlInput.trim());
      const cardNames = decklist.cards.map((c) => c.name);
      onImport(name, cardNames, originalInput, urlInput.trim());
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import deck"
      );
    } finally {
      setImporting(false);
    }
  };

  const handleTextImport = () => {
    if (!textInput.trim()) return;
    setImportError(null);

    const parsed = parseDecklist(textInput.trim());
    if (parsed.errors.length > 0 && parsed.cards.length === 0) {
      setImportError(parsed.errors.join(", "));
      return;
    }

    const cardNames = parsed.cards.map((c) => c.name);
    onImport("Imported Deck", cardNames, textInput.trim());
  };

  const isDisabled = loading || importing;

  return (
    <div className="space-y-6">
      {/* Archidekt URL Import */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          Import from Archidekt
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://archidekt.com/decks/..."
            className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#404040] text-[#e5e5e5] text-sm placeholder-[#6b7280] focus:outline-hidden focus:border-[#4ade80]"
            disabled={isDisabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isArchidektUrl(urlInput)) {
                handleArchidektImport();
              }
            }}
          />
          <button
            onClick={handleArchidektImport}
            disabled={isDisabled || !isArchidektUrl(urlInput)}
            className="px-4 py-2 bg-[#4ade80] text-black text-sm font-medium hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-[#333333]" />
        <span className="text-sm text-[#6b7280]">or</span>
        <div className="flex-1 border-t border-[#333333]" />
      </div>

      {/* Manual Paste */}
      <div>
        <label className="block text-sm font-medium text-[#cccccc] mb-2">
          Paste Decklist
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={"1 Sol Ring\n1 Avenger of Zendikar\n1 Smothering Tithe\n..."}
          rows={8}
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#404040] text-[#e5e5e5] text-sm placeholder-[#6b7280] focus:outline-hidden focus:border-[#4ade80] resize-y font-mono"
          disabled={isDisabled}
        />
        <button
          onClick={handleTextImport}
          disabled={isDisabled || !textInput.trim()}
          className="mt-2 px-4 py-2 bg-[#4ade80] text-black text-sm font-medium hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import Decklist
        </button>
      </div>

      {/* Error */}
      {importError && (
        <div className="px-3 py-2 bg-[#991b1b]/20 border border-[#991b1b] text-red-400 text-sm">
          {importError}
        </div>
      )}
    </div>
  );
}
