import { useCallback, useState } from 'react';
import { PlayerState, SavedSettings, SavedGameState } from '../types';

export function useLocalStorage() {
  const [hasLoadedInitialState, setHasLoadedInitialState] = useState(false);

  // Save player names to localStorage
  const saveSettings = useCallback((players: PlayerState[]) => {
    if (typeof window !== "undefined") {
      const playerNames = players.map((player) => player.name);
      const settings: SavedSettings = {
        playerNames: playerNames,
      };
      localStorage.setItem("commander-settings", JSON.stringify(settings));
    }
  }, []);

  // Save complete game state to localStorage
  const saveGameState = useCallback((players: PlayerState[]) => {
    if (typeof window !== "undefined") {
      const gameState: SavedGameState = {
        players: players,
        timestamp: Date.now(),
      };
      localStorage.setItem("commander-game-state", JSON.stringify(gameState));
    }
  }, []);

  // Load initial state from localStorage
  const loadInitialState = useCallback(() => {
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("commander-settings");
      const savedGameState = localStorage.getItem("commander-game-state");

      let initialPlayers: PlayerState[] | null = null;

      // Load complete game state if it exists (this takes precedence for players)
      if (savedGameState) {
        try {
          const gameState = JSON.parse(savedGameState);
          if (
            gameState.players &&
            Array.isArray(gameState.players) &&
            gameState.players.length === 4
          ) {
            initialPlayers = gameState.players;
          }
        } catch (error) {
          console.error("Failed to load game state:", error);
          // If there's an error loading the game state, remove it
          localStorage.removeItem("commander-game-state");
        }
      }

      // Load settings (player names) if no game state was loaded
      let savedPlayerNames: string[] | null = null;
      if (savedSettings && !savedGameState) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.playerNames) {
            savedPlayerNames = settings.playerNames;
          }
        } catch (error) {
          console.error("Failed to parse saved settings:", error);
        }
      }

      setHasLoadedInitialState(true);
      return { initialPlayers, savedPlayerNames };
    }

    setHasLoadedInitialState(true);
    return { initialPlayers: null, savedPlayerNames: null };
  }, []);

  // Clear game state from localStorage
  const clearGameState = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("commander-game-state");
    }
  }, []);

  return {
    hasLoadedInitialState,
    saveSettings,
    saveGameState,
    loadInitialState,
    clearGameState,
  };
}

