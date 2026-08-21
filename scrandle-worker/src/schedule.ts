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
