/**
 * How the weekly Scrandle draws its pairs. On its own, with no imports, so
 * scripts/test-weekly.mjs can run it a few thousand times without a database
 * — see weekly.ts for what the puzzle is and where it goes.
 */

/**
 * The smallest rating gap a pair may have, in rounded points. A pair has to
 * have an answer, and two plates a point apart are a coin toss the player gets
 * marked wrong on.
 */
const MIN_GAP = 15;

/** What the draw needs to know about a plate. */
export interface WeeklyCandidate {
  id: number;
  poster: string;
  rating: number;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draws the pairs. Pure, so scripts/test-weekly.mjs can run it a few thousand
 * times without a database.
 *
 * Three rules, all of them the board's own. No plate appears twice in one
 * puzzle. Two plates from the same person never meet — the same rule the
 * matchups keep, and for the same reason. And a pair must be at least MIN_GAP
 * apart, so there is an answer.
 *
 * `recent` is a preference rather than a rule: plates from the last few
 * puzzles go to the back of the queue instead of out of it, so a thin catalog
 * repeats itself rather than posting nothing.
 */
export function drawRounds<T extends WeeklyCandidate>(
  pool: T[],
  recent: Set<number>,
  count: number,
  random: () => number = Math.random
): [T, T][] {
  const shuffled = shuffle(pool, random);
  const queue = [
    ...shuffled.filter((plate) => !recent.has(plate.id)),
    ...shuffled.filter((plate) => recent.has(plate.id)),
  ];

  const used = new Set<number>();
  const rounds: [T, T][] = [];

  for (const first of queue) {
    if (rounds.length >= count) break;
    if (used.has(first.id)) continue;

    const second = queue.find(
      (plate) =>
        plate.id !== first.id &&
        !used.has(plate.id) &&
        plate.poster !== first.poster &&
        Math.abs(plate.rating - first.rating) >= MIN_GAP
    );
    if (!second) continue;

    used.add(first.id);
    used.add(second.id);
    // Sides by coin toss. The queue is already shuffled, but `first` is the
    // one drawn from the front of it, and the front is where the plates that
    // have not been in a puzzle lately are — which is a pattern, and people
    // find patterns.
    rounds.push(random() < 0.5 ? [first, second] : [second, first]);
  }

  return rounds;
}

/**
 * Whether a draw is due on this tick: one of the configured days, at or after
 * the hour, and not already drawn today.
 *
 * "Today" rather than a count of days since the last one. The gate used to be
 * six days, which was right for one puzzle a week and made a second weekday a
 * setting that did nothing. Comparing the day says what is meant — one draw
 * per scheduled day — for any list of days, and an hourly retry after a draw
 * still finds the day already spent.
 */
export function weeklyDue(
  now: number,
  { weekdays, hourUtc, lastAt }: {
    weekdays: number[];
    hourUtc: number;
    lastAt: number;
  }
): boolean {
  const date = new Date(now);
  if (!weekdays.includes(date.getUTCDay())) return false;
  if (date.getUTCHours() < hourUtc) return false;

  const day = (at: number) => new Date(at).toISOString().slice(0, 10);
  return day(lastAt) !== day(now);
}
