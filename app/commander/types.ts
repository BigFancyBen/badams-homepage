export interface HistoryEntry {
  action: string;
  timestamp: number;
}

export interface PlayerState {
  life: number;
  commanderDamage: [number, number, number]; // damage from 3 other players
  rotation: 0 | 90 | 180 | 270; // rotation in degrees
  name: string;
  history: HistoryEntry[];
  poison: number;
  isDead: boolean;
}

export interface UndoOperation {
  sourcePlayerIndex: number;
  affectedPlayers: Array<{
    playerIndex: number;
    lifeChange: number;
  }>;
  historyEntries: Array<{
    playerIndex: number;
    entry: HistoryEntry;
  }>;
  timestamp: number;
}

export interface SavedSettings {
  playerNames: string[];
}

export interface SavedGameState {
  players: PlayerState[];
  timestamp: number;
}

export interface WindowSize {
  width: number;
  height: number;
  isClient: boolean;
}

export interface MobileDetection {
  isMobileLandscape: boolean;
  isMobilePortrait: boolean;
  isLandscape: boolean;
  isClient: boolean;
}

export interface ParsedAction {
  value: number;
  type: string;
}

export interface ParsedLifeActionFromPlayer extends ParsedAction {
  fromPlayer: string;
}

export interface ParsedCommanderDamageAction {
  value: number;
  fromPlayer: string;
}

export interface ParsedPoisonAction {
  value: number;
}

// Lobby-related types
export type PlayerCount = 2 | 3 | 4;

export type QuadrantMode = 'local' | 'display' | 'controller';

export interface LobbySettings {
  playerCount: PlayerCount;
  startingLife: number;
}

export interface ConnectedPlayer {
  id: string;
  name: string;
  slot: number | null;
  isHost: boolean;
  isConnected: boolean;
}

// Lobby code generation utilities
export const LOBBY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars: 0/O, 1/l/I

export function generateLobbyCode(): string {
  return Array.from({ length: 6 }, () =>
    LOBBY_CODE_CHARS[Math.floor(Math.random() * LOBBY_CODE_CHARS.length)]
  ).join('');
}

export function isValidLobbyCode(code: string): boolean {
  if (code.length !== 6) return false;
  return code.split('').every(char => LOBBY_CODE_CHARS.includes(char.toUpperCase()));
}

