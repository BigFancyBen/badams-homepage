import { PlayerState, SavedGameState } from './types';
import { createPlayer, normalizePlayers } from './utils';

export const GAME_STATE_KEY = "commander-game-state";
// Older versions kept player names under their own key
const LEGACY_SETTINGS_KEY = "commander-settings";

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Failed to read ${key}:`, error);
    return null;
  }
};

// Load the saved game, or a fresh one. Only call this in the browser.
export function loadGame(): PlayerState[] {
  const saved = readJson(GAME_STATE_KEY) as Partial<SavedGameState> | null;
  const players = normalizePlayers(saved?.players);
  if (players) return players;

  const settings = readJson(LEGACY_SETTINGS_KEY) as { playerNames?: unknown } | null;
  const names = Array.isArray(settings?.playerNames) ? settings.playerNames : [];
  return [0, 1, 2, 3].map((index) =>
    typeof names[index] === 'string' && names[index].trim()
      ? createPlayer(index, { name: names[index] })
      : createPlayer(index)
  );
}

// Storage can refuse writes (quota, some private modes); losing the save is
// better than crashing mid-game.
export function saveGame(players: PlayerState[]) {
  try {
    const gameState: SavedGameState = { players, timestamp: Date.now() };
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(gameState));
  } catch (error) {
    console.error("Failed to save game state:", error);
  }
}

export function clearSavedGame() {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch (error) {
    console.error("Failed to clear game state:", error);
  }
}
