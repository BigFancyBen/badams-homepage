import {
  BANK_HOURS_PER_LEVEL,
  BASE_HAUL,
  BEEKEEPER_BONUS,
  BUILDINGS,
  BUILDING_DECAY_PER_DAY,
  BUILDING_HALF_AT,
  BUILDING_LEVEL_COST_MULTIPLIER,
  FIRE_SALE_DISCOUNT,
  FOUNDING_OUTPUT_BONUS,
  GATHER_BUILDING_BONUS,
  GATHER_XP_CAP,
  GATHER_XP_PER_UNIT,
  GOLDEN_GOD_COINS,
  ORE_PER_BAR,
  PRODUCTION_MASTER_BONUS,
  QUIET_DAY_DECAY,
  QUIET_DAY_FRACTION,
  QUITTER_SILENT_DAYS,
  QUITTER_WORKER_RATE,
  RECRUIT_COST_PER_OWNED,
  REPAIR_LOGS_PER_POINT,
  RESOURCES,
  SACK_CAP_HOURS,
  SMELT_FRACTION,
  STATUE_BONUS,
  TAVERN_EVENT_CHANCE,
  TIERS,
  UNFED_RATE,
  WORKER_FISH_PER_DAY,
  WORKER_KINDS,
  WORKER_RESOURCE,
  WORKER_SKILL,
  WORKER_TIERS,
  EVENT_CHANCE,
  type Building,
  type BuildingKey,
  type RelicKey,
  type ResourceKey,
  type SkillKey,
  type WorkerKind,
  type WorkerTier,
} from "./config.ts";
import { retryWrite } from "./db.ts";
import { addDays } from "./schedule.ts";
import type { Env, Player } from "./types.ts";
import { tierIndex, workerSlots } from "./xp.ts";

/**
 * The shared town. Act 1 is a camp — stores only, fed by the base haul.
 * Founding I brings workers: owned by a player, gathering hourly into a sack
 * that only the owner's check-in empties, so the idle layer pulls toward the
 * gym rather than standing in for it. Buildings multiply, decay, and are
 * repaired with logs. The quiet-day rule is the only shared loss and it is
 * capped and unnamed.
 */

export type Stores = Record<ResourceKey, number>;

export interface TownRow {
  id: number;
  name: string;
  level: number;
  last_tick_at: number | null;
  last_daily_day: string | null;
  beekeeper_until: number | null;
  besieged_until: string | null;
}

export interface WorkerRow {
  id: number;
  kind: WorkerKind;
  tier: string;
  owner_id: string | null;
  original_owner_id: string;
  sack: number;
  sack_updated_at: number | null;
  fed: number;
  name: string | null;
  recruited_at: number;
  town_owned_since: number | null;
}

export interface BuildingRow {
  key: BuildingKey;
  level: number;
  condition: number;
  built_at: number | null;
}

// ── Stores ─────────────────────────────────────────────────────────

export async function getStores(env: Env): Promise<Stores> {
  const { results } = await env.DB.prepare(
    "SELECT resource, amount FROM town_resources"
  ).all<{ resource: ResourceKey; amount: number }>();
  const stores = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stores;
  for (const row of results) stores[row.resource] = row.amount;
  return stores;
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
export function baseHaul(
  weight: number,
  haulMultiplier: number,
  relics: Set<RelicKey> = new Set()
): Partial<Stores> {
  const haul: Partial<Stores> = {};
  for (const [resource, amount] of Object.entries(BASE_HAUL)) {
    haul[resource as ResourceKey] = Math.floor((amount ?? 0) * weight * haulMultiplier);
  }
  if (relics.has("golden_god")) haul.coins = (haul.coins ?? 0) + GOLDEN_GOD_COINS;
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

export function costLine(cost: Partial<Record<ResourceKey, number>>): string {
  const parts = RESOURCES.filter((r) => (cost[r] ?? 0) > 0).map((r) => `${cost[r]} ${r}`);
  return parts.length > 0 ? parts.join(", ") : "free";
}

export function canAfford(stores: Stores, cost: Partial<Record<ResourceKey, number>>): boolean {
  return RESOURCES.every((r) => stores[r] >= (cost[r] ?? 0));
}

function spendStatements(
  env: Env,
  cost: Partial<Record<ResourceKey, number>>,
  kind: string,
  day: string,
  playerId: string | null,
  now: number
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  for (const resource of RESOURCES) {
    const amount = cost[resource] ?? 0;
    if (amount > 0) statements.push(...creditStatements(env, resource, -amount, kind, day, playerId, now));
  }
  return statements;
}

// ── Buildings ──────────────────────────────────────────────────────

export function buildingDef(key: string): Building | undefined {
  return BUILDINGS.find((building) => building.key === key);
}

export async function getBuildings(env: Env): Promise<Map<BuildingKey, BuildingRow>> {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM buildings").all<BuildingRow>();
    return new Map(results.map((row) => [row.key, row]));
  } catch {
    return new Map();
  }
}

/** A building's level after its condition: full above 50, half below, none at 0. */
export function effectiveLevel(row: BuildingRow | undefined): number {
  if (!row || row.level <= 0) return 0;
  if (row.condition <= 0) return 0;
  if (row.condition < BUILDING_HALF_AT) return row.level / 2;
  return row.level;
}

export function buildingCost(def: Building, nextLevel: number): Partial<Record<ResourceKey, number>> {
  const multiplier = BUILDING_LEVEL_COST_MULTIPLIER[nextLevel - 1] ?? BUILDING_LEVEL_COST_MULTIPLIER.at(-1)!;
  const cost: Partial<Record<ResourceKey, number>> = {};
  for (const [resource, amount] of Object.entries(def.cost)) {
    cost[resource as ResourceKey] = Math.floor((amount ?? 0) * multiplier);
  }
  return cost;
}

/** Everything that could be built or upgraded right now, whether affordable or not. */
export function buildOptions(
  buildings: Map<BuildingKey, BuildingRow>,
  town: TownRow,
  act: number
): { key: BuildingKey; name: string; nextLevel: number; cost: Partial<Record<ResourceKey, number>>; effect: string }[] {
  // The Town Hall caps every other building at its own level.
  const cap = Math.max(1, town.level);
  const options = [];
  for (const def of BUILDINGS) {
    if (def.key === "town_hall") continue;
    if (def.from > act) continue;
    const current = buildings.get(def.key)?.level ?? 0;
    const nextLevel = current + 1;
    if (nextLevel > def.maxLevel || nextLevel > cap) continue;
    options.push({ key: def.key, name: def.name, nextLevel, cost: buildingCost(def, nextLevel), effect: def.effect });
  }
  return options;
}

export async function build(
  env: Env,
  key: BuildingKey,
  day: string,
  playerId: string | null,
  now: number,
  act: number
): Promise<{ ok: true; level: number } | { ok: false; reason: string }> {
  const def = buildingDef(key);
  if (!def) return { ok: false, reason: "No such building." };
  const town = await getTown(env);
  const buildings = await getBuildings(env);
  const option = buildOptions(buildings, town, act).find((o) => o.key === key);
  if (!option) return { ok: false, reason: `${def.name} cannot be built or raised right now.` };
  const stores = await getStores(env);
  if (!canAfford(stores, option.cost)) {
    return { ok: false, reason: `${def.name} L${option.nextLevel} needs ${costLine(option.cost)}; the town holds ${storesLine(stores)}.` };
  }
  await env.DB.batch([
    ...spendStatements(env, option.cost, "build", day, playerId, now),
    env.DB.prepare(
      "INSERT INTO buildings (key, level, condition, built_at) VALUES (?, ?, 100, ?) " +
        "ON CONFLICT (key) DO UPDATE SET level = excluded.level, condition = 100"
    ).bind(key, option.nextLevel, now),
  ]);
  return { ok: true, level: option.nextLevel };
}

export async function repair(
  env: Env,
  key: BuildingKey,
  day: string,
  playerId: string | null,
  now: number
): Promise<{ ok: true; points: number; logs: number } | { ok: false; reason: string }> {
  const def = buildingDef(key);
  const row = (await getBuildings(env)).get(key);
  if (!def || !row || row.level <= 0) return { ok: false, reason: "Nothing there to repair." };
  const points = 100 - row.condition;
  if (points <= 0) return { ok: false, reason: `${def.name} is in perfect condition.` };
  const stores = await getStores(env);
  const affordable = Math.min(points, Math.floor(stores.logs / REPAIR_LOGS_PER_POINT));
  if (affordable <= 0) return { ok: false, reason: `Repairs cost ${REPAIR_LOGS_PER_POINT} logs a point and the town has ${Math.floor(stores.logs)} logs.` };
  const logs = affordable * REPAIR_LOGS_PER_POINT;
  await env.DB.batch([
    ...spendStatements(env, { logs }, "repair", day, playerId, now),
    env.DB.prepare("UPDATE buildings SET condition = condition + ? WHERE key = ?").bind(affordable, key),
  ]);
  return { ok: true, points: affordable, logs };
}

/** The Freaky Forester: the worst building gets `points` back, free. */
export async function repairWorst(env: Env, points: number): Promise<string | null> {
  const rows = [...(await getBuildings(env)).values()].filter((row) => row.level > 0 && row.condition < 100);
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.condition - b.condition);
  const worst = rows[0];
  await env.DB.prepare("UPDATE buildings SET condition = MIN(100, condition + ?) WHERE key = ?")
    .bind(points, worst.key)
    .run();
  return buildingDef(worst.key)?.name ?? worst.key;
}

/** The Tavern lowers "one in N". */
export function eventChance(buildings: Map<BuildingKey, BuildingRow>): number {
  const level = Math.floor(effectiveLevel(buildings.get("tavern")));
  return TAVERN_EVENT_CHANCE[Math.min(level, TAVERN_EVENT_CHANCE.length - 1)] ?? EVENT_CHANCE;
}

export function sackCapHours(buildings: Map<BuildingKey, BuildingRow>): number {
  return SACK_CAP_HOURS + BANK_HOURS_PER_LEVEL * Math.floor(effectiveLevel(buildings.get("bank")));
}

// ── Workers ────────────────────────────────────────────────────────

export function workerTierDef(key: string): WorkerTier {
  return WORKER_TIERS.find((tier) => tier.key === key) ?? WORKER_TIERS[0];
}

export function nextWorkerTier(key: string): WorkerTier | null {
  const index = WORKER_TIERS.findIndex((tier) => tier.key === key);
  return index >= 0 && index < WORKER_TIERS.length - 1 ? WORKER_TIERS[index + 1] : null;
}

export async function getWorkers(env: Env, ownerId?: string): Promise<WorkerRow[]> {
  try {
    const query = ownerId
      ? env.DB.prepare("SELECT * FROM workers WHERE owner_id = ? ORDER BY id").bind(ownerId)
      : env.DB.prepare("SELECT * FROM workers ORDER BY id");
    const { results } = await query.all<WorkerRow>();
    return results;
  } catch {
    return [];
  }
}

export function workerLabel(worker: WorkerRow): string {
  const tier = workerTierDef(worker.tier).name;
  const kind = worker.kind[0].toUpperCase() + worker.kind.slice(1);
  return worker.name ? `${worker.name} (${tier} ${kind})` : `${tier} ${kind}`;
}

/**
 * Output per hour for one worker, everything multiplied in: tier rate,
 * the resource's building, the Foundings, relics, the Beekeeper, the
 * statue, and whether it ate.
 */
export function workerRate(
  worker: WorkerRow,
  buildings: Map<BuildingKey, BuildingRow>,
  town: TownRow,
  relics: Set<RelicKey>,
  now: number
): number {
  let rate = workerTierDef(worker.tier).rate;
  const building: Partial<Record<WorkerKind, BuildingKey>> = { fisher: "dock", woodcutter: "mill", miner: "cart" };
  const key = building[worker.kind];
  if (key) rate *= 1 + GATHER_BUILDING_BONUS * effectiveLevel(buildings.get(key));
  rate *= 1 + FOUNDING_OUTPUT_BONUS * Math.max(0, town.level - 1);
  if (relics.has("production_master")) rate *= 1 + PRODUCTION_MASTER_BONUS;
  if (town.beekeeper_until && town.beekeeper_until > now) rate *= 1 + BEEKEEPER_BONUS;
  if (effectiveLevel(buildings.get("statue")) > 0) rate *= 1 + STATUE_BONUS;
  if (!worker.fed) rate *= UNFED_RATE;
  if (!worker.owner_id) rate *= QUITTER_WORKER_RATE;
  return rate;
}

/**
 * The hourly tick. Owned workers fill their sacks up to the cap; town-owned
 * ones deliver straight to the stores at half rate. Elapsed time is measured
 * from the last tick so a missed hour is not lost.
 */
export async function hourlyTownTick(
  env: Env,
  now: number,
  day: string,
  relics: Set<RelicKey>
): Promise<{ workers: number; townOwned: number }> {
  const town = await getTown(env);
  if (town.level < 1) return { workers: 0, townOwned: 0 };
  const buildings = await getBuildings(env);
  const cap = sackCapHours(buildings);
  const workers = await getWorkers(env);
  const statements: D1PreparedStatement[] = [];
  let townOwned = 0;

  for (const worker of workers) {
    const since = worker.sack_updated_at ?? town.last_tick_at ?? now - 60 * 60 * 1000;
    const hours = Math.max(0, Math.min(24, (now - since) / (60 * 60 * 1000)));
    const rate = workerRate(worker, buildings, town, relics, now);
    const gathered = rate * hours;
    if (worker.owner_id) {
      const capAmount = rate * cap;
      const sack = Math.min(capAmount, worker.sack + gathered);
      statements.push(
        env.DB.prepare("UPDATE workers SET sack = ?, sack_updated_at = ? WHERE id = ?").bind(sack, now, worker.id)
      );
    } else {
      townOwned++;
      statements.push(
        ...creditStatements(env, WORKER_RESOURCE[worker.kind], gathered, "town_worker", day, null, now),
        env.DB.prepare("UPDATE workers SET sack_updated_at = ? WHERE id = ?").bind(now, worker.id)
      );
    }
  }
  statements.push(env.DB.prepare("UPDATE town SET last_tick_at = ? WHERE id = 1").bind(now));
  await env.DB.batch(statements);
  return { workers: workers.length, townOwned };
}

/** Whether a sack is at its cap, for the clue step. */
export function sackIsFull(
  worker: WorkerRow,
  buildings: Map<BuildingKey, BuildingRow>,
  town: TownRow,
  relics: Set<RelicKey>,
  now: number
): boolean {
  const capAmount = workerRate(worker, buildings, town, relics, now) * sackCapHours(buildings);
  return capAmount > 0 && worker.sack >= capAmount * 0.99;
}

export interface Delivery {
  delivered: Partial<Stores>;
  xp: Partial<Record<SkillKey, number>>;
  hadFullSack: boolean;
  statements: D1PreparedStatement[];
}

/**
 * Empties a player's sacks into the town on their check-in. Ore meets the
 * Furnace on the way in; gathering XP is paid per kind, capped per skill.
 * Also brings back any workers the town took while the owner was quiet.
 */
export async function deliverSacks(
  env: Env,
  player: Player,
  day: string,
  now: number,
  relics: Set<RelicKey>
): Promise<Delivery> {
  const delivery: Delivery = { delivered: {}, xp: {}, hadFullSack: false, statements: [] };
  const town = await getTown(env);
  if (town.level < 1) return delivery;
  const buildings = await getBuildings(env);

  // Workers the town took while this player was silent come home first.
  delivery.statements.push(
    env.DB.prepare(
      "UPDATE workers SET owner_id = original_owner_id, town_owned_since = NULL WHERE original_owner_id = ? AND owner_id IS NULL"
    ).bind(player.discord_id)
  );

  const furnace = Math.floor(effectiveLevel(buildings.get("furnace")));
  for (const worker of await getWorkers(env, player.discord_id)) {
    if (sackIsFull(worker, buildings, town, relics, now)) delivery.hadFullSack = true;
    const amount = Math.floor(worker.sack);
    if (amount <= 0) continue;
    const resource = WORKER_RESOURCE[worker.kind];
    let toStore = amount;
    if (resource === "ore" && furnace > 0) {
      const smelted = Math.floor(amount * SMELT_FRACTION);
      const bars = Math.floor(smelted / ORE_PER_BAR);
      if (bars > 0) {
        toStore -= bars * ORE_PER_BAR;
        delivery.delivered.bars = (delivery.delivered.bars ?? 0) + bars;
        delivery.statements.push(...creditStatements(env, "bars", bars, "smelt", day, player.discord_id, now));
      }
    }
    delivery.delivered[resource] = (delivery.delivered[resource] ?? 0) + toStore;
    delivery.statements.push(...creditStatements(env, resource, toStore, "sack", day, player.discord_id, now));
    const skill = WORKER_SKILL[worker.kind];
    if (skill) {
      delivery.xp[skill] = Math.min(GATHER_XP_CAP, (delivery.xp[skill] ?? 0) + Math.floor(amount * GATHER_XP_PER_UNIT * 5));
    }
    delivery.statements.push(
      env.DB.prepare("UPDATE workers SET sack = 0, sack_updated_at = ? WHERE id = ?").bind(now, worker.id)
    );
  }
  return delivery;
}

/** How many workers a player may own at their Hitpoints level. */
export function slotsFor(hpLevel: number): number {
  return workerSlots(hpLevel);
}

/** A player's tier as a worker-tier index: the Rune trims all count as Rune. */
function ownerTierIndex(playerTierKey: string): number {
  const base = playerTierKey.startsWith("rune") ? "rune" : playerTierKey;
  return WORKER_TIERS.findIndex((tier) => tier.key === base);
}

export async function recruit(
  env: Env,
  player: Player,
  kind: WorkerKind,
  hpLevel: number,
  day: string,
  now: number,
  free = false
): Promise<{ ok: true; cost: number } | { ok: false; reason: string }> {
  const town = await getTown(env);
  if (town.level < 1) return { ok: false, reason: "Workers arrive at Founding I." };
  if (!WORKER_KINDS.includes(kind)) return { ok: false, reason: "No such kind of worker." };
  const owned = await getWorkers(env, player.discord_id);
  const slots = slotsFor(hpLevel);
  if (owned.length >= slots) {
    return { ok: false, reason: `You have ${owned.length} of ${slots} worker slots; the next comes at Hitpoints ${(slots) * 15}.` };
  }
  const cost = free ? 0 : RECRUIT_COST_PER_OWNED * Math.max(1, owned.length);
  const stores = await getStores(env);
  if (!free && owned.length > 0 && stores.coins < cost) {
    return { ok: false, reason: `A recruit costs ${cost} coins now and the town holds ${Math.floor(stores.coins)}.` };
  }
  const actualCost = free || owned.length === 0 ? 0 : cost;
  await env.DB.batch([
    ...spendStatements(env, { coins: actualCost }, "recruit", day, player.discord_id, now),
    env.DB.prepare(
      "INSERT INTO workers (kind, tier, owner_id, original_owner_id, sack, sack_updated_at, fed, recruited_at) " +
        "VALUES (?, 'bronze', ?, ?, 0, ?, 1, ?)"
    ).bind(kind, player.discord_id, player.discord_id, now, now),
  ]);
  return { ok: true, cost: actualCost };
}

export async function upgradeWorker(
  env: Env,
  player: Player,
  workerId: number,
  playerTierKey: string,
  day: string,
  now: number,
  relics: Set<RelicKey>
): Promise<{ ok: true; tier: WorkerTier } | { ok: false; reason: string }> {
  const worker = (await getWorkers(env, player.discord_id)).find((w) => w.id === workerId);
  if (!worker) return { ok: false, reason: "That worker is not yours." };
  const next = nextWorkerTier(worker.tier);
  if (!next) return { ok: false, reason: `${workerLabel(worker)} is already Dragon.` };
  if (ownerTierIndex(playerTierKey) < WORKER_TIERS.findIndex((t) => t.key === next.key)) {
    return { ok: false, reason: `A worker cannot outrank its owner. ${next.name} needs you at ${next.name} first.` };
  }
  const buildings = await getBuildings(env);
  if (next.furnace && Math.floor(effectiveLevel(buildings.get("furnace"))) < next.furnace) {
    return { ok: false, reason: `${next.name} workers need the Furnace at level ${next.furnace}.` };
  }
  const cost: Partial<Record<ResourceKey, number>> = {};
  for (const [resource, amount] of Object.entries(next.cost)) {
    cost[resource as ResourceKey] = Math.floor((amount ?? 0) * (relics.has("fire_sale") ? 1 - FIRE_SALE_DISCOUNT : 1));
  }
  const stores = await getStores(env);
  if (!canAfford(stores, cost)) {
    return { ok: false, reason: `${next.name} costs ${costLine(cost)}; the town holds ${storesLine(stores)}.` };
  }
  await env.DB.batch([
    ...spendStatements(env, cost, "upgrade", day, player.discord_id, now),
    env.DB.prepare("UPDATE workers SET tier = ? WHERE id = ?").bind(next.key, workerId),
  ]);
  return { ok: true, tier: next };
}

// ── The daily tick ─────────────────────────────────────────────────

/**
 * Feed, decay, quitters. Workers eat six fish a day from the stores; the
 * ones that go hungry produce at half rate tomorrow. Buildings lose three
 * condition. Workers whose owner has been silent three weeks go to the town.
 */
export async function dailyTownTick(
  env: Env,
  today: string,
  now: number,
  players: Player[]
): Promise<{ fed: number; hungry: number; decayed: number; takenByTown: number }> {
  const town = await getTown(env);
  const result = { fed: 0, hungry: 0, decayed: 0, takenByTown: 0 };
  if (town.level < 1) return result;

  const workers = await getWorkers(env);
  const stores = await getStores(env);
  const statements: D1PreparedStatement[] = [];

  let fish = stores.fish;
  for (const worker of workers) {
    if (fish >= WORKER_FISH_PER_DAY) {
      fish -= WORKER_FISH_PER_DAY;
      result.fed++;
      statements.push(env.DB.prepare("UPDATE workers SET fed = 1 WHERE id = ?").bind(worker.id));
    } else {
      result.hungry++;
      statements.push(env.DB.prepare("UPDATE workers SET fed = 0 WHERE id = ?").bind(worker.id));
    }
  }
  const eaten = stores.fish - fish;
  if (eaten > 0) statements.push(...creditStatements(env, "fish", -eaten, "upkeep", today, null, now));

  for (const row of (await getBuildings(env)).values()) {
    if (row.level <= 0 || row.condition <= 0) continue;
    result.decayed++;
    statements.push(
      env.DB.prepare("UPDATE buildings SET condition = MAX(0, condition - ?) WHERE key = ?").bind(BUILDING_DECAY_PER_DAY, row.key)
    );
  }

  const silentBefore = addDays(today, -QUITTER_SILENT_DAYS);
  const quiet = new Set(
    players
      .filter((p) => p.status !== "active" || !p.last_active_day || p.last_active_day < silentBefore)
      .map((p) => p.discord_id)
  );
  for (const worker of workers) {
    if (worker.owner_id && quiet.has(worker.owner_id)) {
      result.takenByTown++;
      statements.push(
        env.DB.prepare("UPDATE workers SET owner_id = NULL, town_owned_since = ?, sack = 0 WHERE id = ?").bind(now, worker.id)
      );
    }
  }

  statements.push(env.DB.prepare("UPDATE town SET last_daily_day = ? WHERE id = 1").bind(today));
  await env.DB.batch(statements);
  return result;
}

/**
 * The Founding. The camp becomes a town (or the town gains a level): the
 * Town Hall rises, every building is repaired, and every active player gets
 * a Bronze worker — kinds rotated so the town starts balanced.
 */
export async function founding(
  env: Env,
  roster: Player[],
  hpLevels: Map<string, number>,
  day: string,
  now: number
): Promise<{ level: number; workersGranted: number }> {
  const town = await getTown(env);
  const level = town.level + 1;
  await env.DB.batch([
    env.DB.prepare("UPDATE town SET level = ?, name = 'the town' WHERE id = 1").bind(level),
    env.DB.prepare(
      "INSERT INTO buildings (key, level, condition, built_at) VALUES ('town_hall', ?, 100, ?) " +
        "ON CONFLICT (key) DO UPDATE SET level = excluded.level, condition = 100"
    ).bind(level, now),
    env.DB.prepare("UPDATE buildings SET condition = 100"),
  ]);
  let granted = 0;
  for (let i = 0; i < roster.length; i++) {
    const kind = WORKER_KINDS[i % WORKER_KINDS.length];
    const result = await recruit(env, roster[i], kind, hpLevels.get(roster[i].discord_id) ?? 1, day, now, true);
    if (result.ok) granted++;
  }
  return { level, workersGranted: granted };
}

export function tierKeyForOwner(hpLevel: number): string {
  let key = TIERS[0].key;
  for (const tier of TIERS) if (hpLevel >= tier.hp) key = tier.key;
  return key;
}

export { tierIndex };
