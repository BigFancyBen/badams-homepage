"use client";

import { useState, useEffect, useCallback } from "react";
import { ParsedDecklist } from "../utils/decklistParser";

export interface SavedDeck {
  id: string;
  name: string;
  decklist: ParsedDecklist;
  originalInput: string;
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "tutor-helper-decks";

export function useDeckStorage() {
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  // Load decks from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedDecks = JSON.parse(stored) as SavedDeck[];
        setDecks(parsedDecks);
        // Set the first deck as active if there are any decks
        if (parsedDecks.length > 0) {
          setActiveDeckId(parsedDecks[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading decks from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save decks to localStorage whenever decks change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
      } catch (error) {
        console.error("Error saving decks to localStorage:", error);
      }
    }
  }, [decks, isLoaded]);

  const addDeck = useCallback((name: string, decklist: ParsedDecklist, originalInput: string, sourceUrl?: string) => {
    const newDeck: SavedDeck = {
      id: `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      decklist,
      originalInput,
      sourceUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setDecks(prev => [...prev, newDeck]);
    setActiveDeckId(newDeck.id);
    return newDeck.id;
  }, []);

  const removeDeck = useCallback((deckId: string) => {
    setDecks(prev => {
      const filtered = prev.filter(deck => deck.id !== deckId);
      // If we removed the active deck, set the first remaining deck as active
      if (deckId === activeDeckId && filtered.length > 0) {
        setActiveDeckId(filtered[0].id);
      } else if (filtered.length === 0) {
        setActiveDeckId(null);
      }
      return filtered;
    });
  }, [activeDeckId]);

  const updateDeck = useCallback((deckId: string, name: string, decklist: ParsedDecklist, originalInput: string, sourceUrl?: string) => {
    setDecks(prev => prev.map(deck => 
      deck.id === deckId 
        ? { ...deck, name, decklist, originalInput, ...(sourceUrl !== undefined ? { sourceUrl } : {}), updatedAt: Date.now() }
        : deck
    ));
  }, []);

  const selectDeck = useCallback((deckId: string) => {
    setActiveDeckId(deckId);
  }, []);

  const getActiveDeck = useCallback((): SavedDeck | null => {
    if (!activeDeckId) return null;
    return decks.find(deck => deck.id === activeDeckId) || null;
  }, [activeDeckId, decks]);

  const clearAllDecks = useCallback(() => {
    setDecks([]);
    setActiveDeckId(null);
  }, []);

  return {
    decks,
    isLoaded,
    activeDeckId,
    addDeck,
    removeDeck,
    updateDeck,
    selectDeck,
    getActiveDeck,
    clearAllDecks,
  } as const;
}
