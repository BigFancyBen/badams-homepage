"use client";

import { useState, useEffect, useCallback } from "react";
import { TokenDeckState, TokenGameState } from "../types";

const DECK_STORAGE_KEY = "token-helper-deck";
const GAME_STORAGE_KEY = "token-helper-game";

export function useTokenStorage() {
  const [deckState, setDeckState] = useState<TokenDeckState | null>(null);
  const [gameState, setGameState] = useState<TokenGameState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedDeck = localStorage.getItem(DECK_STORAGE_KEY);
      if (storedDeck) {
        setDeckState(JSON.parse(storedDeck) as TokenDeckState);
      }

      const storedGame = localStorage.getItem(GAME_STORAGE_KEY);
      if (storedGame) {
        setGameState(JSON.parse(storedGame) as TokenGameState);
      }
    } catch (error) {
      console.error("Error loading token-helper state from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save deck state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        if (deckState) {
          localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckState));
        } else {
          localStorage.removeItem(DECK_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Error saving deck state to localStorage:", error);
      }
    }
  }, [deckState, isLoaded]);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        if (gameState) {
          localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
        } else {
          localStorage.removeItem(GAME_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Error saving game state to localStorage:", error);
      }
    }
  }, [gameState, isLoaded]);

  const saveDeckState = useCallback((state: TokenDeckState) => {
    setDeckState(state);
  }, []);

  const saveGameState = useCallback((state: TokenGameState) => {
    setGameState(state);
  }, []);

  const clearDeckState = useCallback(() => {
    setDeckState(null);
  }, []);

  const clearGameState = useCallback(() => {
    setGameState(null);
  }, []);

  const clearAll = useCallback(() => {
    setDeckState(null);
    setGameState(null);
  }, []);

  return {
    deckState,
    gameState,
    isLoaded,
    saveDeckState,
    saveGameState,
    clearDeckState,
    clearGameState,
    clearAll,
  } as const;
}
