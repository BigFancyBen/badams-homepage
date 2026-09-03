#!/usr/bin/env node
/**
 * Pure-function checks on the curve, the combat formulas, the weight, the
 * tiers and the week boundary. No wrangler, no database — Node strips the
 * types on import.
 *
 *   npm run test:xp
 */
import {
  clueTierForMonster,
  levelForXp,
  levelProgress,
  ordinalWeight,
  tierForDefence,
  workerSlots,
  xpForLevel,
  xpToNext,
  lampXp,
  isLevelMilestone,
} from "../src/xp.ts";
import { EVENT_TABLE, TIERS, CLUE_TIERS, LOGS, ORES, FISH, bestResource, ANTIQUE_LAMP } from "../src/config.ts";
import {
  ARMOUR,
  MASTERS,
  MONSTERS,
  WEAPONS,
  armourFor,
  bestPrayers,
  combatLevel,
  drawAssignment,
  hitChance,
  masterFor,
  simulateSession,
  weaponFor,
} from "../src/combat.ts";
import { resolveWeek } from "../src/streaks.ts";
import { rollEvent, seededRng, weightedPick } from "../src/events.ts";
import { drawSteps, openCasket } from "../src/clues.ts";
import { streakMultiplier } from "../src/slayer.ts";
import { addDays, campaignWeek, dailyHourDue, daysBetween, gameDay, gameWeek, weekdayOf } from "../src/schedule.ts";
import { threadName } from "../src/digest.ts";
import { goingStale, reminderMessage } from "../src/reminders.ts";

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail)}`}`);
}

// ── The curve ──────────────────────────────────────────────────────
const anchors = { 2: 83, 10: 1154, 20: 4470, 30: 13363, 40: 37224, 50: 101333, 60: 273742, 70: 737627, 92: 6517253, 99: 13034431 };
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
check("levelForXp never exceeds 99", levelForXp(100_000_000) === 99);
check("xpToNext at 99 is 0", xpToNext(xpForLevel(99)) === 0);
check("levelProgress halfway through level 10 is ~50", Math.abs(levelProgress(Math.floor((xpForLevel(10) + xpForLevel(11)) / 2)) - 50) <= 1);

// ── The weight ─────────────────────────────────────────────────────
check("ordinal weights are 1, 1, .5, .5, .2, .2, .2",
  [1, 2, 3, 4, 5, 6, 7].map(ordinalWeight).join(",") === "1,1,0.5,0.5,0.2,0.2,0.2");
check("an eighth check-in still weighs .2", ordinalWeight(8) === 0.2);
const weekUnits = [1, 2, 3, 4, 5, 6, 7].reduce((sum, n) => sum + ordinalWeight(n), 0);
check("seven a week is 3.6 units (1.8× two a week)", Math.abs(weekUnits - 3.6) < 1e-9, weekUnits);

// ── Combat, against the wiki ───────────────────────────────────────
const lv = (attack, strength, defence, hitpoints = 10, prayer = 1) => ({ hitpoints, attack, strength, defence, prayer, slayer: 1, woodcutting: 1, mining: 1, fishing: 1 });
check("combat level: all 1s and 10 Hitpoints is 3", combatLevel(lv(1, 1, 1, 10, 1)) === 3, combatLevel(lv(1, 1, 1)));
check("combat level: 99 everything is 126", combatLevel(lv(99, 99, 99, 99, 99)) === 126, combatLevel(lv(99, 99, 99, 99, 99)));
check("combat level: 60/60/60, 60 HP, 43 Prayer is 74", combatLevel(lv(60, 60, 60, 60, 43)) === 74, combatLevel(lv(60, 60, 60, 60, 43)));
check("weapons: iron at 1 (bronze and iron both need 1), rune at 40, dragon at 60", weaponFor(1).key === "iron" && weaponFor(39).key === "adamant" && weaponFor(40).key === "rune" && weaponFor(60).key === "dragon");
check("armour: steel at 5, mithril at 20, dragon at 60", armourFor(5).key === "steel" && armourFor(20).key === "mithril" && armourFor(59).key === "rune" && armourFor(60).key === "dragon");
check("the scimitar bonuses are the wiki's (rune +45 slash, +44 str; dragon +67, +66)",
  WEAPONS.find((w) => w.key === "rune").aslash === 45 && WEAPONS.find((w) => w.key === "rune").str === 44 && WEAPONS.find((w) => w.key === "dragon").aslash === 67 && WEAPONS.find((w) => w.key === "dragon").str === 66);
check("armour sets add up (rune full set slash defence 209)", ARMOUR.find((a) => a.key === "rune").dslash === 209, ARMOUR);
check("prayers: Ultimate Strength at 31, Piety at 70", bestPrayers(31).strength === 1.15 && bestPrayers(69).attack === 1.15 && bestPrayers(70).strength === 1.23 && bestPrayers(1).strength === 1);
check("hit chance: equal rolls is about a half", Math.abs(hitChance(1000, 1000) - 0.5) < 0.01);
check("hit chance: a roll ten times the defence is about 95%", hitChance(10000, 1000) > 0.94 && hitChance(10000, 1000) < 0.96);
const maxed = simulateSession({ levels: lv(99, 99, 99, 99, 1), style: "aggressive", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Hill Giant"], weight: 1 });
check("max hit: 99 Strength, dragon scimitar, aggressive, no prayer is 22", maxed.maxHit === 22, maxed.maxHit);
const helmed = simulateSession({ levels: lv(99, 99, 99, 99, 1), style: "aggressive", gear: { slayerHelmet: true, glory: false }, monster: MONSTERS["Hill Giant"], weight: 1 });
check("the Slayer helmet lifts that to 25", helmed.maxHit === 25, helmed.maxHit);
const novice = simulateSession({ levels: lv(1, 1, 1, 10, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Chicken"], weight: 1 });
check("a level-1 session against chickens pays XP to all four combat skills", novice.xp.attack > 0 && novice.xp.strength === novice.xp.attack && novice.xp.defence === novice.xp.attack && novice.xp.hitpoints === novice.xp.attack, novice.xp);
check("XP is four per damage on a single style, and 4/3 to Hitpoints", maxed.xp.strength === Math.floor(maxed.damage * 4) && maxed.xp.hitpoints === Math.floor(maxed.damage * 4 / 3), maxed.xp);
const half = simulateSession({ levels: lv(40, 40, 40, 40, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Moss giant"], weight: 0.5 });
const full = simulateSession({ levels: lv(40, 40, 40, 40, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Moss giant"], weight: 1 });
check("a half-weight session is about half the damage", Math.abs(half.damage / full.damage - 0.5) < 0.05, [half.damage, full.damage]);
const armoured = simulateSession({ levels: lv(40, 40, 60, 40, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Fire giant"], weight: 1 });
const naked = simulateSession({ levels: lv(40, 40, 1, 40, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Fire giant"], weight: 1 });
check("Defence and armour keep more of the session against a hard hitter", armoured.attacks > naked.attacks && armoured.foodEaten < naked.foodEaten, [armoured.attacks, naked.attacks]);
check("sessions are deterministic", JSON.stringify(full) === JSON.stringify(simulateSession({ levels: lv(40, 40, 40, 40, 1), style: "controlled", gear: { slayerHelmet: false, glory: false }, monster: MONSTERS["Moss giant"], weight: 1 })));

// ── Slayer ─────────────────────────────────────────────────────────
check("masters by combat: Turael 1, Mazchna 20, Vannaka 40, Chaeldar 70, Nieve 85; Duradel needs 50 Slayer",
  masterFor(1, 1).key === "turael" && masterFor(20, 1).key === "mazchna" && masterFor(40, 1).key === "vannaka" && masterFor(70, 1).key === "chaeldar" && masterFor(99, 1).key === "nieve" && masterFor(100, 50).key === "duradel" && masterFor(126, 49).key === "nieve");
check("every master has assignments from the wiki", MASTERS.every((m) => m.tasks.length >= 15), MASTERS.map((m) => [m.key, m.tasks.length]));
check("every assignment's monster has stats", MASTERS.every((m) => m.tasks.every((t) => MONSTERS[t.monster]?.hitpoints > 0)));
let lowOnly = true;
for (let i = 0; i < 300; i++) {
  const drawn = drawAssignment(seededRng(`t:${i}`), MASTERS[0], 1, 3);
  if ((drawn.monster.slayerLevel ?? 1) > 1 || (drawn.assignment.combatReq ?? 1) > 3) lowOnly = false;
  if (drawn.amount < drawn.assignment.min || drawn.amount > drawn.assignment.max) lowOnly = false;
}
check("Turael never assigns a level-3 player something they cannot fight, and amounts are in range", lowOnly);
let abyssals = 0;
for (let i = 0; i < 500; i++) if (drawAssignment(seededRng(`v:${i}`), MASTERS[2], 84, 90).monster.name === "Abyssal demon") abyssals++;
check("Vannaka withholds abyssal demons below 85 Slayer", abyssals === 0, abyssals);
check("the 10th task pays 5x, the 50th 15x, the 100th 25x, the rest 1x",
  streakMultiplier(9) === 1 && streakMultiplier(10) === 5 && streakMultiplier(50) === 15 && streakMultiplier(100) === 25 && streakMultiplier(20) === 5);
check("hill giants drop big bones (15 Prayer XP); abyssal demons abyssal ashes (85)", MONSTERS["Hill Giant"].bones?.xp === 15 && MONSTERS["Abyssal demon"].bones?.xp === 85);

// ── Tiers, slots, gathering, lamps ─────────────────────────────────
let gapFree = true;
for (let level = 1; level <= 99; level++) if (!tierForDefence(level)) gapFree = false;
check("every Defence level 1-99 has a tier", gapFree);
check("Dragon at Defence 60, Rune at 40", tierForDefence(60).key === "dragon" && tierForDefence(59).key === "rune" && tierForDefence(40).key === "rune");
check("everyone starts in iron", tierForDefence(1).key === "iron" && armourFor(1).key === "iron");
check("tiers are in ascending Defence order", TIERS.every((t, i) => i === 0 || t.level >= TIERS[i - 1].level));
check("worker slots: 1 at combat 3, 2 at 25, 4 at 75", workerSlots(3) === 1 && workerSlots(25) === 2 && workerSlots(75) === 4);
check("clue tiers by the monster: chickens easy, hill giants easy, greater demons hard, black demons elite",
  clueTierForMonster(MONSTERS["Chicken"].combat).key === "easy" && clueTierForMonster(MONSTERS["Hill Giant"].combat).key === "easy" && clueTierForMonster(MONSTERS["Greater demon"].combat).key === "hard" && clueTierForMonster(MONSTERS["Black demon"].combat).key === "elite");
check("gathering: willows at 30 (67.5), yews at 60 (175); coal at 30 (50); lobsters at 40 (90)",
  bestResource(LOGS, 30).xp === 67.5 && bestResource(LOGS, 60).xp === 175 && bestResource(ORES, 30).xp === 50 && bestResource(FISH, 40).xp === 90);
check("a genie's lamp is ten times the level", lampXp(1) === 10 && lampXp(50) === 500 && lampXp(99) === 990);
check("antique lamps are the diary's: 2,500 / 7,500 / 15,000 / 50,000", ANTIQUE_LAMP.easy === 2500 && ANTIQUE_LAMP.medium === 7500 && ANTIQUE_LAMP.hard === 15000 && ANTIQUE_LAMP.elite === 50000);

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
  const steps = drawSteps(seededRng(`clue:${tier.key}`), tier, 3);
  const unique = new Set(steps).size === steps.length;
  const verified = steps.filter((s) => s.startsWith("verified_")).length;
  check(`${tier.key} clue draws ${tier.steps} distinct steps with ≥${tier.verifiedSteps} verified`,
    steps.length === tier.steps && unique && verified >= tier.verifiedSteps, steps);
}
let uniques = 0;
for (let i = 0; i < 30000; i++) if (openCasket(seededRng(`c:${i}`), CLUE_TIERS[0], new Set()).unique) uniques++;
check("easy casket holds a unique about one time in three", Math.abs(uniques / 30000 - 1 / 3) < 0.02, uniques / 30000);
const dup = openCasket(seededRng("dup"), CLUE_TIERS[4], new Set(CLUE_TIERS[4].uniques));
check("a duplicate becomes extra XP", dup.unique === null && (dup.duplicate ? dup.xp === 75000 : dup.xp === 50000), dup);

// ── The week boundary ──────────────────────────────────────────────
const base = { formWeeks: 4, rings: 1, ringProgress: 1, playerWeek: 10, graduated: false, paused: false, ringEveryWeek: false };
const form = resolveWeek({ ...base, checkins: 2 });
check("two check-ins: form, streak +1, ring earned at 1 per 2 from week 9", form.outcome === "form" && form.formWeeks === 5 && form.rings === 2 && form.ringEarned, form);
check("Prayer no longer comes from the week (bones do that)", resolveWeek({ ...base, checkins: 3 }).prayerXp === 0);
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

// ── Calendar ───────────────────────────────────────────────────────
check("gameDay before 09:00 UTC is yesterday", gameDay(Date.parse("2026-09-15T08:59:00Z"), 9) === "2026-09-14");
check("gameDay at 09:00 UTC is today", gameDay(Date.parse("2026-09-15T09:00:00Z"), 9) === "2026-09-15");
check("gameWeek of a Sunday is the Monday before", gameWeek("2026-09-20") === "2026-09-14");
check("gameWeek of a Monday is itself", gameWeek("2026-09-14") === "2026-09-14");
check("campaign week 1 starts 14 Sep 2026", campaignWeek("2026-09-14", "2026-09-14") === 1 && campaignWeek("2026-09-20", "2026-09-14") === 1 && campaignWeek("2026-09-21", "2026-09-14") === 2);
check("week 52 is 6 Sep 2027", campaignWeek("2027-09-06", "2026-09-14") === 52);
check("addDays crosses months", addDays("2026-09-30", 1) === "2026-10-01" && daysBetween("2026-09-30", "2026-10-01") === 1);
check("weekdayOf: 2026-09-14 is a Monday", weekdayOf("2026-09-14") === 1);
// The evening slot is 01:00 UTC, which is the same game day as the 14:00 post before it.
check("dailyHourDue: 01:00 UTC is due at 01:00 and 03:00, not at 14:00 or 23:00", dailyHourDue(Date.parse("2026-09-16T01:00:00Z"), 1, 9) && dailyHourDue(Date.parse("2026-09-16T03:00:00Z"), 1, 9) && !dailyHourDue(Date.parse("2026-09-15T14:00:00Z"), 1, 9) && !dailyHourDue(Date.parse("2026-09-15T23:00:00Z"), 1, 9));
check("dailyHourDue: off when the hour is null", !dailyHourDue(Date.parse("2026-09-16T01:00:00Z"), null, 9));
check("threadName names the day", threadName("2026-09-02") === "Check-ins · Wed 2 Sep", threadName("2026-09-02"));

// ── Level-up scrolls and reminders ─────────────────────────────────
check("milestones: 10, 20, 60, 65, 70, 91, 99", [10, 20, 60, 65, 70, 91, 99].every(isLevelMilestone));
check("not milestones: 7, 55, 63, 89", ![7, 55, 63, 89].some(isLevelMilestone));
check("no reminders, no message", reminderMessage({ nudges: [], goingStale: [] }) === null);
const reminder = reminderMessage({ nudges: [{ playerId: "1", name: "ben_*", bits: ["2 lamps to rub (one rubs itself tomorrow)", "hasn't voted"] }], goingStale: [] });
check("a reminder names the player, escapes markdown and pings nobody", /Evening reminders/.test(reminder.content) && reminder.content.includes("• **ben\\_\\*** — 2 lamps to rub (one rubs itself tomorrow) · hasn't voted") && reminder.allowed_mentions.parse.length === 0 && reminder.allowed_mentions.users.length === 0, reminder);
const roster = [
  { discord_id: "fresh", username: "fresh", last_active_day: "2026-09-16" },
  { discord_id: "edge", username: "edge", last_active_day: "2026-09-13" },
  { discord_id: "gone", username: "gone", last_active_day: "2026-09-12" },
  { discord_id: "never", username: "never", last_active_day: null },
];
const stale = goingStale(roster, "2026-09-16");
check("goingStale picks exactly the player on their third day", stale.length === 1 && stale[0].discord_id === "edge", stale);
const shame = reminderMessage({ nudges: [], goingStale: stale });
check("the stale warning @mentions by id and allows only that mention", shame.content.includes("<@edge>") && /Tomorrow makes four/.test(shame.content) && shame.allowed_mentions.users.join() === "edge", shame);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
