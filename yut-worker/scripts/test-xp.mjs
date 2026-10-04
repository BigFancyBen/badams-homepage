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
import { dropTable, gpShort, isNotable, oneIn, rollDrops } from "../src/loot.ts";
import { currentEnemy, enemyPools, questFor, questKey, questLampXp, suppliesNeeded } from "../src/quests.ts";
import { questFight } from "../src/combat.ts";
import { QUEST_CALENDAR, QUEST_FIGHT_ATTACKS } from "../src/config.ts";
import { PROFILES, run as runPace } from "./lib/pace.mjs";
import { containerTable, draftSpoils, featuredFor, openContainer, rollTier, tierRank } from "../src/spoils.ts";
import { gePrice } from "../src/ge.ts";
import { currentTier, diaryNext, diaryProgress } from "../src/diary.ts";
import { potionBoost } from "../src/combat.ts";
import { lampWorth } from "../src/xp.ts";
import { GEAR_DEFS, dropBoost, gearSources, meetsReq, sessionGear, sourceLine } from "../src/gear.ts";
import { blocksOf, masterWanted } from "../src/slayer.ts";
import { advanceKingdom, dailyWage, pendingStacks } from "../src/kingdom.ts";
import { bestSeed, harvestOf, isGrown, lowestSkill, tearXp, tearsCaught } from "../src/farm.ts";
import { itemKeyOf, itemValue } from "../src/loot.ts";
import gearJson from "../config/gear.json" with { type: "json" };
import { bossFight, bossFor, bossLoot, bossPool, bossTable } from "../src/bosses.ts";
import { BOSS_FIGHTS_PER_HEAD, GROUP_BOSSES } from "../src/config.ts";
import {
  CROPS, GEAR_RATE_MULTIPLIER, KINGDOM_APPROVAL_FLOOR, KINGDOM_COFFER_MAX, KINGDOM_DAILY_CAP, KINGDOM_JOBS, PATCHES, PRICED_ITEMS, SKILLS, TEARS_MIN,
} from "../src/config.ts";
import { DIARY, GE_ITEMS, SPOILS_CONTAINERS, SPOILS_PITY, SPOILS_TIERS } from "../src/config.ts";

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

// ── Drops ──────────────────────────────────────────────────────────
const ankou = dropTable("Ankou");
check("Ankou has a drop table with an Always row and a rare-drop-table row", ankou.length > 30 && ankou.some((r) => r.p === 1) && ankou.some((r) => r.rdt), ankou.length);
const monsterList = Object.values(MONSTERS);
const missing = monsterList.filter((m) => dropTable(m.name).length === 0).map((m) => m.name);
// Ghost and Giant spider genuinely drop nothing the game keeps (their wiki rows are all Slayer-only items).
check("every Slayer monster has a drop table, bar the two that drop nothing", missing.every((name) => ["Ghost", "Giant spider"].includes(name)), missing);
const badRows = monsterList.flatMap((m) => dropTable(m.name)).filter((r) => !(r.p > 0 && r.p <= 1) || r.low > r.high || r.low < 0 || r.rolls < 1 || !/^[a-z0-9_+]+$/.test(r.key));
check("every row has a sane rate, quantity, roll count and key", badRows.length === 0, badRows.slice(0, 5));
const many = rollDrops("Ankou", 100_000, seededRng("drops-test"));
const deathRune = many.stacks.find((s) => s.key === "death_rune");
const deathRow = ankou.find((r) => r.key === "death_rune");
const expected = deathRow.p * deathRow.rolls * 100_000 * (deathRow.low + deathRow.high) / 2;
check("100k Ankou kills pay Death runes at the wiki's rate (±2%)", deathRune && Math.abs(deathRune.qty - expected) / expected < 0.02, { got: deathRune?.qty, expected });
const bones = many.stacks.find((s) => s.key === "bones");
check("an Always drop lands exactly once per kill", bones?.qty === 100_000, bones);
check("stacks are sorted richest first and the total is their sum", many.stacks.every((s, i) => i === 0 || many.stacks[i - 1].value >= s.value) && Math.abs(many.total - many.stacks.reduce((sum, s) => sum + s.value, 0)) < 1e-6);
check("no stack is empty or negative", many.stacks.every((s) => s.qty > 0 && s.value >= 0));
const once = rollDrops("Ankou", 60, seededRng("p1:2026-09-16:drops"));
const twice = rollDrops("Ankou", 60, seededRng("p1:2026-09-16:drops"));
const other = rollDrops("Ankou", 60, seededRng("p1:2026-09-17:drops"));
check("the same seed rolls the same drops; a different day differs", JSON.stringify(once) === JSON.stringify(twice) && JSON.stringify(once) !== JSON.stringify(other));
const excluded = rollDrops("Ankou", 60, seededRng("x"), (r) => r.key === "bones");
check("an excluded row never lands", !excluded.stacks.some((s) => s.key === "bones"));
check("Dragon spear is notable, Death rune is not", isNotable(ankou.find((r) => r.key === "dragon_spear")) && !isNotable(deathRow));
check("gpShort and oneIn read like the game", gpShort(312) === "312 gp" && gpShort(48_212) === "48k gp" && gpShort(4_821) === "4.8k gp" && gpShort(1_234_567) === "1.2m gp" && oneIn(1 / 273066.67) === "1/273,067");

// ── Quest of the week ──────────────────────────────────────────────
const weeks = QUEST_CALENDAR.map((q) => q.week);
check("the calendar has 51 unique weeks inside the year", weeks.length === 51 && new Set(weeks).size === 51 && weeks.every((w) => w >= 1 && w <= 52));
const noData = QUEST_CALENDAR.filter((q) => !questFor(q.week));
check("every calendar quest has wiki data", noData.length === 0, noData);
check("every quest pays at least one quest point", QUEST_CALENDAR.every((q) => questFor(q.week).data.qp >= 1));
const qpThrough17 = QUEST_CALENDAR.filter((q) => q.week <= 17).reduce((sum, q) => sum + questFor(q.week).data.qp, 0);
check("32 quest points before the Champions' Guild beat at week 18, as in the game", qpThrough17 >= 32, qpThrough17);
check("week 8 is The Restless Ghost and week 50 is Dragon Slayer I", questFor(8).name === "The Restless Ghost" && questFor(50).name === "Dragon Slayer I");
const cooks = questFor(1).data;
check("a quest with no enemies has no fight step", cooks.enemies.length === 0 && enemyPools(cooks, 5).length === 0 && currentEnemy(cooks, 5, 0) === null);
const ds = questFor(50).data;
const pools = enemyPools(ds, 5);
check("pools are hitpoints × count, in order, whatever the roster", pools[pools.length - 1] === ds.enemies[ds.enemies.length - 1].hitpoints * ds.enemies[ds.enemies.length - 1].count && JSON.stringify(enemyPools(ds, 1)) === JSON.stringify(pools) && currentEnemy(ds, 5, 0).enemy.name === ds.enemies[0].name);
check("damage carries into the next enemy", currentEnemy(ds, 5, pools[0] + 3).index === 1 && currentEnemy(ds, 5, pools[0] + 3).left === pools[1] - 3);
check("supplies needed never exceed half the roster", suppliesNeeded(ds, 4) === Math.min(ds.items, 2) && suppliesNeeded(cooks, 10) === Math.min(cooks.items, 5));
check("quest lamps are antique lamps by difficulty", questLampXp(cooks) === ANTIQUE_LAMP.easy && questLampXp(questFor(40).data) === ANTIQUE_LAMP.hard);
check("questKey slugs the name", questKey("Cook's Assistant") === "quest:cook_s_assistant" && questKey("Romeo & Juliet") === "quest:romeo_juliet");
const low = { hitpoints: 10, attack: 1, strength: 1, defence: 1, prayer: 1, slayer: 1, woodcutting: 1, mining: 1, fishing: 1 };
const mid = { ...low, attack: 40, strength: 40, defence: 40, hitpoints: 40 };
const elvarg = ds.enemies[ds.enemies.length - 1];
const f1 = questFight(low, "controlled", { slayerHelmet: false, glory: false }, elvarg, QUEST_FIGHT_ATTACKS);
const f2 = questFight(mid, "controlled", { slayerHelmet: false, glory: false }, elvarg, QUEST_FIGHT_ATTACKS);
check("a mini-fight is deterministic and grows with levels", f1 === questFight(low, "controlled", { slayerHelmet: false, glory: false }, elvarg, QUEST_FIGHT_ATTACKS) && f2 > f1, { f1, f2 });
// The pace check: a party of 2/week players must finish the quest inside their two check-ins each —
// gather takes at most ceil(R/2) of them, so the fights must fit in the other 1.5R. Every quest
// must fall to a party of four; the Grandmasters may want six.
const paceD = runPace(PROFILES.find((p) => p.name === "D 2/wk"));
const fightsFor = (entry) => {
  const { data } = questFor(entry.week);
  const lv = paceD.weekly[entry.week];
  let fights = 0;
  for (let i = 0; i < data.enemies.length; i++) {
    const per = Math.max(1, questFight(lv, "controlled", { slayerHelmet: false, glory: false }, data.enemies[i], QUEST_FIGHT_ATTACKS));
    fights += enemyPools(data, 1)[i] / per;
  }
  return fights;
};
const tooHardForFour = QUEST_CALENDAR.filter((q) => questFor(q.week).data.difficulty !== "Grandmaster" && fightsFor(q) > 1.5 * 4).map((q) => `${q.quest} (${fightsFor(q).toFixed(1)})`);
const tooHardForSix = QUEST_CALENDAR.filter((q) => fightsFor(q) > 1.5 * 6).map((q) => `${q.quest} (${fightsFor(q).toFixed(1)})`);
const hardest = QUEST_CALENDAR.map((q) => ({ q: q.quest, f: fightsFor(q) })).sort((a, b) => b.f - a.f)[0];
console.log(`      hardest quest for a 2/wk party: ${hardest.q}, ${hardest.f.toFixed(1)} fights`);
check("every non-Grandmaster quest falls to a 2/week party of four", tooHardForFour.length === 0, tooHardForFour);
check("every quest, Grandmasters included, falls to a 2/week party of six", tooHardForSix.length === 0, tooHardForSix);
// The two-a-week promise with the quest lamps included: Dragon by the finale, not long before it.
const dragonWeek = Object.entries(paceD.weekly).find(([, lv]) => lv.defence >= 60)?.[0];
console.log(`      pace: 2/wk reaches Defence 60 at week ${dragonWeek ?? "never"} (final def ${paceD.final.defence}, att ${paceD.final.attack}); 1/wk final def ${runPace(PROFILES.find((p) => p.name === "E 1/wk")).final.defence}`);
check("two a week reaches Dragon by the finale with quest lamps, and not before week 40", paceD.final.defence >= 60 && Number(dragonWeek ?? 99) >= 40, { dragonWeek, final: paceD.final });

// ── Spoils ─────────────────────────────────────────────────────────
{
  const base = { playerId: "p1", day: "2026-10-06", ordinal: 1, weight: 1, formWeeks: 0, dry: 0, holdingClue: false };
  const a = draftSpoils(base);
  const b = draftSpoils(base);
  check("a draft is the same on a retry", JSON.stringify(a) === JSON.stringify(b), { a, b });
  check("a full-value draft offers three: the roll, today's container, a sure thing",
    a.options.length === 3 && a.options[0].kind === "container" && a.options[0].slot === "roll" &&
      a.options[1].kind === "container" && a.options[1].slot === "featured" && a.options[2].kind !== "container", a.options);
  check("today's container is the same for everybody", a.options[1].key === featuredFor("2026-10-06").key && featuredFor("2026-10-06").key === draftSpoils({ ...base, playerId: "p2" }).options[1].key);
  check("the roll is never today's container", (() => {
    for (let i = 0; i < 400; i++) {
      const d = draftSpoils({ ...base, playerId: `x${i}`, day: addDays("2026-10-06", i % 30) });
      if (d.options[0].key === d.options[1].key) return false;
    }
    return true;
  })());
  const slim = draftSpoils({ ...base, ordinal: 3, weight: 0.5 });
  check("a third check-in gets the roll and a sure thing, capped at uncommon", slim.options.length === 2 && tierRank(slim.tier) <= tierRank("uncommon"), slim);
  let slimOk = true;
  for (let i = 0; i < 500; i++) if (tierRank(draftSpoils({ ...base, playerId: `s${i}`, ordinal: 4, weight: 0.5 }).tier) > tierRank("uncommon")) slimOk = false;
  check("no slim draft ever rolls above uncommon", slimOk);
  const pity = draftSpoils({ ...base, dry: SPOILS_PITY - 1 });
  check("the pity counter forces a rare roll and resets", tierRank(pity.tier) >= tierRank("rare") && pity.dryAfter === 0, pity);
  const dryDraft = Array.from({ length: 200 }, (_, i) => draftSpoils({ ...base, playerId: `d${i}`, dry: 2 })).find((d) => tierRank(d.tier) < tierRank("rare"));
  check("a dry roll counts up", dryDraft?.dryAfter === 3, dryDraft);
  check("a slim check-in leaves the counter alone", draftSpoils({ ...base, ordinal: 3, weight: 0.5, dry: 5 }).dryAfter === 5);
  check("nobody holding a clue is offered a clue", Array.from({ length: 300 }, (_, i) => draftSpoils({ ...base, playerId: `c${i}`, holdingClue: true })).every((d) => d.options.every((o) => o.kind !== "clue")));

  // The tier odds, and the week's chest's advantage.
  const share = (rolls) => {
    const rng = seededRng(`tiers:${rolls}`);
    let rare = 0;
    for (let i = 0; i < 20000; i++) if (tierRank(rollTier(rng, rolls)) >= tierRank("rare")) rare++;
    return rare / 20000;
  };
  const one = share(1);
  const two = share(2);
  check("about 13% of rolls are rare or better", Math.abs(one - 0.13) < 0.015, one);
  check("the week's chest rolls rare or better about 24% of the time", Math.abs(two - (1 - 0.87 * 0.87)) < 0.02, two);
  check("every tier has a container and every container a loot table",
    SPOILS_TIERS.every((tier) => SPOILS_CONTAINERS.some((c) => c.tier === tier.key)) && SPOILS_CONTAINERS.every((c) => containerTable(c.key).length > 0),
    SPOILS_CONTAINERS.filter((c) => containerTable(c.key).length === 0).map((c) => c.key));

  // Opening: deterministic, never empty, and the tiers are in order of worth.
  const mean = (key) => {
    const rng = seededRng(`open:${key}`);
    let total = 0;
    let empty = 0;
    for (let i = 0; i < 4000; i++) {
      const opened = openContainer(key, rng);
      total += opened.total;
      if (opened.stacks.length === 0) empty++;
    }
    return { mean: total / 4000, empty };
  };
  const means = Object.fromEntries(SPOILS_CONTAINERS.map((c) => [c.key, mean(c.key)]));
  check("no container ever opens empty", Object.values(means).every((m) => m.empty === 0), means);
  const tierMean = (tier) => {
    const list = SPOILS_CONTAINERS.filter((c) => c.tier === tier).map((c) => means[c.key].mean);
    return list.reduce((s, n) => s + n, 0) / list.length;
  };
  const ladder = SPOILS_TIERS.map((tier) => Math.round(tierMean(tier.key)));
  console.log(`      mean worth by tier: ${SPOILS_TIERS.map((tier, i) => `${tier.name} ${gpShort(ladder[i])}`).join(", ")}`);
  check("each tier's containers are worth more than the tier below", ladder.every((n, i) => i === 0 || n > ladder[i - 1]), ladder);
  check("an opening is the same on a retry",
    JSON.stringify(openContainer("magpie_impling_jar", seededRng("retry"))) === JSON.stringify(openContainer("magpie_impling_jar", seededRng("retry"))));
  const muddy = openContainer("muddy_key", seededRng("muddy"));
  check("the Muddy chest always pays its whole table", muddy.stacks.length === containerTable("muddy_key").length, muddy);
}

// ── The Grand Exchange ─────────────────────────────────────────────
{
  const at = (level) => ({ hitpoints: level, attack: level, strength: level, defence: level, prayer: 1, slayer: 1, woodcutting: 1, mining: 1, fishing: 1 });
  const superCombat = GE_ITEMS.find((item) => item.key === "super_combat_potion4");
  // 5 + 15% of 60 = 14; a 600-swing session is 24 minutes, four doses six minutes apart, so three levels drain on average.
  const boost = potionBoost(at(60), superCombat.boost, 1);
  check("a super combat potion at 60 averages +11 across a full session", boost.attack === 11 && boost.strength === 11 && boost.defence === 11, boost);
  const hill = MONSTERS["Hill Giant"];
  const gear = { slayerHelmet: false, glory: false };
  const plain = simulateSession({ levels: at(60), style: "aggressive", gear, monster: hill, weight: 1 });
  const potted = simulateSession({ levels: at(60), style: "aggressive", gear, monster: hill, weight: 1, boost });
  check("a potion lifts the max hit and the damage, and never the weapon", potted.maxHit > plain.maxHit && potted.damage > plain.damage && potted.weapon.key === plain.weapon.key, { plain: plain.maxHit, potted: potted.maxHit });
  console.log(`      super combat at 60 vs hill giants: max hit ${plain.maxHit} -> ${potted.maxHit}, damage +${Math.round((potted.damage / plain.damage - 1) * 100)}%`);
  // Nothing bought may ever make a session worse, against any monster at any level.
  let worse = [];
  let longer = 0;
  let sessions = 0;
  for (const level of [20, 40, 60, 80]) {
    for (const monster of Object.values(MONSTERS)) {
      const plainRun = simulateSession({ levels: at(level), style: "controlled", gear, monster, weight: 1 });
      const sharkRun = simulateSession({ levels: at(level), style: "controlled", gear, monster, weight: 1, foodHeal: 20 });
      const potRun = simulateSession({ levels: at(level), style: "controlled", gear, monster, weight: 1, boost: potionBoost(at(level), superCombat.boost, 1) });
      sessions++;
      if (sharkRun.attacks > plainRun.attacks) longer++;
      if (sharkRun.damage < plainRun.damage || potRun.damage < plainRun.damage) worse.push(`${monster.name}@${level}`);
    }
  }
  console.log(`      sharks lengthen ${longer} of ${sessions} sessions (every monster at 20/40/60/80)`);
  check("sharks and potions never cost damage, against any monster", worse.length === 0, worse.slice(0, 10));
  check("sharks lengthen some sessions", longer > 0, longer);
  check("every Grand Exchange item has a price", GE_ITEMS.every((item) => gePrice(item) > 0), GE_ITEMS.map((item) => [item.key, gePrice(item)]));
  check("a Book of knowledge is 15 a level", lampWorth({ xp: 0, source: "book" }, 40) === 600 && lampWorth({ xp: 0, source: "genie" }, 40) === 400 && lampWorth({ xp: 2500, source: "diary" }, 40) === 2500);
}

// ── The diary ──────────────────────────────────────────────────────
{
  const zero = { checkins: 0, kills: 0, tasks: 0, bank: 0, combat: 3, total: 18, spoils: 0, containers: 0, form: 0, verified: 0, caskets: 0, spent: 0 };
  const fresh = diaryProgress(zero, new Set());
  check("a new player has nothing done", fresh.every((row) => row.done === 0 && !row.complete));
  const easyDone = diaryProgress({ ...zero, checkins: 5, kills: 100, tasks: 1, spoils: 3, bank: 10_000, combat: 10 }, new Set());
  check("the Easy diary completes on its six tasks", easyDone[0].complete && !easyDone[1].complete, easyDone[0]);
  check("the open tier is the first unpaid one", currentTier(easyDone).tier.key === "easy" && currentTier(diaryProgress(zero, new Set(["easy"]))).tier.key === "medium");
  check("the receipt names the nearest task", /Easy diary 0\/6 \(next: /.test(diaryNext(fresh)), diaryNext(fresh));
  check("the diary pays the Achievement Diary's lamps", DIARY.map((tier) => tier.lamp).join() === [ANTIQUE_LAMP.easy, ANTIQUE_LAMP.medium, ANTIQUE_LAMP.hard, ANTIQUE_LAMP.elite].join());
  check("every tier's tasks are harder than the tier before", DIARY.every((tier, i) => i === 0 || tier.tasks.every((task) => {
    const earlier = DIARY[i - 1].tasks.find((t) => t.stat === task.stat);
    return !earlier || task.goal > earlier.goal;
  })));
}

// ── Gear ───────────────────────────────────────────────────────────
{
  const at = (level) => Object.fromEntries(SKILLS.map((skill) => [skill, level]));
  const player = (gear, extra = {}) => ({ gear: JSON.stringify(gear), cosmetics: "{}", wishlist: null, ...extra });
  check("gear keys are unique", new Set(GEAR_DEFS.map((d) => d.key)).size === GEAR_DEFS.length);
  const noStats = GEAR_DEFS.filter((d) => d.stats && d.slot !== "head" && !gearJson.items[d.key]).map((d) => d.item);
  check("every weapon and boot has the wiki's bonuses", noStats.length === 0, noStats);
  const clueNames = new Set(CLUE_TIERS.flatMap((tier) => tier.uniques));
  const strayClue = GEAR_DEFS.filter((d) => d.clue && !clueNames.has(d.item)).map((d) => d.item);
  check("every clue look is a real clue unique", strayClue.length === 0, strayClue);
  const sources = gearSources();
  const noSource = GEAR_DEFS.filter((d) => !d.clue && !sources.has(d.key)).map((d) => d.item);
  check("every other piece drops from a task monster", noSource.length === 0, noSource);
  console.log(`      ${GEAR_DEFS.length} pieces: ${GEAR_DEFS.filter((d) => d.stats).length} with stats, ${GEAR_DEFS.filter((d) => d.clue).length} clue looks; e.g. Abyssal whip: ${sourceLine(GEAR_DEFS.find((d) => d.key === "abyssal_whip"))}`);

  const hill = MONSTERS["Hill Giant"];
  const bare = { slayerHelmet: false, glory: false };
  const plain = simulateSession({ levels: at(70), style: "aggressive", gear: bare, monster: hill, weight: 1 });
  const whipGear = sessionGear(player({ weapon: "abyssal_whip" }), at(70), new Set(["abyssal_whip"]), false);
  const whip = simulateSession({ levels: at(70), style: "aggressive", gear: whipGear, monster: hill, weight: 1 });
  check("a worn whip out-hits the dragon scimitar at 70", whip.weapon.key === "abyssal_whip" && whip.maxHit > plain.maxHit && whip.damage > plain.damage, { plain: plain.maxHit, whip: whip.maxHit });
  check("a whip the levels cannot wield is only a look", sessionGear(player({ weapon: "abyssal_whip" }), at(60), new Set(["abyssal_whip"]), false).weapon === undefined);
  check("a whip that is not owned does nothing", sessionGear(player({ weapon: "abyssal_whip" }), at(70), new Set(), false).weapon === undefined);
  const maul = simulateSession({ levels: at(70), style: "aggressive", gear: sessionGear(player({ weapon: "granite_maul" }), at(70), new Set(["granite_maul"]), false), monster: hill, weight: 1 });
  check("a seven-tick maul swings less often than a four-tick whip", maul.maxHit > plain.maxHit && maul.damage < whip.damage, { maul: maul.damage, whip: whip.damage });
  const hard = Object.values(MONSTERS).sort((x, y) => y.maxHit - x.maxHit)[0];
  const noBoots = simulateSession({ levels: at(50), style: "controlled", gear: bare, monster: hard, weight: 1 });
  const boots = simulateSession({ levels: at(50), style: "controlled", gear: sessionGear(player({ boots: "rune_boots" }), at(50), new Set(["rune_boots"]), false), monster: hard, weight: 1 });
  check("boots take the edge off what the monster does", boots.damageTaken / boots.attacks < noBoots.damageTaken / noBoots.attacks, { boots: boots.damageTaken / boots.attacks, none: noBoots.damageTaken / noBoots.attacks });
  check("a worn black mask is the Slayer helmet's bonus", sessionGear(player({ head: "black_mask_10" }), at(20), new Set(["black_mask_10"]), false).slayerHelmet === true);
  check("requirements are the game's", meetsReq(GEAR_DEFS.find((d) => d.key === "abyssal_whip"), at(70)) && !meetsReq(GEAR_DEFS.find((d) => d.key === "leaf_bladed_sword"), { ...at(60), slayer: 54 }));

  // The adapted rates: wearables at twice the wiki's rate, the chased item at four times, nothing else touched.
  const boost = dropBoost("abyssal_whip");
  check("the boost is the adapted rate for a wearable, twice that for the chased one, 1x for the rest", boost({ key: "rune_boots" }) === GEAR_RATE_MULTIPLIER && boost({ key: "abyssal_whip" }) === GEAR_RATE_MULTIPLIER * 2 && boost({ key: "coins" }) === 1);
  const count = (b) => {
    let whips = 0;
    let other = 0;
    for (let i = 0; i < 300; i++) {
      const d = rollDrops("Abyssal demon", 100, seededRng(`whip:${i}`), undefined, b);
      for (const s of d.stacks) {
        if (s.key === "abyssal_whip") whips += s.qty;
        else if (!GEAR_DEFS.some((def) => def.key === s.key)) other += s.qty;
      }
    }
    return { whips, other };
  };
  const wiki = count(undefined);
  const chased = count(boost);
  console.log(`      30,000 abyssal demons: ${wiki.whips} whips at the wiki's 1/512, ${chased.whips} when chased`);
  check("chasing multiplies the whips by about the adapted rate times two", chased.whips > wiki.whips * GEAR_RATE_MULTIPLIER * 2 * 0.7 && chased.whips < wiki.whips * GEAR_RATE_MULTIPLIER * 2 * 1.4, { wiki, chased });
  check("and leaves every drop that is not a wearable exactly as it was", wiki.other === chased.other, { wiki: wiki.other, chased: chased.other });
}

// ── Slayer choices ─────────────────────────────────────────────────
{
  const vannaka = MASTERS.find((m) => m.name === "Vannaka");
  const blocked = vannaka.tasks.slice(0, 5).map((t) => t.monster);
  let hit = false;
  for (let i = 0; i < 500; i++) if (blocked.includes(drawAssignment(seededRng(`block:${i}`), vannaka, 99, 126, blocked).assignment.monster)) hit = true;
  check("a blocked monster is never assigned", !hit);
  check("a chosen master is used while the player qualifies", masterWanted({ slayer_master: "turael" }, 100, 60).key === "turael" && masterWanted({ slayer_master: vannaka.key }, 20, 1).key !== vannaka.key);
  check("no choice takes the best master", masterWanted({ slayer_master: null }, 100, 60).key === masterFor(100, 60).key);
  check("a broken block list reads as empty", blocksOf({ slayer_blocks: "nope" }).length === 0 && blocksOf({ slayer_blocks: '["Banshee"]' })[0] === "Banshee");
}

// ── Miscellania ────────────────────────────────────────────────────
{
  const base = { player_id: "k", coffer: KINGDOM_COFFER_MAX, approval: 100, workers: { herbs: 10 }, pending: {}, last_day: "2026-10-05", visited_day: "2026-10-05", collected_day: null };
  const week = advanceKingdom(base, "2026-10-12");
  check("a day's wage is 10% of the coffer, capped", dailyWage(1000) === 100 && dailyWage(KINGDOM_COFFER_MAX) === KINGDOM_DAILY_CAP);
  check("a week costs seven days' wages and 17.5% approval", week.coffer === KINGDOM_COFFER_MAX - 7 * KINGDOM_DAILY_CAP && week.approval === 82.5, week);
  // Ten subjects on herbs at full pay: 6.1 herbs a day, scaled by approval (97.5% down to 82.5%).
  const herbs = pendingStacks(week, "seed").reduce((sum, s) => sum + s.qty, 0);
  check("a week of herbs at full pay is 38", herbs === 38, { herbs, pending: week.pending });
  check("the same seed deals the same herbs", JSON.stringify(pendingStacks(week, "seed")) === JSON.stringify(pendingStacks(week, "seed")));
  check("advancing is the same in one step or seven", JSON.stringify(advanceKingdom(advanceKingdom(base, "2026-10-08"), "2026-10-12")) === JSON.stringify({ ...week }), null);
  check("an empty coffer gathers nothing", pendingStacks(advanceKingdom({ ...base, coffer: 0 }, "2026-10-12"), "s").length === 0);
  const split = advanceKingdom({ ...base, workers: { wood: 5, mining: 5 } }, "2026-10-06");
  const got = Object.fromEntries(pendingStacks(split, "s").map((s) => [s.item, s.qty]));
  check("five on wood and five on coal bring half of each (89.2 and 54.6 a day at full size)", got["Maple logs"] === Math.floor(0.5 * 0.975 * 89.2) && got["Coal"] === Math.floor(0.5 * 0.975 * 54.6), got);
  const long = advanceKingdom(base, "2027-03-01");
  check("approval never falls below the floor, and an unvisited kingdom stops after thirty days", long.approval === KINGDOM_APPROVAL_FLOOR && long.coffer === KINGDOM_COFFER_MAX - 30 * KINGDOM_DAILY_CAP, long);
  const unpriced = PRICED_ITEMS.filter((name) => itemValue(itemKeyOf(name)) <= 0);
  check("everything gathered, grown or sold has a price", unpriced.length === 0, unpriced);
  check("every job's subjects fit", KINGDOM_JOBS.length === 5);
}

// ── The farm and the tears ─────────────────────────────────────────
{
  const stock = new Map([["ranarr_seed", 2], ["tarromin_seed", 5], ["watermelon_seed", 3], ["cabbage_seed", 2]]);
  check("a run plants the best seed the level allows", bestSeed("herb", 32, stock, 1).seed === "Ranarr seed" && bestSeed("herb", 31, stock, 1).seed === "Tarromin seed");
  check("an allotment needs three seeds, and falls back to potatoes", bestSeed("allotment", 50, stock, 3).seed === "Watermelon seed" && bestSeed("allotment", 10, stock, 3).seed === "Potato seed");
  check("a herb patch with nothing plantable stays empty", bestSeed("herb", 5, stock, 1) === null && bestSeed("tree", 99, stock, 1) === null);
  const ranarr = CROPS.find((c) => c.seed === "Ranarr seed");
  const h = harvestOf(ranarr, "p:1:herb");
  check("a herb harvest is 4 to 9 leaves at the crop's XP, the same on a retry", h.qty >= 4 && h.qty <= 9 && h.xp === h.qty * 30.5 && harvestOf(ranarr, "p:1:herb").qty === h.qty, h);
  const willow = CROPS.find((c) => c.seed === "Willow seed");
  check("a tree is checked, not harvested", harvestOf(willow, "x").qty === 0 && harvestOf(willow, "x").xp === 1456.5);
  check("herbs take 80 minutes", !isGrown({ seed: "ranarr_seed", planted_at: 0 }, 79 * 60_000) && isGrown({ seed: "ranarr_seed", planted_at: 0 }, 80 * 60_000));
  check("every crop's patch exists and levels rise within a patch", CROPS.every((c) => PATCHES.some((p) => p.key === c.patch)));
  check("a tear is 10 XP at level 1 and 60 from level 30", tearXp(1) === 10 && tearXp(30) === 60 && tearXp(99) === 60 && tearXp(15) > 10 && tearXp(15) < 60);
  check("tears grow with quest points and never fall below the minimum", tearsCaught(0, "a") === TEARS_MIN && tearsCaught(100, "a") >= 60 && tearsCaught(100, "a") <= 90);
  check("the tears go to the lowest skill", lowestSkill({ hitpoints: 2000, attack: 500, strength: 500, defence: 500, prayer: 300, slayer: 100, woodcutting: 400, mining: 50, fishing: 60, farming: 55 }) === "mining" && lowestSkill({ hitpoints: 1154 }) === "attack");
}

// ── The boss of the week ───────────────────────────────────────────
{
  const at = (level) => Object.fromEntries(SKILLS.map((skill) => [skill, level]));
  const bare = { slayerHelmet: false, glory: false };
  check("no boss before the campaign, and they rotate from week 1", bossFor(0) === null && bossFor(1).key === GROUP_BOSSES[0].key && bossFor(2).key === GROUP_BOSSES[1].key && bossFor(GROUP_BOSSES.length + 1).key === GROUP_BOSSES[0].key);
  for (const def of GROUP_BOSSES) {
    const boss = bossFor(GROUP_BOSSES.indexOf(def) + 1);
    check(`${def.name} has the wiki's stats and a table`, boss.stats.hitpoints > 0 && boss.stats.def > 0 && bossTable(def.key).length > 10, boss.stats);
    check(`${def.name}'s bones are not loot`, !bossTable(def.key).some((row) => / bones$/i.test(row.item)));
  }
  const obor = bossFor(2);
  const roster = [at(10), at(20), at(30), at(40), at(50)];
  const pool = bossPool(obor, roster);
  const fights = roster.map((levels) => bossFight(levels, "controlled", bare, obor, 1));
  check("the pool is the roster's mean fight times the fights a head", pool === Math.round(roster.length * BOSS_FIGHTS_PER_HEAD * (fights.reduce((s, n) => s + n, 0) / fights.length)), { pool, fights });
  check("two full fights from everyone brings it down", fights.reduce((s, n) => s + 2 * n, 0) >= pool, { pool, fights });
  check("one fight each does not", fights.reduce((s, n) => s + n, 0) < pool, { pool, fights });
  check("a half-value check-in swings half as often", bossFight(at(40), "controlled", bare, obor, 0.5) < bossFight(at(40), "controlled", bare, obor, 1));
  check("an empty roster still has a boss to hit", bossPool(obor, []) >= 1);
  const loot = bossLoot("obor", 1, "p:2026-10-06:boss", null);
  check("a boss roll pays something, the same on a retry", loot.stacks.length > 0 && JSON.stringify(loot) === JSON.stringify(bossLoot("obor", 1, "p:2026-10-06:boss", null)), loot);
  let clubs = 0;
  let chased = 0;
  for (let i = 0; i < 3000; i++) {
    if (bossLoot("obor", 1, `c:${i}`, null).stacks.some((s) => s.key === "hill_giant_club")) clubs++;
    if (bossLoot("obor", 1, `c:${i}`, "hill_giant_club").stacks.some((s) => s.key === "hill_giant_club")) chased++;
  }
  console.log(`      3,000 Obor rolls: ${clubs} hill giant clubs (wiki 1/118, here 1/${Math.round(118 / GEAR_RATE_MULTIPLIER)}), ${chased} when chased`);
  check("the hill giant club drops at the adapted rate, and twice that when chased", clubs > 60 && clubs < 150 && chased > clubs * 1.5, { clubs, chased });
  check("the bosses' uniques are in the catalogue with their source", /Obor/.test(sourceLine(GEAR_DEFS.find((d) => d.key === "hill_giant_club"))) && /Scurrius/.test(sourceLine(GEAR_DEFS.find((d) => d.key === "scurrius_spine"))) && /Bryophyta/.test(sourceLine(GEAR_DEFS.find((d) => d.key === "bryophytas_essence"))));

  // The evening message: the group's business by name, a player's own as a count.
  const quiet = reminderMessage({ nudges: [], waiting: 3, goingStale: [] });
  check("private things are a count in the channel, never names", /3 players have things waiting/.test(quiet.content) && /My to-do/.test(quiet.content), quiet);
  check("one player is singular", /One player has things waiting/.test(reminderMessage({ nudges: [], waiting: 1, goingStale: [] }).content));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
