/**
 * Drives caption contests through the real worker code.
 *
 * A contest has two live phases and three transitions, which is one more than
 * anything else here, and most of what can go wrong lives in the seams: the
 * bot's caption arriving at the wrong moment, slots leaking the order people
 * wrote in, a contest with nothing to vote on going up anyway.
 *
 * Captions and ballots are written straight into the database rather than
 * clicked, for the same reason the matchup simulator forces its posts: the
 * button path is signed and has its own suite (test:interactions), and this
 * one is about the engine.
 *
 *   npm run test:contests
 */
const DB = "00000000-0000-0000-0000-000000000000";
// Overridable for the same reason as the mock's port: parallel worktrees.
const WORKER = process.env.SCRANDLE_WORKER_URL ?? "http://127.0.0.1:8787";
const API = `${WORKER}/cdn-cgi/local/explorer/api`;
// From .dev.vars — see the local testing section of the README.
const SECRET = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";

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

const admin = async (path) => {
  const response = await fetch(
    `${WORKER}${path}${path.includes("?") ? "&" : "?"}secret=${encodeURIComponent(SECRET)}`
  );
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return response.json();
};

const post = () => admin("/admin/post-matchup?caption=1");
const openVote = () => admin("/admin/open-vote");
const close = () => admin("/admin/close-matchup");

const quote = (text) => text.replace(/'/g, "''");

let nextTag = 0;

/**
 * Seeds photographs in the contest categories. `name` matters more here than
 * anywhere else in the suite: it is the caption the bot enters, so a seed
 * without one cannot show whether the machine's entry works.
 */
async function seed(dishes) {
  await sql(
    "DELETE FROM contest_votes; DELETE FROM contest_entries; DELETE FROM contests; " +
      "DELETE FROM round_votes; DELETE FROM round_entries; DELETE FROM rounds; " +
      "DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; " +
      "DELETE FROM players; DELETE FROM state;"
  );
  nextTag = 0;
  const values = dishes
    .map((d) => {
      const tag = nextTag++;
      const at = 1700000000000 + tag * 1000;
      return (
        `('m${tag}','a${tag}','user_${d.chef}','dishes/h${tag}.jpg','h${tag}',` +
        `'d${tag}',${at},${at},1500,${d.played ?? 0},'${d.category}','${quote(d.name)}')`
      );
    })
    .join(",");
  await sql(
    "INSERT INTO dishes (discord_message_id, attachment_id, poster_discord_id, " +
      "r2_key, sha256, caption, posted_at, ingested_at, elo, matches_played, " +
      `category, name) VALUES ${values};`
  );
  const chefs = [...new Set(dishes.map((d) => d.chef))];
  await sql(
    "INSERT INTO players (discord_id, username, first_seen) VALUES " +
      chefs.map((c) => `('user_${c}','${c}',0)`).join(",") +
      ";"
  );
}

/** A caption written straight in, the way the modal handler would write it. */
async function write(contestId, author, text) {
  await sql(
    "INSERT INTO contest_entries (contest_id, author_discord_id, text, submitted_at) " +
      `VALUES (${contestId},'user_${author}','${quote(text)}',1700000000000);`
  );
}

/** A ballot, best first, given as slot numbers. */
async function vote(contestId, voter, slots) {
  const entries = await sql(
    `SELECT id, slot FROM contest_entries WHERE contest_id = ${contestId}`
  );
  const bySlot = new Map(entries.map((e) => [e.slot, e.id]));
  const rows = slots
    .map((slot, i) => `(${contestId},'user_${voter}',${bySlot.get(slot)},${i + 1},1)`)
    .join(",");
  await sql(
    "INSERT INTO contest_votes (contest_id, voter_discord_id, entry_id, rank, voted_at) " +
      `VALUES ${rows};`
  );
}

const liveContest = async () =>
  (await sql("SELECT * FROM contests ORDER BY id DESC LIMIT 1"))[0];

// ── scenario 1: a contest end to end ───────────────────────────────
// One photograph, four people writing, the bot making five, and a vote whose
// arithmetic is small enough to do in your head.
await seed([
  { chef: "ben", category: "document", name: "receipt for one sad lunch", played: 0 },
  { chef: "sarah", category: "pet", name: "cat unimpressed by weather", played: 3 },
  { chef: "mike", category: "screenshot", name: "text message, deeply unwell", played: 3 },
]);

const posted = await post();
check("a contest posts", posted.posted === true, JSON.stringify(posted));

let contest = await liveContest();
check("it opens in the writing phase", contest?.status === "writing", JSON.stringify(contest));

// The rotation picks the least-played photograph, which is the only one on
// zero. That is what stops the same receipt coming round every Saturday.
const prompt = (await sql(`SELECT * FROM dishes WHERE id = ${contest.dish_id}`))[0];
check(
  "and draws the least-played photograph",
  prompt.matches_played === 0 && prompt.category === "document",
  JSON.stringify(prompt)
);

check(
  "the bot has not entered yet",
  (await sql(`SELECT COUNT(*) AS n FROM contest_entries WHERE contest_id = ${contest.id}`))[0].n === 0,
  "something is in the contest before anybody wrote"
);

// A second contest must not start while this one is live.
const second = await post();
check("a second contest is refused while one is live", second.posted === false, JSON.stringify(second));

await write(contest.id, "ben", "the void, itemised");
await write(contest.id, "sarah", "proof of a decision");
await write(contest.id, "mike", "eleven pounds of regret");
await write(contest.id, "dana", "a document, technically");

const opened = await openVote();
check("the vote opens", opened.opened === 1, JSON.stringify(opened));

contest = await liveContest();
check("and the contest moves to voting", contest.status === "voting", contest.status);
check("with a message of its own", Boolean(contest.vote_message_id), "no vote message recorded");

let entries = await sql(
  `SELECT id, author_discord_id, text, slot FROM contest_entries WHERE contest_id = ${contest.id} ORDER BY slot`
);

check("the bot's caption joins the board", entries.length === 5, `${entries.length} entries`);
const bot = entries.find((e) => e.author_discord_id === null);
check(
  "and it is the name the classifier wrote",
  bot?.text === prompt.name,
  `${JSON.stringify(bot?.text)} vs ${JSON.stringify(prompt.name)}`
);

const slots = entries.map((e) => e.slot).sort((a, b) => a - b);
check(
  "every caption gets a slot, numbered from one",
  slots.length === 5 && slots.every((s, i) => s === i + 1),
  JSON.stringify(slots)
);

// Borda: 3 for a first, 2 for a second, 1 for a third. Three ballots, worked
// out by hand so a change to the scoring has to be a deliberate one.
//   ben   1 › 2 › 3
//   sarah 2 › 1 › 4
//   mike  2 › 3 › 1
// slot 1: 3 + 2 + 1 = 6, two firsts
// slot 2: 2 + 3 + 3 = 8, two firsts
// slot 3: 1 + 0 + 2 = 3
// slot 4: 0 + 1 + 0 = 1
// slot 5: nothing
await vote(contest.id, "ben", [1, 2, 3]);
await vote(contest.id, "sarah", [2, 1, 4]);
await vote(contest.id, "mike", [2, 3, 1]);

const closed = await close();
check("the contest closes", closed.contests === 1, JSON.stringify(closed));

entries = await sql(
  `SELECT slot, points, firsts FROM contest_entries WHERE contest_id = ${contest.id} ORDER BY slot`
);
const points = Object.fromEntries(entries.map((e) => [e.slot, e.points]));
check(
  "Borda points are what the ballots say",
  points[1] === 6 && points[2] === 8 && points[3] === 3 && points[4] === 1 && points[5] === 0,
  JSON.stringify(points)
);

const firsts = Object.fromEntries(entries.map((e) => [e.slot, e.firsts]));
check(
  "firsts are counted for the tiebreak",
  firsts[1] === 1 && firsts[2] === 2 && firsts[3] === 0,
  JSON.stringify(firsts)
);

// Every point awarded came off a ballot, and each ballot is worth exactly
// 3+2+1. This catches a scoring change that quietly hands out more.
const total = entries.reduce((sum, e) => sum + e.points, 0);
check("no points are invented", total === 3 * (3 + 2 + 1), `${total} points from 3 ballots`);

const after = (await sql(`SELECT matches_played FROM dishes WHERE id = ${contest.dish_id}`))[0];
check("the photograph counts as used", after.matches_played === 1, JSON.stringify(after));

check(
  "and the contest is done",
  (await liveContest()).status === "closed",
  "still live after closing"
);

// ── scenario 2: nobody plays ───────────────────────────────────────
// One caption is not a contest — it is a referendum on the bot. The vote must
// not open, and the photograph must not be left in limbo.
await seed([{ chef: "ben", category: "other", name: "a plant, unwell", played: 0 }]);
await post();
let lonely = await liveContest();
await write(lonely.id, "ben", "the only caption anyone wrote");

const abandoned = await openVote();
check("a lone caption still ends the writing phase", abandoned.opened === 1, JSON.stringify(abandoned));

lonely = await liveContest();
check("but the contest is abandoned, not voted on", lonely.status === "closed", lonely.status);
check("and no vote was ever posted", lonely.vote_message_id === null, lonely.vote_message_id);
check(
  "the bot does not enter a contest that never ran",
  (await sql(`SELECT COUNT(*) AS n FROM contest_entries WHERE contest_id = ${lonely.id} AND author_discord_id IS NULL`))[0].n === 0,
  "the bot wrote into an abandoned contest"
);

// Abandoning frees the slot immediately — the next Saturday must not be
// blocked by a contest nobody entered.
check("and the next contest can start", (await post()).posted === true, "still blocked");

// ── scenario 3: the order is not the order they wrote in ───────────
// Slots are shuffled when the vote opens. If they were not, the first caption
// on the card would always be whoever typed fastest, and everyone would learn
// to read the slot instead of the caption.
await seed(
  Array.from({ length: 12 }, (_, i) => ({
    chef: "ben",
    category: "pet",
    name: `animal number ${i}`,
    played: 0,
  }))
);

const firstSlotAuthors = [];
const writers = ["alice", "bob", "carol", "dave"];
for (let round = 0; round < 12; round++) {
  const contestId = (await post(), (await liveContest()).id);
  for (const writer of writers) await write(contestId, writer, `${writer} on round ${round}`);
  await openVote();
  const board = await sql(
    `SELECT author_discord_id, slot FROM contest_entries WHERE contest_id = ${contestId} ORDER BY slot LIMIT 1`
  );
  firstSlotAuthors.push(board[0]?.author_discord_id ?? "bot");
  await close();
}

check(
  "slot 1 is not always whoever wrote first",
  new Set(firstSlotAuthors).size > 1,
  `slot 1 went to ${JSON.stringify(firstSlotAuthors)}`
);

// And the rotation holds across contests: twelve photographs, twelve rounds,
// nothing drawn twice.
const used = await sql("SELECT dish_id FROM contests");
check(
  "no photograph is used twice while others are unplayed",
  new Set(used.map((row) => row.dish_id)).size === used.length,
  `${used.length} contests over ${new Set(used.map((r) => r.dish_id)).size} photographs`
);

console.log(failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`);
process.exit(failures === 0 ? 0 : 1);
