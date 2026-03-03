"use client";

import { useEffect } from "react";
import { DeckImportForm } from "./DeckImportForm";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (deckName: string, cardNames: string[], originalInput: string, sourceUrl?: string) => void;
  loading?: boolean;
}

export function ImportModal({
  isOpen,
  onClose,
  onImport,
  loading,
}: ImportModalProps) {
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-[#222222] border border-[#333333]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-[#333333]">
          <h2 className="text-lg font-semibold text-[#e5e5e5]">
            Import Deck
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[#6b7280] hover:text-[#e5e5e5] transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <DeckImportForm onImport={onImport} loading={loading} />
        </div>
      </div>
    </div>
  );
}
