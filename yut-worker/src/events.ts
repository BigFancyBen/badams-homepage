import {
  EVENT_CHANCE,
  EVENT_PITY,
  EVENT_TABLE,
  QUIZ_BANK,
  type EventKey,
} from "./config.ts";

/**
 * A seeded generator, so a check-in that has to be recomputed rolls the same
 * thing it rolled the first time. The seed is the player and the day; nothing
 * about the order requests arrive in can change what somebody got.
 */
export function seededRng(seed: string): () => number {
  // FNV-1a to a 32-bit state, then mulberry32.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks from a weighted table. */
export function weightedPick<T extends { weight: number }>(
  rng: () => number,
  table: T[]
): T {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let roll = rng() * total;
  for (const row of table) {
    roll -= row.weight;
    if (roll < 0) return row;
  }
  return table[table.length - 1];
}

/**
 * Whether this check-in gets an event, and which. `dryStreak` is how many
 * check-ins in a row have rolled nothing; the twelfth is guaranteed.
 * `chance` is "one in N" and the Tavern lowers it.
 */
export function rollEvent(
  rng: () => number,
  dryStreak: number,
  chance = EVENT_CHANCE,
  effect?: string
): EventKey | null {
  const hit = dryStreak + 1 >= EVENT_PITY || rng() < 1 / chance;
  if (!hit) return null;

  let table = EVENT_TABLE;
  // Halloween: the Grim Reaper stands in for the Genie (same effect, other
  // name) and the Evil Chicken is out in force. Thanksgiving: the Sandwich
  // Lady is everywhere. The keys stay the same; the label changes downstream.
  if (effect === "halloween") {
    table = table.map((row) =>
      row.key === "evil_chicken" ? { ...row, weight: row.weight * 2 } : row
    );
  } else if (effect === "sandwich") {
    table = table.map((row) =>
      row.key === "sandwich_lady" ? { ...row, weight: row.weight * 4 } : row
    );
  } else if (effect === "dwarf") {
    table = table.map((row) =>
      row.key === "drunken_dwarf" ? { ...row, weight: row.weight * 3 } : row
    );
  }
  return weightedPick(rng, table).key;
}

export function eventLabel(key: EventKey, effect?: string): string {
  if (key === "genie" && effect === "halloween") return "Grim Reaper";
  return EVENT_TABLE.find((row) => row.key === key)?.label ?? key;
}

/** A question index, seeded so a retry asks the same one. */
export function pickQuiz(rng: () => number): number {
  return Math.floor(rng() * QUIZ_BANK.length);
}
