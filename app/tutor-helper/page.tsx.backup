"use client";

import { useMemo, useState, useEffect } from "react";
import { useScryfall } from "./hooks/useScryfall";
import { useCardFilters } from "./hooks/useCardFilters";
import { useLocalStorageCache } from "./hooks/useLocalStorageCache";
import { ManaCostFilter } from "./components/ManaCostFilter";
import { CardTypeFilter } from "./components/CardTypeFilter";
import { CardGrid } from "./components/CardGrid";
import { ImportModal } from "./components/ImportModal";
import { TypeSearchField } from "./components/TypeSearchField";
import { filterCards } from "./utils/cardFilters";
import { ParsedDecklist } from "./utils/decklistParser";

export default function TutorHelperPage() {
  const [decklistCards, setDecklistCards] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [sortBy, setSortBy] = useState<"mana" | "name">("mana");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { isLoaded, saveDecklist, loadDecklist, clearDecklist, cleanupCache } =
    useLocalStorageCache();

  const { cards, loading, error } = useScryfall(decklistCards);
  const {
    filters,
    toggleManaCost,
    toggleCardType,
    toggleTypeLogic,
    toggleTypeSearch,
    resetFilters,
  } = useCardFilters();

  // Load cached decklist on initial load
  useEffect(() => {
    if (isLoaded) {
      const cached = loadDecklist();
      if (cached) {
        setImportInput(cached.originalInput);
        if (cached.decklist.cards.length > 0) {
          const cardNames = cached.decklist.cards.map((card) => card.name);
          setDecklistCards(cardNames);
        }
      }
      // Cleanup expired cache entries
      cleanupCache();
    }
  }, [isLoaded, loadDecklist, cleanupCache]);

  const handleDecklistParsed = (
    decklist: ParsedDecklist,
    originalInput?: string
  ) => {
    if (decklist.cards.length > 0) {
      const cardNames = decklist.cards.map((card) => card.name);
      setDecklistCards(cardNames);
      // Save to localStorage with original input
      if (originalInput) {
        saveDecklist(decklist, originalInput);
        setImportInput(originalInput);
      }
    } else {
      setDecklistCards([]);
      clearDecklist();
      setImportInput("");
    }
  };

  const filteredCards = useMemo(() => {
    const filtered = filterCards(cards, filters);

    // Sort the filtered cards
    return filtered.sort((a, b) => {
      if (sortBy === "mana") {
        const diff = a.cmc - b.cmc;
        return sortOrder === "asc" ? diff : -diff;
      } else {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        const diff = nameA.localeCompare(nameB);
        return sortOrder === "asc" ? diff : -diff;
      }
    });
  }, [cards, filters, sortBy, sortOrder]);

  const hasActiveFilters =
    filters.manaCosts.length > 0 ||
    filters.cardTypes.length > 0 ||
    filters.typeSearch.length > 0;

  const toggleManaSort = () => {
    if (sortBy === "mana") {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy("mana");
      setSortOrder("asc");
    }
  };

  const toggleNameSort = () => {
    if (sortBy === "name") {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy("name");
      setSortOrder("asc");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Import Modal */}
        <ImportModal
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          onDecklistParsed={handleDecklistParsed}
          initialInput={importInput}
        />

        {/* Filters */}
        <div className="bg-[#222222] border border-[#333333] p-3 sm:p-6 mb-3 sm:mb-6 relative">
          {/* Import Button - Absolutely positioned top right */}
          <button
            onClick={() => setShowImport(!showImport)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 bg-[#4ade80] text-black hover:bg-[#22c55e] transition-colors"
            title={showImport ? "Hide Import" : "Import Decklist"}
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

          <div className="mb-2 sm:mb-4 pr-12">
            <div className="flex gap-1 sm:gap-2 flex-wrap">
              <ManaCostFilter
                selectedCosts={filters.manaCosts}
                onToggleCost={toggleManaCost}
              />
            </div>
          </div>

          <CardTypeFilter
            selectedTypes={filters.cardTypes}
            onToggleType={toggleCardType}
          />

          {/* Advanced Type Search */}
          <div className="mt-2">
            <TypeSearchField
              selectedTypes={filters.typeSearch}
              onTypeChange={toggleTypeSearch}
            />
          </div>
        </div>

        {/* Results */}
        <div className="bg-[#222222] border border-[#333333] p-3 sm:p-6">
          {/* Results Header */}
          {(filteredCards.length > 0 || decklistCards.length > 0) && (
            <div className="flex justify-between items-center mb-2 sm:mb-4">
              {/* Card Count - Left Side */}
              <span className="text-sm sm:text-base font-semibold text-[#e5e5e5]">
                {hasActiveFilters
                  ? `${filteredCards.length}/${cards.length}`
                  : `${cards.length}/${cards.length}`}
              </span>

              {/* Control Buttons - Right Side */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Mana Sort Button */}
                <button
                  onClick={toggleManaSort}
                  className={`w-12 h-8 border transition-colors flex items-center justify-center ${
                    sortBy === "mana"
                      ? "bg-[#4ade80] text-black border-[#4ade80]"
                      : "bg-[#2a2a2a] text-[#e5e5e5] border-[#404040] hover:bg-[#3a3a3a]"
                  }`}
                  title={`Sort by mana value ${
                    sortBy === "mana" && sortOrder === "asc"
                      ? "descending"
                      : "ascending"
                  }`}
                >
                  <span className="text-xs sm:text-sm">
                    {sortBy === "mana" && sortOrder === "desc" ? "↓" : "↑"}
                  </span>
                </button>

                {/* Name Sort Button */}
                <button
                  onClick={toggleNameSort}
                  className={`w-12 h-8 border transition-colors flex items-center justify-center ${
                    sortBy === "name"
                      ? "bg-[#4ade80] text-black border-[#4ade80]"
                      : "bg-[#2a2a2a] text-[#e5e5e5] border-[#404040] hover:bg-[#3a3a3a]"
                  }`}
                  title={`Sort alphabetically ${
                    sortBy === "name" && sortOrder === "asc"
                      ? "descending"
                      : "ascending"
                  }`}
                >
                  <span className="text-xs sm:text-sm font-serif">
                    {sortBy === "name" && sortOrder === "desc" ? "Z" : "A"}
                  </span>
                </button>

                {/* AND/OR Button */}
                {filters.cardTypes.length + filters.typeSearch.length > 1 && (
                  <button
                    onClick={toggleTypeLogic}
                    className={`w-12 h-8 border transition-colors flex items-center justify-center ${
                      filters.typeLogic === "and"
                        ? "bg-[#4ade80] text-black border-[#4ade80]"
                        : "bg-[#2a2a2a] text-[#e5e5e5] border-[#404040] hover:bg-[#3a3a3a]"
                    }`}
                    title={
                      filters.typeLogic === "and"
                        ? "Cards must match ALL selected types"
                        : "Cards must match ANY selected type"
                    }
                  >
                    <span
                      className={`font-medium ${
                        filters.typeLogic === "and"
                          ? "text-xs sm:text-sm"
                          : "text-xs"
                      }`}
                    >
                      {filters.typeLogic === "and" ? "&" : "OR"}
                    </span>
                  </button>
                )}

                {/* Reset Button */}
                <button
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className={`w-12 h-8 border transition-colors flex items-center justify-center ${
                    hasActiveFilters
                      ? "bg-[#991b1b] text-white hover:bg-[#b91c1b] border-[#991b1b]"
                      : "bg-[#374151] text-[#6b7280] cursor-not-allowed border-[#404040]"
                  }`}
                  title="Reset All Filters"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {filteredCards.length > 0 ? (
            <CardGrid cards={filteredCards} loading={loading} />
          ) : !loading && decklistCards.length === 0 ? (
            <div className="text-center py-16">
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
                No Decklist Loaded
              </h3>
              <p className="text-[#9ca3af] mb-6">
                Click &quot;Import Decklist&quot; to get started with filtering
                your Magic cards.
              </p>
              <button
                onClick={() => setShowImport(true)}
                className="px-6 py-3 bg-[#4ade80] text-black hover:bg-[#22c55e] transition-colors font-semibold"
              >
                Import Your First Decklist
              </button>
            </div>
          ) : (
            <CardGrid cards={filteredCards} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
