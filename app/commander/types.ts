export type Rotation = 0 | 90 | 180 | 270;

export type HistoryKind = "life" | "commander" | "poison";

export interface HistoryEntry {
  kind: HistoryKind;
  value: number;
  // Name of the player the change came from ("-1 others" and commander damage)
  from?: string;
  timestamp: number;
}

export interface PlayerState {
  life: number;
  commanderDamage: [number, number, number]; // damage from 3 other players
  rotation: Rotation;
  name: string;
  history: HistoryEntry[];
  poison: number;
  isDead: boolean;
}

// One "-1 others" press, kept so its owner can undo it
export interface UndoOperation {
  sourcePlayerIndex: number;
  sourceName: string;
  change: number;
}

export interface SavedGameState {
  players: PlayerState[];
  timestamp: number;
}

export type Layout = "desktop" | "portrait" | "landscape";

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
