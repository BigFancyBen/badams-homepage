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

// Multiplayer lobby types
export interface LobbyPlayer {
  clientId: string;
  name: string;
  playerSlot: number | null; // 0-3 for assigned slot, null for spectator
  isHost: boolean;
  isReady: boolean;
  isCreator: boolean; // true if this client created the room
}

// Slot ownership for multiplayer - tracks who owns each quadrant
export interface SlotOwner {
  clientId: string;
  name: string;
  isConnected: boolean;
}

// Base action with senderId for echo filtering
interface BaseAction {
  senderId: string;
}

export type GameAction =
  | (BaseAction & { type: 'UPDATE_LIFE'; playerIndex: number; change: number })
  | (BaseAction & { type: 'UPDATE_POISON'; playerIndex: number; change: number })
  | (BaseAction & { type: 'UPDATE_COMMANDER_DAMAGE'; playerIndex: number; sourceIndex: number; change: number })
  | (BaseAction & { type: 'TOGGLE_DEAD'; playerIndex: number })
  | (BaseAction & { type: 'DAMAGE_ALL_OTHERS'; sourcePlayerIndex: number; damage: number })
  | (BaseAction & { type: 'UNDO_DAMAGE_ALL_OTHERS' })
  | (BaseAction & { type: 'RESET_GAME' })
  | (BaseAction & { type: 'FULL_STATE_SYNC'; players: PlayerState[]; slotOwners: (SlotOwner | null)[] })
  | (BaseAction & { type: 'CLAIM_SLOT'; slotIndex: number; clientId: string; name: string })
  | (BaseAction & { type: 'REQUEST_STATE_SYNC' });

