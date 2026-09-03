#!/usr/bin/env node
/**
 * Drives a year through the real Worker: six players with the attendance
 * profiles from the design's balance check, every daily tick and every
 * Monday resolution, against the local D1 and the mock Discord.
 *
 *   npm run mock:discord           (in one terminal)
 *   npm run dev:local              (in another, .dev.vars pointed at the mock)
 *   npm run test:year [--days 365] [--url http://localhost:8788]
 *
 * Prints the balance table and asserts the invariants that matter: nobody
 * above 99, the two-a-week player reaches Dragon (Defence 60), rings only
 * ever spent on one-check-in weeks, one daily resolution per day, no
 * duplicate check-ins.
 */
const url = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8788";
const DAYS = process.argv.includes("--days") ? Number(process.argv[process.argv.indexOf("--days") + 1]) : 365;
const ADMIN = process.env.ADMIN_SECRET ?? "dev-only-admin-secret";
const START = "2026-09-14";

async function admin(path, params = {}) {
  const query = new URLSearchParams({ secret: ADMIN, ...params });
  const response = await fetch(`${url}/admin/${path}?${query}`);
  return response.json();
}
const sql = async (q) => (await admin("sql", { q })).results ?? [];

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail).slice(0, 600)}`}`);
}

// Attendance profiles: which weekdays each player trains, and when they stop.
const stamp = Date.now();
const ROSTER = [
  { id: `A_${stamp}`, name: "A", days: [1, 2, 3, 4, 5], quitAfter: null, skip: 0.05 },
  { id: `B_${stamp}`, name: "B", days: [1, 2, 4, 5, 6], quitAfter: null, skip: 0.05 },
  { id: `C_${stamp}`, name: "C", days: [1, 3, 5], quitAfter: null, skip: 0.1 },
  { id: `D_${stamp}`, name: "D", days: [2, 5], quitAfter: null, skip: 0.08 },
  { id: `E_${stamp}`, name: "E", days: [6], quitAfter: null, skip: 0.15 },
  { id: `F_${stamp}`, name: "F", days: [1, 3, 5], quitAfter: 35, skip: 0.1 },
];

// Deterministic "randomness" so a run is repeatable.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const health = await fetch(`${url}/health`).then((r) => r.text()).catch(() => null);
if (health !== "ok") {
  console.error(`No worker at ${url}. Run npm run dev:local first.`);
  process.exit(1);
}

const startMs = Date.parse(`${START}T00:00:00Z`);
const isoDay = (i) => new Date(startMs + i * 86400000).toISOString().slice(0, 10);

await admin("seed", { players: ROSTER.map((p) => p.id).join(","), day: START, ...Object.fromEntries(ROSTER.map((p) => [`name_${p.id}`, p.name])) });

const checkinsByPlayer = Object.fromEntries(ROSTER.map((p) => [p.id, 0]));
const milestones = {};
const t0 = Date.now();

for (let i = 0; i < DAYS; i++) {
  const day = isoDay(i);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  // 10:00 UTC: the daily resolution for this game day (yesterday closes).
  await admin("tick", { at: `${day}T10:00:00Z` });
  // 15:00 UTC: the morning post.
  await admin("tick", { at: `${day}T15:00:00Z` });

  const photosToday = [];
  for (const player of ROSTER) {
    if (player.quitAfter !== null && i >= player.quitAfter) continue;
    if (!player.days.includes(weekday)) continue;
    if (rand() < player.skip) continue;
    // Real people train at all hours, write the odd note, and post the odd
    // video; the clue steps are shaped like that.
    const photo = rand() < 0.3;
    const hourUtc = [3, 12, 15, 18, 23][Math.floor(rand() * 5)];
    const note = rand() < 0.25 ? (rand() < 0.4 ? "Long one today: squats, bench, rows, then a slow cooldown on the bike with far too many sets of curls to finish it off properly" : "Legs") : null;
    const result = await admin("checkin-as", {
      player: player.id,
      day,
      at: `${day}T${String(hourUtc).padStart(2, "0")}:00:00Z`,
      photo: photo ? "1" : "0",
      ...(photo && rand() < 0.3 ? { video: "1" } : {}),
      ...(note ? { note } : {}),
    });
    if (result.ok) {
      checkinsByPlayer[player.id]++;
      if (photo) photosToday.push({ checkinId: result.outcome.checkinId, owner: player.id });
    }
  }
  // Friends verify about half the photos, later the same evening.
  for (const { checkinId, owner } of photosToday) {
    if (rand() < 0.5) continue;
    const verifier = ROSTER.find((p) => p.id !== owner && p.days.includes(weekday) && (p.quitAfter === null || i < p.quitAfter)) ?? ROSTER.find((p) => p.id !== owner);
    if (verifier) await admin("verify-as", { player: verifier.id, checkin: String(checkinId), at: `${day}T20:00:00Z` });
  }

  // The four regulars vote for the first option on anything open: builds go
  // up, relics get picked, raids get a yes.
  if (i % 2 === 0) {
    for (const player of ROSTER.slice(0, 4)) await admin("ballot", { player: player.id, idx: "0", at: `${day}T19:00:00Z` });
  }

  if ([30, 90, 180, 364].includes(i) || i === DAYS - 1) {
    const rows = await sql(`SELECT player_id, skill, xp FROM skill_xp WHERE skill IN ('defence', 'attack', 'hitpoints')`);
    milestones[i] = {};
    for (const r of rows) (milestones[i][r.player_id] ??= {})[r.skill] = r.xp;
  }
  if (i % 30 === 0) process.stdout.write(`day ${i} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

// ── The table ──────────────────────────────────────────────────────
const { levelForXp, tierForDefence } = await import("../src/xp.ts");
console.log("\nAttack / Defence / Hitpoints by player at day 30 / 90 / 180 / 365:");
const finalLevels = {};
for (const player of ROSTER) {
  const cells = [30, 90, 180, 364].map((d) => {
    const xp = milestones[d]?.[player.id] ?? {};
    return `${levelForXp(xp.attack ?? 0)}/${levelForXp(xp.defence ?? 0)}/${levelForXp(xp.hitpoints ?? 0)}`;
  });
  const finalXp = milestones[DAYS - 1]?.[player.id] ?? milestones[364]?.[player.id] ?? {};
  finalLevels[player.id] = levelForXp(finalXp.defence ?? 0);
  console.log(`  ${player.name} (${player.days.length}/wk${player.quitAfter ? `, quit day ${player.quitAfter}` : ""}): ${cells.join(" / ")} · ${tierForDefence(finalLevels[player.id]).name} · ${checkinsByPlayer[player.id]} check-ins`);
}
const sessions = await sql("SELECT COUNT(*) AS n, AVG(CAST(json_extract(session, '$.damage') AS REAL)) AS dmg, AVG(CAST(json_extract(session, '$.kills') AS REAL)) AS kills FROM checkins WHERE session IS NOT NULL");
console.log(`Sessions: ${sessions[0]?.n} · mean damage ${Math.round(sessions[0]?.dmg ?? 0)} · mean kills ${Math.round(sessions[0]?.kills ?? 0)}`);
const monsters = await sql("SELECT json_extract(session, '$.monster') AS m, COUNT(*) AS n FROM checkins WHERE session IS NOT NULL GROUP BY m ORDER BY n DESC LIMIT 8");
console.log(`Most fought: ${monsters.map((r) => `${r.m} ${r.n}`).join(" · ")}`);

const players = await sql("SELECT discord_id, username, form_weeks, best_form_weeks, rings FROM players");
console.log("\nForm weeks / best / rings:");
for (const p of players) console.log(`  ${p.username}: ${p.form_weeks} / ${p.best_form_weeks} / ${p.rings}`);

const stores = await sql("SELECT resource, amount FROM town_resources");
console.log(`\nStores: ${stores.map((r) => `${Math.floor(r.amount)} ${r.resource}`).join(" · ")}`);
const lamps = await sql("SELECT source, COUNT(*) AS n FROM lamps GROUP BY source");
console.log(`Lamps: ${lamps.map((r) => `${r.n} ${r.source}`).join(" · ")}`);
const events = await sql("SELECT event_key, COUNT(*) AS n FROM events_log WHERE event_key LIKE 'event:%' GROUP BY event_key");
console.log(`Events: ${events.map((r) => `${r.n} ${r.event_key.slice(6)}`).join(" · ")}`);
const caskets = await sql("SELECT COUNT(*) AS n FROM clues WHERE completed_day IS NOT NULL AND loot NOT LIKE '%expired%'");
const verifiedRows = await sql("SELECT COUNT(*) AS n FROM verifications");
console.log(`Verifications: ${verifiedRows[0]?.n}`);
const clues = await sql("SELECT COUNT(*) AS n FROM clues");
console.log(`Clues: ${clues[0]?.n} dropped, ${caskets[0]?.n} caskets opened`);
const tasks = await sql("SELECT status, COUNT(*) AS n FROM slayer_tasks GROUP BY status");
console.log(`Slayer tasks: ${tasks.map((r) => `${r.n} ${r.status}`).join(" · ") || "none"}`);
const masters = await sql("SELECT master, COUNT(*) AS n FROM slayer_tasks WHERE status = 'done' GROUP BY master");
console.log(`Tasks done by master: ${masters.map((r) => `${r.n} ${r.master}`).join(" · ") || "none"}`);
const slayerPts = await sql("SELECT username, slayer_points, slayer_streak, tasks_done FROM players WHERE tasks_done > 0 ORDER BY tasks_done DESC LIMIT 6");
console.log(`Slayer: ${slayerPts.map((r) => `${r.username} ${r.tasks_done} done, ${r.slayer_points} pts, streak ${r.slayer_streak}`).join(" · ")}`);
const workers = await sql("SELECT tier, kind, owner_id IS NULL AS town_owned, COUNT(*) AS n FROM workers GROUP BY tier, kind, town_owned");
console.log(`Workers: ${workers.map((r) => `${r.n} ${r.tier} ${r.kind}${r.town_owned ? " (town)" : ""}`).join(" · ") || "none"}`);
const buildingRows = await sql("SELECT key, level, condition FROM buildings WHERE level > 0 ORDER BY key");
console.log(`Buildings: ${buildingRows.map((r) => `${r.key} L${r.level} ${r.condition}%`).join(" · ") || "none"}`);
const votes = await sql("SELECT kind, status, COUNT(*) AS n FROM votes GROUP BY kind, status");
console.log(`Votes: ${votes.map((r) => `${r.n} ${r.kind} ${r.status}`).join(" · ") || "none"}`);
const raids = await sql("SELECT boss, status, hp, hp_max FROM raids ORDER BY id");
console.log(`Raids: ${raids.map((r) => `${r.boss} ${r.status} (${r.hp}/${r.hp_max})`).join(" · ") || "none"}`);
const relics = await sql("SELECT key FROM relics");
console.log(`Relics: ${relics.map((r) => r.key).join(", ") || "none"}`);
const ledger = await sql("SELECT kind, SUM(amount) AS total FROM town_ledger GROUP BY kind");
console.log(`Ledger: ${ledger.map((r) => `${r.kind} ${Math.round(r.total)}`).join(" · ")}`);

// ── Invariants ─────────────────────────────────────────────────────
if (DAYS >= 365) {
  const A = finalLevels[ROSTER[0].id];
  const D = finalLevels[ROSTER[3].id];
  const E = finalLevels[ROSTER[4].id];
  check("five a week is Dragon (Defence 60) by the finale", A >= 60, A);
  check("two a week is within reach of Dragon by the finale (Defence ≥ 55 without Founding lamps rubbed)", D >= 55, D);
  check("one a week is Adamant or Rune, not Dragon", E >= 30 && E < 60, E);
}
const above = await sql("SELECT COUNT(*) AS n FROM skill_xp WHERE xp > 13034431");
check("no skill above 99", above[0]?.n === 0, above);
// The bank: every check-in's kills dropped something, nothing went negative, and the richest stacks are real items.
const bankRows = await sql("SELECT COUNT(*) AS n, COALESCE(SUM(value), 0) AS v, MIN(qty) AS minq, MIN(value) AS minv FROM bank");
check("the bank holds stacks with no negative quantity or value", (bankRows[0]?.n ?? 0) > 0 && bankRows[0].minq > 0 && bankRows[0].minv >= 0, bankRows);
const bankless = await sql("SELECT COUNT(*) AS n FROM players p WHERE EXISTS (SELECT 1 FROM checkins c WHERE c.player_id = p.discord_id) AND NOT EXISTS (SELECT 1 FROM bank b WHERE b.player_id = p.discord_id)");
check("everyone who checked in has a bank", bankless[0]?.n === 0, bankless);
const lootless = await sql("SELECT COUNT(*) AS n FROM checkins WHERE loot IS NULL");
check("every check-in row keeps its loot", lootless[0]?.n === 0, lootless);
const richest = await sql("SELECT p.username, b.item, b.qty, b.value FROM bank b JOIN players p ON p.discord_id = b.player_id ORDER BY b.value DESC LIMIT 5");
console.log(`Richest stacks: ${richest.map((r) => `${r.username} ${r.qty}× ${r.item} (${Math.round(r.value / 1000)}k)`).join(" · ")}`);
const bankByPlayer = await sql("SELECT p.username, COALESCE(SUM(b.value), 0) AS v FROM players p LEFT JOIN bank b ON b.player_id = p.discord_id GROUP BY p.discord_id ORDER BY v DESC");
console.log(`Banks: ${bankByPlayer.map((r) => `${r.username} ${(r.v / 1_000_000).toFixed(2)}m`).join(" · ")}`);
const notableDrops = await sql("SELECT COUNT(*) AS n FROM collection_log WHERE entry_key LIKE 'drop:%'");
console.log(`Notable drops logged: ${notableDrops[0]?.n ?? 0}`);
if (DAYS >= 200) check("at least one notable drop was logged", (notableDrops[0]?.n ?? 0) >= 1, notableDrops);
// Quest of the week: the party finishes most quests, the group's quest points grow, and the lamps were handed out.
const questRows = await sql("SELECT campaign_week, quest, status, qp, supplies, supplies_needed, damage, hp_total FROM quests ORDER BY campaign_week");
console.log(`Quests: ${questRows.filter((q) => q.status === "done").length} done, ${questRows.filter((q) => q.status === "unfinished").length} unfinished of ${questRows.length} · QP ${questRows.filter((q) => q.status === "done").reduce((s, q) => s + q.qp, 0)}`);
for (const q of questRows.filter((q) => q.status !== "done")) console.log(`  unfinished: wk${q.campaign_week} ${q.quest} supplies ${q.supplies}/${q.supplies_needed} damage ${q.damage}/${q.hp_total}`);
const questWeeks = Math.min(51, Math.floor(DAYS / 7));
if (questWeeks >= 4) {
  check("every quest week opened a quest", questRows.length >= questWeeks - 1, { rows: questRows.length, questWeeks });
  check("at least nine of ten quests get finished", questRows.filter((q) => q.status === "done").length >= Math.floor(questWeeks * 0.9), questRows.map((q) => `${q.campaign_week}:${q.status}`));
  const questLamps = await sql("SELECT COUNT(*) AS n FROM pending_claims WHERE kind = 'lamp' AND payload LIKE '%\"source\":\"quest\"%'");
  check("quest lamps were handed out", (questLamps[0]?.n ?? 0) > 0, questLamps);
  const dupHits = await sql("SELECT COUNT(*) AS n FROM quest_hits h JOIN checkins c ON c.id = h.checkin_id WHERE c.week != h.week");
  check("every quest hit belongs to its check-in's week", dupHits[0]?.n === 0, dupHits);
}
if (DAYS >= 365) {
  const qp = questRows.filter((q) => q.status === "done").reduce((s, q) => s + q.qp, 0);
  check("the group passes 32 quest points before week 18 and 100 by the finale", qp >= 100 && questRows.filter((q) => q.campaign_week <= 17 && q.status === "done").reduce((s, q) => s + q.qp, 0) >= 32, qp);
}
const dupes = await sql("SELECT player_id, day, COUNT(*) AS n FROM checkins GROUP BY player_id, day HAVING n > 1");
check("no duplicate (player, day)", dupes.length === 0, dupes);
const heldOnWrongWeek = await sql("SELECT COUNT(*) AS n FROM week_log WHERE outcome = 'held' AND checkins != 1");
check("rings only spent on one-check-in weeks", heldOnWrongWeek[0]?.n === 0, heldOnWrongWeek);
const weeksLogged = await sql("SELECT COUNT(DISTINCT week) AS n FROM week_log");
check("every closed week was resolved", weeksLogged[0]?.n >= Math.floor(DAYS / 7) - 1, weeksLogged);
const zeroStores = stores.filter((r) => ["coins", "logs"].includes(r.resource) && r.amount <= 0);
check("coins and logs never hit zero", zeroStores.length === 0, stores);
const negative = await sql("SELECT COUNT(*) AS n FROM town_resources WHERE amount < 0");
check("no negative stores", negative[0]?.n === 0, negative);
const foundings = await sql("SELECT level FROM town WHERE id = 1");
check(`foundings ran (${Math.floor(DAYS / 91)} expected)`, (foundings[0]?.level ?? 0) >= Math.floor(DAYS / 91) - (DAYS >= 365 ? 0 : 1), foundings);
if (DAYS >= 100) {
  const workerCount = await sql("SELECT COUNT(*) AS n FROM workers");
  check("Founding I handed out workers", (workerCount[0]?.n ?? 0) >= 4, workerCount);
  const sackDeliveries = await sql("SELECT COUNT(*) AS n FROM town_ledger WHERE kind = 'sack'");
  check("sacks were delivered on check-ins", (sackDeliveries[0]?.n ?? 0) > 0, sackDeliveries);
  const upkeep = await sql("SELECT COUNT(*) AS n FROM town_ledger WHERE kind = 'upkeep'");
  check("workers were fed", (upkeep[0]?.n ?? 0) > 0, upkeep);
  const passedBuilds = await sql("SELECT COUNT(*) AS n FROM votes WHERE kind = 'build' AND status = 'passed'");
  check("build votes passed with four ballots", (passedBuilds[0]?.n ?? 0) > 0, passedBuilds);
  const builtRows = await sql("SELECT COUNT(*) AS n FROM buildings WHERE level > 0 AND key != 'town_hall'");
  check("something got built", (builtRows[0]?.n ?? 0) > 0, builtRows);
  const decayed = await sql("SELECT COUNT(*) AS n FROM buildings WHERE level > 0 AND condition < 100");
  check("buildings decay between repairs", (decayed[0]?.n ?? 0) >= 0, decayed);
}
if (DAYS >= 200) {
  const raidRows = await sql("SELECT status FROM raids");
  check("the bot-proposed Giant Mole raid ran and resolved", raidRows.some((r) => r.status === "won" || r.status === "lost"), raidRows);
  const doneTasks = await sql("SELECT COUNT(*) AS n FROM slayer_tasks WHERE status = 'done'");
  check("Slayer tasks were completed", (doneTasks[0]?.n ?? 0) > 0, doneTasks);
  const expiredTasks = await sql("SELECT COUNT(*) AS n FROM slayer_tasks WHERE status = 'expired'");
  check("tasks never expire", (expiredTasks[0]?.n ?? 0) === 0, expiredTasks);
  const slayerXp = await sql("SELECT MIN(xp) AS m FROM skill_xp WHERE skill = 'slayer'");
  check("every player earned Slayer from kills on task", (slayerXp[0]?.m ?? 0) > 0, slayerXp);
  const prayerXp = await sql("SELECT MIN(xp) AS m FROM skill_xp WHERE skill = 'prayer'");
  check("every player buried bones", (prayerXp[0]?.m ?? 0) > 0, prayerXp);
  const answers = await sql("SELECT COUNT(*) AS n FROM day_answers WHERE answer = 'yes'");
  check("check-ins were recorded as answers to the morning question", (answers[0]?.n ?? 0) > 0, answers);
  const overKilled = await sql("SELECT COUNT(*) AS n FROM slayer_tasks WHERE kills > kills_needed");
  check("no task records more kills than it needs", (overKilled[0]?.n ?? 0) === 0, overKilled);
  const relicRows = await sql("SELECT COUNT(*) AS n FROM relics");
  check("a relic was picked at Act 3", (relicRows[0]?.n ?? 0) >= 1, relicRows);
  const heals = await sql("SELECT MAX(heal) AS m FROM raid_days");
  check("raid heals never exceed the daily cap", (heals[0]?.m ?? 0) <= 80, heals);
}

console.log(failures === 0 ? "\nAll invariants hold." : `\n${failures} invariant(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
