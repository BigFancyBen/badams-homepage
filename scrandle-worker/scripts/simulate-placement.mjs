/**
 * The placement slot, which is a draw before it is a round.
 *
 * Everything the other harnesses cover — how a card is scored, how a ballot
 * counts — is the same here, because a placement round *is* a ranking round
 * once it is posted. What is new is what goes on it, and the four different
 * shapes a week can arrive in:
 *
 *   - enough new cooking for a card, which is a ranking round
 *   - two new photographs from two people, which is a matchup between them
 *   - one new photograph, or two from one kitchen, which goes up against the
 *     catalog instead
 *   - nothing new at all, which posts nothing and does not burn the slot
 *
 * And the rule that made the whole thing need a schema change: a placement
 * pair is food, and food is what the everyday matchup draws, so it has to be
 * marked a bonus or it stands in front of the next cooking slot and skips it.
 *
 * Needs the mock Discord and the local dev server, same as the others.
 */
const DB = "00000000-0000-0000-0000-000000000000";
/**
 * The dev server, overridable so a second worktree can run its own on another
 * port — `npm run dev:local` binds 8787, and two checkouts of this repo cannot
 * both have it.
 */
const WORKER = process.env.SCRANDLE_WORKER_URL ?? "http://127.0.0.1:8787";
const API = `${WORKER}/cdn-cgi/local/explorer/api`;
// From .dev.vars — see the local testing section of the README.
const SECRET = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";

const DAY = 24 * 60 * 60 * 1000;
/** Matches RD_START in src/elo.ts. */
const RD_START = 250;
const RD_MIN = 60;
/** Matches PLACEMENT_RECENT_DAYS in wrangler.toml. */
const RECENT_DAYS = 14;

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
 * `dishes` is a list of `{ chef, age, played?, elo?, rd?, category? }`.
 *
 * `age` is in days before now and is the field this suite is really about —
 * the placement draw is the only one that reads `posted_at`, so every scenario
 * here is a statement about how old something is. Everything else defaults to
 * an unplayed food photograph on the opening rating, which is what a
 * photograph that has just been ingested actually looks like.
 */
function dishRow(d) {
  const tag = nextTag++;
  // Spread inside the day so `posted_at DESC` has a defined order — the draw
  // trims an overflowing week from the old end, and rows sharing a timestamp
  // would make which five it kept a matter of insertion order.
  const at = Date.now() - d.age * DAY - tag * 1000;
  return (
    `('m${tag}','a${tag}','user_${d.chef}','dishes/h${tag}.jpg','h${tag}',` +
    `'d${tag}',${at},${at},${d.elo ?? 1500},${d.rd ?? RD_START},` +
    `${d.played ?? 0},'${d.category ?? "food"}')`
  );
}

const DISH_COLUMNS =
  "discord_message_id, attachment_id, poster_discord_id, r2_key, sha256, " +
  "caption, posted_at, ingested_at, elo, rd, matches_played, category";

async function seed(dishes) {
  await sql(
    "DELETE FROM contest_votes; DELETE FROM contest_entries; DELETE FROM contests; " +
      "DELETE FROM round_votes; DELETE FROM round_entries; DELETE FROM rounds; " +
      "DELETE FROM votes; DELETE FROM matchups; DELETE FROM dishes; " +
      "DELETE FROM players; DELETE FROM state;"
  );
  nextTag = 0;
  const chefs = [...new Set(dishes.map((d) => d.chef))];
  await sql(
    `INSERT INTO dishes (${DISH_COLUMNS}) VALUES ${dishes.map(dishRow).join(",")};`
  );
  await sql(
    "INSERT INTO players (discord_id, username, first_seen) VALUES " +
      `${chefs.map((c) => `('user_${c}','${c}',0)`).join(",")};`
  );
}

/** Forces the placement slot and returns what the route said it did. */
async function post() {
  const response = await fetch(
    `${WORKER}/admin/post-matchup?placement=1&secret=${encodeURIComponent(SECRET)}`
  );
  if (!response.ok) throw new Error(`post failed: ${response.status}`);
  return response.json();
}

/** Whatever the slot actually put up: a round's entries, or a matchup's pair. */
async function whatWentUp() {
  const rounds = await sql(
    "SELECT r.id, d.id AS dish_id, d.poster_discord_id AS chef, " +
      "d.matches_played AS played, d.posted_at AS at " +
      "FROM rounds r JOIN round_entries e ON e.round_id = r.id " +
      "JOIN dishes d ON d.id = e.dish_id WHERE r.status = 'open' ORDER BY e.slot"
  );
  if (rounds.length > 0) return { kind: "round", entries: rounds };

  const matchups = await sql(
    "SELECT m.id, m.bonus, m.dish_a_id, m.dish_b_id FROM matchups m " +
      "WHERE m.status = 'open' ORDER BY m.id DESC LIMIT 1"
  );
  if (matchups.length === 0) return { kind: "nothing" };

  const [pair] = matchups;
  const dishes = await sql(
    "SELECT id, poster_discord_id AS chef, matches_played AS played " +
      `FROM dishes WHERE id IN (${pair.dish_a_id},${pair.dish_b_id})`
  );
  return { kind: "pair", bonus: pair.bonus, dishes };
}

const chefs = ["ben", "sarah", "mike", "dana"];

// ── a full week ────────────────────────────────────────────────────
// Eight new photographs across three people, sitting on a backlog that has
// already been played. The card is five, every one of them new, and while
// there is a choice no more than two come from one kitchen.
await seed([
  ...Array.from({ length: 8 }, (_, i) => ({
    chef: chefs[i % 3],
    age: 1 + (i % 5),
  })),
  ...Array.from({ length: 20 }, (_, i) => ({
    chef: chefs[i % 4],
    age: 100 + i,
    played: 3,
    rd: RD_MIN,
  })),
]);

let result = await post();
let up = await whatWentUp();

check("a full week posts a ranking round", up.kind === "round", JSON.stringify(result));
check(
  "the card is five photographs",
  up.entries?.length === 5,
  `${up.entries?.length} on the card`
);
check(
  "every one of them is new and unplayed",
  up.entries?.every((e) => e.played === 0 && Date.now() - e.at < RECENT_DAYS * DAY),
  up.entries?.map((e) => `#${e.dish_id}:${e.played}`).join(" ")
);

const perChef = new Map();
for (const entry of up.entries ?? []) {
  perChef.set(entry.chef, (perChef.get(entry.chef) ?? 0) + 1);
}
check(
  "no more than two from one kitchen while there is a choice",
  [...perChef.values()].every((n) => n <= 2),
  [...perChef].map(([chef, n]) => `${chef}:${n}`).join(" ")
);

// ── a week that was one person cooking ─────────────────────────────
// The per-poster rule is a preference here and not the place round's hard cap.
// Five photographs from one kitchen is still a week worth ranking, and
// refusing to rank it is refusing to seed any of it.
await seed([
  ...Array.from({ length: 5 }, () => ({ chef: "ben", age: 2 })),
  ...Array.from({ length: 10 }, (_, i) => ({
    chef: chefs[i % 4],
    age: 100 + i,
    played: 3,
    rd: RD_MIN,
  })),
]);

result = await post();
up = await whatWentUp();
check(
  "one person's week still fills the card",
  up.kind === "round" && up.entries.length === 5,
  `${up.kind}, ${up.entries?.length ?? 0} entries`
);

// ── nothing new ────────────────────────────────────────────────────
// Unplayed but old, and recent but already played. Neither is new cooking, and
// between them they are the two ways the filter could be got wrong.
await seed([
  ...Array.from({ length: 6 }, (_, i) => ({ chef: chefs[i % 3], age: 60 + i })),
  ...Array.from({ length: 6 }, (_, i) => ({
    chef: chefs[i % 3],
    age: 2,
    played: 1,
    rd: RD_MIN,
  })),
]);

result = await post();
up = await whatWentUp();
check(
  "a week with nothing new in it posts nothing",
  result.posted === false && up.kind === "nothing",
  JSON.stringify(result)
);
check(
  "and does not claim the slot, so the next tick can try again",
  (await sql("SELECT value FROM state WHERE key='last_placement_slot'")).length === 0,
  "last_placement_slot was written despite nothing being posted"
);

// ── two newcomers, two kitchens ────────────────────────────────────
await seed([
  { chef: "ben", age: 1 },
  { chef: "sarah", age: 2 },
  ...Array.from({ length: 10 }, (_, i) => ({
    chef: chefs[i % 4],
    age: 100 + i,
    played: 3,
    rd: RD_MIN,
  })),
]);

result = await post();
up = await whatWentUp();
check(
  "two newcomers from two kitchens meet each other",
  up.kind === "pair" && up.dishes.every((d) => d.played === 0),
  JSON.stringify(result)
);

// The reason migration 0008 adds a column. A placement pair is food, and under
// the old category inference it would have counted as the everyday matchup and
// blacked out the next cooking slot for a day.
check(
  "a placement pair is marked a bonus",
  up.bonus === 1,
  `bonus = ${up.bonus}`
);

const everyday = await fetch(
  `${WORKER}/admin/post-matchup?secret=${encodeURIComponent(SECRET)}`
);
const everydayResult = await everyday.json();
check(
  "so the everyday matchup can still post beside it",
  everydayResult.posted === true,
  JSON.stringify(everydayResult)
);

// ── two newcomers, one kitchen ─────────────────────────────────────
// They can never meet — two photographs from the same person is not a matchup
// anyone can take a side on — so the newest goes up against the catalog.
await seed([
  { chef: "ben", age: 1 },
  { chef: "ben", age: 2 },
  ...Array.from({ length: 10 }, (_, i) => ({
    chef: chefs[(i % 3) + 1],
    age: 100 + i,
    played: 3,
    rd: RD_MIN,
  })),
]);

result = await post();
up = await whatWentUp();
check(
  "two newcomers from one kitchen go against the catalog instead",
  up.kind === "pair" &&
    up.dishes.filter((d) => d.played === 0).length === 1 &&
    up.dishes.filter((d) => d.played > 0).length === 1,
  JSON.stringify(up.dishes)
);
check(
  "and never against each other",
  new Set(up.dishes?.map((d) => d.chef)).size === 2,
  up.dishes?.map((d) => d.chef).join(" vs ")
);

// ── one newcomer, and nobody to play it ────────────────────────────
// The whole category is this person's, so no legal opponent exists. The slot
// posts nothing rather than bending the rule, and leaves itself open to retry.
await seed([
  { chef: "ben", age: 1 },
  ...Array.from({ length: 5 }, (_, i) => ({
    chef: "ben",
    age: 100 + i,
    played: 3,
    rd: RD_MIN,
  })),
]);

result = await post();
up = await whatWentUp();
check(
  "a lone newcomer with no legal opponent posts nothing",
  result.posted === false && up.kind === "nothing",
  JSON.stringify(result)
);

console.log(
  failures === 0 ? "\nall invariants held" : `\n${failures} invariant(s) violated`
);
process.exit(failures === 0 ? 0 : 1);
