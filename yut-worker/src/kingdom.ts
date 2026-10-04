import {
  KINGDOM_APPROVAL_DECAY,
  KINGDOM_APPROVAL_FLOOR,
  KINGDOM_CHECKIN_APPROVAL,
  KINGDOM_COFFER_MAX,
  KINGDOM_DAILY_CAP,
  KINGDOM_DAILY_RATE,
  KINGDOM_IDLE_DAYS,
  KINGDOM_JOBS,
  KINGDOM_SCALE,
  KINGDOM_SUBJECTS,
  type KingdomJob,
} from "./config.ts";
import { bankDepositStatement, logEventStatement } from "./db.ts";
import { seededRng, weightedPick } from "./events.ts";
import { geBalance } from "./ge.ts";
import { gpShort, itemKeyOf, itemValue } from "./loot.ts";
import { addDays, daysBetween } from "./schedule.ts";
import { buttonRow, type Button, type Env, type Player } from "./types.ts";

/**
 * Managing Miscellania, at a tenth of its size. Ten subjects are split across
 * the jobs; each day the coffer pays out 10% of what it holds (up to the
 * cap), approval falls 2.5%, and the subjects bring in their share of the
 * wiki's daily maxima, scaled by approval and by how much they were paid.
 * A check-in is the good works that keep approval up.
 *
 * Nothing here runs on the cron: the days since the kingdom was last looked
 * at are worked through when it is next looked at, so the answer is the same
 * whenever that happens.
 */

export interface Kingdom {
  player_id: string;
  coffer: number;
  approval: number;
  workers: Partial<Record<KingdomJob, number>>;
  /** Per job, full-pay full-approval days of ten subjects' work. */
  pending: Partial<Record<KingdomJob, number>>;
  last_day: string;
  visited_day: string;
  collected_day: string | null;
}

interface KingdomRow extends Omit<Kingdom, "workers" | "pending"> {
  workers: string;
  pending: string;
}

const DEFAULT_WORKERS: Partial<Record<KingdomJob, number>> = { herbs: KINGDOM_SUBJECTS };

function parse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** What the coffer pays out today. */
export function dailyWage(coffer: number): number {
  return Math.min(Math.floor(coffer * KINGDOM_DAILY_RATE), KINGDOM_DAILY_CAP);
}

/**
 * Works through the days up to `today` — pure. A kingdom nobody has visited
 * for thirty days stops, as in the game; the days after that are skipped.
 */
export function advanceKingdom(kingdom: Kingdom, today: string): Kingdom {
  const next: Kingdom = { ...kingdom, workers: { ...kingdom.workers }, pending: { ...kingdom.pending } };
  const days = daysBetween(kingdom.last_day, today);
  const stopAt = addDays(kingdom.visited_day, KINGDOM_IDLE_DAYS);
  for (let i = 1; i <= days; i++) {
    if (addDays(kingdom.last_day, i) > stopAt) break;
    next.approval = Math.max(KINGDOM_APPROVAL_FLOOR, next.approval - KINGDOM_APPROVAL_DECAY);
    const wage = dailyWage(next.coffer);
    next.coffer -= wage;
    for (const job of KINGDOM_JOBS) {
      const subjects = next.workers[job.key] ?? 0;
      if (subjects <= 0 || wage <= 0) continue;
      next.pending[job.key] =
        (next.pending[job.key] ?? 0) + (subjects / KINGDOM_SUBJECTS) * (next.approval / 100) * (wage / KINGDOM_DAILY_CAP);
    }
  }
  if (days > 0) next.last_day = today;
  return next;
}

/** What is waiting, as item stacks. Herbs are dealt out by their weights from a seed. */
export function pendingStacks(kingdom: Kingdom, seed: string): { item: string; qty: number }[] {
  const stacks: { item: string; qty: number }[] = [];
  for (const job of KINGDOM_JOBS) {
    const worked = kingdom.pending[job.key] ?? 0;
    if (worked <= 0) continue;
    if (job.yields.some((y) => y.weight)) {
      // One pool shared between the items: 61 herbs a day, of whichever kinds come up.
      const total = Math.floor((worked * job.yields[0].max) / KINGDOM_SCALE);
      const rng = seededRng(`${seed}:${job.key}`);
      const counts = new Map<string, number>();
      const table = job.yields.map((y) => ({ ...y, weight: y.weight ?? 1 }));
      for (let i = 0; i < total; i++) {
        const pick = weightedPick(rng, table).item;
        counts.set(pick, (counts.get(pick) ?? 0) + 1);
      }
      for (const [item, qty] of counts) stacks.push({ item, qty });
    } else {
      for (const y of job.yields) {
        const qty = Math.floor((worked * y.max) / KINGDOM_SCALE);
        if (qty > 0) stacks.push({ item: y.item, qty });
      }
    }
  }
  return stacks;
}

function worth(stacks: { item: string; qty: number }[]): number {
  return stacks.reduce((sum, stack) => sum + stack.qty * itemValue(itemKeyOf(stack.item)), 0);
}

async function save(env: Env, kingdom: Kingdom): Promise<void> {
  await env.DB.prepare(
    "UPDATE kingdoms SET coffer = ?, approval = ?, workers = ?, pending = ?, last_day = ?, visited_day = ?, collected_day = ? WHERE player_id = ?"
  )
    .bind(
      kingdom.coffer,
      kingdom.approval,
      JSON.stringify(kingdom.workers),
      JSON.stringify(kingdom.pending),
      kingdom.last_day,
      kingdom.visited_day,
      kingdom.collected_day,
      kingdom.player_id
    )
    .run();
}

/** The player's kingdom, worked through to today. Created on first sight, with all ten subjects on herbs. */
export async function loadKingdom(env: Env, playerId: string, day: string): Promise<Kingdom> {
  await env.DB.prepare(
    "INSERT INTO kingdoms (player_id, workers, last_day, visited_day) VALUES (?, ?, ?, ?) ON CONFLICT (player_id) DO NOTHING"
  )
    .bind(playerId, JSON.stringify(DEFAULT_WORKERS), day, day)
    .run();
  const row = (await env.DB.prepare("SELECT * FROM kingdoms WHERE player_id = ?").bind(playerId).first<KingdomRow>())!;
  const kingdom: Kingdom = { ...row, workers: parse(row.workers, DEFAULT_WORKERS), pending: parse(row.pending, {}) };
  return advanceKingdom(kingdom, day);
}

/** A check-in is a day's good works: approval rises, and it counts as a visit. */
export async function kingdomCheckin(env: Env, playerId: string, day: string, weight: number): Promise<Kingdom> {
  const kingdom = await loadKingdom(env, playerId, day);
  kingdom.approval = Math.min(100, kingdom.approval + KINGDOM_CHECKIN_APPROVAL * weight);
  kingdom.visited_day = day;
  await save(env, kingdom);
  return kingdom;
}

export interface Line {
  content: string;
  components?: unknown[];
}

function workersLine(kingdom: Kingdom): string {
  const parts = KINGDOM_JOBS.filter((job) => (kingdom.workers[job.key] ?? 0) > 0).map((job) => `${job.name} ${kingdom.workers[job.key]}`);
  const idle = KINGDOM_SUBJECTS - KINGDOM_JOBS.reduce((sum, job) => sum + (kingdom.workers[job.key] ?? 0), 0);
  if (idle > 0) parts.push(`idle ${idle}`);
  return parts.join(" · ");
}

export async function kingdomView(env: Env, player: Player, day: string, lead?: string): Promise<Line> {
  const kingdom = await loadKingdom(env, player.discord_id, day);
  kingdom.visited_day = day;
  await save(env, kingdom);
  const stacks = pendingStacks(kingdom, `${player.discord_id}:${kingdom.collected_day ?? "first"}`);
  const since = kingdom.collected_day ? daysBetween(kingdom.collected_day, day) : null;
  const balance = await geBalance(env, player);
  const lines = [
    ...(lead ? [lead] : []),
    `👑 **${player.username}'s Miscellania** — approval ${Math.round(kingdom.approval)}% · coffer ${gpShort(kingdom.coffer)} (pays ${gpShort(dailyWage(kingdom.coffer))} a day, up to ${gpShort(KINGDOM_DAILY_CAP)})`,
    `Subjects: ${workersLine(kingdom)}`,
    stacks.length > 0
      ? `Waiting${since !== null ? ` since ${since === 0 ? "today" : `${since} day${since === 1 ? "" : "s"} ago`}` : ""}: ` +
        `${stacks.sort((a, b) => b.qty - a.qty).slice(0, 8).map((s) => `${s.qty.toLocaleString("en-US")}× ${s.item}`).join(", ")} — about ${gpShort(worth(stacks))}.`
      : kingdom.coffer > 0
        ? "Nothing gathered yet. The subjects are paid and bring their haul in at each day's rollover."
        : "The coffer is empty, so nobody is working. Fund it from your bank.",
    `Approval falls ${KINGDOM_APPROVAL_DECAY}% a day and rises ${KINGDOM_CHECKIN_APPROVAL}% with a check-in; the haul scales with it. You have ${gpShort(balance)} to spend. \`/kingdom assign\` splits the ten subjects.`,
  ];
  const fund = (gp: number): Button => ({
    label: `Fund ${gpShort(gp)}`,
    custom_id: `kd:dep:${gp}`,
    style: 1,
    disabled: balance < gp || kingdom.coffer + gp > KINGDOM_COFFER_MAX,
  });
  return {
    content: lines.join("\n"),
    components: [
      buttonRow([
        { label: "Collect", custom_id: "kd:collect", style: 3, emoji: "📦", disabled: stacks.length === 0 },
        fund(10_000),
        fund(50_000),
      ]),
      buttonRow(KINGDOM_JOBS.map((job) => ({ label: `All on ${job.name.toLowerCase()}`, custom_id: `kd:job:${job.key}`, style: 2 }))),
    ],
  };
}

/** Banks everything the subjects have gathered. */
export async function kingdomCollect(env: Env, player: Player, day: string, now: number): Promise<Line> {
  const kingdom = await loadKingdom(env, player.discord_id, day);
  const stacks = pendingStacks(kingdom, `${player.discord_id}:${kingdom.collected_day ?? "first"}`);
  if (stacks.length === 0) return kingdomView(env, player, day, "Nothing to collect yet.");
  // What was collected leaves the pending pile; the fractions of an item stay.
  for (const job of KINGDOM_JOBS) {
    const worked = kingdom.pending[job.key] ?? 0;
    const unit = KINGDOM_SCALE / job.yields[0].max;
    kingdom.pending[job.key] = worked - Math.floor(worked / unit) * unit;
  }
  kingdom.collected_day = day;
  kingdom.visited_day = day;
  const total = worth(stacks);
  await env.DB.batch([
    ...stacks.map((stack) => {
      const key = itemKeyOf(stack.item);
      return bankDepositStatement(env, player.discord_id, key, stack.qty, stack.qty * itemValue(key), day);
    }),
    logEventStatement(env, player.discord_id, day, null, "kingdom_collect", { stacks, total }, now),
  ]);
  await save(env, kingdom);
  return kingdomView(
    env,
    player,
    day,
    `📦 Collected ${stacks.map((s) => `${s.qty.toLocaleString("en-US")}× ${s.item}`).join(", ")} — ${gpShort(total)}, banked.`
  );
}

/** Moves coins between the bank's balance and the coffer; a negative amount withdraws. */
export async function kingdomFund(env: Env, player: Player, amount: number, day: string, now: number): Promise<Line> {
  if (!Number.isInteger(amount) || amount === 0) return kingdomView(env, player, day, "Give a whole number of coins.");
  const kingdom = await loadKingdom(env, player.discord_id, day);
  if (amount > 0) {
    const balance = await geBalance(env, player);
    if (amount > balance) return kingdomView(env, player, day, `You have ${gpShort(balance)} to spend.`);
    if (kingdom.coffer + amount > KINGDOM_COFFER_MAX) return kingdomView(env, player, day, `The coffer holds ${gpShort(KINGDOM_COFFER_MAX)} at most.`);
  } else if (-amount > kingdom.coffer) {
    return kingdomView(env, player, day, `The coffer holds ${gpShort(kingdom.coffer)}.`);
  }
  kingdom.coffer += amount;
  kingdom.visited_day = day;
  await save(env, kingdom);
  await env.DB.batch([
    env.DB.prepare("UPDATE players SET gp_spent = gp_spent + ? WHERE discord_id = ?").bind(amount, player.discord_id),
    logEventStatement(env, player.discord_id, day, null, "kingdom_fund", { amount }, now),
  ]);
  return kingdomView(
    env,
    { ...player, gp_spent: (player.gp_spent ?? 0) + amount },
    day,
    amount > 0 ? `Put ${gpShort(amount)} in the coffer.` : `Took ${gpShort(-amount)} out of the coffer.`
  );
}

/** Splits the subjects. Anything not named is left idle. */
export async function kingdomAssign(
  env: Env,
  player: Player,
  workers: Partial<Record<KingdomJob, number>>,
  day: string
): Promise<Line> {
  const clean: Partial<Record<KingdomJob, number>> = {};
  let total = 0;
  for (const job of KINGDOM_JOBS) {
    const n = Math.floor(workers[job.key] ?? 0);
    if (n < 0) return kingdomView(env, player, day, "Subjects cannot be negative.");
    if (n > 0) clean[job.key] = n;
    total += n;
  }
  if (total > KINGDOM_SUBJECTS) return kingdomView(env, player, day, `You have ${KINGDOM_SUBJECTS} subjects; that is ${total}.`);
  const kingdom = await loadKingdom(env, player.discord_id, day);
  kingdom.workers = clean;
  kingdom.visited_day = day;
  await save(env, kingdom);
  return kingdomView(env, player, day, `Subjects reassigned: ${workersLine(kingdom)}.`);
}

/** Kingdoms with at least a week's haul waiting, or a dry coffer, for the evening reminders. */
export async function kingdomNudges(env: Env, today: string): Promise<Map<string, string>> {
  const { results } = await env.DB.prepare("SELECT * FROM kingdoms").all<KingdomRow>();
  const nudges = new Map<string, string>();
  for (const row of results) {
    const kingdom = advanceKingdom({ ...row, workers: parse(row.workers, DEFAULT_WORKERS), pending: parse(row.pending, {}) }, today);
    const waiting = pendingStacks(kingdom, "nudge").length > 0;
    // A week since the last collection (or since the kingdom was founded, if it never has been).
    const since = daysBetween(kingdom.collected_day ?? row.visited_day, today);
    if (waiting && since >= 7) nudges.set(row.player_id, "a week's haul to collect in Miscellania (`/kingdom`)");
    else if (waiting && dailyWage(kingdom.coffer) === 0) nudges.set(row.player_id, "Miscellania's coffer is empty (`/kingdom`)");
  }
  return nudges;
}
