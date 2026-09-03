#!/usr/bin/env node
/**
 * Pure-function checks on the curve, the weight, the tiers and the week
 * boundary. No wrangler, no database — Node strips the types on import.
 *
 *   npm run test:xp
 */
import {
  checkinXp,
  levelForXp,
  levelProgress,
  ordinalWeight,
  tierForHp,
  workerSlots,
  xpForLevel,
  xpToNext,
} from "../src/xp.ts";
import { EVENT_TABLE, TIERS, CLUE_TIERS } from "../src/config.ts";
import { resolveWeek } from "../src/streaks.ts";
import { rollEvent, seededRng, weightedPick } from "../src/events.ts";
import { drawSteps, openCasket } from "../src/clues.ts";
import { drawPairs, judge } from "../src/rivalries.ts";
import { addDays, campaignWeek, daysBetween, gameDay, gameWeek, weekdayOf } from "../src/schedule.ts";

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail)}`}`);
}

// ── The curve ──────────────────────────────────────────────────────
const anchors = { 2: 8, 10: 115, 20: 447, 30: 1336, 40: 3722, 50: 10133, 60: 27374, 70: 73762, 92: 651725, 99: 1303443 };
for (const [level, xp] of Object.entries(anchors)) {
  check(`xpForLevel(${level}) = ${xp}`, xpForLevel(Number(level)) === xp, xpForLevel(Number(level)));
}
let monotonic = true;
let roundTrip = true;
for (let level = 1; level <= 99; level++) {
  if (level > 1 && xpForLevel(level) <= xpForLevel(level - 1)) monotonic = false;
  if (levelForXp(xpForLevel(level)) !== level) roundTrip = false;
  if (level < 99 && levelForXp(xpForLevel(level + 1) - 1) !== level) roundTrip = false;
}
check("table is strictly increasing", monotonic);
check("levelForXp(xpForLevel(L)) === L for 1..99, and one XP short is L-1", roundTrip);
check("levelForXp never exceeds 99", levelForXp(10_000_000) === 99);
check("xpToNext at 99 is 0", xpToNext(xpForLevel(99)) === 0);
check("levelProgress halfway through level 10 is ~50", Math.abs(levelProgress(Math.floor((xpForLevel(10) + xpForLevel(11)) / 2)) - 50) <= 1);

// ── The weight ─────────────────────────────────────────────────────
check("ordinal weights are 1, 1, .5, .5, .2, .2, .2",
  [1, 2, 3, 4, 5, 6, 7].map(ordinalWeight).join(",") === "1,1,0.5,0.5,0.2,0.2,0.2");
check("an eighth check-in still weighs .2", ordinalWeight(8) === 0.2);
const weekUnits = [1, 2, 3, 4, 5, 6, 7].reduce((sum, n) => sum + ordinalWeight(n), 0);
check("seven a week is 3.6 units (1.8× two a week)", Math.abs(weekUnits - 3.6) < 1e-9, weekUnits);
const controlled = checkinXp(1, "controlled");
check("controlled splits combat three ways", controlled.combat.attack === 66 && controlled.combat.strength === 66 && controlled.combat.defence === 66, controlled);
check("aggressive puts it all in Strength", checkinXp(0.5, "aggressive").combat.strength === 100);
check("bootstrap doubles Hitpoints only", checkinXp(1, "accurate", 2).hp === 400 && checkinXp(1, "accurate", 2).combatTotal === 200);

// ── Tiers ──────────────────────────────────────────────────────────
let gapFree = true;
for (let hp = 1; hp <= 99; hp++) if (!tierForHp(hp)) gapFree = false;
check("every HP level 1-99 has a tier", gapFree);
check("Dragon at 60", tierForHp(60).key === "dragon" && tierForHp(59).key === "rune_or");
check("Bronze at 1, Iron at 2", tierForHp(1).key === "bronze" && tierForHp(2).key === "iron");
check("tiers are in ascending HP order", TIERS.every((t, i) => i === 0 || t.hp > TIERS[i - 1].hp));
check("worker slots: 1 at L1, 2 at L15, 5 at L60", workerSlots(1) === 1 && workerSlots(15) === 2 && workerSlots(60) === 5);

// ── Events ─────────────────────────────────────────────────────────
check("event weights sum to 100", EVENT_TABLE.reduce((s, r) => s + r.weight, 0) === 100);
const rng = seededRng("player:2026-09-14:event");
const rngAgain = seededRng("player:2026-09-14:event");
check("seeded rng is deterministic", rng() === rngAgain() && rng() === rngAgain());
let hits = 0;
for (let i = 0; i < 60000; i++) if (rollEvent(seededRng(`p:${i}`), 0) !== null) hits++;
check("event rate is about one in six", Math.abs(hits / 60000 - 1 / 6) < 0.01, hits / 60000);
check("the twelfth dry check-in is guaranteed", rollEvent(seededRng("never"), 11) !== null);
const picks = {};
for (let i = 0; i < 20000; i++) {
  const key = weightedPick(seededRng(`w:${i}`), EVENT_TABLE).key;
  picks[key] = (picks[key] ?? 0) + 1;
}
check("genie is ~30% of events", Math.abs(picks.genie / 20000 - 0.3) < 0.02, picks.genie / 20000);

// ── Clues ──────────────────────────────────────────────────────────
for (const tier of CLUE_TIERS) {
  const steps = drawSteps(seededRng(`clue:${tier.key}`), tier, 1);
  const unique = new Set(steps).size === steps.length;
  const verified = steps.filter((s) => s.startsWith("verified_")).length;
  check(`${tier.key} clue draws ${tier.steps} distinct steps with ≥${tier.verifiedSteps} verified`,
    steps.length === tier.steps && unique && verified >= tier.verifiedSteps, steps);
}
let uniques = 0;
for (let i = 0; i < 30000; i++) if (openCasket(seededRng(`c:${i}`), CLUE_TIERS[0], new Set()).unique) uniques++;
check("easy casket holds a unique about one time in three", Math.abs(uniques / 30000 - 1 / 3) < 0.02, uniques / 30000);
const dup = openCasket(seededRng("dup"), CLUE_TIERS[4], new Set(CLUE_TIERS[4].uniques));
check("a duplicate becomes extra XP", dup.unique === null && (dup.duplicate ? dup.xp === 1200 : dup.xp === 800), dup);

// ── The week boundary ──────────────────────────────────────────────
const base = { formWeeks: 4, rings: 1, ringProgress: 1, playerWeek: 10, graduated: false, paused: false, ringEveryWeek: false, chapelBonus: 0 };
const form = resolveWeek({ ...base, checkins: 2 });
check("two check-ins: form, streak +1, ring earned at 1 per 2 from week 9", form.outcome === "form" && form.formWeeks === 5 && form.rings === 2 && form.ringEarned, form);
const three = resolveWeek({ ...base, checkins: 3, ringProgress: 0 });
check("three check-ins pays the Prayer bonus", three.prayerXp === 250, three);
const held = resolveWeek({ ...base, checkins: 1 });
check("one check-in with a ring: held, ring spent, streak kept", held.outcome === "held" && held.rings === 0 && held.formWeeks === 4, held);
const broke = resolveWeek({ ...base, checkins: 1, rings: 0 });
check("one check-in with no ring: broke", broke.outcome === "broke" && broke.formWeeks === 0, broke);
const zero = resolveWeek({ ...base, checkins: 0, rings: 2 });
check("zero check-ins breaks even with rings", zero.outcome === "broke" && zero.rings === 2, zero);
const idle = resolveWeek({ ...base, checkins: 0, formWeeks: 0 });
check("nothing to break is idle", idle.outcome === "idle", idle);
const early = resolveWeek({ ...base, checkins: 2, rings: 0, ringProgress: 0, playerWeek: 3, formWeeks: 0 });
check("week 3 of a player's campaign hands the first ring over early", early.rings === 1 && early.ringEarned, early);
const capped = resolveWeek({ ...base, checkins: 2, rings: 2, ringProgress: 1 });
check("rings cap at 2 before graduation", capped.rings === 2 && !capped.ringEarned, capped);
const paused = resolveWeek({ ...base, checkins: 0, paused: true });
check("an expedition week changes nothing", paused.outcome === "paused" && paused.formWeeks === 4, paused);

// ── Rivalries ──────────────────────────────────────────────────────
const roster = ["a", "b", "c", "d", "e", "f"];
const recent = [{ id: 1, week: "2026-09-21", player_a: "a", player_b: "b", units_a: null, units_b: null, winner_id: null, resolved: 0 }];
const draw = drawPairs(seededRng("draw"), roster, recent, new Map());
check("six players draw three pairs and no bye", draw.pairs.length === 3 && draw.bye === null, draw);
check("a recent pair is not redrawn", !draw.pairs.some(([x, y]) => (x === "a" && y === "b") || (x === "b" && y === "a")), draw);
const odd = drawPairs(seededRng("odd"), roster.slice(0, 5), [], new Map());
check("five players draw two pairs and a bye", odd.pairs.length === 2 && odd.bye !== null, odd);
const tooFew = drawPairs(seededRng("few"), ["a", "b", "c"], [], new Map());
check("fewer than four draws nothing", tooFew.pairs.length === 0 && tooFew.bye === null);
check("judge: more units wins", judge("a", 2.5, "b", 2).winner === "a");
check("judge: a tie at 2.0 is shared", judge("a", 2, "b", 2).winner === "both");
check("judge: a tie below 2.0 is nobody", judge("a", 1, "b", 1).winner === null);
check("judge: vs the town, beat the mean", judge("a", 2.5, null, 2.2).winner === "a" && judge("a", 1, null, 2).winner === null);

// ── Calendar ───────────────────────────────────────────────────────
check("gameDay before 09:00 UTC is yesterday", gameDay(Date.parse("2026-09-15T08:59:00Z"), 9) === "2026-09-14");
check("gameDay at 09:00 UTC is today", gameDay(Date.parse("2026-09-15T09:00:00Z"), 9) === "2026-09-15");
check("gameWeek of a Sunday is the Monday before", gameWeek("2026-09-20") === "2026-09-14");
check("gameWeek of a Monday is itself", gameWeek("2026-09-14") === "2026-09-14");
check("campaign week 1 starts 14 Sep 2026", campaignWeek("2026-09-14", "2026-09-14") === 1 && campaignWeek("2026-09-20", "2026-09-14") === 1 && campaignWeek("2026-09-21", "2026-09-14") === 2);
check("week 52 is 6 Sep 2027", campaignWeek("2027-09-06", "2026-09-14") === 52);
check("addDays crosses months", addDays("2026-09-30", 1) === "2026-10-01" && daysBetween("2026-09-30", "2026-10-01") === 1);
check("weekdayOf: 2026-09-14 is a Monday", weekdayOf("2026-09-14") === 1);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
