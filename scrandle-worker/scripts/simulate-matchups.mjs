/**
 * Drives many matchup rounds through the real worker code and asserts the
 * matchmaking invariants that a single round cannot show:
 *   - the draw is a rotation: nothing plays again while something has played
 *     less
 *   - no pair repeats inside the recency window
 *   - the wide-gap rule fires on the expected cadence
 *   - Elo stays zero-sum across the catalog
 *
 * Two catalogs, because one cannot show both halves of that. A small catalog
 * where everything is in play exercises pair recency and the deliberate
 * mismatch. A large one with a backlog and a handful of veterans exercises the
 * rotation — and is the shape the real channel is in, hundreds of photographs
 * deep with a few that have been on the board repeatedly.
 */
const API = "http://127.0.0.1:8787/cdn-cgi/local/explorer/api";
const DB = "00000000-0000-0000-0000-000000000000";
const WORKER = "http://127.0.0.1:8787";
const ROUNDS = Number(process.argv[2] ?? 25);
// From .dev.vars — see the local testing section of the README.
const SECRET = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";
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

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
  if (!ok) failures++;
};

/**
 * `dishes` is a list of `{ chef, elo, played }`. Categories matter:
 * matchmaking only ever draws food and drink, so a seed without them leaves
 * every query empty and the whole suite passes vacuously. One category
 * throughout, because an opponent has to match the primary's.
 *
 * `played` seeds matches_played directly and leaves first_matchup_id null.
 * Nothing in the draw reads that column — the rotation keys off the count —
 * and inventing matchup ids for history that was never played would be a
 * bigger lie than the null.
 */
async function seed(dishes) {
  await sql("DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; DELETE FROM players; DELETE FROM state;");
  const chefs = [...new Set(dishes.map((d) => d.chef))];
  const values = dishes
    .map((d, i) => `('m${i}','a${i}','user_${d.chef}','dishes/h${i}.jpg','h${i}','d${i}',${1700000000000 + i * 1000},${1700000000000 + i * 1000},${d.elo},${d.played},'food')`)
    .join(",");
  await sql(`INSERT INTO dishes (discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, caption, posted_at, ingested_at, elo, matches_played, category) VALUES ${values};`);
  await sql(`INSERT INTO players (discord_id, username, first_seen) VALUES ${chefs.map((c) => `('user_${c}','${c}',0)`).join(",")};`);
}

async function playRounds(rounds) {
  for (let round = 0; round < rounds; round++) {
    // Force the post rather than running the cron: the scheduled path only
    // fires on a named hour, so a cron-driven simulation posts nothing at all
    // unless it happens to be run at 15:00 or 03:00 UTC. The posting schedule
    // has its own suite (test:schedule); what this one is about is the draw.
    const posted = await fetch(
      `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}`
    );
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

    // Close it the same way, and for the same reason: the cron tick is gated
    // on the clock, this is not.
    const closed = await fetch(
      `${WORKER}/admin/close-matchup?secret=${encodeURIComponent(SECRET)}`
    );
    if (!closed.ok) throw new Error(`close failed: ${closed.status}`);
  }
}

/**
 * Replays the matchups in order against the play counts as they stood at the
 * time, which is the only way to see the rotation — the final counts cannot
 * tell you whether a dish was drawn while something rarer was sitting there.
 *
 * One above the floor is legal. The draw prefers the least-played rather than
 * requiring it, so it spills into the next count on its own when the poster
 * and pair-recency rules rule out everything on the floor.
 */
function rotationViolations(matchups, startingCounts) {
  const counts = new Map(startingCounts);
  const violations = [];
  for (const m of matchups) {
    const floor = Math.min(...counts.values());
    for (const id of [m.dish_a_id, m.dish_b_id]) {
      const played = counts.get(id);
      if (played > floor + 1) {
        violations.push(`#${m.id} drew dish ${id} on ${played} with ${floor} available`);
      }
      counts.set(id, played + 1);
    }
  }
  return violations;
}

function pairRepeats(matchups) {
  const repeats = [];
  for (let i = 0; i < matchups.length; i++) {
    const key = [matchups[i].dish_a_id, matchups[i].dish_b_id].sort().join("-");
    for (let j = Math.max(0, i - RECENCY_WINDOW); j < i; j++) {
      const prior = [matchups[j].dish_a_id, matchups[j].dish_b_id].sort().join("-");
      if (prior === key) repeats.push(`${key} at #${matchups[j].id} and #${matchups[i].id}`);
    }
  }
  return repeats;
}

// ── scenario 1: small catalog, everything in play ──────────────────
// 12 dishes, 4 chefs, ratings clustered with two outliers. Twelve rather than
// more because pair recency is only interesting when the pool is tight enough
// to strain it, and one category because splitting twelve across two leaves so
// few candidates that the window cannot be honoured at all.
const chefs = ["ben", "sarah", "mike", "dana"];
const clustered = [1500, 1520, 1480, 1510, 1495, 1530, 1470, 1505, 1515, 1490, 1700, 1300];
await seed(clustered.map((elo, i) => ({ chef: chefs[i % 4], elo, played: 0 })));

const startingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;
const smallStart = new Map((await sql("SELECT id, matches_played FROM dishes")).map((d) => [d.id, d.matches_played]));

await playRounds(ROUNDS);

let matchups = await sql("SELECT id, dish_a_id, dish_b_id, elo_a_before, elo_b_before FROM matchups WHERE status='closed' ORDER BY id");
let dishes = await sql("SELECT id, ROUND(elo,1) AS elo, matches_played FROM dishes ORDER BY matches_played, id");
const endingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;

console.log(`\nsmall catalog: ${matchups.length} matchups over ${ROUNDS} rounds\n`);

const repeats = pairRepeats(matchups);
check(`no pair repeats within ${RECENCY_WINDOW} matchups`, repeats.length === 0, repeats.join("; "));

const spills = rotationViolations(matchups, smallStart);
check("the rotation holds", spills.length === 0, spills.join("; "));

// Elo is zero-sum: the catalog total never moves.
const drift = Math.abs(endingTotal - startingTotal);
check("Elo total conserved", drift < 0.01, `drift ${drift}`);

// The wide-gap rule fires — some pairing spans a big rating gap. It looks for
// that gap inside the least-played group, so this catalog is the one that can
// show it: everything is in play, and the two outliers are in the running from
// the first round.
const gaps = matchups.map((m) => Math.abs((m.elo_a_before ?? 0) - (m.elo_b_before ?? 0)));
check("wide-gap pairings occur", gaps.some((g) => g > 150), `max gap ${Math.max(...gaps).toFixed(0)}`);

console.log("dish spread:", dishes.map((d) => `#${d.id}:${d.matches_played}`).join(" "));
console.log("gaps:", gaps.map((g) => g.toFixed(0)).join(" "));

// ── scenario 2: a backlog behind a few veterans ────────────────────
// The shape the real channel is in. Four dishes have been on the board six
// times and carry ratings far from the opening one; thirty-six have never
// played and all sit at 1500. A draw that weighs rating ahead of the play
// count keeps reaching for those four — they are the only dishes with a rating
// worth matching or mismatching — and the backlog never moves.
const backlog = [];
for (const [chef, elo] of [["ben", 1720], ["sarah", 1680], ["mike", 1310], ["dana", 1290]]) {
  backlog.push({ chef, elo, played: 6 });
}
for (let i = 0; i < 36; i++) {
  backlog.push({ chef: ["ben", "sarah", "mike", "dana", "kit"][i % 5], elo: 1500, played: 0 });
}
await seed(backlog);

const veterans = (await sql("SELECT id FROM dishes WHERE matches_played = 6 ORDER BY id")).map((d) => d.id);
const backlogStart = new Map((await sql("SELECT id, matches_played FROM dishes")).map((d) => [d.id, d.matches_played]));

await playRounds(ROUNDS);

matchups = await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='closed' ORDER BY id");
dishes = await sql("SELECT id, matches_played FROM dishes ORDER BY matches_played, id");

console.log(`\nbacklog catalog: ${matchups.length} matchups over ${ROUNDS} rounds\n`);

const backlogSpills = rotationViolations(matchups, backlogStart);
check("the rotation holds against a backlog", backlogSpills.length === 0, backlogSpills.join("; "));

// The sharp version of the same thing, and the one the channel notices: while
// anything is unplayed, the dishes that have already been on the board six
// times stay off it.
const vetAppearances = matchups.filter(
  (m) => veterans.includes(m.dish_a_id) || veterans.includes(m.dish_b_id)
);
check(
  "veterans stay benched while a backlog exists",
  vetAppearances.length === 0,
  `veterans ${veterans} appeared in ${vetAppearances.map((m) => `#${m.id}`).join(", ")}`
);

const backlogRepeats = pairRepeats(matchups);
check(`no pair repeats within ${RECENCY_WINDOW} matchups`, backlogRepeats.length === 0, backlogRepeats.join("; "));

const unplayed = dishes.filter((d) => d.matches_played === 0).length;
const vetCounts = dishes.filter((d) => veterans.includes(d.id)).map((d) => `#${d.id}:${d.matches_played}`);
console.log(`backlog drawn down: ${unplayed} of 36 still unplayed; veterans ${vetCounts.join(" ")} (seeded at 6)`);

console.log(failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`);
process.exit(failures === 0 ? 0 : 1);
