import drops from "../config/drops.json" with { type: "json" };
import spoils from "../config/spoils.json" with { type: "json" };
import bossData from "../config/bosses.json" with { type: "json" };
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
/** Names for everything a bank can hold: the kills' drops, and what the spoils' jars and chests pay. */
const names = new Map([
  ...(spoils as unknown as { items: { k: string; n: string }[] }).items.map((item) => [item.k, item.n] as [string, string]),
  ...FILE.items.map((item) => [item.k, item.n] as [string, string]),
]);
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

/** The item-key rule, as checkins.ts spells it. */
export function itemKeyOf(name: string): string {
  if (name === "Amulet of glory (t)") return "glory_t";
  return name.toLowerCase().replace(/[()']/g, "").replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}

const SPOILS = spoils as unknown as { items: { k: string; n: string; v: number }[]; ge: Record<string, number>; priced?: { k: string; n: string }[] };
for (const item of SPOILS.priced ?? []) if (!names.has(item.k)) names.set(item.k, item.n);
const BOSS_ITEMS = (bossData as unknown as { items: { k: string; n: string; v: number }[] }).items;
for (const item of BOSS_ITEMS) if (!names.has(item.k)) names.set(item.k, item.n);
const values = new Map<string, number>([
  ...BOSS_ITEMS.map((item) => [item.k, item.v] as [string, number]),
  ...SPOILS.items.map((item) => [item.k, item.v] as [string, number]),
  ...FILE.items.map((item) => [item.k, item.v] as [string, number]),
  ...Object.entries(SPOILS.ge),
]);

/** An item's GE value per unit at fetch time, for what the farm grows and the kingdom gathers. */
export function itemValue(key: string): number {
  return values.get(key) ?? 0;
}

/** The item's display name for a key, or the key itself. */
export function itemName(key: string): string {
  return names.get(key) ?? key.replace(/_/g, " ");
}

/** Rare enough, or valuable enough, to be announced and logged. */
export function isNotable(row: DropRow): boolean {
  return row.p <= 1 / NOTABLE_RARITY_DENOMINATOR || row.value * row.low >= NOTABLE_VALUE;
}

/** Rows in the files' packed form ([item index, p, low, high, rolls, flags]) as drop rows. */
export function decodeRows(items: { k: string; n: string; v: number }[], packed: number[][]): DropRow[] {
  const rows: DropRow[] = [];
  for (const [index, p, low, high, rolls, flags] of packed) {
    const item = items[index];
    if (!item || item.k === "nothing") continue;
    rows.push({ item: item.n, key: item.k, p, low, high, rolls: rolls || 1, noted: (flags & 1) !== 0, rdt: (flags & 2) !== 0, value: item.v });
  }
  return rows;
}

export function rollDrops(
  monster: string,
  kills: number,
  rng: () => number,
  exclude?: (row: DropRow) => boolean,
  /** A multiplier on a row's rate: the game's adapted rates for wearable drops. The rarity reported stays the wiki's. */
  boost?: (row: DropRow) => number
): Drops {
  return rollRows(dropTable(monster), kills, rng, exclude, boost);
}

/** Rolls any table: a monster's, or a boss's. */
export function rollRows(
  table: DropRow[],
  kills: number,
  rng: () => number,
  exclude?: (row: DropRow) => boolean,
  boost?: (row: DropRow) => number
): Drops {
  const stacks = new Map<string, Stack>();
  for (const row of table) {
    if (exclude?.(row)) continue;
    const trials = kills * row.rolls;
    const p = row.p >= 1 ? 1 : Math.min(1, row.p * (boost?.(row) ?? 1));
    let hits = 0;
    if (p >= 1) hits = trials;
    else for (let i = 0; i < trials; i++) if (rng() < p) hits++;
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
