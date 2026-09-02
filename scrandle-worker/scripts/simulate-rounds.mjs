/**
 * Drives many ranking rounds through the real worker code and asserts the
 * things a single round cannot show:
 *   - the draw is the same rotation the pair game uses
 *   - no round is more than two photographs from any one person
 *   - a round counts as one match played, not one per comparison
 *   - a round is one Glicko rating period, and narrows the deviation once
 *   - a settled round stays near enough zero-sum, and an unrated one need not
 *   - the photograph most people put first is the one that wins
 *   - a partial ballot still scores, and still beats what it left unranked
 *   - a themed round puts five of one kind up, and works through the kinds
 *
 * Five catalogs. A deep one for the rotation and the arithmetic, a small one
 * with unanimous voters for the ordering, one where nobody ranks more than a
 * single photograph — the case worth being sure about, because it is the one
 * most people will actually cast — and two for the themed food round: a
 * catalog with kinds deep enough to theme on, and one with none, which has to
 * fall back to a mixed five rather than skip the week.
 */
const DB = "00000000-0000-0000-0000-000000000000";
// Overridable for the same reason as the mock's port: parallel worktrees.
const WORKER = process.env.SCRANDLE_WORKER_URL ?? "http://127.0.0.1:8787";
const API = `${WORKER}/cdn-cgi/local/explorer/api`;
const ROUNDS = Number(process.argv[2] ?? 15);
// From .dev.vars — see the local testing section of the README.
const SECRET = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";
/** Matches RD_MIN in src/elo.ts: the deviation a settled photograph sits on. */
const RD_MIN = 60;
/** Matches RD_START: the deviation a photograph nobody has voted on carries. */
const RD_START = 250;
/**
 * What a settled pair shutout is worth under Glicko at RD_MIN, to a tenth.
 * The fixed K it replaced was 24, so a shutout moved 12; two settled
 * photographs now produce an effective K near 20 and a shutout of 9.9. That
 * closeness is deliberate — the change is meant to be felt at the new end of
 * the catalog, not the old one.
 */
const SETTLED_SHUTOUT = 9.9;

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

let nextTag = 0;

/**
 * `dishes` is a list of `{ chef, elo, played, rd, category, kind }`. Category
 * defaults to place, because the place round draws nothing else and a seed of
 * food would leave every query empty and the whole suite would pass having
 * tested nothing. The themed scenarios override it, and set the kind the
 * classifier would have written.
 *
 * `rd` is the Glicko deviation and defaults to the settled floor. A seed is a
 * catalog with a history behind it; leaving everything on the opening 250
 * would make every scenario's first round swing hundreds of points, which is
 * right for photographs nobody has voted on and no use for reading arithmetic.
 */
function dishRow(d) {
  const tag = nextTag++;
  const at = 1700000000000 + tag * 1000;
  const rd = d.rd ?? RD_MIN;
  const kind = d.kind ? `'${d.kind}'` : "NULL";
  return `('m${tag}','a${tag}','user_${d.chef}','dishes/h${tag}.jpg','h${tag}','d${tag}',${at},${at},${d.elo},${rd},${d.played},'${d.category ?? "place"}',${kind})`;
}

const DISH_COLUMNS =
  "discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, caption, posted_at, ingested_at, elo, rd, matches_played, category, kind";

async function seed(dishes) {
  await sql(
    "DELETE FROM contest_votes; DELETE FROM contest_entries; DELETE FROM contests; DELETE FROM round_votes; DELETE FROM round_entries; DELETE FROM rounds; " +
      "DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; " +
      "DELETE FROM players; DELETE FROM state;"
  );
  nextTag = 0;
  const chefs = [...new Set(dishes.map((d) => d.chef))];
  await sql(`INSERT INTO dishes (${DISH_COLUMNS}) VALUES ${dishes.map(dishRow).join(",")};`);
  await sql(
    `INSERT INTO players (discord_id, username, first_seen) VALUES ` +
      `${chefs.map((c) => `('user_${c}','${c}',0)`).join(",")};`
  );
}

let clock = 1;

/**
 * Casts one ballot straight into the table. `order` is a list of slot numbers,
 * best first, and may be shorter than the round — a partial ballot is a real
 * ballot, and the point of taking slots rather than dish ids is that it is
 * exactly what a run of button clicks would have produced.
 */
async function castBallot(roundId, voter, order) {
  const rows = order.map(
    (slot, index) =>
      `(${roundId},'${voter}',(SELECT dish_id FROM round_entries WHERE round_id=${roundId} AND slot=${slot}),${index + 1},${clock++})`
  );
  await sql(
    `INSERT INTO round_votes (round_id, voter_discord_id, dish_id, rank, voted_at) ` +
      `VALUES ${rows.join(",")};`
  );
}

/**
 * Posts a round, hands it to `vote(roundId, slots)`, and closes it. Forced
 * rather than cron-driven for the same reason the matchup harness forces its
 * posts: the scheduled path only fires on the round's named weekday and hour,
 * so a cron-driven simulation would post nothing at all unless it happened to
 * be run at noon on a Monday.
 */
async function playRounds(rounds, vote, flag = "place") {
  for (let round = 0; round < rounds; round++) {
    const posted = await fetch(
      `${WORKER}/admin/post-matchup?${flag}=1&secret=${encodeURIComponent(SECRET)}`
    );
    if (!posted.ok) throw new Error(`post failed: ${posted.status}`);

    const open = await sql("SELECT id FROM rounds WHERE status='open' ORDER BY id DESC LIMIT 1");
    if (open.length === 0) {
      console.log(`round ${round}: nothing posted`);
      continue;
    }

    const roundId = open[0].id;
    const slots = (
      await sql(`SELECT slot FROM round_entries WHERE round_id=${roundId} ORDER BY slot`)
    ).map((row) => row.slot);

    await vote(roundId, slots, round);
    await sql(`UPDATE rounds SET closes_at = 1 WHERE id = ${roundId};`);

    const closed = await fetch(
      `${WORKER}/admin/close-matchup?secret=${encodeURIComponent(SECRET)}`
    );
    if (!closed.ok) throw new Error(`close failed: ${closed.status}`);
  }
}

/** Every closed round with its entries, oldest first. */
async function closedRounds() {
  const rounds = await sql("SELECT id FROM rounds WHERE status='closed' ORDER BY id");
  const entries = await sql(
    "SELECT round_id, dish_id, slot, elo_before, elo_after, rd_before, " +
      "rd_after, wins, firsts FROM round_entries ORDER BY round_id, slot"
  );
  return rounds.map((round) => ({
    id: round.id,
    entries: entries.filter((entry) => entry.round_id === round.id),
  }));
}

/**
 * Replays the rounds in order against the play counts as they stood, the same
 * way the matchup harness does — final counts cannot tell you whether a
 * photograph was drawn while something rarer sat there unplayed.
 *
 * One above the floor is legal: the draw prefers the least-played rather than
 * requiring it, and spills into the next count on its own when the per-poster
 * cap rules out everything on the floor.
 */
function rotationViolations(rounds, startingCounts) {
  const counts = new Map(startingCounts);
  const violations = [];
  for (const round of rounds) {
    const floor = Math.min(...counts.values());
    for (const entry of round.entries) {
      const played = counts.get(entry.dish_id);
      if (played > floor + 1) {
        violations.push(
          `round #${round.id} drew dish ${entry.dish_id} on ${played} with ${floor} available`
        );
      }
      counts.set(entry.dish_id, played + 1);
    }
  }
  return violations;
}

// ── scenario 1: a deep catalog, ranked in full ─────────────────────
// Forty places across eight people, none of them played. This is the shape the
// place pool is really in, and the only one that can show the rotation working
// across many rounds.
const chefs = ["ben", "sarah", "mike", "dana", "kit", "ali", "jo", "sam"];
await seed(
  Array.from({ length: 40 }, (_, i) => ({
    chef: chefs[i % chefs.length],
    elo: 1500,
    played: 0,
  }))
);

const startingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;
const deepStart = new Map(
  (await sql("SELECT id, matches_played FROM dishes")).map((d) => [d.id, d.matches_played])
);

// Six voters, each with a different rotation of the same five slots, so no
// photograph is anyone's favourite by position alone.
await playRounds(ROUNDS, async (roundId, slots) => {
  for (let voter = 0; voter < 6; voter++) {
    const order = slots.map((_, i) => slots[(i + voter) % slots.length]);
    await castBallot(roundId, `voter_${voter}`, order);
  }
});

const rounds = await closedRounds();
const endingTotal = (await sql("SELECT SUM(elo) AS total FROM dishes"))[0].total;
const played = await sql("SELECT id, matches_played FROM dishes");

console.log(`\ndeep catalog: ${rounds.length} rounds over ${ROUNDS} ticks\n`);

check("every round filled its card", rounds.every((r) => r.entries.length === 5),
  rounds.filter((r) => r.entries.length !== 5).map((r) => `#${r.id}:${r.entries.length}`).join(" "));

const spills = rotationViolations(rounds, deepStart);
check("the rotation holds", spills.length === 0, spills.join("; "));

// Nobody's photo album. Two from one person is the cap; three is a bug.
const crowded = [];
for (const round of rounds) {
  const posters = await sql(
    `SELECT d.poster_discord_id AS chef, COUNT(*) AS n FROM round_entries e ` +
      `JOIN dishes d ON d.id = e.dish_id WHERE e.round_id = ${round.id} ` +
      `GROUP BY d.poster_discord_id HAVING n > 2`
  );
  for (const row of posters) crowded.push(`round #${round.id}: ${row.chef} has ${row.n}`);
}
check("no more than two photographs from one person", crowded.length === 0, crowded.join("; "));

// A round is one match played. The four comparisons a photograph appears in
// are a scoring detail, not four turns on the board — counting them would run
// the rotation four times as fast as the game actually moves.
const appearances = new Map();
for (const round of rounds) {
  for (const entry of round.entries) {
    appearances.set(entry.dish_id, (appearances.get(entry.dish_id) ?? 0) + 1);
  }
}
const miscounted = played.filter(
  (dish) => dish.matches_played !== (appearances.get(dish.id) ?? 0)
);
check(
  "a round counts as one match played",
  miscounted.length === 0,
  miscounted.map((d) => `#${d.id}: ${d.matches_played} played, ${appearances.get(d.id) ?? 0} rounds`).join("; ")
);

// Glicko is not zero-sum in general — the side with the wider deviation moves
// further. On a catalog that starts settled every photograph is equally well
// known, so the movements inside a round cancel and the total holds to within
// rounding. The unrated round below is where that stops being true, and it is
// checked there rather than asserted away here.
const drift = Math.abs(endingTotal - startingTotal);
check("a settled catalog's total holds", drift < 0.01, `drift ${drift}`);

// The deviation is a measure of ignorance and a round only ever reduces it.
const widened = rounds.flatMap((round) =>
  round.entries.filter((entry) => entry.rd_after > entry.rd_before + 0.01)
);
check(
  "a round never widens a deviation",
  widened.length === 0,
  widened.map((e) => `#${e.dish_id}: ${e.rd_before} to ${e.rd_after}`).join("; ")
);

// What replaced dividing K by (n-1). A photograph in a five-way round is
// judged four times, and the worry was always that one weekly bonus would
// outweigh the week it sits in. Glicko damps it with the prior instead of by
// hand: four comparisons move a settled rating about three and a half times a
// matchup's worth rather than four, and — the part dividing K never did — the
// round leaves the photograph on a tighter deviation, so the round after moves
// it less. Four settled shutouts is the ceiling, and nothing may exceed it.
const moves = rounds.flatMap((round) =>
  round.entries.map((entry) => Math.abs((entry.elo_after ?? 0) - (entry.elo_before ?? 0)))
);
const biggest = Math.max(...moves);
const ceiling = 4 * SETTLED_SHUTOUT;
check(
  "a settled round stays inside four matchups' worth",
  biggest <= ceiling + 0.01,
  `biggest move ${biggest.toFixed(1)}, ceiling ${ceiling.toFixed(1)}`
);

console.log(
  `biggest rating move: ${biggest.toFixed(1)} of a possible ${ceiling.toFixed(1)}`
);

// ── scenario 2: everybody agrees ───────────────────────────────────
// Ten places, five voters, all of them ranking the slots in the same order.
// The finish is then not a matter of opinion, and neither is the arithmetic:
// slot 1 beat everything on every ballot and must come out on top.
await seed(
  Array.from({ length: 10 }, (_, i) => ({ chef: chefs[i % chefs.length], elo: 1500, played: 0 }))
);

await playRounds(1, async (roundId, slots) => {
  for (let voter = 0; voter < 5; voter++) {
    await castBallot(roundId, `voter_${voter}`, slots);
  }
});

const [unanimous] = await closedRounds();
const bySlot = new Map(unanimous.entries.map((entry) => [entry.slot, entry]));
const top = bySlot.get(1);
const bottom = bySlot.get(unanimous.entries.length);

check(
  "the photograph everyone put first wins the round",
  top.wins === Math.max(...unanimous.entries.map((e) => e.wins)) && top.firsts === 5,
  `slot 1 took ${top.wins} comparisons and ${top.firsts} firsts`
);
check(
  "and the one everyone put last loses it",
  bottom.wins === 0 && bottom.elo_after < bottom.elo_before,
  `slot ${unanimous.entries.length} took ${bottom.wins} comparisons`
);
check(
  "the order of finish is the order they were ranked in",
  unanimous.entries.every((entry, i) => i === 0 || entry.wins < bySlot.get(i).wins),
  unanimous.entries.map((e) => `#${e.slot}:${e.wins}`).join(" ")
);

// What a clean sweep of a five-way round is actually worth, stated as a
// number. Four comparisons, all won outright, against opponents as settled as
// the winner — and the answer is a little under four matchup shutouts, because
// the prior term damps it. That is the whole of what dividing K by (n-1) was
// approximating, arrived at rather than imposed.
//
// The deep catalog cannot show this: six voters disagreeing split every pair
// near even, and nothing there moves more than a point or two.
const sweep = top.elo_after - top.elo_before;
const ratio = sweep / SETTLED_SHUTOUT;
check(
  "a settled sweep is worth a little under four matchup shutouts",
  ratio > 3.5 && ratio < 4,
  `moved ${sweep.toFixed(2)}, which is ${ratio.toFixed(2)} shutouts of ${SETTLED_SHUTOUT}`
);
check(
  "and the sweep narrows the winner's deviation",
  top.rd_after <= top.rd_before + 0.01,
  `deviation went ${top.rd_before} to ${top.rd_after}`
);
console.log(
  `unanimous winner moved ${sweep.toFixed(2)} (${ratio.toFixed(2)} shutouts)`
);

// ── scenario 3: nobody ranks more than one ─────────────────────────
// The ballot most people will actually cast: one click and gone. It has to
// count, and it has to say something about every pair it touches — whatever
// they picked beat all four they did not, and the four say nothing about each
// other. A round that quietly ignored these would collect almost no opinions.
//
// Seeded unrated rather than settled, which is both the interesting case and
// the common one — a one-click ballot on a card of photographs nobody has
// voted on is precisely what the placement round collects. It also leaves the
// deviations room to move: at the floor they are all pinned at RD_MIN and the
// round's effect on them cannot be read at all.
await seed(
  Array.from({ length: 10 }, (_, i) => ({
    chef: chefs[i % chefs.length],
    elo: 1500,
    played: 0,
    rd: RD_START,
  }))
);

await playRounds(1, async (roundId, slots) => {
  // Four voters for slot 1, one for slot 2, nobody looks at the rest.
  for (let voter = 0; voter < 4; voter++) {
    await castBallot(roundId, `voter_${voter}`, [slots[0]]);
  }
  await castBallot(roundId, "voter_4", [slots[1]]);
});

const [partial] = await closedRounds();
const partialBySlot = new Map(partial.entries.map((entry) => [entry.slot, entry]));
const favourite = partialBySlot.get(1);
const runnerUp = partialBySlot.get(2);
const ignored = partial.entries.filter((entry) => entry.slot > 2);

check(
  "a one-click ballot still counts",
  favourite.elo_after > favourite.elo_before,
  `slot 1 moved ${(favourite.elo_after - favourite.elo_before).toFixed(2)}`
);
check(
  "what was ranked beats what was left unranked",
  favourite.wins > runnerUp.wins && runnerUp.wins > 0,
  `slot 1 took ${favourite.wins}, slot 2 took ${runnerUp.wins}`
);
check(
  "photographs nobody looked at are not scored against each other",
  ignored.every((entry) => entry.wins === 0),
  ignored.map((e) => `#${e.slot}:${e.wins}`).join(" ")
);

// A partial ballot is where the deviation stops being an accounting detail.
// Slots 1 and 2 were judged four times each; slots 3, 4 and 5 were judged
// twice — beaten by the two that were ranked, and never set against each
// other. So the round knows more about the top two than the bottom three, the
// prior damps them by different amounts, and the movements no longer cancel.
//
// That is Glicko working rather than Glicko leaking. What has to hold is that
// the drift stays small against the movements that produced it, and that the
// photographs judged more often come out better known than the ones judged
// less. A fixed K could express neither.
const partialDrift = Math.abs(
  partial.entries.reduce((sum, entry) => sum + (entry.elo_after - entry.elo_before), 0)
);
const partialTravel = partial.entries.reduce(
  (sum, entry) => sum + Math.abs(entry.elo_after - entry.elo_before),
  0
);
check(
  "a partial ballot's drift is small against what it moved",
  partialDrift < partialTravel / 4,
  `drift ${partialDrift.toFixed(2)} against ${partialTravel.toFixed(2)} of movement`
);
check(
  "the photographs judged four times end better known than those judged twice",
  Math.max(favourite.rd_after, runnerUp.rd_after) <
    Math.min(...ignored.map((e) => e.rd_after)),
  partial.entries.map((e) => `#${e.slot}:${e.rd_after.toFixed(1)}`).join(" ")
);

// ── scenario 4: the placement round ────────────────────────────────
// The same unanimous ballots on five photographs nobody has ever voted on,
// which is exactly the card the placement slot puts up. This is the whole
// reason the round exists: five photographs at their widest deviation, judged
// against each other, and one card is allowed to place them properly. Under
// the fixed K it replaced, the identical card was worth twelve points a head
// and everything stayed at 1500.
await seed(
  Array.from({ length: 5 }, (_, i) => ({
    chef: chefs[i],
    elo: 1500,
    played: 0,
    rd: RD_START,
  }))
);

await playRounds(1, async (roundId, slots) => {
  for (let voter = 0; voter < 5; voter++) {
    await castBallot(roundId, `voter_${voter}`, slots);
  }
});

const [placement] = await closedRounds();
const placementBySlot = new Map(placement.entries.map((e) => [e.slot, e]));
const placedTop = placementBySlot.get(1);
const placedBottom = placementBySlot.get(placement.entries.length);
const placedSpread = placedTop.elo_after - placedBottom.elo_after;
const settledSpread = top.elo_after - bottom.elo_after;

console.log(
  `
placement round: ${placement.entries
    .map((e) => `#${e.slot}:${Math.round(e.elo_after)}`)
    .join(" ")}`
);

check(
  "one placement round separates five unrated photographs",
  placedSpread > 400,
  `spread ${placedSpread.toFixed(0)}, and a settled card of the same ballots spreads ${settledSpread.toFixed(0)}`
);
check(
  "which is far more than the same card does to settled ratings",
  placedSpread > settledSpread * 4,
  `${placedSpread.toFixed(0)} against ${settledSpread.toFixed(0)}`
);
check(
  "and every photograph comes out of it substantially better known",
  placement.entries.every(
    (e) => e.rd_after < RD_START * 0.75 && e.rd_after >= RD_MIN
  ),
  placement.entries.map((e) => `#${e.slot}:${e.rd_after.toFixed(0)}`).join(" ")
);

// The middle photograph is the check that the card places rather than merely
// scatters: ranked third of five by everybody, it beat two and lost to two,
// and it belongs exactly where it started.
const middle = placementBySlot.get(3);
check(
  "the photograph everyone ranked in the middle stays in the middle",
  Math.abs(middle.elo_after - middle.elo_before) < 1,
  `moved ${(middle.elo_after - middle.elo_before).toFixed(2)}`
);

// ── scenario 4: the themed food round ──────────────────────────────
// The reason this format exists for food at all. An ungrouped five drawn from
// the catalog is a lasagne, a fry-up, a cheeseboard, a taco and a bowl of
// ramen, and what people rank there is which meal they fancy. A round has to
// be five of one thing.
//
// Kinds of four different depths, plus a handful of `other` — the bucket for
// what fits nowhere, which must never be themed on — and one kind that is a
// single person's, which cannot fill a card because no more than two of
// anyone's go on one.
const THEMED = [
  ...spread("pasta", 8),
  ...spread("burger", 6),
  ...spread("pizza", 5),
  ...spread("tacos", 4),
  ...spread("other", 6),
  // Four steaks, all Ben's. Eligible on count and ineligible on people.
  ...Array.from({ length: 4 }, () => ({ chef: "ben", kind: "steak" })),
];

function spread(kind, count) {
  return Array.from({ length: count }, (_, i) => ({
    chef: chefs[i % chefs.length],
    kind,
  }));
}

await seed(
  THEMED.map((d) => ({ ...d, category: "food", elo: 1500, played: 0 }))
);

// One round per themeable kind, which is what the rotation should take to work
// through them. Four qualify: pasta, burger, pizza and tacos.
const THEMEABLE = 4;
await playRounds(
  THEMEABLE,
  async (roundId, slots) => {
    for (let voter = 0; voter < 3; voter++) {
      const order = slots.map((_, i) => slots[(i + voter) % slots.length]);
      await castBallot(roundId, `voter_${voter}`, order);
    }
  },
  "foodround"
);

const themed = await sql(
  "SELECT r.id AS round, d.kind AS kind, d.poster_discord_id AS chef " +
    "FROM round_entries e JOIN rounds r ON r.id = e.round_id " +
    "JOIN dishes d ON d.id = e.dish_id ORDER BY r.id, e.slot"
);
const themedRounds = [...new Set(themed.map((row) => row.round))].map((id) => ({
  id,
  kinds: [...new Set(themed.filter((row) => row.round === id).map((r) => r.kind))],
}));

console.log(`\nthemed food rounds: ${themedRounds.length}\n`);

check(
  "every round is all one kind",
  themedRounds.length === THEMEABLE &&
    themedRounds.every((round) => round.kinds.length === 1),
  themedRounds.map((r) => `#${r.id}:${r.kinds.join("+")}`).join(" ")
);

check(
  "the round is never built on 'other'",
  themedRounds.every((round) => round.kinds[0] !== "other"),
  themedRounds.map((r) => r.kinds[0]).join(" ")
);

// A kind one person owns is short a card however many photographs are in it —
// the per-poster cap allows two, and three is the floor. Picking it would mean
// drawing it, failing to fill, and falling back to a mixed five with the theme
// already announced.
check(
  "a kind that is one person's is never drawn",
  themedRounds.every((round) => round.kinds[0] !== "steak"),
  themedRounds.map((r) => r.kinds[0]).join(" ")
);

// The rotation, applied a level up. Kinds come off the least-played end the
// same way photographs do, so every themeable kind gets a week before any of
// them gets a second.
check(
  "the kinds rotate rather than repeating",
  new Set(themedRounds.map((round) => round.kinds[0])).size === THEMEABLE,
  themedRounds.map((r) => r.kinds[0]).join(" ")
);

// ── scenario 5: nothing to theme on ────────────────────────────────
// Six plates, six kinds, no three of anything. The week still has to have a
// round in it: a slot that fires only when the catalog is deep enough is a
// weekly post that does not appear for months.
await seed(
  ["pasta", "burger", "pizza", "tacos", "curry", "sushi"].map((kind, i) => ({
    chef: chefs[i % chefs.length],
    category: "food",
    kind,
    elo: 1500,
    played: 0,
  }))
);

await playRounds(
  1,
  async (roundId, slots) => castBallot(roundId, "voter_0", slots),
  "foodround"
);

const mixed = await sql(
  "SELECT d.kind AS kind FROM round_entries e JOIN dishes d ON d.id = e.dish_id " +
    "JOIN rounds r ON r.id = e.round_id WHERE r.status = 'closed'"
);

check(
  "a catalog with no themeable kind still posts a round",
  mixed.length >= 3,
  `${mixed.length} photographs on the card`
);
check(
  "and it is honestly a mixed one",
  new Set(mixed.map((row) => row.kind)).size > 1,
  mixed.map((row) => row.kind).join(" ")
);

console.log(failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`);
process.exit(failures === 0 ? 0 : 1);
