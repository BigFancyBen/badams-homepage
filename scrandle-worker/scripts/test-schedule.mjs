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
import { readFileSync } from "node:fs";
import {
  drinkCadence,
  nextPostTime,
  parsePerSlot,
  parsePostHours,
  parseWeekdays,
  postSlotKey,
} from "../src/schedule.ts";

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

console.log("\nparsePerSlot");
check("the configured batch", parsePerSlot("5"), 5);
check("one is one", parsePerSlot("1"), 1);
check("unset means the old behaviour", parsePerSlot(undefined), 1);
check("empty means the old behaviour", parsePerSlot(""), 1);
check("whitespace is trimmed", parsePerSlot(" 3 "), 3);
check("junk means the old behaviour", parsePerSlot("three"), 1);
check("zero would post nothing, so it does not", parsePerSlot("0"), 1);
check("negatives likewise", parsePerSlot("-2"), 1);
check("a fraction is not a count", parsePerSlot("2.5"), 1);
check("a typo cannot empty the catalog", parsePerSlot("300"), 10);

// The live schedule: one named hour, five matchups on it, each open until the
// same hour tomorrow. The point of moving the cadence off POST_HOURS_UTC is
// that adding matchups no longer shortens the window, so that is what to
// assert — under the old two-hour schedule these would have been 12 apart.
console.log("\nthe 9am batch");
const NINE_AM = parsePostHours("15");
check("one named hour a day", NINE_AM, [15]);
const posted = Date.parse("2026-09-02T15:00:00.4Z");
const batchCloses = nextPostTime(NINE_AM, posted, FALLBACK);
check("the batch closes on tomorrow's slot", iso(batchCloses), "2026-09-03T15:00:00Z");
check("which is a full day of voting", Math.round((batchCloses - posted) / HOUR), 24);
check(
  "five matchups posted together are one slot, not five",
  new Set([1, 2, 3, 4, 5].map((i) => postSlotKey(posted + i))).size,
  1
);

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

// ── the drink cadence ──────────────────────────────────────────────
// Drinks post on a slot of their own, as often as there is drink to post. The
// rule is a constant sweep — every drink on the board about once a month — so
// most of what follows is that sweep, computed back out of the answer.
console.log("\ndrinkCadence");

check("nothing to draw from", drinkCadence(0, 0), []);
check("one drink cannot make a pair", drinkCadence(1, 1), []);
// A matchup never pits someone against himself, so a one-person cellar holds
// no pair at all, however deep it goes.
check("forty drinks, all one person's", drinkCadence(40, 1), []);

check("the smallest real pool posts weekly", drinkCadence(2, 2), [4]);
check("eight drinks: one a week", drinkCadence(8, 3), [4]);
check("sixteen drinks: two a week", drinkCadence(16, 4), [1, 4]);
check("twenty-four drinks: three a week", drinkCadence(24, 5), [1, 3, 5]);
check("thirty-two drinks: four a week", drinkCadence(32, 5), [0, 2, 4, 6]);
check("fifty-two drinks: daily", drinkCadence(52, 6), [0, 1, 2, 3, 4, 5, 6]);
check("and it stops at daily", drinkCadence(400, 9), [0, 1, 2, 3, 4, 5, 6]);

// Monotonic: a bigger catalog never posts less often than a smaller one.
const cadences = [];
for (let count = 2; count <= 200; count++) cadences.push(drinkCadence(count, 4).length);
check(
  "the cadence never goes backwards as the catalog grows",
  cadences.every((n, i) => i === 0 || n >= cadences[i - 1]),
  true
);

// The property the ladder exists for: whatever size the catalog is, a sweep of
// it — every drink on the board once, two to a matchup — lands between three
// and five weeks. Only the ends fall outside, and both are the clamp doing its
// job rather than the arithmetic: under eight drinks there is nothing to sweep
// slowly enough, and past fifty-two the slot is already daily.
const sweeps = [];
for (let count = 8; count <= 52; count++) {
  sweeps.push(Math.ceil(count / 2) / drinkCadence(count, 4).length);
}
check(
  "a sweep of the catalog stays near four weeks at every size",
  sweeps.every((weeks) => weeks >= 3 && weeks <= 5),
  true
);

// Every day handed back has to be a real weekday and appear once. parseWeekdays
// drops anything else, so a bad list would not fail loudly — the slot would
// quietly run at a cadence nobody chose.
const drinkDays = [];
const duplicated = [];
for (let count = 2; count <= 200; count++) {
  const list = drinkCadence(count, 4);
  drinkDays.push(...list);
  if (new Set(list).size !== list.length) duplicated.push(count);
}
check(
  "every day is a weekday in range",
  drinkDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  true
);
check("no day is listed twice", duplicated, []);

// The drink slot has an hour to itself. Sharing one with the food posts would
// put a cocktail right beside the cooking matchup it was moved out of.
check("23:00 is clear of the food hours", HOURS.includes(23), false);

// ── the weekly slots, as actually configured ───────────────────────
// Six weekly posts share one channel now, and every one of them is a pair of
// numbers in wrangler.toml that somebody has to shift twice a year when the
// clocks change. Two landing on the same day and hour is not an error anything
// would report — both would simply go up in the same minute, and the second
// would read as the first having posted twice.
//
// Only the fixed slots are here. The drink matchup computes its days from the
// catalog, and the caption contest occupies the two days after the one it is
// configured for, so neither can be checked against a constant.
console.log("\nthe configured weekly slots");

const config = readFileSync("wrangler.toml", "utf-8");
const setting = (name) =>
  config.match(new RegExp(`^${name} = "([^"]*)"`, "m"))?.[1] ?? "";

const weekly = [
  ["standings", "STANDINGS_WEEKDAY", "STANDINGS_HOUR_UTC"],
  ["place round", "PLACE_WEEKDAY", "PLACE_HOUR_UTC"],
  ["person bonus", "PERSON_WEEKDAY", "PERSON_HOUR_UTC"],
  ["food round", "FOOD_ROUND_WEEKDAY", "FOOD_ROUND_HOUR_UTC"],
  ["drink round", "DRINK_ROUND_WEEKDAY", "DRINK_ROUND_HOUR_UTC"],
  ["caption contest", "CAPTION_WEEKDAY", "CAPTION_HOUR_UTC"],
].map(([name, weekday, hour]) => ({
  name,
  days: parseWeekdays(setting(weekday)),
  hour: Number(setting(hour)),
}));

check(
  "every weekly slot has a day and an hour",
  weekly.filter((slot) => slot.days.length === 0 || !Number.isInteger(slot.hour))
    .map((slot) => slot.name),
  []
);

const taken = new Map();
const clashes = [];
for (const slot of weekly) {
  for (const day of slot.days) {
    const key = `${day}@${slot.hour}`;
    if (taken.has(key)) clashes.push(`${slot.name} and ${taken.get(key)} both on ${key}`);
    taken.set(key, slot.name);
  }
}
check("no two weekly slots share a day and an hour", clashes, []);

// A bonus is meant to run beside the cooking matchup, not on top of it.
check(
  "no weekly slot lands on a cooking hour",
  weekly.filter((slot) => HOURS.includes(slot.hour)).map((slot) => slot.name),
  []
);

console.log(failures === 0 ? "\nAll passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
