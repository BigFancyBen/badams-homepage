import {
  EARLY_RING_WEEK_FROM,
  EARLY_RING_WEEK_TO,
  FORM_CHECKINS,
  PRAYER_FORM_WEEK,
  PRAYER_THREE_PLUS_BONUS,
  RING_CAP,
  RING_CAP_GRADUATED,
  RING_EVERY_EARLY,
  RING_EVERY_LATE,
  RING_LATE_FROM_WEEK,
} from "./config.ts";

/**
 * The week boundary, as arithmetic. Given what a player did this week and
 * where they stood, says where they stand now. Pure, so the simulation and
 * the Monday tick agree by construction.
 */

export type WeekOutcome = "form" | "held" | "broke" | "paused" | "idle";

export interface WeekInput {
  checkins: number;
  formWeeks: number;
  rings: number;
  ringProgress: number;
  /** Which week of the player's own campaign this was, 1-based. */
  playerWeek: number;
  graduated: boolean;
  paused: boolean;
  /** Last Recall relic: a ring every Form week. */
  ringEveryWeek: boolean;
  chapelBonus: number;
  /** Extra ring capacity (Last Recall). */
  ringCapBonus?: number;
}

export interface WeekResult {
  outcome: WeekOutcome;
  formWeeks: number;
  rings: number;
  ringProgress: number;
  ringEarned: boolean;
  ringSpent: boolean;
  prayerXp: number;
}

export function resolveWeek(input: WeekInput): WeekResult {
  const cap = (input.graduated ? RING_CAP_GRADUATED : RING_CAP) + (input.ringCapBonus ?? 0);

  if (input.paused) {
    return {
      outcome: "paused",
      formWeeks: input.formWeeks,
      rings: input.rings,
      ringProgress: input.ringProgress,
      ringEarned: false,
      ringSpent: false,
      prayerXp: 0,
    };
  }

  // A Form week: two or more. Prayer pays, the streak advances, and the ring
  // counter ticks.
  if (input.checkins >= FORM_CHECKINS) {
    const formWeeks = input.formWeeks + 1;
    let ringProgress = input.ringProgress + 1;
    let rings = input.rings;
    let ringEarned = false;

    const every = input.ringEveryWeek
      ? 1
      : input.playerWeek >= RING_LATE_FROM_WEEK
        ? RING_EVERY_LATE
        : RING_EVERY_EARLY;
    // Weeks 3-4 of a player's own campaign: the first ring comes at the first
    // Form week rather than the third. A safety net handed over early.
    const earlyHandover =
      input.rings === 0 &&
      input.playerWeek >= EARLY_RING_WEEK_FROM &&
      input.playerWeek <= EARLY_RING_WEEK_TO;

    if (ringProgress >= every || earlyHandover) {
      ringProgress = 0;
      if (rings < cap) {
        rings++;
        ringEarned = true;
      }
    }

    const prayerXp =
      PRAYER_FORM_WEEK +
      (input.checkins >= 3 ? PRAYER_THREE_PLUS_BONUS : 0) +
      input.chapelBonus;

    return { outcome: "form", formWeeks, rings, ringProgress, ringEarned, ringSpent: false, prayerXp };
  }

  // Exactly one: a Ring holds the week if there is one. The streak survives,
  // Prayer pays at the one-check-in rate, the ring counter does not move.
  if (input.checkins === 1 && input.rings > 0) {
    return {
      outcome: "held",
      formWeeks: input.formWeeks,
      rings: input.rings - 1,
      ringProgress: input.ringProgress,
      ringEarned: false,
      ringSpent: true,
      prayerXp: Math.floor(PRAYER_FORM_WEEK / 2),
    };
  }

  // Zero, or one with no ring: broken. A ring covers one miss, never two.
  // Nothing to break is "idle" — a player who was never in form is not
  // told they lost something.
  return {
    outcome: input.formWeeks > 0 ? "broke" : "idle",
    formWeeks: 0,
    rings: input.rings,
    ringProgress: 0,
    ringEarned: false,
    ringSpent: false,
    prayerXp: 0,
  };
}
