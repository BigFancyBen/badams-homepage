import {
  RIVALRY_MIN_ROSTER,
  RIVALRY_RECENCY_WEEKS,
  RIVALRY_TIE_FLOOR,
} from "./config.ts";
import type { Rivalry } from "./types.ts";

/**
 * The weekly head-to-head. Drawn at the Monday resolution from the active
 * roster, avoiding any pair from the last three weeks; the odd player out
 * plays the town. Most weighted units that week wins a lamp. The loser gets
 * nothing and is not named.
 */

/** Pairs the roster. Returns [a, b] pairs and the bye, if any. */
export function drawPairs(
  rng: () => number,
  roster: string[],
  recent: Rivalry[],
  byeCounts: Map<string, number>
): { pairs: [string, string][]; bye: string | null } {
  if (roster.length < RIVALRY_MIN_ROSTER) {
    return { pairs: [], bye: null };
  }

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const recentKeys = new Set(
    recent.filter((r) => r.player_b).map((r) => pairKey(r.player_a, r.player_b!))
  );

  // The bye goes to whoever has had the fewest, random among ties.
  let pool = [...roster];
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    const fewest = Math.min(...pool.map((id) => byeCounts.get(id) ?? 0));
    const candidates = pool.filter((id) => (byeCounts.get(id) ?? 0) === fewest);
    bye = candidates[Math.floor(rng() * candidates.length)];
    pool = pool.filter((id) => id !== bye);
  }

  // Try random matchings that avoid the recency window; if none works after
  // a few goes, the window shrinks (scrandle's spill rule) by dropping the
  // oldest week's pairs from the set until a legal draw exists.
  const attempt = (blocked: Set<string>): [string, string][] | null => {
    for (let tries = 0; tries < 40; tries++) {
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const pairs: [string, string][] = [];
      let legal = true;
      for (let i = 0; i < shuffled.length; i += 2) {
        const pair: [string, string] = [shuffled[i], shuffled[i + 1]];
        if (blocked.has(pairKey(pair[0], pair[1]))) {
          legal = false;
          break;
        }
        pairs.push(pair);
      }
      if (legal) return pairs;
    }
    return null;
  };

  const weeks = [...new Set(recent.map((r) => r.week))].sort();
  let blocked = recentKeys;
  let pairs = attempt(blocked);
  for (let drop = 0; pairs === null && drop < weeks.length; drop++) {
    const kept = weeks.slice(drop + 1);
    blocked = new Set(
      recent
        .filter((r) => r.player_b && kept.includes(r.week))
        .map((r) => pairKey(r.player_a, r.player_b!))
    );
    pairs = attempt(blocked);
  }
  return { pairs: pairs ?? attempt(new Set()) ?? [], bye };
}

/** The Monday of the week `weeks` weeks before `week`. */
export function weeksBefore(week: string, weeks: number = RIVALRY_RECENCY_WEEKS): string {
  const date = new Date(`${week}T00:00:00Z`);
  return new Date(date.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export type RivalryVerdict =
  | { winner: string }
  | { winner: "both" }
  | { winner: null };

/**
 * Who won. Units are the week's weighted check-in units. A tie at or above
 * the floor is a shared win; below it, nobody.
 */
export function judge(a: string, unitsA: number, b: string | null, unitsB: number): RivalryVerdict {
  if (unitsA > unitsB) return { winner: a };
  if (b && unitsB > unitsA) return { winner: b };
  if (!b && unitsB > unitsA) return { winner: null };
  if (unitsA === unitsB && unitsA >= RIVALRY_TIE_FLOOR) return { winner: b ? "both" : a };
  return { winner: null };
}
