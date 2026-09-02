/**
 * Drives many matchup rounds through the real worker code and asserts the
 * matchmaking invariants that a single round cannot show:
 *   - the draw is a rotation: nothing plays again while something has played
 *     less
 *   - no pair repeats inside the recency window
 *   - the wide-gap rule fires on the expected cadence
 *   - the deviation only ever narrows, and never past its floor
 *   - a settled catalog's ratings stay where a fixed K would have kept them
 *   - a steady trickle of new photographs does not take over the board
 *
 * Three catalogs, because no one of them can show all of that. A small catalog
 * where everything is in play exercises pair recency and the deliberate
 * mismatch. A large one with a backlog and a handful of veterans exercises the
 * rotation. A third adds a photograph between every round, which is the only
 * way to see the fresh slot: it needs new arrivals to keep arriving, and a
 * fixed seed can only ever run it dry.
 */
const DB = "00000000-0000-0000-0000-000000000000";
// Overridable for the same reason as the mock's port: parallel worktrees.
const WORKER = process.env.SCRANDLE_WORKER_URL ?? "http://127.0.0.1:8787";
const API = `${WORKER}/cdn-cgi/local/explorer/api`;
const ROUNDS = Number(process.argv[2] ?? 25);
// From .dev.vars — see the local testing section of the README.
const SECRET = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";
const RECENCY_WINDOW = 20;
/** Matches RD_MIN in src/elo.ts: the deviation a settled photograph sits on. */
const RD_MIN = 60;
/** Matches RD_START. The deviation a photograph nobody has voted on carries. */
const RD_START = 250;

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
 * `dishes` is a list of `{ chef, elo, played, rd?, postedAt?, category? }`.
 *
 * `rd` is the Glicko deviation and defaults to the settled floor rather than
 * the opening 250. A seed is a catalog with a history behind it, and leaving
 * every dish at maximum uncertainty would make the first result of every
 * scenario swing a couple of hundred points — which is correct behaviour for a
 * photograph nobody has voted on and useless for testing the draw.
 * Categories matter: the everyday draw only ever reaches food, so a seed
 * without any leaves every query empty and the whole suite passes vacuously.
 * Food is the default and the first three scenarios use nothing else, because
 * an opponent has to match the primary's category. The last one seeds drinks
 * as well, to check that the everyday draw leaves them alone.
 *
 * `played` seeds matches_played directly and leaves first_matchup_id null.
 * Nothing in the draw reads that column — the rotation keys off the count —
 * and inventing matchup ids for history that was never played would be a
 * bigger lie than the null.
 */
let nextTag = 0;

/** One row's worth of VALUES, with a tag that stays unique across a whole run. */
function dishRow(d) {
  const tag = nextTag++;
  const at = d.postedAt ?? 1700000000000 + tag * 1000;
  const category = d.category ?? "food";
  const rd = d.rd ?? RD_MIN;
  return `('m${tag}','a${tag}','user_${d.chef}','dishes/h${tag}.jpg','h${tag}','d${tag}',${at},${at},${d.elo},${rd},${d.played},'${category}')`;
}

const DISH_COLUMNS =
  "discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, caption, posted_at, ingested_at, elo, rd, matches_played, category";

async function seed(dishes) {
  // Every table holding a foreign key into `dishes` first, and in dependency
  // order among themselves — contests and ranking rounds both point at it,
  // so a reset that skips either fails on the constraint rather than on
  // anything to do with the draw. A format added later has to be added here.
  await sql(
    "DELETE FROM contest_votes; DELETE FROM contest_entries; DELETE FROM contests; " +
      "DELETE FROM round_votes; DELETE FROM round_entries; DELETE FROM rounds; " +
      "DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; " +
      "DELETE FROM players; DELETE FROM state;"
  );
  nextTag = 0;
  const chefs = [...new Set(dishes.map((d) => d.chef))];
  const values = dishes.map(dishRow).join(",");
  await sql(`INSERT INTO dishes (${DISH_COLUMNS}) VALUES ${values};`);
  await sql(`INSERT INTO players (discord_id, username, first_seen) VALUES ${chefs.map((c) => `('user_${c}','${c}',0)`).join(",")};`);
}

/** A photograph arriving mid-run, the way ingest delivers them. */
async function addDish(dish) {
  await sql(`INSERT INTO dishes (${DISH_COLUMNS}) VALUES ${dishRow(dish)};`);
}

async function playRounds(rounds, beforeRound, unanimousFor) {
  for (let round = 0; round < rounds; round++) {
    if (beforeRound) await beforeRound(round);
    // Force the post rather than running the cron: the scheduled path only
    // fires on a named hour, so a cron-driven simulation posts nothing at all
    // unless it happens to be run at 15:00 UTC. The posting schedule has its
    // own suite (test:schedule); what this one is about is the draw.
    //
    // count=1 pins the batch at one matchup a round whatever MATCHUPS_PER_SLOT
    // says. The rotation and recency invariants below are counted per matchup,
    // so they hold either way — but a round that posts three and votes on one
    // would close the other two on no votes, and every Elo assertion here would
    // then be measuring the harness rather than the draw.
    const posted = await fetch(
      `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=1`
    );
    if (!posted.ok) throw new Error(`tick failed: ${posted.status}`);

    const open = await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='open' ORDER BY id DESC LIMIT 1");
    if (open.length === 0) {
      console.log(`round ${round}: no matchup posted`);
      continue;
    }
    const { id, dish_a_id, dish_b_id } = open[0];

    // Random-ish but deterministic split so Elo actually moves. A scenario
    // that cares which side wins passes `unanimousFor` and gets six votes for
    // whichever dish it names — the split above is fine for exercising the
    // draw and useless for asking how far a rating travels, because it hands
    // every dish roughly as many wins as losses.
    const favourite = unanimousFor
      ? unanimousFor(dish_a_id, dish_b_id)
      : null;
    const votesForA = favourite
      ? favourite === dish_a_id
        ? 6
        : 0
      : (round % 5) + 1;
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
const deviations = await sql("SELECT id, rd, matches_played FROM dishes");

console.log(`\nsmall catalog: ${matchups.length} matchups over ${ROUNDS} rounds\n`);

const repeats = pairRepeats(matchups);
check(`no pair repeats within ${RECENCY_WINDOW} matchups`, repeats.length === 0, repeats.join("; "));

const spills = rotationViolations(matchups, smallStart);
check("the rotation holds", spills.length === 0, spills.join("; "));

// Glicko is deliberately not zero-sum — the side with the wider deviation
// moves further, which is the whole reason for carrying a deviation at all. On
// a catalog that starts settled there is nothing to be uncertain about, so the
// two sides move together and the total barely stirs. It is checked as a bound
// rather than an identity: a run that drifted hundreds of points across a
// settled pool would mean the deviation was not doing its job.
const drift = Math.abs(endingTotal - startingTotal);
check(
  "a settled catalog's total barely moves",
  drift < 1,
  `drift ${drift.toFixed(2)} over ${matchups.length} matchups`
);

// The deviation is a measure of ignorance and results only ever reduce it.
// Nothing here inflates it back — see the note over RD_START in src/elo.ts.
const loosened = deviations.filter((d) => d.rd > RD_MIN + 0.01);
check(
  "the deviation never widens, and never falls past its floor",
  loosened.length === 0 && deviations.every((d) => d.rd >= RD_MIN - 0.01),
  deviations.map((d) => `#${d.id}:${d.rd.toFixed(1)}`).join(" ")
);

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

// ── scenario 3: a trickle of new arrivals over a deep backlog ───────
// The bias the channel complained about. Forty photographs nobody has voted on
// sit behind new cooking that keeps arriving — one more every round, the way
// ingest actually delivers them.
//
// An unconditional "recent and unplayed goes first" is a rotation rule only
// while the backlog empties, and at two matchups a day against hundreds of
// photographs it never does. Every primary is then something from the last
// fortnight and the rest of the catalog is unreachable: against that draw the
// arrivals take about two thirds of the slots and most of the backlog is never
// seen at all.
const DAY = 24 * 60 * 60 * 1000;
const trickleChefs = ["ben", "sarah", "mike", "dana", "kit"];
await seed(
  Array.from({ length: 40 }, (_, i) => ({
    chef: trickleChefs[i % 5],
    elo: 1500,
    played: 0,
    // Well outside the fortnight, so none of these can take the fresh slot.
    postedAt: Date.now() - 300 * DAY,
  }))
);
const backlogIds = new Set((await sql("SELECT id FROM dishes")).map((d) => d.id));
const trickleStart = new Map((await sql("SELECT id, matches_played FROM dishes")).map((d) => [d.id, d.matches_played]));

await playRounds(ROUNDS, (round) =>
  addDish({
    chef: trickleChefs[round % 5],
    elo: 1500,
    played: 0,
    // Yesterday, so it is inside the fortnight and eligible for the fresh slot.
    postedAt: Date.now() - DAY,
  })
);

matchups = await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='closed' ORDER BY id");

const slots = matchups.flatMap((m) => [m.dish_a_id, m.dish_b_id]);
const arrivals = slots.filter((id) => !backlogIds.has(id)).length;
const share = slots.length === 0 ? 0 : arrivals / slots.length;

console.log(`\ntrickle catalog: ${matchups.length} matchups over ${ROUNDS} rounds\n`);

// The fresh slot is one primary in four, so arrivals earn roughly a quarter of
// the board by cadence plus their share of the pool on every other draw. Half
// is the line, and it is a structural one rather than a tuned threshold: a draw
// that hands every primary to a recent photograph scores 50% by construction —
// one of the two slots, every time — so anything below it means the primary is
// no longer reserved for new arrivals.
check(
  "new arrivals do not take over the board",
  share < 0.5,
  `arrivals took ${arrivals} of ${slots.length} slots (${(share * 100).toFixed(0)}%)`
);

// The sharper version of the same thing, and the one the channel notices: whole
// boards drawn from the backlog. While the primary belongs to recency there are
// none at all — every matchup has a photograph from the last fortnight in it.
const allBacklog = matchups.filter(
  (m) => backlogIds.has(m.dish_a_id) && backlogIds.has(m.dish_b_id)
).length;
check(
  "some boards are drawn entirely from the backlog",
  allBacklog >= matchups.length / 4,
  `${allBacklog} of ${matchups.length} matchups had no photo from the last fortnight`
);

// And the other direction — recency still gets its share. Dropping the fresh
// slot altogether would pass the checks above and fail this one.
check(
  "recent cooking still reaches the board",
  arrivals > 0,
  "nothing posted inside the fortnight was ever drawn"
);

// Arrivals start unplayed, so they join the rotation at the floor rather than
// jumping it. Every dish added mid-run starts the replay on zero.
const trickleCounts = new Map(trickleStart);
for (const d of await sql("SELECT id FROM dishes")) {
  if (!trickleCounts.has(d.id)) trickleCounts.set(d.id, 0);
}
const trickleSpills = rotationViolations(matchups, trickleCounts);
check("the rotation holds through the trickle", trickleSpills.length === 0, trickleSpills.join("; "));

const backlogSeen = new Set(slots.filter((id) => backlogIds.has(id))).size;
console.log(`arrivals took ${arrivals} of ${slots.length} slots; ${backlogSeen} of 40 backlog photos played`);

// ── scenario 4: drinks on a slot of their own ──────────────────────
// Drinks used to be drawn by the everyday matchup alongside food, so the 9am
// and 9pm posts were cooking only when the draw happened to land on cooking.
// Now they have their own slot, which puts two things at risk that only a
// mixed catalog can show: that the everyday draw never reaches a drink, and
// that a live drink matchup does not stand in front of the next food one.
//
// The second is the sharp one. The one-at-a-time rule reads "is an everyday
// matchup open", and while that question counted drinks, an open drink matchup
// would have blocked the cooking slot outright — the same cycle-skipping bug
// that closing on the schedule was written to fix, arriving from a new
// direction.
await seed([
  ...Array.from({ length: 14 }, (_, i) => ({
    chef: chefs[i % 4],
    elo: 1500,
    played: 0,
    category: "food",
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    chef: chefs[i % 4],
    elo: 1500,
    played: 0,
    category: "drink",
  })),
]);

const drinkIds = new Set(
  (await sql("SELECT id FROM dishes WHERE category='drink'")).map((d) => d.id)
);

// Force the drink slot up, the way the cron does on one of its own days.
const drinkPost = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&drink=1`
);
const drinkBody = await drinkPost.json();
check("the drink slot posts", drinkBody.posted === true, JSON.stringify(drinkBody));

const liveDrink = (
  await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='open' ORDER BY id DESC LIMIT 1")
)[0];
check(
  "and it drew two drinks",
  liveDrink && drinkIds.has(liveDrink.dish_a_id) && drinkIds.has(liveDrink.dish_b_id),
  JSON.stringify(liveDrink)
);

// The regression. No overlap flag: this is the ordinary scheduled post, asked
// for while a drink matchup is open.
const foodPost = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=1`
);
const foodBody = await foodPost.json();
check(
  "an open drink matchup does not block the cooking slot",
  foodBody.posted === true,
  JSON.stringify(foodBody)
);

const liveFood = (
  await sql(`SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='open' AND id > ${liveDrink?.id ?? 0} ORDER BY id DESC LIMIT 1`)
)[0];
check(
  "and the cooking slot drew food",
  liveFood && !drinkIds.has(liveFood.dish_a_id) && !drinkIds.has(liveFood.dish_b_id),
  JSON.stringify(liveFood)
);

// The other half of the rule still holds: a slot of one will not post over its
// own open matchup. The cap generalised from "never two" to "never more than
// the slot asked for", and the drink query narrowing to food must not have
// turned it off along the way.
const second = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=1`
);
const secondBody = await second.json();
check(
  "a slot of one is not posted over while its matchup is open",
  secondBody.posted === false,
  JSON.stringify(secondBody)
);

// The 9am batch: three matchups posted together, and the thing that makes it a
// batch rather than three posts is that the draw has to see its own output. A
// photograph in two of the morning's three would be as indefensible as the same
// one appearing twice in a day, and nothing but the growing exclude list stops
// it — the database has no open matchup to consult until the row is written.
await sql("DELETE FROM votes; DELETE FROM matchups; UPDATE dishes SET matches_played = 0, first_matchup_id = NULL, elo = 1500;");

const batchPost = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=3`
);
const batchBody = await batchPost.json();
check("the batch posts", batchBody.posted === true, JSON.stringify(batchBody));

const batchOpen = await sql(
  "SELECT id, dish_a_id, dish_b_id, closes_at FROM matchups WHERE status='open' ORDER BY id"
);
check("three matchups go up", batchOpen.length === 3, `${batchOpen.length} open`);

const batchDishes = batchOpen.flatMap((m) => [m.dish_a_id, m.dish_b_id]);
check(
  "on six different photographs",
  new Set(batchDishes).size === batchDishes.length,
  JSON.stringify(batchDishes)
);

check(
  "all closing at the same moment",
  new Set(batchOpen.map((m) => m.closes_at)).size === 1,
  JSON.stringify(batchOpen.map((m) => m.closes_at))
);

// The cap counts what is open, so a second batch asked for while the first is
// still up posts the shortfall — which here is none of it.
const fourth = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=3`
);
const fourthBody = await fourth.json();
check(
  "and a full slot posts nothing more",
  fourthBody.posted === false,
  JSON.stringify(fourthBody)
);

// Close one and the slot is one short, so the next tick tops it back up rather
// than starting a fresh batch of three on top of the two still running.
await sql(`UPDATE matchups SET status='closed', closed_at=1 WHERE id = ${batchOpen[0].id};`);
const topUp = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}&count=3`
);
check("a short slot is topped up", (await topUp.json()).posted === true, "");
const afterTopUp = await sql("SELECT COUNT(*) AS n FROM matchups WHERE status='open'");
check(
  "back to three open, not five",
  afterTopUp[0].n === 3,
  `${afterTopUp[0].n} open`
);

// Clear the board, then run the everyday draw properly. Over a long run not
// one of its matchups may contain a drink.
await sql("DELETE FROM votes; DELETE FROM matchups;");
await playRounds(ROUNDS);

matchups = await sql("SELECT id, dish_a_id, dish_b_id FROM matchups WHERE status='closed' ORDER BY id");
const drinkSlots = matchups.filter(
  (m) => drinkIds.has(m.dish_a_id) || drinkIds.has(m.dish_b_id)
);

console.log(`\nmixed catalog: ${matchups.length} everyday matchups over ${ROUNDS} rounds\n`);

check(
  "the everyday draw never reaches a drink",
  drinkSlots.length === 0,
  `drinks appeared in ${drinkSlots.map((m) => `#${m.id}`).join(", ")}`
);

// And the drinks are still there to be drawn by their own slot — an everyday
// draw that quietly consumed them would pass the check above by leaving none.
const drinksUnplayed = (
  await sql("SELECT COUNT(*) AS n FROM dishes WHERE category='drink' AND matches_played = 0")
)[0].n;
check("and leaves them for it", drinksUnplayed === 10, `${drinksUnplayed} of 10 still unplayed`);

// ── scenario 4: an unrated photograph among settled ones ───────────
// The reason the deviation exists, stated as an experiment. One photograph on
// the opening deviation among three settled ones, all on the same rating, and
// every voter always picks the newcomer.
//
// A four-dish catalog rather than a deep one, because the rotation is what
// decides how often the newcomer plays: a sweep of four is two matchups, so it
// is drawn about every other round. On twelve dishes it would play once in six
// rounds and there would be no curve to look at.
await seed([
  { chef: "ben", elo: 1500, played: 0, rd: RD_START },
  { chef: "sarah", elo: 1500, played: 0, rd: RD_MIN },
  { chef: "mike", elo: 1500, played: 0, rd: RD_MIN },
  { chef: "dana", elo: 1500, played: 0, rd: RD_MIN },
]);

const newcomerId = (await sql("SELECT MIN(id) AS id FROM dishes"))[0].id;

await playRounds(12, undefined, () => newcomerId);

const newcomer = (
  await sql(`SELECT elo, rd, matches_played FROM dishes WHERE id=${newcomerId}`)
)[0];

// Only the matchups it actually played. The rotation gives the other three
// games of their own, and reading a movement off one of those would be reading
// a photograph that was not in it.
const played = await sql(
  "SELECT elo_a_before, elo_a_after, elo_b_before, elo_b_after, dish_a_id " +
    `FROM matchups WHERE status='closed' AND (dish_a_id=${newcomerId} ` +
    `OR dish_b_id=${newcomerId}) ORDER BY id`
);

/** Where a fixed K of 24 would have put it after the same n unanimous wins. */
function underFixedK(games) {
  let elo = 1500;
  for (let i = 0; i < games; i++) {
    const expected = 1 / (1 + Math.pow(10, (1500 - elo) / 400));
    elo += 24 * (1 - expected);
  }
  return elo;
}

const fixedK = underFixedK(newcomer.matches_played);

console.log(
  `
newcomer after ${newcomer.matches_played} unanimous wins: ` +
    `${newcomer.elo.toFixed(0)} (rd ${newcomer.rd.toFixed(0)}) — ` +
    `a fixed K of 24 would have reached ${fixedK.toFixed(0)}`
);

// The scenario is only worth reading if the rotation actually gave it games.
check(
  "the newcomer got a run of matchups",
  newcomer.matches_played >= 3,
  `played ${newcomer.matches_played} of 12 rounds`
);

check(
  "an unrated photograph converges far faster than a fixed K allows",
  newcomer.elo - 1500 > (fixedK - 1500) * 3,
  `reached ${newcomer.elo.toFixed(0)} against ${fixedK.toFixed(0)} in ` +
    `${newcomer.matches_played} games`
);

// The asymmetry itself. In every matchup the newcomer played it moved further
// than its opponent did — the same result taught us far more about the side
// nobody had voted on.
const lopsided = played.map((m) => {
  const newIsA = m.dish_a_id === newcomerId;
  const mine = Math.abs(
    (newIsA ? m.elo_a_after : m.elo_b_after) -
      (newIsA ? m.elo_a_before : m.elo_b_before)
  );
  const theirs = Math.abs(
    (newIsA ? m.elo_b_after : m.elo_a_after) -
      (newIsA ? m.elo_b_before : m.elo_a_before)
  );
  return { mine, theirs };
});
check(
  "the uncertain side moves further than the settled one",
  lopsided.length > 0 && lopsided.every((m) => m.mine > m.theirs),
  lopsided.map((m) => `${m.mine.toFixed(1)} vs ${m.theirs.toFixed(1)}`).join(" ")
);

// And it stops being uncertain, which is what makes the fast start safe: each
// result narrows the deviation, so the next one moves it less.
check(
  "and stops moving so far once it is known",
  newcomer.rd < RD_START && newcomer.rd >= RD_MIN,
  `deviation went ${RD_START} to ${newcomer.rd.toFixed(0)}`
);
check(
  "its later matchups move it less than its first did",
  lopsided.length < 2 || lopsided[lopsided.length - 1].mine < lopsided[0].mine,
  lopsided.map((m) => m.mine.toFixed(1)).join(" > ")
);

console.log(failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`);
process.exit(failures === 0 ? 0 : 1);
