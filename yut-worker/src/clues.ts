import {
  CLUE_CHANCE,
  CLUE_STEPS,
  CLUE_TIERS,
  type ClueStepKey,
  type ClueTier,
} from "./config.ts";
import { weightedPick } from "./events.ts";
import { weekdayOf } from "./schedule.ts";
import type { Checkin, Clue } from "./types.ts";

/**
 * Clue scrolls: treasure trails where the steps are workouts. One held at a
 * time; each later check-in can complete the next step; the casket at the end
 * holds a lamp, coins for the town, and a chance at a unique.
 */

export function clueTier(key: string): ClueTier {
  return CLUE_TIERS.find((tier) => tier.key === key) ?? CLUE_TIERS[0];
}

/** Whether this check-in drops a clue. Skipped while holding one. */
export function rollClue(rng: () => number, holding: boolean): boolean {
  if (holding) return false;
  return rng() < 1 / CLUE_CHANCE;
}

/**
 * Draws a trail: `steps` distinct steps from the pool, with at least the
 * tier's number of verified ones, none from an act that has not arrived.
 */
export function drawSteps(
  rng: () => number,
  tier: ClueTier,
  act: number
): ClueStepKey[] {
  const pool = CLUE_STEPS.filter((step) => (step.from ?? 1) <= act);
  const verified = pool.filter((step) => step.verified);
  const plain = pool.filter((step) => !step.verified);

  const picked: ClueStepKey[] = [];
  const take = (from: { key: ClueStepKey }[]) => {
    const remaining = from.filter((step) => !picked.includes(step.key));
    if (remaining.length === 0) return;
    picked.push(remaining[Math.floor(rng() * remaining.length)].key);
  };

  for (let i = 0; i < tier.verifiedSteps; i++) take(verified);
  while (picked.length < tier.steps) {
    // Every third step leans verified; when a pool runs dry, take from the
    // other, and stop if both have.
    const preferVerified = picked.length % 3 === 2;
    const before = picked.length;
    take(preferVerified ? verified : plain);
    if (picked.length === before) take(preferVerified ? plain : verified);
    if (picked.length === before) break;
  }

  // Shuffle so the verified steps are not always first.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

export function stepLabel(key: string): string {
  return CLUE_STEPS.find((step) => step.key === key)?.label ?? key;
}

export function clueSteps(clue: Clue): ClueStepKey[] {
  try {
    return JSON.parse(clue.steps) as ClueStepKey[];
  } catch {
    return [];
  }
}

export function doneIndices(clue: Clue): number[] {
  try {
    return JSON.parse(clue.done) as number[];
  } catch {
    return [];
  }
}

/**
 * The steps still to do. Any order: a trail whose one impossible step sat at
 * the front would never move, so a check-in completes whichever remaining
 * step it satisfies — one per check-in, like the original.
 */
export function remainingSteps(clue: Clue): { index: number; key: ClueStepKey }[] {
  const done = new Set(doneIndices(clue));
  return clueSteps(clue)
    .map((key, index) => ({ index, key }))
    .filter((step) => !done.has(step.index));
}

export function nextStep(clue: Clue): ClueStepKey | null {
  return remainingSteps(clue)[0]?.key ?? null;
}

/** What the check-in path knows about the day, for the day-shaped steps. */
export interface StepContext {
  checkin: Checkin;
  othersToday: number;
  checkedInYesterday: boolean;
  delivered: number;
  lostRivalryYesterday: boolean;
  sackWasFull: boolean;
  raidWeek: boolean;
}

/** Steps a plain check-in can satisfy. The verified ones are checked elsewhere. */
export function checkinSatisfies(step: ClueStepKey, ctx: StepContext): boolean {
  const { checkin } = ctx;
  const weekday = weekdayOf(checkin.day);
  switch (step) {
    case "weekend":
      return weekday === 0 || weekday === 6;
    case "monday":
      return weekday === 1;
    case "early":
      return ctx.checkin.hour_utc >= 9 && ctx.checkin.hour_utc < 14; // 3am-8am MDT
    case "late":
      return ctx.checkin.hour_utc >= 2 && ctx.checkin.hour_utc < 9; // 8pm-3am MDT
    case "two_in_a_row":
      return ctx.checkedInYesterday;
    case "with_two_others":
      return ctx.othersToday >= 2;
    case "deliver_200":
      return ctx.delivered >= 200;
    case "long_note":
      return (checkin.note ?? "").trim().split(/\s+/).filter(Boolean).length >= 20;
    case "raid_checkin":
      return ctx.raidWeek;
    case "after_rivalry_loss":
      return ctx.lostRivalryYesterday;
    case "full_sack":
      return ctx.sackWasFull;
    default:
      return false;
  }
}

/** Steps satisfied by a verification landing on the author's check-in. */
export function verificationSatisfies(
  step: ClueStepKey,
  kind: "image" | "video" | null
): boolean {
  if (step === "verified_photo") return kind === "image";
  if (step === "verified_video") return kind === "video";
  return false;
}

export interface CasketLoot {
  xp: number;
  coins: number;
  unique: string | null;
  duplicate: boolean;
}

/** Opens the casket. `owned` is what is already in the collection log. */
export function openCasket(
  rng: () => number,
  tier: ClueTier,
  owned: Set<string>
): CasketLoot {
  let unique: string | null = null;
  let duplicate = false;
  if (rng() < 1 / tier.uniqueChance) {
    const table = tier.uniques.map((name) => ({ name, weight: 1 }));
    let pick = weightedPick(rng, table).name;
    if (owned.has(pick)) {
      // One re-roll, then fall back to extra XP.
      pick = weightedPick(rng, table).name;
      if (owned.has(pick)) duplicate = true;
    }
    if (!duplicate) unique = pick;
  }
  return {
    xp: duplicate ? Math.floor(tier.xp * 1.5) : tier.xp,
    coins: tier.coins,
    unique,
    duplicate,
  };
}

export function clueLine(clue: Clue): string {
  const tier = clueTier(clue.tier);
  const steps = clueSteps(clue);
  const left = remainingSteps(clue);
  return left.length > 0
    ? `Clue (${tier.name.toLowerCase()}) ${steps.length - left.length}/${steps.length} — left: ${left.map((s) => stepLabel(s.key)).join("; ")}.`
    : `Clue (${tier.name.toLowerCase()}) complete.`;
}
