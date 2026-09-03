import {
  BASE_HAUL,
  QUIET_DAY_DECAY,
  QUIET_DAY_FRACTION,
  RESOURCES,
  type ResourceKey,
} from "./config.ts";
import { retryWrite } from "./db.ts";
import type { Env } from "./types.ts";

/**
 * The shared stores. Act 1 is a camp — no workers, no buildings — and every
 * check-in hauls straight into these. Workers and buildings arrive with the
 * town phase; the stores, the crates and the quiet-day rule are here from
 * the start because they are what the morning post reports.
 */

export type Stores = Record<ResourceKey, number>;

export async function getStores(env: Env): Promise<Stores> {
  const { results } = await env.DB.prepare(
    "SELECT resource, amount FROM town_resources"
  ).all<{ resource: ResourceKey; amount: number }>();
  const stores = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stores;
  for (const row of results) stores[row.resource] = row.amount;
  return stores;
}

export interface TownRow {
  id: number;
  name: string;
  level: number;
  last_tick_at: number | null;
  last_daily_day: string | null;
  beekeeper_until: number | null;
  besieged_until: string | null;
}

export async function getTown(env: Env): Promise<TownRow> {
  const row = await env.DB.prepare("SELECT * FROM town WHERE id = 1").first<TownRow>();
  return (
    row ?? {
      id: 1,
      name: "the camp",
      level: 0,
      last_tick_at: null,
      last_daily_day: null,
      beekeeper_until: null,
      besieged_until: null,
    }
  );
}

/** A statement that adds to one store and writes the ledger line. */
export function creditStatements(
  env: Env,
  resource: ResourceKey,
  amount: number,
  kind: string,
  day: string,
  playerId: string | null,
  now: number
): D1PreparedStatement[] {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded === 0) return [];
  return [
    env.DB.prepare(
      "UPDATE town_resources SET amount = MAX(0, amount + ?) WHERE resource = ?"
    ).bind(rounded, resource),
    env.DB.prepare(
      "INSERT INTO town_ledger (day, kind, resource, amount, player_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(day, kind, resource, rounded, playerId, now),
  ];
}

export async function credit(
  env: Env,
  resource: ResourceKey,
  amount: number,
  kind: string,
  day: string,
  playerId: string | null,
  now: number
): Promise<void> {
  const statements = creditStatements(env, resource, amount, kind, day, playerId, now);
  if (statements.length > 0) await env.DB.batch(statements);
}

/** What a check-in hauls before workers exist: coins and logs, weighted. */
export function baseHaul(weight: number, haulMultiplier: number): Partial<Stores> {
  const haul: Partial<Stores> = {};
  for (const [resource, amount] of Object.entries(BASE_HAUL)) {
    haul[resource as ResourceKey] = Math.floor((amount ?? 0) * weight * haulMultiplier);
  }
  return haul;
}

export interface LedgerLine {
  kind: string;
  resource: ResourceKey;
  amount: number;
  player_id: string | null;
}

export async function ledgerOn(env: Env, day: string): Promise<LedgerLine[]> {
  const { results } = await env.DB.prepare(
    "SELECT kind, resource, amount, player_id FROM town_ledger WHERE day = ?"
  )
    .bind(day)
    .all<LedgerLine>();
  return results;
}

/**
 * The quiet-day rule, the only shared loss in soft mode: fewer check-ins than
 * a quarter of the active roster costs every store one percent. Never more,
 * never named. Returns what was taken, for the morning post's line item.
 */
export async function quietDayDecay(
  env: Env,
  day: string,
  checkinsThatDay: number,
  activeCount: number,
  now: number
): Promise<Partial<Stores> | null> {
  const threshold = Math.ceil(QUIET_DAY_FRACTION * activeCount);
  if (activeCount === 0 || checkinsThatDay >= threshold) return null;

  const stores = await getStores(env);
  const taken: Partial<Stores> = {};
  const statements: D1PreparedStatement[] = [];
  for (const resource of RESOURCES) {
    const loss = Math.floor(stores[resource] * QUIET_DAY_DECAY);
    if (loss <= 0) continue;
    taken[resource] = loss;
    statements.push(...creditStatements(env, resource, -loss, "quiet_day", day, null, now));
  }
  if (statements.length > 0) await retryWrite(() => env.DB.batch(statements));
  return taken;
}

export async function setBeekeeper(env: Env, until: number): Promise<void> {
  await env.DB.prepare("UPDATE town SET beekeeper_until = ? WHERE id = 1")
    .bind(until)
    .run();
}

/** "1,140 coins · 620 logs" — only what is non-zero, coins first. */
export function storesLine(stores: Partial<Stores>): string {
  const parts = RESOURCES.filter((r) => (stores[r] ?? 0) > 0).map(
    (r) => `${Math.floor(stores[r] ?? 0).toLocaleString("en-US")} ${r}`
  );
  return parts.length > 0 ? parts.join(" · ") : "nothing yet";
}
