"use client";

import { useState, useCallback } from "react";
import {
  ScryfallRelatedPart,
  ScryfallTokenCard,
  DiscoveredToken,
} from "../types";
import {
  extractTokenParts,
  deduplicateTokenParts,
  buildDiscoveredToken,
} from "../utils/tokenDiscovery";
import {
  loadCachedCardParts,
  saveCachedCardParts,
  loadCachedTokenCards,
  saveCachedTokenCards,
  cleanupExpiredEntries,
} from "../utils/scryfallCache";

interface ScryfallCardResponse {
  id: string;
  name: string;
  all_parts?: ScryfallRelatedPart[];
}

interface UseScryfallTokensResult {
  discoveredTokens: DiscoveredToken[];
  loading: boolean;
  error: string | null;
  progress: { current: number; total: number; phase: string };
  discoverTokens: (cardNames: string[]) => Promise<DiscoveredToken[]>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useScryfallTokens(): UseScryfallTokensResult {
  const [discoveredTokens, setDiscoveredTokens] = useState<DiscoveredToken[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    phase: "",
  });

  const discoverTokens = useCallback(
    async (cardNames: string[]): Promise<DiscoveredToken[]> => {
      if (cardNames.length === 0) return [];

      setLoading(true);
      setError(null);
      setDiscoveredTokens([]);

      // Clean up expired entries on each discovery run
      cleanupExpiredEntries();

      const uniqueNames = [...new Set(cardNames)];
      const totalCards = uniqueNames.length;

      try {
        // Phase 1: Fetch each card and extract token parts
        setProgress({ current: 0, total: totalCards, phase: "Scanning cards" });

        const allTokenParts: Array<{
          part: ScryfallRelatedPart;
          sourceCard: string;
        }> = [];

        // Check card-level cache first
        const { cached: cachedCards, missing: missingCards } =
          loadCachedCardParts(uniqueNames);

        // Populate from cache immediately
        let processed = 0;
        for (const [, { name, parts }] of cachedCards) {
          processed++;
          setProgress({
            current: processed,
            total: totalCards,
            phase: "Scanning cards",
          });
          for (const part of parts) {
            allTokenParts.push({ part, sourceCard: name });
          }
        }

        // Fetch only missing cards from API
        const newCardResults: {
          searchTerm: string;
          cardName: string;
          parts: ScryfallRelatedPart[];
        }[] = [];

        for (let i = 0; i < missingCards.length; i++) {
          const cardName = missingCards[i];
          processed++;
          setProgress({
            current: processed,
            total: totalCards,
            phase: "Scanning cards",
          });

          try {
            const response = await fetch(
              `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
            );

            if (response.ok) {
              const card = (await response.json()) as ScryfallCardResponse;
              const tokenParts = extractTokenParts(card.all_parts);

              for (const part of tokenParts) {
                allTokenParts.push({ part, sourceCard: card.name });
              }

              newCardResults.push({
                searchTerm: cardName,
                cardName: card.name,
                parts: tokenParts,
              });
            }
          } catch {
            // Skip cards that fail to fetch
          }

          // Rate limit: 100ms between requests
          if (i < missingCards.length - 1) {
            await delay(100);
          }
        }

        // Save newly fetched card results to cache
        if (newCardResults.length > 0) {
          saveCachedCardParts(newCardResults);
        }

        // Deduplicate tokens by ID
        const tokenMap = deduplicateTokenParts(allTokenParts);

        if (tokenMap.size === 0) {
          setDiscoveredTokens([]);
          setLoading(false);
          setProgress({ current: 0, total: 0, phase: "" });
          return [];
        }

        // Phase 2: Fetch full token details
        const tokenEntries = Array.from(tokenMap.values());
        const tokenIds = tokenEntries.map((e) => e.part.id);

        setProgress({
          current: 0,
          total: tokenEntries.length,
          phase: "Fetching tokens",
        });

        const tokens: DiscoveredToken[] = [];

        // Check token-level cache first
        const { cached: cachedTokens, missing: missingTokenIds } =
          loadCachedTokenCards(tokenIds);

        // Build DiscoveredToken objects from cached token cards
        let tokenProcessed = 0;
        for (const entry of tokenEntries) {
          const cachedToken = cachedTokens.get(entry.part.id);
          if (cachedToken) {
            tokenProcessed++;
            setProgress({
              current: tokenProcessed,
              total: tokenEntries.length,
              phase: "Fetching tokens",
            });
            tokens.push(buildDiscoveredToken(cachedToken, entry.sourceCards));
          }
        }

        // Build a set for quick lookup of missing IDs
        const missingIdSet = new Set(missingTokenIds);

        // Fetch only missing tokens from API
        const newTokenResults: { id: string; card: ScryfallTokenCard }[] = [];

        for (const entry of tokenEntries) {
          if (!missingIdSet.has(entry.part.id)) continue;

          const { part, sourceCards } = entry;
          tokenProcessed++;
          setProgress({
            current: tokenProcessed,
            total: tokenEntries.length,
            phase: "Fetching tokens",
          });

          try {
            const response = await fetch(part.uri);

            if (response.ok) {
              const tokenCard = (await response.json()) as ScryfallTokenCard;
              tokens.push(buildDiscoveredToken(tokenCard, sourceCards));
              newTokenResults.push({ id: part.id, card: tokenCard });
            }
          } catch {
            // Skip tokens that fail to fetch
          }

          // Rate limit
          if (tokenProcessed < tokenEntries.length) {
            await delay(100);
          }
        }

        // Save newly fetched token cards to cache
        if (newTokenResults.length > 0) {
          saveCachedTokenCards(newTokenResults);
        }

        setDiscoveredTokens(tokens);
        setLoading(false);
        setProgress({ current: 0, total: 0, phase: "" });
        return tokens;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to discover tokens";
        setError(message);
        setLoading(false);
        setProgress({ current: 0, total: 0, phase: "" });
        return [];
      }
    },
    []
  );

  return {
    discoveredTokens,
    loading,
    error,
    progress,
    discoverTokens,
  };
}
