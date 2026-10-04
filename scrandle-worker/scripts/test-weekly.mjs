#!/usr/bin/env node
/**
 * The two pieces of the week that are arithmetic rather than plumbing: who
 * moved in the standings and past whom, and how the weekly Scrandle draws its
 * pairs.
 *
 * Node >= 22 strips the types from the imported .ts on the fly, so this needs
 * no build step and no test dependency. Both modules are imported for the
 * pure functions only — nothing here touches D1, R2 or Discord.
 */
import assert from "node:assert/strict";
import {
  overtakeLines,
  overtakes,
  previousRanks,
  standingsRows,
} from "../src/standings.ts";
import { drawRounds, weeklyDue } from "../src/weekly-draw.ts";

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

const chef = (id, elo) => ({ discord_id: id, username: id, elo });
const plain = (text) => text;

// ── Standings ──────────────────────────────────────────────────────
console.log("Standings: rank movement");

// Last week: ann, bob, cat, dan. This week dan has gone from last to first.
const lastWeek = { ann: 1600, bob: 1560, cat: 1520, dan: 1480 };
const thisWeek = [
  chef("dan", 1610),
  chef("ann", 1598),
  chef("cat", 1540),
  chef("bob", 1530),
];

check(
  "last week's ranks come out of last week's ratings",
  [...previousRanks(lastWeek)],
  [["ann", 1], ["bob", 2], ["cat", 3], ["dan", 4]]
);

const rows = standingsRows(thisWeek, lastWeek, 12);
check("a climb is positive places", rows[0].m, 3);
check("the rating change is still reported", rows[0].d, 130);
check("being passed is negative places", rows[1].m, -1);
check(
  "holding a place while the rating moves is no movement",
  [rows[2].m, rows[2].d, rows[3].m, rows[3].d],
  [0, 20, -2, -30]
);

const climbs = overtakes(thisWeek, lastWeek, 12);
check(
  "only the chef who gained places is a climber",
  climbs.map((c) => c.name),
  ["dan"]
);
check("and names everybody it went past, best first", climbs[0].passed, [
  "ann",
  "cat",
  "bob",
]);
check("the lines read as sentences", overtakeLines(climbs, plain), [
  "▲ **dan** up 3 places to #1, past ann, cat and bob",
]);

check(
  "nobody moved, nothing to say",
  overtakeLines(overtakes(thisWeek, { dan: 1600, ann: 1590, cat: 1500, bob: 1400 }, 12), plain),
  []
);

const withNewcomer = standingsRows(
  [chef("eve", 1700), ...thisWeek],
  lastWeek,
  12
);
check("somebody absent last week is new, not a climber", withNewcomer[0], {
  n: "eve",
  e: 1700,
  d: 0,
  m: 0,
  nw: 1,
});
check(
  "and pushes everyone else down a place",
  withNewcomer.slice(1).map((row) => row.m),
  [2, -2, -1, -3]
);

check(
  "the first post ever marks nobody new",
  standingsRows(thisWeek, {}, 12).some((row) => row.nw),
  false
);

// A chef above drops out of the table entirely: a place gained, nobody passed.
const dropout = overtakes([chef("bob", 1560), chef("cat", 1520)], lastWeek, 12);
check(
  "a place gained by default invents no victim",
  overtakeLines(dropout, plain),
  ["▲ **bob** up 1 place to #1", "▲ **cat** up 1 place to #2"]
);

check(
  "names are escaped by the caller's rule",
  overtakeLines(
    overtakes([chef("b_b", 1700), chef("a_a", 1600)], { a_a: 1650, b_b: 1500 }, 12),
    (text) => text.replace(/_/g, "\\_")
  ),
  ["▲ **b\\_b** up 1 place to #1, past a\\_a"]
);

check(
  "the card can be shorter than the table",
  standingsRows(thisWeek, lastWeek, 2).length,
  2
);

// Twelve chefs passed in one week is a list nobody reads.
const crowd = Array.from({ length: 6 }, (_, i) => chef(`c${i}`, 1600 - i * 10));
const crowdBefore = Object.fromEntries(crowd.map((c) => [c.discord_id, c.elo]));
const leap = [chef("c5", 1700), ...crowd.slice(0, 5)];
check("a long list of names is cut short", overtakeLines(overtakes(leap, crowdBefore, 12), plain), [
  "▲ **c5** up 5 places to #1, past c0, c1, c2 and 2 more",
]);

// ── The weekly draw ────────────────────────────────────────────────
console.log("Weekly Scrandle: the draw");

/** Deterministic, so a failure here is the same failure every run. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Sixty plates across six kitchens, ratings spread over about 300 points.
const catalog = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  poster: `chef${i % 6}`,
  rating: 1350 + ((i * 37) % 300),
}));

let allFull = true;
let noRepeats = true;
let noSelfPairs = true;
let allHaveAnAnswer = true;
let higherOnA = 0;
let total = 0;

for (let seed = 1; seed <= 500; seed++) {
  const rounds = drawRounds(catalog, new Set(), 10, seeded(seed));
  if (rounds.length !== 10) allFull = false;
  const ids = rounds.flatMap(([a, b]) => [a.id, b.id]);
  if (new Set(ids).size !== ids.length) noRepeats = false;
  for (const [a, b] of rounds) {
    if (a.poster === b.poster) noSelfPairs = false;
    if (Math.abs(a.rating - b.rating) < 15) allHaveAnAnswer = false;
    if (a.rating > b.rating) higherOnA++;
    total++;
  }
}

check("a deep catalog always fills ten rounds", allFull, true);
check("no plate appears twice in a puzzle", noRepeats, true);
check("two plates from one kitchen never meet", noSelfPairs, true);
check("every pair is far enough apart to have an answer", allHaveAnAnswer, true);
check(
  "the answer is not always on the same side",
  higherOnA / total > 0.4 && higherOnA / total < 0.6,
  true
);

// A third of the catalog was in recent puzzles: the rest fills the card.
const recent = new Set(catalog.slice(0, 20).map((plate) => plate.id));
let avoidedRecent = true;
for (let seed = 1; seed <= 200; seed++) {
  const rounds = drawRounds(catalog, recent, 10, seeded(seed));
  if (rounds.flat().some((plate) => recent.has(plate.id))) avoidedRecent = false;
}
check("plates from recent puzzles wait their turn", avoidedRecent, true);

// ...but recency is a preference: with everything recent, the puzzle still fills.
const everything = new Set(catalog.map((plate) => plate.id));
check(
  "a catalog that is all recent still draws",
  drawRounds(catalog, everything, 10, seeded(7)).length,
  10
);

check(
  "one kitchen's catalog draws nothing",
  drawRounds(
    catalog.map((plate) => ({ ...plate, poster: "solo" })),
    new Set(),
    10,
    seeded(3)
  ).length,
  0
);

check(
  "plates all on one rating draw nothing",
  drawRounds(
    catalog.map((plate) => ({ ...plate, rating: 1500 })),
    new Set(),
    10,
    seeded(3)
  ).length,
  0
);

check(
  "a thin catalog gives as many rounds as it can",
  drawRounds(catalog.slice(0, 8), new Set(), 10, seeded(11)).length <= 4,
  true
);

// ── When it draws ──────────────────────────────────────────────────
console.log("Weekly Scrandle: the schedule");

const at = (iso) => Date.parse(iso);
const twice = { weekdays: [0, 3], hourUtc: 18 };
// 4 October 2026 is a Sunday; the first puzzle went out that day at 18:11.
const firstDraw = at("2026-10-04T18:11:00Z");

check("draws on a listed day once the hour has come",
  weeklyDue(at("2026-10-04T18:00:00Z"), { ...twice, lastAt: 0 }), true);
check("not before the hour",
  weeklyDue(at("2026-10-04T17:11:00Z"), { ...twice, lastAt: 0 }), false);
check("not twice in a day",
  weeklyDue(at("2026-10-04T19:00:00Z"), { ...twice, lastAt: firstDraw }), false);
check("not on a day that is not listed",
  weeklyDue(at("2026-10-06T18:00:00Z"), { ...twice, lastAt: firstDraw }), false);
check("the second day of the week draws three days after the first",
  weeklyDue(at("2026-10-07T18:00:00Z"), { ...twice, lastAt: firstDraw }), true);
check("a tick that failed is retried later the same day",
  weeklyDue(at("2026-10-07T23:11:00Z"), { ...twice, lastAt: firstDraw }), true);
check("and Sunday comes round again four days after Wednesday",
  weeklyDue(at("2026-10-11T18:00:00Z"), { ...twice, lastAt: at("2026-10-07T18:00:00Z") }), true);

// A fortnight of ticks at :00 and :11, drawing whenever one is due.
let draws = [];
let last = firstDraw;
for (let t = at("2026-10-04T19:00:00Z"); t < at("2026-10-18T17:00:00Z"); t += 60e3) {
  const minute = new Date(t).getUTCMinutes();
  if (minute !== 0 && minute !== 11) continue;
  if (weeklyDue(t, { ...twice, lastAt: last })) {
    draws.push(new Date(t).toISOString().slice(0, 16));
    last = t;
  }
}
check("two weeks of ticks draw exactly on the listed days", draws, [
  "2026-10-07T18:00",
  "2026-10-11T18:00",
  "2026-10-14T18:00",
]);

check("an empty list is the slot switched off",
  weeklyDue(at("2026-10-04T18:00:00Z"), { weekdays: [], hourUtc: 18, lastAt: 0 }), false);

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll passed");
