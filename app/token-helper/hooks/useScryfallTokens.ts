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

      const uniqueNames = [...new Set(cardNames)];
      const totalCards = uniqueNames.length;

      try {
        // Phase 1: Fetch each card and extract token parts
        setProgress({ current: 0, total: totalCards, phase: "Scanning cards" });

        const allTokenParts: Array<{
          part: ScryfallRelatedPart;
          sourceCard: string;
        }> = [];

        for (let i = 0; i < uniqueNames.length; i++) {
          const cardName = uniqueNames[i];
          setProgress({
            current: i + 1,
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
            }
          } catch {
            // Skip cards that fail to fetch
          }

          // Rate limit: 100ms between requests
          if (i < uniqueNames.length - 1) {
            await delay(100);
          }
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
        setProgress({
          current: 0,
          total: tokenEntries.length,
          phase: "Fetching tokens",
        });

        const tokens: DiscoveredToken[] = [];

        for (let i = 0; i < tokenEntries.length; i++) {
          const { part, sourceCards } = tokenEntries[i];
          setProgress({
            current: i + 1,
            total: tokenEntries.length,
            phase: "Fetching tokens",
          });

          try {
            const response = await fetch(part.uri);

            if (response.ok) {
              const tokenCard = (await response.json()) as ScryfallTokenCard;
              tokens.push(buildDiscoveredToken(tokenCard, sourceCards));
            }
          } catch {
            // Skip tokens that fail to fetch
          }

          // Rate limit
          if (i < tokenEntries.length - 1) {
            await delay(100);
          }
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
