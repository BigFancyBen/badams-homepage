"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MagicCard } from "../types";
import { ParsedDecklist } from "../utils/decklistParser";

// Helper functions for useSyncExternalStore (SSR-safe isLoaded detection)
function subscribeNoop(_callback: () => void) {
  return () => {};
}
function getSnapshotClient() {
  return true;
}
function getSnapshotServer() {
  return false;
}

interface CachedCard extends MagicCard {
  cachedAt: number;
  searchTerm: string; // Store the original search term used to find this card
}

interface CachedDecklist extends ParsedDecklist {
  cachedAt: number;
  originalInput: string;
}

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const DECKLIST_KEY = "tutor-helper-decklist";
const SCRYFALL_CACHE_KEY = "tutor-helper-scryfall-cache";

// Create a hash-based cache key for card names to avoid special character issues
function createCacheKey(cardName: string): string {
  // Simple hash function to create consistent keys
  const normalizedName = cardName.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    const char = normalizedName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Use both hash and length to reduce collision probability
  return `card_${Math.abs(hash).toString(36)}_${normalizedName.length}`;
}

export function useLocalStorageCache() {
  // Use useSyncExternalStore for SSR-safe client detection
  const isLoaded = useSyncExternalStore(subscribeNoop, getSnapshotClient, getSnapshotServer);

  // Save decklist to localStorage
  const saveDecklist = useCallback((decklist: ParsedDecklist, originalInput: string) => {
    if (!isLoaded) return;
    
    try {
      const cachedDecklist: CachedDecklist = {
        ...decklist,
        cachedAt: Date.now(),
        originalInput
      };
      localStorage.setItem(DECKLIST_KEY, JSON.stringify(cachedDecklist));
    } catch (error) {
      console.warn("Failed to save decklist to localStorage:", error);
    }
  }, [isLoaded]);

  // Load decklist from localStorage
  const loadDecklist = useCallback((): { decklist: ParsedDecklist; originalInput: string } | null => {
    if (!isLoaded) return null;

    try {
      const cached = localStorage.getItem(DECKLIST_KEY);
      if (!cached) return null;

      const cachedDecklist: CachedDecklist = JSON.parse(cached);
      
      // Check if cache is expired
      if (Date.now() - cachedDecklist.cachedAt > CACHE_EXPIRY) {
        localStorage.removeItem(DECKLIST_KEY);
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cachedAt, originalInput, ...decklist } = cachedDecklist;
      return { decklist, originalInput };
    } catch (error) {
      console.warn("Failed to load decklist from localStorage:", error);
      return null;
    }
  }, [isLoaded]);

  // Clear decklist from localStorage
  const clearDecklist = useCallback(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.removeItem(DECKLIST_KEY);
    } catch (error) {
      console.warn("Failed to clear decklist from localStorage:", error);
    }
  }, [isLoaded]);

  // Save Scryfall card data to cache with search term mapping
  const saveScryfallCards = useCallback((cardResults: { searchTerm: string; card: MagicCard }[]) => {
    if (!isLoaded) return;

    try {
      const existingCache = localStorage.getItem(SCRYFALL_CACHE_KEY);
      const cache: Record<string, CachedCard> = existingCache ? JSON.parse(existingCache) : {};

      // Add new cards to cache using search term as key
      cardResults.forEach(({ searchTerm, card }) => {
        const cacheKey = createCacheKey(searchTerm);
        cache[cacheKey] = {
          ...card,
          cachedAt: Date.now(),
          searchTerm
        };
        console.log(`Cached card: search "${searchTerm}" -> found "${card.name}" with key: "${cacheKey}"`);
      });

      localStorage.setItem(SCRYFALL_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn("Failed to save Scryfall cards to localStorage:", error);
    }
  }, [isLoaded]);

  // Load cached Scryfall cards
  const loadCachedCards = useCallback((cardNames: string[]): { cached: MagicCard[]; missing: string[] } => {
    if (!isLoaded) return { cached: [], missing: cardNames };

    try {
      const cached = localStorage.getItem(SCRYFALL_CACHE_KEY);
      if (!cached) return { cached: [], missing: cardNames };

      const cache: Record<string, CachedCard> = JSON.parse(cached);
      const cachedCards: MagicCard[] = [];
      const missingCards: string[] = [];
      const now = Date.now();

      cardNames.forEach(name => {
        const cacheKey = createCacheKey(name);
        const cachedCard = cache[cacheKey];

        if (cachedCard && (now - cachedCard.cachedAt) < CACHE_EXPIRY) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { cachedAt, ...card } = cachedCard;
          cachedCards.push(card);
          console.log(`Cache hit for: "${name}" -> "${card.name}"`);
        } else {
          missingCards.push(name);
          console.log(`Cache miss for: "${name}" (key: "${cacheKey}")`);
        }
      });

      return { cached: cachedCards, missing: missingCards };
    } catch (error) {
      console.warn("Failed to load cached Scryfall cards:", error);
      return { cached: [], missing: cardNames };
    }
  }, [isLoaded]);

  // Clear expired cache entries
  const cleanupCache = useCallback(() => {
    if (!isLoaded) return;

    try {
      const cached = localStorage.getItem(SCRYFALL_CACHE_KEY);
      if (!cached) return;

      const cache: Record<string, CachedCard> = JSON.parse(cached);
      const now = Date.now();
      const cleanCache: Record<string, CachedCard> = {};

      Object.entries(cache).forEach(([key, card]) => {
        if ((now - card.cachedAt) < CACHE_EXPIRY) {
          cleanCache[key] = card;
        }
      });

      localStorage.setItem(SCRYFALL_CACHE_KEY, JSON.stringify(cleanCache));
    } catch (error) {
      console.warn("Failed to cleanup cache:", error);
    }
  }, [isLoaded]);



  // Clear all cache
  const clearAllCache = useCallback(() => {
    if (!isLoaded) return;

    try {
      localStorage.removeItem(DECKLIST_KEY);
      localStorage.removeItem(SCRYFALL_CACHE_KEY);
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  }, [isLoaded]);

  return {
    isLoaded,
    saveDecklist,
    loadDecklist,
    clearDecklist,
    saveScryfallCards,
    loadCachedCards,
    cleanupCache,
    clearAllCache
  };
}
