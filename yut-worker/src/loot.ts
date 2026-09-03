import drops from "../config/drops.json" with { type: "json" };
import { MONSTERS } from "./combat.ts";
import { NOTABLE_RARITY_DENOMINATOR, NOTABLE_VALUE } from "./config.ts";

/**
 * Drops. Every kill of a session rolls the monster's real drop table — the
 * wiki's, fetched by scripts/fetch-osrs.mjs into config/drops.json with the
 * herb, seed, gem and rare-drop sub-tables already expanded into flat rows —
 * and the stacks go to the player's bank at their GE value.
 *
 * One simplification, on purpose: every row is rolled independently, as
 * `kills × rolls` Bernoulli trials at its own rate. In the game the main
 * table is one exclusive roll per kill, so a kill here can pay two
 * main-table items where the game would pay one. The expected rate of every
 * item is exactly the wiki's; only the variance differs. Rows are rolled in
 * file order from a seeded RNG, so a retried check-in banks the same loot.
 */

export interface DropRow {
  item: string;
  key: string;
  /** Probability per roll. 1 is an "Always" drop. */
  p: number;
  low: number;
  high: number;
  rolls: number;
  noted: boolean;
  /** From the rare drop table. */
  rdt: boolean;
  /** GE value per unit, in coins, at fetch time. */
  value: number;
}

export interface Stack {
  key: string;
  item: string;
  qty: number;
  /** The stack's worth in coins. */
  value: number;
  /** The rarest row that fed the stack. */
  rate: number;
  notable: boolean;
}

export interface Drops {
  /** By value, richest first. */
  stacks: Stack[];
  total: number;
  notable: Stack[];
}

interface DropsFile {
  items: { k: string; n: string; v: number }[];
  monsters: Record<string, { version: string; rows: number[][] }>;
}

const FILE = drops as unknown as DropsFile;
const tables = new Map<string, DropRow[]>();
const names = new Map(FILE.items.map((item) => [item.k, item.n]));
/** osrs.json keys its monsters by task category; the infobox name can differ ("Cave kraken" is the Whirlpool). */
const keyByName = new Map(Object.entries(MONSTERS).map(([key, monster]) => [monster.name, key]));

/** The monster's table, by osrs.json key or infobox name, decoded once. Empty for one the file does not know. */
export function dropTable(monster: string): DropRow[] {
  const cached = tables.get(monster);
  if (cached) return cached;
  const entry = FILE.monsters[monster] ?? FILE.monsters[keyByName.get(monster) ?? ""];
  const rows: DropRow[] = [];
  for (const [index, p, low, high, rolls, flags] of entry?.rows ?? []) {
    const item = FILE.items[index];
    if (!item || item.k === "nothing") continue;
    rows.push({
      item: item.n,
      key: item.k,
      p,
      low,
      high,
      rolls: rolls || 1,
      noted: (flags & 1) !== 0,
      rdt: (flags & 2) !== 0,
      value: item.v,
    });
  }
  tables.set(monster, rows);
  return rows;
}

/** The item's display name for a key, or the key itself. */
export function itemName(key: string): string {
  return names.get(key) ?? key.replace(/_/g, " ");
}

/** Rare enough, or valuable enough, to be announced and logged. */
export function isNotable(row: DropRow): boolean {
  return row.p <= 1 / NOTABLE_RARITY_DENOMINATOR || row.value * row.low >= NOTABLE_VALUE;
}

export function rollDrops(
  monster: string,
  kills: number,
  rng: () => number,
  exclude?: (row: DropRow) => boolean
): Drops {
  const stacks = new Map<string, Stack>();
  for (const row of dropTable(monster)) {
    if (exclude?.(row)) continue;
    const trials = kills * row.rolls;
    let hits = 0;
    if (row.p >= 1) hits = trials;
    else for (let i = 0; i < trials; i++) if (rng() < row.p) hits++;
    if (hits === 0) continue;
    let qty = 0;
    if (row.low === row.high) qty = hits * row.low;
    else for (let i = 0; i < hits; i++) qty += row.low + Math.floor(rng() * (row.high - row.low + 1));
    const notable = isNotable(row);
    const existing = stacks.get(row.key);
    if (existing) {
      existing.qty += qty;
      existing.value += qty * row.value;
      existing.rate = Math.min(existing.rate, row.p);
      existing.notable = existing.notable || notable;
    } else {
      stacks.set(row.key, { key: row.key, item: row.item, qty, value: qty * row.value, rate: row.p, notable });
    }
  }
  const list = [...stacks.values()].sort(
    (a, b) => b.value - a.value || b.qty - a.qty || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
  return {
    stacks: list,
    total: list.reduce((sum, stack) => sum + stack.value, 0),
    notable: list.filter((stack) => stack.notable),
  };
}

/** "48.2k gp", "1.2m gp", "312 gp". */
export function gpShort(coins: number): string {
  if (coins >= 1_000_000) return `${(coins / 1_000_000).toFixed(coins >= 10_000_000 ? 0 : 1)}m gp`;
  if (coins >= 1_000) return `${(coins / 1_000).toFixed(coins >= 10_000 ? 0 : 1)}k gp`;
  return `${Math.round(coins)} gp`;
}

/** "1/273,067" for a rate. */
export function oneIn(rate: number): string {
  return `1/${Math.round(1 / rate).toLocaleString("en-US")}`;
}
