import spoils from "../config/spoils.json" with { type: "json" };
import {
  ACTS,
  ACT_WEEKS,
  NOTABLE_RARITY_DENOMINATOR,
  NOTABLE_VALUE,
  SPOILS_CLUE_TIER,
  SPOILS_CONTAINERS,
  SPOILS_FEATURED_TIERS,
  SPOILS_FORM_WEEKS_BONUS,
  SPOILS_PITY,
  SPOILS_SLIM_CAP,
  SPOILS_TIERS,
  SPOILS_WEEK_CHEST_ROLLS,
  SUPPLY_CRATE,
  type ResourceKey,
  type SpoilsTierKey,
} from "./config.ts";
import { clueTier, drawSteps } from "./clues.ts";
import { bankDepositStatement, grantLampStatement, insertClue, logEntry, logEventStatement, openClue } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { seededRng, weightedPick } from "./events.ts";
import { actForWeek, campaignWeek } from "./schedule.ts";
import { creditStatements } from "./town.ts";
import type { Button, Env, Player } from "./types.ts";

/**
 * Spoils. Every check-in ends with a pick: the player's own roll (an impling
 * jar or a reward chest), today's featured container, and a sure thing (a
 * Book of knowledge, a supply crate for the camp, a clue). One is taken and
 * the others are gone.
 *
 * What is inside a jar or a chest is the wiki's loot table for it
 * (config/spoils.json, pulled by scripts/fetch-osrs.mjs --spoils). Which tier
 * a container sits on and how often each tier comes up are the game's own
 * (config.ts). Everything is drawn from a seed on the player and the day, so
 * a retried check-in offers the same three and a retried pick opens the same
 * loot.
 */

export type SpoilsOption =
  | { kind: "container"; key: string; slot: "roll" | "featured" }
  | { kind: "book" }
  | { kind: "crate"; resource: ResourceKey; amount: number }
  | { kind: "clue"; tier: string };

export interface Container {
  key: string;
  name: string;
  page: string;
  icon: string;
  tier: SpoilsTierKey;
}

export interface SpoilsStack {
  key: string;
  item: string;
  qty: number;
  value: number;
  /** The chance of the row that paid it. */
  rate: number;
  notable: boolean;
}

interface SpoilsFile {
  items: { k: string; n: string; v: number }[];
  containers: Record<string, { page: string; rows: number[][] }>;
  ge: Record<string, number>;
}

const FILE = spoils as unknown as SpoilsFile;

/** GE prices of what /ge sells, at fetch time. */
export const GE_PRICES: Record<string, number> = FILE.ge;

/** Item names by key, for the bank and the cards. */
export const SPOILS_ITEM_NAMES = new Map(FILE.items.map((item) => [item.k, item.n]));

const TIER_ORDER: SpoilsTierKey[] = SPOILS_TIERS.map((tier) => tier.key);

export function tierRank(tier: SpoilsTierKey): number {
  return TIER_ORDER.indexOf(tier);
}

export function tierName(tier: SpoilsTierKey): string {
  return SPOILS_TIERS.find((row) => row.key === tier)?.name ?? tier;
}

export function containerByKey(key: string): Container | undefined {
  return SPOILS_CONTAINERS.find((container) => container.key === key);
}

function containersOf(tier: SpoilsTierKey): Container[] {
  return SPOILS_CONTAINERS.filter((container) => container.tier === tier);
}

/** Today's featured container: the same for everybody, drawn from the day alone. */
export function featuredFor(day: string): Container {
  const pool = SPOILS_CONTAINERS.filter((container) => SPOILS_FEATURED_TIERS.includes(container.tier));
  return pool[Math.floor(seededRng(`${day}:featured`)() * pool.length)];
}

/** One tier roll, or the best of several. */
export function rollTier(rng: () => number, rolls = 1): SpoilsTierKey {
  let best: SpoilsTierKey = TIER_ORDER[0];
  for (let i = 0; i < Math.max(1, rolls); i++) {
    const tier = weightedPick(rng, SPOILS_TIERS).key;
    if (tierRank(tier) > tierRank(best)) best = tier;
  }
  return best;
}

export interface DraftInput {
  playerId: string;
  day: string;
  /** The check-in's ordinal within its week, and its weight. */
  ordinal: number;
  weight: number;
  formWeeks: number;
  /** Full-value check-ins since the player's own roll was last rare or better. */
  dry: number;
  holdingClue: boolean;
}

export interface Draft {
  options: SpoilsOption[];
  /** The tier the player's own roll came up. */
  tier: SpoilsTierKey;
  /** The second check-in of the week rolls with advantage. */
  weekChest: boolean;
  /** The pity counter forced this roll up to rare. */
  pity: boolean;
  /** The counter after this draft. */
  dryAfter: number;
}

/**
 * The three on offer. A full-value check-in gets the roll, today's container
 * and a sure thing; past the second check-in of the week the roll stops at
 * uncommon and today's container is not on the table.
 */
export function draftSpoils(input: DraftInput): Draft {
  const rng = seededRng(`${input.playerId}:${input.day}:spoils`);
  const full = input.weight >= 1;
  const weekChest = full && input.ordinal === 2;
  const rolls = weekChest ? SPOILS_WEEK_CHEST_ROLLS + (input.formWeeks >= SPOILS_FORM_WEEKS_BONUS ? 1 : 0) : 1;

  let tier = rollTier(rng, rolls);
  let pity = false;
  if (!full && tierRank(tier) > tierRank(SPOILS_SLIM_CAP)) tier = SPOILS_SLIM_CAP;
  if (full && input.dry + 1 >= SPOILS_PITY && tierRank(tier) < tierRank("rare")) {
    tier = "rare";
    pity = true;
  }

  const featured = full ? featuredFor(input.day) : null;
  const pool = containersOf(tier).filter((container) => container.key !== featured?.key);
  const own = (pool.length > 0 ? pool : containersOf(tier))[Math.floor(rng() * Math.max(1, pool.length))];

  const options: SpoilsOption[] = [{ kind: "container", key: own.key, slot: "roll" }];
  if (featured) options.push({ kind: "container", key: featured.key, slot: "featured" });

  const sure = ["book", "crate", ...(input.holdingClue ? [] : ["clue"])];
  switch (sure[Math.floor(rng() * sure.length)]) {
    case "crate": {
      const resources: ResourceKey[] = ["coins", "logs", "ore", "fish"];
      options.push({
        kind: "crate",
        resource: resources[Math.floor(rng() * resources.length)],
        amount: Math.max(10, Math.floor(SUPPLY_CRATE[tier] * input.weight)),
      });
      break;
    }
    case "clue":
      options.push({ kind: "clue", tier: SPOILS_CLUE_TIER[tier] });
      break;
    default:
      options.push({ kind: "book" });
  }

  const rare = tierRank(tier) >= tierRank("rare");
  return { options, tier, weekChest, pity, dryAfter: full ? (rare ? 0 : input.dry + 1) : input.dry };
}

// ── Opening ────────────────────────────────────────────────────────

interface Row {
  key: string;
  item: string;
  p: number;
  low: number;
  high: number;
  rolls: number;
  value: number;
}

const tables = new Map<string, Row[]>();

/** A container's loot table, decoded once. */
export function containerTable(key: string): Row[] {
  const cached = tables.get(key);
  if (cached) return cached;
  const rows: Row[] = [];
  for (const [index, p, low, high, rolls] of FILE.containers[key]?.rows ?? []) {
    const item = FILE.items[index];
    if (!item) continue;
    rows.push({ key: item.k, item: item.n, p, low, high, rolls: rolls || 1, value: item.v });
  }
  tables.set(key, rows);
  return rows;
}

/**
 * Opens a jar or a chest. "Always" rows are always paid. A table whose
 * chances add up to one is one exclusive roll, as an impling jar is in the
 * game; a chest with several sub-tables rolls every row at its own rate (the
 * same simplification the kill drops make), and never comes up empty.
 */
export function openContainer(key: string, rng: () => number): { stacks: SpoilsStack[]; total: number } {
  const rows = containerTable(key);
  const hits: Row[] = rows.filter((row) => row.p >= 1);
  const chance = rows.filter((row) => row.p < 1).map((row) => ({ ...row, weight: row.p * row.rolls }));
  const sum = chance.reduce((total, row) => total + row.weight, 0);
  if (chance.length > 0) {
    if (sum <= 1.05) {
      hits.push(weightedPick(rng, chance));
    } else {
      const before = hits.length;
      for (const row of chance) for (let i = 0; i < row.rolls; i++) if (rng() < row.p) hits.push(row);
      if (hits.length === before) hits.push(weightedPick(rng, chance));
    }
  }

  const stacks = new Map<string, SpoilsStack>();
  for (const row of hits) {
    const qty = row.low === row.high ? row.low : row.low + Math.floor(rng() * (row.high - row.low + 1));
    const existing = stacks.get(row.key);
    if (existing) {
      existing.qty += qty;
      existing.value += qty * row.value;
      existing.rate = Math.min(existing.rate, row.p);
    } else {
      stacks.set(row.key, { key: row.key, item: row.item, qty, value: qty * row.value, rate: row.p, notable: false });
    }
  }
  const list = [...stacks.values()].sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : 1));
  for (const stack of list) {
    stack.notable = stack.rate <= 1 / NOTABLE_RARITY_DENOMINATOR || stack.value >= NOTABLE_VALUE;
  }
  return { stacks: list, total: list.reduce((total, stack) => total + stack.value, 0) };
}

// ── Words ──────────────────────────────────────────────────────────

function gp(coins: number): string {
  if (coins >= 1_000_000) return `${(coins / 1_000_000).toFixed(1)}m gp`;
  if (coins >= 1_000) return `${(coins / 1_000).toFixed(coins >= 10_000 ? 0 : 1)}k gp`;
  return `${Math.round(coins)} gp`;
}

function optionEmoji(option: SpoilsOption): string {
  if (option.kind === "book") return "📖";
  if (option.kind === "crate") return "📦";
  if (option.kind === "clue") return "📜";
  return option.key.endsWith("_jar") ? "🫙" : option.key === "casket" ? "⚱️" : "🗝️";
}

/** "Magpie impling jar", "Supply crate (100 ore)", for a button or a line. */
export function optionName(option: SpoilsOption): string {
  switch (option.kind) {
    case "container":
      return containerByKey(option.key)?.name ?? option.key;
    case "book":
      return "Book of knowledge";
    case "crate":
      return `Supply crate (${option.amount} ${option.resource})`;
    case "clue":
      return `Clue bottle (${option.tier})`;
  }
}

function optionBlurb(option: SpoilsOption): string {
  switch (option.kind) {
    case "container": {
      const container = containerByKey(option.key);
      const tier = container ? tierName(container.tier).toLowerCase() : "";
      return `*${tier}*${option.slot === "featured" ? " · today's container" : ""} — loot for your bank`;
    }
    case "book":
      return "a lamp worth 15× the level of the skill you read it into";
    case "crate":
      return "straight to the camp's stores";
    case "clue":
      return "a clue scroll to follow";
  }
}

/** The pick, as the receipt shows it. */
export function draftLines(options: SpoilsOption[], draft: Pick<Draft, "weekChest" | "pity"> | null, dry: number): string[] {
  const lines = [
    draft?.weekChest
      ? "🎁 **The week's chest** — your second check-in rolled with advantage. Pick one:"
      : "🎁 **Spoils** — pick one:",
  ];
  options.forEach((option, i) => lines.push(`${i + 1}. ${optionEmoji(option)} **${optionName(option)}** — ${optionBlurb(option)}`));
  if (draft?.pity) lines.push(`Pity: ${SPOILS_PITY} check-ins without a rare roll, so this one is.`);
  else if (dry > 0) lines.push(`Dry streak ${dry}/${SPOILS_PITY}: a rare roll is guaranteed at ${SPOILS_PITY}.`);
  return lines;
}

export function spoilsButtons(id: number, options: SpoilsOption[]): Button[] {
  return options.map((option, i) => {
    const tier = option.kind === "container" ? containerByKey(option.key)?.tier : undefined;
    return {
      label: optionName(option).slice(0, 80),
      custom_id: `sp:${id}:${i}`,
      style: tier && tierRank(tier) >= tierRank("rare") ? 3 : 1,
      emoji: optionEmoji(option),
    };
  });
}

// ── The table ──────────────────────────────────────────────────────

export interface SpoilsRow {
  id: number;
  player_id: string;
  checkin_id: number;
  day: string;
  options: string;
  picked: number | null;
  container: string | null;
  result: string | null;
  opened_day: string | null;
  opened_at: number | null;
  auto: number;
}

export function optionsOf(row: SpoilsRow): SpoilsOption[] {
  try {
    return JSON.parse(row.options) as SpoilsOption[];
  } catch {
    return [];
  }
}

export async function getSpoils(env: Env, id: number): Promise<SpoilsRow | null> {
  return env.DB.prepare("SELECT * FROM spoils WHERE id = ?").bind(id).first<SpoilsRow>();
}

/** Spoils the player has not picked from, oldest first. */
export async function waitingSpoils(env: Env, playerId: string): Promise<SpoilsRow[]> {
  const { results } = await env.DB.prepare("SELECT * FROM spoils WHERE player_id = ? AND picked IS NULL ORDER BY id")
    .bind(playerId)
    .all<SpoilsRow>();
  return results;
}

/** Unopened spoils per player, for the evening reminders. */
export async function waitingSpoilsCounts(env: Env): Promise<{ player_id: string; n: number }[]> {
  const { results } = await env.DB.prepare(
    "SELECT player_id, COUNT(*) AS n FROM spoils WHERE picked IS NULL GROUP BY player_id"
  ).all<{ player_id: string; n: number }>();
  return results;
}

export async function spoilsCounts(env: Env, playerId: string): Promise<{ opened: number; containers: string[] }> {
  const opened = await env.DB.prepare("SELECT COUNT(*) AS n FROM spoils WHERE player_id = ? AND picked IS NOT NULL")
    .bind(playerId)
    .first<{ n: number }>();
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT container FROM spoils WHERE player_id = ? AND container IS NOT NULL"
  )
    .bind(playerId)
    .all<{ container: string }>();
  return { opened: opened?.n ?? 0, containers: results.map((row) => row.container) };
}

/**
 * Draws the check-in's spoils and stores them. A retried check-in finds the
 * row already there and hands the same one back.
 */
export async function createSpoils(
  env: Env,
  player: Player,
  checkinId: number,
  day: string,
  ordinal: number,
  weight: number
): Promise<{ row: SpoilsRow; draft: Draft }> {
  const draft = draftSpoils({
    playerId: player.discord_id,
    day,
    ordinal,
    weight,
    formWeeks: player.form_weeks,
    dry: player.spoils_dry ?? 0,
    holdingClue: Boolean(await openClue(env, player.discord_id)),
  });
  await env.DB.prepare(
    "INSERT INTO spoils (player_id, checkin_id, day, options) VALUES (?, ?, ?, ?) ON CONFLICT (checkin_id) DO NOTHING"
  )
    .bind(player.discord_id, checkinId, day, JSON.stringify(draft.options))
    .run();
  const row = await env.DB.prepare("SELECT * FROM spoils WHERE checkin_id = ?").bind(checkinId).first<SpoilsRow>();
  return { row: row!, draft };
}

export interface Opened {
  /** What the player reads. */
  line: string;
  /** What the day's thread reads. */
  publicLine: string;
  /** The card: a headline, the icon drawn large, and the loot under it. */
  card: { title: string; sub: string; big: string; tier?: string; loot: { k: string; c: number }[]; v?: number };
  hasLamp: boolean;
}

/**
 * Takes one of the options. Returns null when the row was already opened —
 * a double click, or the next check-in got there first.
 */
export async function openSpoils(
  env: Env,
  player: Player,
  row: SpoilsRow,
  index: number,
  day: string,
  now: number,
  auto = false
): Promise<Opened | null> {
  const options = optionsOf(row);
  let option = options[index];
  if (!option) return null;

  // A clue bottle is no use to somebody already on a trail: it reads as a book.
  if (option.kind === "clue" && (await openClue(env, player.discord_id))) option = { kind: "book" };

  const container = option.kind === "container" ? containerByKey(option.key) : undefined;
  const claimed = await env.DB.prepare(
    "UPDATE spoils SET picked = ?, container = ?, opened_day = ?, opened_at = ?, auto = ? WHERE id = ? AND picked IS NULL"
  )
    .bind(index, container?.key ?? null, day, now, auto ? 1 : 0, row.id)
    .run();
  if (claimed.meta.changes === 0) return null;

  const name = escapeMarkdown(player.username);
  const rng = seededRng(`${player.discord_id}:${row.id}:open:${index}`);
  const statements: D1PreparedStatement[] = [];
  let opened: Opened;
  let result: unknown;

  switch (option.kind) {
    case "container": {
      const { stacks, total } = openContainer(option.key, rng);
      for (const stack of stacks) {
        statements.push(bankDepositStatement(env, player.discord_id, stack.key, stack.qty, stack.value, day));
      }
      const tier = container ? tierName(container.tier).toLowerCase() : "";
      const what = container?.name ?? option.key;
      const list = stacks.map((stack) => `${stack.qty.toLocaleString("en-US")}× ${stack.item}`).join(", ");
      const notable = stacks.filter((stack) => stack.notable);
      const shout = notable.length > 0 ? ` 💎 **${notable.map((stack) => stack.item).join(", ")}**!` : "";
      opened = {
        line: `${optionEmoji(option)} **${what}** (${tier}): ${list} — ${gp(total)}, banked.${shout}`,
        publicLine: `🎁 **${name}** opened a ${what.toLowerCase()} (${tier}): ${list} — ${gp(total)}.${shout}`,
        card: {
          title: `${player.username} opened a ${what.toLowerCase()}`,
          sub: `${tierName(container?.tier ?? "common")} spoils - worth ${gp(total)}`,
          big: option.key,
          tier: container?.tier,
          loot: stacks.map((stack) => ({ k: stack.key, c: stack.qty })),
          v: Math.round(total),
        },
        hasLamp: false,
      };
      result = { kind: "container", container: option.key, s: stacks.map((stack) => [stack.key, stack.qty, stack.value]), t: total };
      for (const stack of notable) await logEntry(env, player.discord_id, `drop:${stack.key}`, day);
      break;
    }
    case "book":
      statements.push(grantLampStatement(env, player.discord_id, 0, "book", day));
      opened = {
        line: "📖 **Book of knowledge**: it is with your lamps. Read it into a skill with `/lamp` for 15× that skill's level.",
        publicLine: `🎁 **${name}** took the Book of knowledge.`,
        card: { title: `${player.username} took a Book of knowledge`, sub: "Spoils - 15 XP per level, any skill", big: "book_of_knowledge", loot: [] },
        hasLamp: true,
      };
      result = { kind: "book" };
      break;
    case "crate":
      statements.push(...creditStatements(env, option.resource, option.amount, "crate", day, player.discord_id, now));
      opened = {
        line: `📦 **Supply crate**: ${option.amount} ${option.resource} delivered to the camp.`,
        publicLine: `🎁 **${name}** sent a supply crate to the camp: ${option.amount} ${option.resource}.`,
        card: {
          title: `${player.username} sent a supply crate`,
          sub: `Spoils - ${option.amount} ${option.resource} for the camp`,
          big: "crate",
          loot: [{ k: option.resource, c: option.amount }],
        },
        hasLamp: false,
      };
      result = { kind: "crate", resource: option.resource, amount: option.amount };
      break;
    case "clue": {
      const tier = clueTier(option.tier);
      const act = actForWeek(campaignWeek(day, env.CAMPAIGN_START), ACT_WEEKS, ACTS.length);
      const steps = drawSteps(rng, tier, act);
      await insertClue(env, player.discord_id, tier.key, steps, day);
      opened = {
        line: `📜 **Clue bottle**: a${tier.key === "easy" || tier.key === "elite" ? "n" : ""} ${tier.name.toLowerCase()} clue scroll, ${steps.length} steps. \`/clue\` shows the trail.`,
        publicLine: `🎁 **${name}** fished out a clue bottle: a${tier.key === "easy" || tier.key === "elite" ? "n" : ""} ${tier.name.toLowerCase()} clue scroll.`,
        card: {
          title: `${player.username} found a clue bottle`,
          sub: `Spoils - ${tier.name} clue scroll, ${steps.length} steps`,
          big: `clue_${tier.key}`,
          loot: [],
        },
        hasLamp: false,
      };
      result = { kind: "clue", tier: tier.key };
      break;
    }
  }

  statements.push(
    env.DB.prepare("UPDATE spoils SET result = ? WHERE id = ?").bind(JSON.stringify(result), row.id),
    logEventStatement(env, player.discord_id, day, row.checkin_id, "spoils", { id: row.id, pick: index, auto, ...(result as object) }, now)
  );
  await env.DB.batch(statements);
  return opened;
}

/** `/spoils`: what is waiting, the pity counter, today's container, and the collection. */
export async function spoilsView(
  env: Env,
  player: Player,
  day: string
): Promise<{ content: string; components?: unknown[]; waiting: SpoilsRow | null }> {
  const waiting = await waitingSpoils(env, player.discord_id);
  const counts = await spoilsCounts(env, player.discord_id);
  const featured = featuredFor(day);
  const lines: string[] = [];
  const current = waiting[waiting.length - 1] ?? null;
  if (current) {
    lines.push(...draftLines(optionsOf(current), null, 0));
    lines.push("Unpicked spoils open themselves (your roll) at your next check-in.");
  } else {
    lines.push("🎁 **Spoils** — nothing waiting. Every check-in ends with a pick of three.");
  }
  lines.push(
    `Today's container: **${featured.name}** (${tierName(featured.tier).toLowerCase()}). It is on offer with every full-value check-in today.`
  );
  const dry = player.spoils_dry ?? 0;
  lines.push(`Dry streak ${dry}/${SPOILS_PITY} · the week's second check-in rolls with advantage.`);
  const have = new Set(counts.containers);
  lines.push(
    `Opened ${counts.opened} · containers ${have.size}/${SPOILS_CONTAINERS.length}: ` +
      SPOILS_CONTAINERS.map((container) => (have.has(container.key) ? `**${container.name}**` : `~~${container.name}~~`)).join(", ")
  );
  return { content: lines.join("\n"), waiting: current };
}
