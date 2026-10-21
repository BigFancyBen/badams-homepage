import { HistoryEntry, HistoryKind, Layout, PlayerState, Rotation } from './types';

export const STARTING_LIFE = 40;
export const COMMANDER_DAMAGE_MAX = 21;
// Taps on the same counter within this window merge into one history entry
export const COLLAPSE_WINDOW_MS = 2000;

export const defaultPlayerName = (index: number) => `Player ${index + 1}`;

export const createPlayer = (index: number, overrides: Partial<PlayerState> = {}): PlayerState => ({
  life: STARTING_LIFE,
  commanderDamage: [0, 0, 0],
  rotation: 0,
  name: defaultPlayerName(index),
  history: [],
  poison: 0,
  isDead: false,
  ...overrides,
});

// Indices of the three opponents, in the order commanderDamage stores them
export const commanderSources = (playerIndex: number) =>
  [0, 1, 2, 3].filter((i) => i !== playerIndex);

// Add an entry to the front of a history, merging it with the newest entry when
// that one is the same counter from the same source and still recent. A merge
// that sums to zero removes the entry, so +1 then -1 leaves no trace.
export const addHistoryEntry = (
  history: HistoryEntry[],
  entry: Omit<HistoryEntry, 'timestamp'>,
  now = Date.now()
): HistoryEntry[] => {
  const [latest, ...rest] = history;
  if (
    latest &&
    latest.kind === entry.kind &&
    latest.from === entry.from &&
    now - latest.timestamp <= COLLAPSE_WINDOW_MS
  ) {
    const value = latest.value + entry.value;
    return value === 0 ? rest : [{ ...entry, value, timestamp: now }, ...rest];
  }
  return [{ ...entry, timestamp: now }, ...history];
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const LEGACY_KINDS: Record<string, HistoryKind> = {
  life: 'life',
  'commander damage': 'commander',
  poison: 'poison',
};

// Earlier versions stored history as strings like "-1 life from Bob|negative"
const parseLegacyEntry = (action: string, timestamp: number): HistoryEntry | null => {
  const match = action.match(/^([+-])(\d+)\s+(life|commander damage|poison)(?: from (.+))?\|\w+$/);
  if (!match) return null;
  return {
    kind: LEGACY_KINDS[match[3]],
    value: parseInt(match[2]) * (match[1] === '+' ? 1 : -1),
    ...(match[4] ? { from: match[4] } : {}),
    timestamp,
  };
};

const normalizeHistory = (raw: unknown): HistoryEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): HistoryEntry[] => {
    if (!item || typeof item !== 'object') return [];
    const { kind, value, from, timestamp, action } = item as Record<string, unknown>;
    if (!isFiniteNumber(timestamp)) return [];
    if (typeof action === 'string') {
      const legacy = parseLegacyEntry(action, timestamp);
      return legacy ? [legacy] : [];
    }
    if ((kind === 'life' || kind === 'commander' || kind === 'poison') && isFiniteNumber(value)) {
      return [{ kind, value, ...(typeof from === 'string' ? { from } : {}), timestamp }];
    }
    return [];
  });
};

// Rebuild a saved game field by field, falling back to defaults for anything
// missing or malformed, so a save from an older version can't crash the page.
export const normalizePlayers = (raw: unknown): PlayerState[] | null => {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  return raw.map((item, index) => {
    const p = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const damage = Array.isArray(p.commanderDamage) ? p.commanderDamage : [];
    return createPlayer(index, {
      life: isFiniteNumber(p.life) ? p.life : STARTING_LIFE,
      commanderDamage: [0, 1, 2].map((i) =>
        isFiniteNumber(damage[i]) ? Math.max(0, Math.min(COMMANDER_DAMAGE_MAX, damage[i])) : 0
      ) as [number, number, number],
      rotation: p.rotation === 90 || p.rotation === 180 || p.rotation === 270 ? p.rotation : 0,
      name: typeof p.name === 'string' && p.name.trim() ? p.name : defaultPlayerName(index),
      history: normalizeHistory(p.history),
      poison: isFiniteNumber(p.poison) ? Math.max(0, p.poison) : 0,
      isDead: p.isDead === true,
    });
  });
};

// Generate unique abbreviations for player names
export const generateAbbreviations = (players: PlayerState[]): string[] => {
  const abbreviations: string[] = [];
  const nameGroups: { [key: string]: number[] } = {};

  players.forEach((player, index) => {
    // Default names keep P1, P2, etc.
    if (player.name === defaultPlayerName(index)) {
      abbreviations[index] = `P${index + 1}`;
      return;
    }

    const prefix = player.name.trim().toLowerCase().substring(0, 3);
    if (!prefix) {
      abbreviations[index] = `P${index + 1}`;
      return;
    }
    (nameGroups[prefix] ??= []).push(index);
  });

  Object.entries(nameGroups).forEach(([prefix, indices]) => {
    indices.forEach((index, i) => {
      // Names sharing a prefix get numbered: BOB1, BOB2
      abbreviations[index] = prefix.toUpperCase() + (indices.length > 1 ? i + 1 : '');
    });
  });

  return abbreviations;
};

// Format timestamp to time string
export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const describeEntry = (entry: HistoryEntry) => {
  const base =
    entry.kind === 'life' ? 'life' : entry.kind === 'commander' ? 'commander damage' : 'poison';
  return {
    sign: entry.value > 0 ? '+' : '-',
    number: String(Math.abs(entry.value)),
    label: entry.from ? `${base} from ${entry.from}` : base,
  };
};

// Phones only flip a player between the two angles that fit the screen, so a
// rotation saved in another layout is mapped onto the matching one here.
// Desktop allows all four.
export const fitRotation = (rotation: Rotation, layout: Layout): Rotation => {
  if (layout === 'portrait') {
    return rotation === 90 ? 0 : rotation === 270 ? 180 : rotation;
  }
  if (layout === 'landscape') {
    return rotation === 0 ? 90 : rotation === 180 ? 270 : rotation;
  }
  return rotation;
};

export const nextRotation = (rotation: Rotation, layout: Layout): Rotation => {
  const current = fitRotation(rotation, layout);
  if (layout === 'desktop') return ((current + 90) % 360) as Rotation;
  // A half turn keeps the player on the same axis
  return ((current + 180) % 360) as Rotation;
};

// Get rotation CSS class based on rotation value
export const getRotationClass = (rotation: Rotation): string => {
  switch (rotation) {
    case 90:
      return "rotate-90 origin-center";
    case 180:
      return "rotate-180 origin-center";
    case 270:
      return "-rotate-90 origin-center";
    default:
      return "rotate-0 origin-center";
  }
};
