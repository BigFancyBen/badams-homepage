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

