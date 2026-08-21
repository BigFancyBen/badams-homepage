#!/usr/bin/env node
/**
 * Schedule arithmetic, checked against the bug that motivated it.
 *
 * On 2026-08-21 a matchup forced up at 06:32 UTC was given a 12-hour stopwatch
 * window closing at 18:32, so it was still open at 15:00 when the cron went to
 * post — and an open matchup blocks posting. The 9am slot was silently
 * skipped. Deriving closes_at from the schedule fixes it; the last block here
 * runs 30 days of ticks from that exact state to prove the cadence recovers.
 *
 * Node >= 22 strips the types from the imported .ts on the fly, so this needs
 * no build step and no test dependency.
 */
import assert from "node:assert/strict";
import { nextPostTime, parsePostHours, postSlotKey } from "../src/schedule.ts";

const HOUR = 3600e3;
const FALLBACK = 12 * HOUR;
const HOURS = parsePostHours("15,3");

let failures = 0;
function check(name, actual, expected) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  pass  ${name}`);
  } catch {
    failures++;
    console.log(`  FAIL  ${name}`);
    console.log(`        actual   ${JSON.stringify(actual)}`);
    console.log(`        expected ${JSON.stringify(expected)}`);
  }
}

const iso = (ms) => new Date(ms).toISOString().replace(".000Z", "Z");
const closesFor = (at) => iso(nextPostTime(HOURS, Date.parse(at), FALLBACK));

console.log("parsePostHours");
check("sorts and dedupes", HOURS, [3, 15]);
check("drops junk and out-of-range", parsePostHours("15, x, 99, -1, 3, 3"), [3, 15]);
check("empty string", parsePostHours(""), []);
check("undefined", parsePostHours(undefined), []);

console.log("\nnextPostTime");
check(
  "regression: off-hour post closes at the next slot, not 12h later",
  closesFor("2026-08-21T06:32:53Z"),
  "2026-08-21T15:00:00Z"
);
check(
  "scheduled 15:00 post gets the full 12 hours",
  closesFor("2026-08-21T15:00:00.123Z"),
  "2026-08-22T03:00:00Z"
);
check(
  "scheduled 03:00 post gets the full 12 hours",
  closesFor("2026-08-21T03:00:00.123Z"),
  "2026-08-21T15:00:00Z"
);
check("a second before a slot", closesFor("2026-08-21T14:59:59Z"), "2026-08-21T15:00:00Z");
check("evening wraps to tomorrow", closesFor("2026-08-21T23:30:00Z"), "2026-08-22T03:00:00Z");
check("midnight", closesFor("2026-08-21T00:00:00Z"), "2026-08-21T03:00:00Z");
check("crosses month end", closesFor("2026-08-31T16:00:00Z"), "2026-09-01T03:00:00Z");
check("crosses year end", closesFor("2026-12-31T16:00:00Z"), "2027-01-01T03:00:00Z");
check(
  "a single daily hour is 24 hours apart",
  iso(nextPostTime([15], Date.parse("2026-08-21T15:00:00.5Z"), FALLBACK)),
  "2026-08-22T15:00:00Z"
);
check(
  "no configured hours falls back to the fixed window",
  iso(nextPostTime([], Date.parse("2026-08-21T06:32:00Z"), FALLBACK)),
  "2026-08-21T18:32:00Z"
);

console.log("\npostSlotKey");
check("shape", postSlotKey(Date.parse("2026-08-21T15:04:59Z")), "2026-08-21T15");
check(
  "a retry later in the same hour is the same slot",
  postSlotKey(Date.parse("2026-08-21T15:00:00Z")) ===
    postSlotKey(Date.parse("2026-08-21T15:59:59Z")),
  true
);
check(
  "the next hour is a new slot",
  postSlotKey(Date.parse("2026-08-21T15:59:59Z")) ===
    postSlotKey(Date.parse("2026-08-21T16:00:00Z")),
  false
);
check(
  "the same hour tomorrow is a new slot",
  postSlotKey(Date.parse("2026-08-21T15:00:00Z")) ===
    postSlotKey(Date.parse("2026-08-22T15:00:00Z")),
  false
);

// Replay the real cron loop — close, then post, once an hour — starting from
// the exact state that skipped a cycle.
console.log("\n30 days of hourly ticks from the state that broke");
const TICKS = 30 * 24;
const START = Date.parse("2026-08-21T07:00:00Z");

const posts = [];
const slots = new Set();
let closesAt = nextPostTime(HOURS, Date.parse("2026-08-21T06:32:53Z"), FALLBACK);
let open = true;
let namedHoursInWindow = 0;

for (let tick = 0; tick < TICKS; tick++) {
  const now = START + tick * HOUR;
  if (HOURS.includes(new Date(now).getUTCHours())) namedHoursInWindow++;

  if (open && closesAt <= now) open = false;

  if (!open && HOURS.includes(new Date(now).getUTCHours())) {
    const slot = postSlotKey(now);
    if (!slots.has(slot)) {
      slots.add(slot);
      posts.push(now);
      closesAt = nextPostTime(HOURS, now, FALLBACK);
      open = true;
    }
  }
}

const postedHours = [...new Set(posts.map((p) => new Date(p).getUTCHours()))].sort(
  (a, b) => a - b
);
const gaps = [...new Set(posts.slice(1).map((p, i) => (p - posts[i]) / HOUR))];

check("the skipped 15:00 slot is recovered immediately", iso(posts[0]), "2026-08-21T15:00:00Z");
check("every post lands on a named hour", postedHours, [3, 15]);
check("every gap is exactly 12 hours", gaps, [12]);
// The real assertion: a post for every named hour in the window, no more and
// no fewer. Hard-coding a count just moves the arithmetic into the test.
check("exactly one post per named hour, none skipped", posts.length, namedHoursInWindow);

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
