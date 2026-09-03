const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Parsed, deduplicated, sorted. Empty means "no fixed schedule". */
export function parsePostHours(raw: string | undefined): number[] {
  const hours = (raw || "")
    .split(",")
    // Drop blanks before Number(), or an empty setting parses as [0] — an
    // empty string coerces to 0, which is a perfectly valid hour. "No
    // schedule" would quietly become "post at midnight".
    .map((h) => h.trim())
    .filter((h) => h.length > 0)
    .map(Number)
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  return [...new Set(hours)].sort((a, b) => a - b);
}

/** Weekdays a weekly post runs on: comma-separated, 0 = Sunday. Junk is dropped. */
export function parseWeekdays(raw: string | undefined): number[] {
  const days = (raw || "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(days)];
}

/**
 * How many everyday matchups one posting slot puts up.
 *
 * The slot used to mean one matchup by definition, and the cadence was changed
 * by adding hours to POST_HOURS_UTC. That stops working once you want more
 * cooking on the board than there are sensible hours to put it at: the pool is
 * hundreds deep and only refills at about one photograph a day, so the useful
 * range is three or four a day, and spreading those across the evening buys
 * nothing but shorter vote windows. Posting them together at one hour keeps the
 * window a full day and gives people one thing to sit down to.
 *
 * Clamped to at least one, and to at most ten — a guard against a typo rather
 * than a policy. Ten a day would sweep the entire food catalog inside a month.
 */
export function parsePerSlot(raw: string | undefined): number {
  const perSlot = Number((raw || "").trim());
  if (!Number.isInteger(perSlot) || perSlot < 1) return 1;
  return Math.min(perSlot, 10);
}

/**
 * The next scheduled posting time strictly after `now`.
 *
 * This is what a matchup closes on, rather than `now + VOTE_WINDOW_HOURS`.
 * The two are the same for a matchup posted by the cron on a named hour, but
 * they diverge the moment one is posted off-schedule — a forced admin post, or
 * a cron tick that failed and left the slot empty. A stopwatch window from an
 * off-hour post stays open across the next named hour and silently eats that
 * cycle, because a matchup already being open blocks posting. Closing on the
 * schedule instead means whenever a matchup went up, it hands the slot back at
 * the right time and the cadence repairs itself on the next tick.
 *
 * Falls back to a fixed window when no hours are configured.
 */
export function nextPostTime(
  hours: number[],
  now: number,
  fallbackMs: number
): number {
  if (hours.length === 0) return now + fallbackMs;

  const date = new Date(now);
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );

  // Today's remaining hours, then tomorrow's. Two days is always enough: the
  // list is non-empty, so tomorrow's first hour is a guaranteed answer.
  for (let day = 0; day <= 1; day++) {
    for (const hour of hours) {
      const at = midnight + day * DAY + hour * HOUR;
      if (at > now) return at;
    }
  }

  return now + fallbackMs;
}

/**
 * Whether a weekly slot's day, hour and minute all land on this tick.
 *
 * Every slot that is not the everyday matchup asks the same three questions in
 * the same order, and there are five of them now — the place round, the
 * placement round, the person bonus, the drink slot and the caption contest.
 * The once-per-slot guard stays at the call site because it is a database read
 * and this file is arithmetic, but the calendar part belongs in one place.
 *
 * An empty weekday list means the slot is off, which is how -1 and a blank
 * setting both arrive here after parseWeekdays has dropped them.
 */
export function weeklySlotDue(
  now: number,
  { weekdays, hourUtc, minute = 0 }: {
    weekdays: number[];
    hourUtc: number;
    minute?: number;
  }
): boolean {
  if (weekdays.length === 0) return false;

  const date = new Date(now);
  return (
    weekdays.includes(date.getUTCDay()) &&
    date.getUTCHours() === hourUtc &&
    date.getUTCMinutes() === minute
  );
}

/**
 * Identifies the posting slot a moment falls in, as `2026-08-21T15`.
 *
 * Replaces the old "N hours since the last post" floor, whose only real job
 * was stopping a retry inside the same hour from double-posting. Elapsed time
 * did that badly: an 11-hour floor also blocks a legitimate scheduled post
 * whenever the previous one went up off-schedule, which is the same cycle-
 * skipping bug from the other direction. Comparing slots says exactly what is
 * meant — one post per named hour — and cannot interact with the schedule.
 */
export function postSlotKey(now: number): string {
  return new Date(now).toISOString().slice(0, 13);
}

/**
 * The day a moment falls on, as people in the channel would name it —
 * "Thu 3 Sep". The threads the 9am batch and its results go into are named
 * with this, so the sidebar reads as a calendar and the two halves of a day
 * pair up by eye.
 *
 * In the configured zone rather than UTC: the 9am slot is 15:00 UTC and the
 * dates agree, but a forced post at 10pm Mountain is already tomorrow in UTC,
 * and a thread named for the wrong day would be the first thing anyone saw.
 * Assembled from parts rather than taken as a formatted string, because the
 * order and punctuation of a locale's short date are not the same everywhere
 * the code might run.
 */
export function dayLabel(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timeZone || "UTC",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/**
 * How many drink matchups a week a catalog of `count` drinks deserves, as the
 * weekdays to post them on.
 *
 * Drinks used to share the everyday slots with food, which meant the 9am and
 * 9pm posts were food *usually* — whenever the draw happened to land on a
 * cocktail, the day's cooking matchup was not a cooking matchup. Giving drinks
 * a slot of their own fixes that, and raises the question this answers: how
 * often should that slot fire? A fixed weekly day is wrong in both directions.
 * Six drinks in the catalog and a weekly post shows the same two every month;
 * eighty drinks and a weekly post never gets through them.
 *
 * So the cadence follows the catalog, aiming at a constant *sweep* — the time
 * it takes for every drink to have been on the board once. A matchup uses two,
 * so a sweep is `ceil(count / 2)` posts, and a four-week sweep wants a quarter
 * of that a week. Four weeks because it is long enough that a drink does not
 * come round often enough to be boring, and short enough that somebody's
 * negroni from last month is still a live argument.
 *
 * Clamped to at most daily, which is where the ladder tops out however deep
 * the catalog gets, and to at least weekly, so a small pool still runs.
 *
 * `posters` is the number of distinct people with a drink in the catalog. Below
 * two there is no schedule at all: a matchup never pits someone against
 * himself, so the draw could not produce a pair however often it was asked.
 */
export function drinkCadence(count: number, posters: number): number[] {
  if (count < 2 || posters < 2) return [];

  // Posts, not drinks. Dividing the count straight through is off by the
  // rounding at small sizes — eleven drinks is six matchups, and eleven halved
  // and rounded says one a week, which sweeps in six weeks rather than four.
  const sweep = Math.ceil(count / DRINKS_PER_MATCHUP);
  const perWeek = Math.min(7, Math.max(1, Math.round(sweep / SWEEP_WEEKS)));
  return DRINK_DAYS[perWeek];
}

const DRINKS_PER_MATCHUP = 2;
/** The sweep the cadence aims at: every drink on the board once a month. */
const SWEEP_WEEKS = 4;

/**
 * Which days each cadence uses, spread as evenly as seven allows. The single
 * day is Thursday: late enough in the week to be its own thing, and clear of
 * the Monday place round and the Tuesday person bonus.
 */
const DRINK_DAYS: Record<number, number[]> = {
  1: [4],
  2: [1, 4],
  3: [1, 3, 5],
  4: [0, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};
