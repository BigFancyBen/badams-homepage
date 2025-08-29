"use client";

import { useEffect } from "react";
import { DecklistInput } from "./DecklistInput";
import { ParsedDecklist } from "../utils/decklistParser";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDecklistParsed: (decklist: ParsedDecklist, originalInput?: string) => void;
  initialInput?: string;
}

export function ImportModal({
  isOpen,
  onClose,
  onDecklistParsed,
  initialInput,
}: ImportModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDecklistParsed = (
    decklist: ParsedDecklist,
    originalInput?: string
  ) => {
    onDecklistParsed(decklist, originalInput);
    if (decklist.cards.length > 0) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] mx-4 bg-[#222222] border border-[#333333] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a1a] text-white px-8 py-6 relative">
          <h2 className="text-2xl font-bold text-white">Import Decklist</h2>
          <p className="text-[#cccccc] mt-2">
            Import your Magic: The Gathering decklist from various formats
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-8 text-[#cccccc] hover:text-white transition-colors text-2xl font-bold leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          <div className="p-8">
            <DecklistInput
              onDecklistParsed={handleDecklistParsed}
              initialInput={initialInput}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
