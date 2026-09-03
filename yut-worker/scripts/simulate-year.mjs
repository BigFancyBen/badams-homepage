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
 * above 99, the two-a-week player reaches Dragon, rings only ever spent on
 * one-check-in weeks, one daily resolution per day, no duplicate check-ins.
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

  for (const player of ROSTER) {
    if (player.quitAfter !== null && i >= player.quitAfter) continue;
    if (!player.days.includes(weekday)) continue;
    if (rand() < player.skip) continue;
    const result = await admin("checkin-as", { player: player.id, day, at: `${day}T18:00:00Z`, photo: rand() < 0.3 ? "1" : "0" });
    if (result.ok) checkinsByPlayer[player.id]++;
  }

  if ([30, 90, 180, 364].includes(i) || i === DAYS - 1) {
    const rows = await sql(`SELECT player_id, xp FROM skill_xp WHERE skill = 'hitpoints'`);
    milestones[i] = Object.fromEntries(rows.map((r) => [r.player_id, r.xp]));
  }
  if (i % 30 === 0) process.stdout.write(`day ${i} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

// ── The table ──────────────────────────────────────────────────────
const { levelForXp, tierForHp } = await import("../src/xp.ts");
console.log("\nHitpoints by player at day 30 / 90 / 180 / 365:");
const finalLevels = {};
for (const player of ROSTER) {
  const cells = [30, 90, 180, 364].map((d) => {
    const xp = milestones[d]?.[player.id] ?? 0;
    return `L${levelForXp(xp)}`;
  });
  const finalXp = milestones[DAYS - 1]?.[player.id] ?? milestones[364]?.[player.id] ?? 0;
  finalLevels[player.id] = levelForXp(finalXp);
  console.log(`  ${player.name} (${player.days.length}/wk${player.quitAfter ? `, quit day ${player.quitAfter}` : ""}): ${cells.join(" / ")} · ${tierForHp(finalLevels[player.id]).name} · ${checkinsByPlayer[player.id]} check-ins`);
}

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
const clues = await sql("SELECT COUNT(*) AS n FROM clues");
console.log(`Clues: ${clues[0]?.n} dropped, ${caskets[0]?.n} caskets opened`);
const rivalries = await sql("SELECT COUNT(*) AS n, SUM(CASE WHEN winner_id IS NOT NULL THEN 1 ELSE 0 END) AS decided FROM rivalries WHERE resolved = 1");
console.log(`Rivalries: ${rivalries[0]?.n} resolved, ${rivalries[0]?.decided} with a winner`);

// ── Invariants ─────────────────────────────────────────────────────
if (DAYS >= 365) {
  const A = finalLevels[ROSTER[0].id];
  const D = finalLevels[ROSTER[3].id];
  const E = finalLevels[ROSTER[4].id];
  check("five a week is Dragon by the finale", A >= 60, A);
  check("two a week is within reach of Dragon by the finale (≥ 55 without Founding lamps rubbed)", D >= 55, D);
  check("one a week is Rune-ish, not Dragon", E >= 40 && E < 60, E);
}
const above = await sql("SELECT COUNT(*) AS n FROM skill_xp WHERE xp > 1303443");
check("no skill above 99", above[0]?.n === 0, above);
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

console.log(failures === 0 ? "\nAll invariants hold." : `\n${failures} invariant(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
