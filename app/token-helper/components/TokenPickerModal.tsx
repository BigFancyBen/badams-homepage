"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { DiscoveredToken } from "../types";

interface TokenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: DiscoveredToken[];
  onAddTokens: (tokens: DiscoveredToken[]) => void;
}

export function TokenPickerModal({
  isOpen,
  onClose,
  tokens,
  onAddTokens,
}: TokenPickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const handleClose = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  const sortedTokens = useMemo(
    () =>
      [...tokens].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [tokens]
  );

  const filteredTokens = useMemo(() => {
    if (!search.trim()) return sortedTokens;
    const query = search.trim().toLowerCase();
    return sortedTokens.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.sourceCards.some((s) => s.toLowerCase().includes(query))
    );
  }, [sortedTokens, search]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const toggleToken = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of filteredTokens) {
        next.add(t.scryfallId);
      }
      return next;
    });
  };

  const handleAdd = () => {
    const selectedTokens = tokens.filter((t) => selected.has(t.scryfallId));
    onAddTokens(selectedTokens);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl mx-4 bg-[#222222] border border-[#333333] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#1a1a1a] border-b border-[#333333] shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold text-[#e5e5e5]">
              Discovered Tokens ({tokens.length})
            </h2>
            <button
              onClick={handleClose}
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
          {tokens.length > 0 && (
            <div className="px-3 sm:px-4 pb-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Search by token or card name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-8 py-2 bg-[#1a1a1a] border border-[#333333] text-[#e5e5e5] placeholder-[#6b7280] text-sm focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30 focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#e5e5e5] transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
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
                )}
              </div>
              {search.trim() && (
                <p className="text-xs text-[#6b7280] mt-1.5">
                  Showing {filteredTokens.length} of {tokens.length} tokens
                </p>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {tokens.length === 0 ? (
            <p className="text-center text-[#6b7280] py-8">
              No tokens found in this deck.
            </p>
          ) : filteredTokens.length === 0 ? (
            <p className="text-center text-[#6b7280] py-8">
              No tokens match your search
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredTokens.map((token) => {
                const isSelected = selected.has(token.scryfallId);
                return (
                  <button
                    key={token.scryfallId}
                    onClick={() => toggleToken(token.scryfallId)}
                    className={`text-left border-2 transition-colors ${
                      isSelected
                        ? "border-[#4ade80] bg-[#4ade80]/10"
                        : "border-[#333333] bg-[#1a1a1a] hover:border-[#404040]"
                    }`}
                  >
                    <div className="relative aspect-[488/680] w-full">
                      <Image
                        src={token.imageUrl}
                        alt={token.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-[#4ade80] flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-black"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-sm font-medium text-[#e5e5e5] truncate">
                        {token.name}
                      </div>
                      {token.basePower !== null &&
                        token.baseToughness !== null && (
                          <div className="text-xs text-[#9ca3af]">
                            {token.basePower}/{token.baseToughness}
                          </div>
                        )}
                      <div className="text-xs text-[#6b7280] truncate mt-0.5">
                        From: {token.sourceCards.join(", ")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {tokens.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-t border-[#333333] shrink-0">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm text-[#cccccc] border border-[#404040] hover:bg-[#2a2a2a] transition-colors"
            >
              Select All
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-4 py-1.5 bg-[#4ade80] text-black text-sm font-medium hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Selected ({selected.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
