"use client";

import { useState, useCallback } from "react";
import { useTokenStorage } from "./hooks/useTokenStorage";
import { useScryfallTokens } from "./hooks/useScryfallTokens";
import { useTokenGameState } from "./hooks/useTokenGameState";
import { ImportModal } from "./components/ImportModal";
import { TokenPickerModal } from "./components/TokenPickerModal";
import { TokenGrid } from "./components/TokenGrid";
import { EndOfTurnBanner } from "./components/EndOfTurnBanner";
import { DiscoveredToken } from "./types";

export default function TokenHelperPage() {
  const [showImport, setShowImport] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  const {
    deckState,
    gameState,
    isLoaded,
    saveDeckState,
    saveGameState,
    clearAll,
  } = useTokenStorage();

  const { discoveredTokens, loading, error, progress, discoverTokens } =
    useScryfallTokens();

  const {
    activeTokens,
    addToken,
    removeStack,
    toggleTap,
    incrementCount,
    decrementCount,
    addPermanentCounter,
    removePermanentCounter,
    addTemporaryCounter,
    removeTemporaryCounter,
    splitStack,
    mergeStacks,
    clearTemporaryCounters,
    hasTemporaryCounters,
    resetGame,
  } = useTokenGameState({
    initialState: gameState,
    onStateChange: saveGameState,
  });

  // All tokens available: from current discovery or from saved deck state
  const availableTokens =
    discoveredTokens.length > 0
      ? discoveredTokens
      : deckState?.discoveredTokens ?? [];

  const handleImport = useCallback(
    async (
      deckName: string,
      cardNames: string[],
      originalInput: string,
      sourceUrl?: string
    ) => {
      setShowImport(false);

      const tokens = await discoverTokens(cardNames);

      saveDeckState({
        deckName,
        originalInput,
        sourceUrl,
        discoveredTokens: tokens,
        updatedAt: Date.now(),
      });

      if (tokens.length > 0) {
        setPickerKey((k) => k + 1);
        setShowPicker(true);
      }
    },
    [discoverTokens, saveDeckState]
  );

  const handleAddTokens = useCallback(
    (tokens: DiscoveredToken[]) => {
      for (const token of tokens) {
        addToken(token);
      }
    },
    [addToken]
  );

  const handleReset = useCallback(() => {
    resetGame();
    clearAll();
  }, [resetGame, clearAll]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#6b7280]">Loading...</div>
      </div>
    );
  }

  // State A: No deck loaded and no active tokens
  const hasDeck = deckState !== null;
  const hasTokens = activeTokens.length > 0;

  return (
    <div className="min-h-screen bg-[#1a1a1a] pb-16">
      {/* Header */}
      <div className="bg-[#222222] border-b border-[#333333] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#e5e5e5]">Token Helper</h1>
            {deckState && (
              <span className="text-sm text-[#6b7280] hidden sm:inline">
                {deckState.deckName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Token Picker */}
            {availableTokens.length > 0 && (
              <button
                onClick={() => {
                  setPickerKey((k) => k + 1);
                  setShowPicker(true);
                }}
                className="px-3 py-1.5 text-sm bg-[#4ade80] text-black font-medium hover:bg-[#22c55e] transition-colors"
              >
                Tokens
              </button>
            )}

            {/* Import */}
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 text-sm border border-[#404040] text-[#cccccc] hover:bg-[#2a2a2a] transition-colors"
            >
              Import
            </button>

            {/* Reset */}
            {(hasDeck || hasTokens) && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm border border-[#991b1b] text-red-400 hover:bg-[#991b1b]/20 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {loading && (
        <div className="bg-[#222222] border-b border-[#333333] px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#333333] h-2">
                <div
                  className="bg-[#4ade80] h-2 transition-all duration-200"
                  style={{
                    width:
                      progress.total > 0
                        ? `${(progress.current / progress.total) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-[#9ca3af] shrink-0">
                {progress.phase} ({progress.current}/{progress.total})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[#991b1b]/20 border-b border-[#991b1b] px-4 py-2">
          <div className="max-w-7xl mx-auto text-sm text-red-400">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {!hasDeck && !hasTokens && !loading ? (
          /* State A: Empty - show import prompt */
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
              No Deck Imported
            </h3>
            <p className="text-[#9ca3af] mb-6">
              Import a deck to discover all the tokens it can produce.
            </p>
            <button
              onClick={() => setShowImport(true)}
              className="px-6 py-3 bg-[#4ade80] text-black hover:bg-[#22c55e] transition-colors font-semibold"
            >
              Import a Deck
            </button>
          </div>
        ) : (
          /* State B/C: Show token grid */
          <TokenGrid
            activeTokens={activeTokens}
            onToggleTap={toggleTap}
            onIncrementCount={incrementCount}
            onDecrementCount={decrementCount}
            onAddPermanent={addPermanentCounter}
            onRemovePermanent={removePermanentCounter}
            onAddTemporary={addTemporaryCounter}
            onRemoveTemporary={removeTemporaryCounter}
            onSplit={splitStack}
            onRemoveStack={removeStack}
            onMerge={mergeStacks}
          />
        )}
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        loading={loading}
      />

      <TokenPickerModal
        key={pickerKey}
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        tokens={availableTokens}
        onAddTokens={handleAddTokens}
      />

      {/* End of Turn Banner */}
      <EndOfTurnBanner
        visible={hasTemporaryCounters}
        onEndTurn={clearTemporaryCounters}
      />
    </div>
  );
}
