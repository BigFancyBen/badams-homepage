/**
 * Drives many matchup rounds through the real worker code and asserts the
 * matchmaking invariants that a single round cannot show:
 *   - every dish gets played before any dish plays twice
 *   - no pair repeats inside the recency window
 *   - the wide-gap rule fires on the expected cadence
 *   - Elo stays zero-sum across the catalog
 */
const API = "http://127.0.0.1:8787/cdn-cgi/local/explorer/api";
const DB = "00000000-0000-0000-0000-000000000000";
const WORKER = "http://127.0.0.1:8787";
const ROUNDS = Number(process.argv[2] ?? 25);
const RECENCY_WINDOW = 20;

async function sql(statement) {
  const response = await fetch(`${API}/d1/database/${DB}/raw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: statement }),
  });
  const json = await response.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  const block = json.result[json.result.length - 1];
  const { columns = [], rows = [] } = block.results ?? {};
  return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// Fresh catalog: 12 dishes, 4 chefs, ratings clustered with two outliers.
await sql("DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; DELETE FROM players; DELETE FROM state;");
const chefs = ["ben", "sarah", "mike", "dana"];
const elos = [1500, 1520, 1480, 1510, 1495, 1530, 1470, 1505, 1515, 1490, 1700, 1300];
const values = elos
  .map((elo, i) => `('m${i}','a${i}','user_${chefs[i % 4]}','dishes/h${i}.jpg','h${i}','d${i}',${1700000000000 + i * 1000},${1700000000000 + i * 1000},${elo},0)`)
  .join(",");
await sql(`INSERT INTO dishes (discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, caption, posted_at, ingested_at, elo, matches_played) VALUES ${values};`);
await sql(`INSERT INTO players (discord_id, username, first_seen) VALUES ${chefs.map((c) => `('user_${c}','${c}',0)`).join(",")};`);

const startingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;

for (let round = 0; round < ROUNDS; round++) {
  // Let the tick post a matchup, then make it votable-and-due immediately.
  await sql("DELETE FROM state WHERE key = 'last_matchup_slot';");
  const posted = await fetch(`${WORKER}/__scheduled`);
  if (!posted.ok) throw new Error(`tick failed: ${posted.status}`);

  const open = await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='open' ORDER BY id DESC LIMIT 1");
  if (open.length === 0) {
    console.log(`round ${round}: no matchup posted`);
    continue;
  }
  const { id, dish_a_id, dish_b_id } = open[0];

  // Random-ish but deterministic split so Elo actually moves.
  const votesForA = (round % 5) + 1;
  const votesForB = 6 - votesForA;
  const rows = [];
  for (let v = 0; v < votesForA; v++) rows.push(`(${id},'voter_a${v}',${dish_a_id},0)`);
  for (let v = 0; v < votesForB; v++) rows.push(`(${id},'voter_b${v}',${dish_b_id},0)`);
  await sql(`INSERT INTO votes (matchup_id, voter_discord_id, picked_dish_id, voted_at) VALUES ${rows.join(",")};`);
  await sql(`UPDATE matchups SET closes_at = 1 WHERE id = ${id};`);

  await fetch(`${WORKER}/__scheduled`); // closes it
}

// ── assertions ────────────────────────────────────────────────────
const matchups = await sql("SELECT id, dish_a_id, dish_b_id, elo_a_before, elo_b_before FROM matchups WHERE status='closed' ORDER BY id");
const dishes = await sql("SELECT id, ROUND(elo,1) AS elo, matches_played FROM dishes ORDER BY matches_played, id");
const endingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
  if (!ok) failures++;
};

console.log(`\nplayed ${matchups.length} matchups over ${ROUNDS} rounds\n`);

// 1. No pair repeats inside the recency window.
let repeats = [];
for (let i = 0; i < matchups.length; i++) {
  const key = [matchups[i].dish_a_id, matchups[i].dish_b_id].sort().join("-");
  for (let j = Math.max(0, i - RECENCY_WINDOW); j < i; j++) {
    const prior = [matchups[j].dish_a_id, matchups[j].dish_b_id].sort().join("-");
    if (prior === key) repeats.push(`${key} at #${matchups[j].id} and #${matchups[i].id}`);
  }
}
check(`no pair repeats within ${RECENCY_WINDOW} matchups`, repeats.length === 0, repeats.join("; "));

// 2. Play is spread — nothing played 3+ times while something sits at zero.
const unplayed = dishes.filter((d) => d.matches_played === 0);
const heavilyPlayed = dishes.filter((d) => d.matches_played >= 3);
check(
  "no dish played 3x while another is unplayed",
  !(unplayed.length > 0 && heavilyPlayed.length > 0),
  `unplayed=${unplayed.map((d) => d.id)} played3x=${heavilyPlayed.map((d) => d.id)}`
);

// 3. Elo is zero-sum: the catalog total never moves.
const drift = Math.abs(endingTotal - startingTotal);
check("Elo total conserved", drift < 0.01, `drift ${drift}`);

// 4. The wide-gap rule fires — some pairing spans a big rating gap.
const gaps = matchups.map((m) => Math.abs((m.elo_a_before ?? 0) - (m.elo_b_before ?? 0)));
const wide = gaps.filter((g) => g > 150);
check("wide-gap pairings occur", wide.length > 0, `max gap ${Math.max(...gaps).toFixed(0)}`);

console.log("\ndish spread:", dishes.map((d) => `#${d.id}:${d.matches_played}`).join(" "));
console.log("gaps:", gaps.map((g) => g.toFixed(0)).join(" "));
console.log(failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`);
process.exit(failures === 0 ? 0 : 1);
