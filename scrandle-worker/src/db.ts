import type { Dish, Env, Matchup, Round, RoundDish } from "./types";

/**
 * D1 fails transiently. Cloudflare's own error table lists "Network connection
 * lost", a Durable Object restart behind the database, and a replica losing
 * its primary, all with the same recommended action: retry.
 *
 * Since September 2025 D1 retries these itself — but only for statements it
 * can prove are read-only (`SELECT`, `WITH`, `EXPLAIN`). Anything that writes
 * is left to the caller, which is why an hourly ingest could die on a blip
 * that a `SELECT` two lines earlier would have shrugged off.
 *
 * https://developers.cloudflare.com/d1/observability/debug-d1/#error-list
 */
const RETRYABLE = [
  "Network connection lost",
  "storage caused object to be reset",
  "reset because its code was updated",
  "Cannot resolve D1 DB due to transient issue on remote node",
  "Replica disconnected from primary",
];

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE.some((fragment) => message.includes(fragment));
}

/** 100ms then 200ms — 300ms of added latency in the worst case. */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 100;

/**
 * Retries a D1 write through a transient failure.
 *
 * **Only for idempotent statements.** A retry cannot tell "the write never
 * landed" from "the write landed and the reply got lost", so re-running has to
 * be harmless — an upsert, or an insert guarded by `ON CONFLICT`. Never wrap a
 * bare `INSERT` or a counter bump in this.
 *
 * Retries cost a subrequest each, which matters on the ingest path where the
 * budget is already counted out. Failing on the subrequest ceiling instead of
 * on D1 is no worse, and only happens when things are already going wrong.
 */
export async function retryWrite<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= RETRY_ATTEMPTS - 1 || !isRetryable(error)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_MS * 2 ** attempt)
      );
    }
  }
}

export async function getState(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM state WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

/** Retried: an upsert of a known value, so re-running it changes nothing. */
export async function setState(
  env: Env,
  key: string,
  value: string
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO state (key, value) VALUES (?, ?) " +
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
    )
      .bind(key, value)
      .run()
  );
}

export async function getDish(env: Env, id: number): Promise<Dish | null> {
  return env.DB.prepare("SELECT * FROM dishes WHERE id = ?")
    .bind(id)
    .first<Dish>();
}

/**
 * The oldest open *everyday* matchup, ignoring bonus rounds.
 *
 * Only the one-at-a-time rule uses this, and a bonus must not trip it. A bonus
 * is posted to run beside the everyday matchup and holds a flat window of its
 * own, so counting it blacked out every ordinary slot for a full day after each
 * one — with bonuses on Monday, Tuesday and Wednesday that is most of the week.
 *
 * `matchups` has no column saying which is which, and does not need one. The
 * everyday draw is fixed to DEFAULT_CATEGORIES and both dishes in a matchup
 * always share a category, so a matchup holding anything else can only have
 * come from a bonus. Joining dish A is enough to tell them apart.
 *
 * Food only, now that drinks have a slot of their own. Leaving drinks in here
 * would have been the exact blackout described above, on the busiest bonus of
 * the lot: an open drink matchup would have stood in front of the next cooking
 * matchup and skipped it.
 */
export async function getOpenStandardMatchup(env: Env): Promise<Matchup | null> {
  return env.DB.prepare(
    "SELECT m.* FROM matchups m JOIN dishes d ON d.id = m.dish_a_id " +
      "WHERE m.status = 'open' AND d.category = 'food' " +
      "ORDER BY m.created_at ASC LIMIT 1"
  ).first<Matchup>();
}

/**
 * How much drink there is to play with, and how many people it came from.
 *
 * Both numbers, because the cadence needs both: a catalog of forty drinks that
 * are all one person's cannot produce a single matchup, since a matchup never
 * pits someone against himself. Counted at post time rather than cached — it is
 * one aggregate over a small table, read at most once an hour.
 */
export async function drinkPool(
  env: Env
): Promise<{ count: number; posters: number }> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COUNT(DISTINCT poster_discord_id) AS posters " +
      "FROM dishes WHERE category = 'drink'"
  ).first<{ count: number; posters: number }>();
  return { count: row?.count ?? 0, posters: row?.posters ?? 0 };
}

/** Every open matchup, regardless of closes_at. */
export async function getOpenMatchups(env: Env): Promise<Matchup[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM matchups WHERE status = 'open' ORDER BY created_at ASC"
  ).all<Matchup>();
  return result.results ?? [];
}

export async function getDueMatchups(
  env: Env,
  now: number
): Promise<Matchup[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM matchups WHERE status = 'open' AND closes_at <= ?"
  )
    .bind(now)
    .all<Matchup>();
  return result.results ?? [];
}

export async function getMatchup(
  env: Env,
  id: number
): Promise<Matchup | null> {
  return env.DB.prepare("SELECT * FROM matchups WHERE id = ?")
    .bind(id)
    .first<Matchup>();
}

/**
 * By the Discord message it was posted as. A matchup that went out without a
 * card carries its id nowhere a reader can see — not in the text, only in the
 * vote buttons — so a repair has to be reachable from the message link, which
 * is the one thing anyone looking at a broken round actually has.
 */
export async function getMatchupByMessage(
  env: Env,
  messageId: string
): Promise<Matchup | null> {
  return env.DB.prepare("SELECT * FROM matchups WHERE message_id = ?")
    .bind(messageId)
    .first<Matchup>();
}

/**
 * Upsert so people can change their pick until close. The UNIQUE constraint on
 * (matchup_id, voter_discord_id) is what actually enforces one vote each.
 */
export async function recordVote(
  env: Env,
  matchupId: number,
  voterId: string,
  pickedDishId: number,
  now: number
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO votes (matchup_id, voter_discord_id, picked_dish_id, voted_at) " +
      "VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (matchup_id, voter_discord_id) " +
      "DO UPDATE SET picked_dish_id = excluded.picked_dish_id, voted_at = excluded.voted_at"
  )
    .bind(matchupId, voterId, pickedDishId, now)
    .run();
}

export async function tallyVotes(
  env: Env,
  matchup: Matchup
): Promise<{ a: number; b: number }> {
  const row = await env.DB.prepare(
    "SELECT " +
      "SUM(CASE WHEN picked_dish_id = ? THEN 1 ELSE 0 END) AS a, " +
      "SUM(CASE WHEN picked_dish_id = ? THEN 1 ELSE 0 END) AS b " +
      "FROM votes WHERE matchup_id = ?"
  )
    .bind(matchup.dish_a_id, matchup.dish_b_id, matchup.id)
    .first<{ a: number | null; b: number | null }>();
  return { a: row?.a ?? 0, b: row?.b ?? 0 };
}

/**
 * Every vote in a matchup with the name behind it, oldest first.
 *
 * Vote order rather than alphabetical: it is free — `voted_at` is already
 * stored — and who committed first is the part worth reading. Only final picks
 * exist to report, because recordVote upserts; somebody who changed their mind
 * leaves no trace of having done so.
 */
export async function voteBreakdown(
  env: Env,
  matchup: Matchup
): Promise<{ dish_id: number; name: string }[]> {
  const result = await env.DB.prepare(
    "SELECT v.picked_dish_id AS dish_id, " +
      "COALESCE(p.username, 'someone') AS name " +
      "FROM votes v LEFT JOIN players p ON p.discord_id = v.voter_discord_id " +
      "WHERE v.matchup_id = ? ORDER BY v.voted_at ASC, v.id ASC"
  )
    .bind(matchup.id)
    .all<{ dish_id: number; name: string }>();
  return result.results ?? [];
}

// ── Ranking rounds ─────────────────────────────────────────────────

export async function getRound(env: Env, id: number): Promise<Round | null> {
  return env.DB.prepare("SELECT * FROM rounds WHERE id = ?")
    .bind(id)
    .first<Round>();
}

export async function getRoundByMessage(
  env: Env,
  messageId: string
): Promise<Round | null> {
  return env.DB.prepare("SELECT * FROM rounds WHERE message_id = ?")
    .bind(messageId)
    .first<Round>();
}

export async function getOpenRounds(env: Env): Promise<Round[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM rounds WHERE status = 'open' ORDER BY created_at ASC"
  ).all<Round>();
  return result.results ?? [];
}

export async function getDueRounds(env: Env, now: number): Promise<Round[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM rounds WHERE status = 'open' AND closes_at <= ?"
  )
    .bind(now)
    .all<Round>();
  return result.results ?? [];
}

/**
 * Photographs held by an open ranking round, so the pair draw can leave them
 * alone. Nothing pairs the two pools today — places are drawn nowhere else —
 * but that is a property of the current categories rather than a rule anything
 * enforces, and it costs one read a tick to not rely on it.
 */
export async function openRoundDishIds(env: Env): Promise<number[]> {
  const result = await env.DB.prepare(
    "SELECT e.dish_id AS id FROM round_entries e " +
      "JOIN rounds r ON r.id = e.round_id WHERE r.status = 'open'"
  ).all<{ id: number }>();
  return (result.results ?? []).map((row) => row.id);
}

/** The round's photographs in slot order — the order they sit on the card. */
export async function getRoundEntries(
  env: Env,
  roundId: number
): Promise<RoundDish[]> {
  const result = await env.DB.prepare(
    "SELECT d.*, e.slot AS slot, e.elo_before AS elo_before, " +
      "e.elo_after AS elo_after, e.wins AS wins, e.firsts AS firsts " +
      "FROM round_entries e JOIN dishes d ON d.id = e.dish_id " +
      "WHERE e.round_id = ? ORDER BY e.slot ASC"
  )
    .bind(roundId)
    .all<RoundDish>();
  return result.results ?? [];
}

/** One person's ballot so far, best first. Empty until they click something. */
export async function getBallot(
  env: Env,
  roundId: number,
  voterId: string
): Promise<{ dish_id: number; slot: number }[]> {
  const result = await env.DB.prepare(
    "SELECT v.dish_id AS dish_id, e.slot AS slot FROM round_votes v " +
      "JOIN round_entries e ON e.round_id = v.round_id AND e.dish_id = v.dish_id " +
      "WHERE v.round_id = ? AND v.voter_discord_id = ? ORDER BY v.rank ASC"
  )
    .bind(roundId, voterId)
    .all<{ dish_id: number; slot: number }>();
  return result.results ?? [];
}

/**
 * Adds one photograph to the end of somebody's ballot.
 *
 * The rank is computed inside the statement rather than read out and sent
 * back, so two clicks arriving together cannot both decide they are third.
 * The upsert clause is what absorbs a double-click on the *same* photograph;
 * the SELECT keeps its WHERE for the reason SQLite's upsert documentation
 * gives, which is that a bare SELECT here would make `ON` ambiguous.
 */
export async function appendToBallot(
  env: Env,
  roundId: number,
  voterId: string,
  dishId: number,
  now: number
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO round_votes (round_id, voter_discord_id, dish_id, rank, voted_at) " +
      "SELECT ?1, ?2, ?3, COALESCE(MAX(rank), 0) + 1, ?4 FROM round_votes " +
      "WHERE round_id = ?1 AND voter_discord_id = ?2 " +
      "ON CONFLICT (round_id, voter_discord_id, dish_id) DO NOTHING"
  )
    .bind(roundId, voterId, dishId, now)
    .run();
}

export async function clearBallot(
  env: Env,
  roundId: number,
  voterId: string
): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM round_votes WHERE round_id = ? AND voter_discord_id = ?"
  )
    .bind(roundId, voterId)
    .run();
}

/**
 * Every ballot in a round, each best-first, ordered by who started first.
 *
 * One query and a group rather than a read per voter: a busy round is twenty
 * ballots, and twenty round trips inside a close tick is a bad trade for
 * ordering that SQL already did.
 */
export async function getRoundBallots(
  env: Env,
  roundId: number
): Promise<{ name: string; dishIds: number[] }[]> {
  const result = await env.DB.prepare(
    "SELECT v.voter_discord_id AS voter, " +
      "COALESCE(p.username, 'someone') AS name, v.dish_id AS dish_id " +
      "FROM round_votes v " +
      "LEFT JOIN players p ON p.discord_id = v.voter_discord_id " +
      "WHERE v.round_id = ? ORDER BY v.voted_at ASC, v.rank ASC"
  )
    .bind(roundId)
    .all<{ voter: string; name: string; dish_id: number }>();

  // Insertion order is first-vote order, because the rows arrive oldest first.
  const ballots = new Map<string, { name: string; dishIds: number[] }>();
  for (const row of result.results ?? []) {
    const existing = ballots.get(row.voter);
    if (existing) existing.dishIds.push(row.dish_id);
    else ballots.set(row.voter, { name: row.name, dishIds: [row.dish_id] });
  }
  return [...ballots.values()];
}

export async function upsertPlayer(
  env: Env,
  discordId: string,
  username: string,
  now: number
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO players (discord_id, username, first_seen) VALUES (?, ?, ?) " +
      "ON CONFLICT (discord_id) DO UPDATE SET username = excluded.username"
  )
    .bind(discordId, username, now)
    .run();
}

export async function playerName(env: Env, discordId: string): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT username FROM players WHERE discord_id = ?"
  )
    .bind(discordId)
    .first<{ username: string }>();
  return row?.username ?? "unknown chef";
}

/** Chef rating is the mean Elo of their dishes — no separate rating to maintain. */
export async function chefStandings(
  env: Env,
  limit = 12
): Promise<{ discord_id: string; username: string; elo: number }[]> {
  const result = await env.DB.prepare(
    "SELECT d.poster_discord_id AS discord_id, " +
      "COALESCE(p.username, 'unknown') AS username, " +
      "AVG(d.elo) AS elo " +
      "FROM dishes d LEFT JOIN players p ON p.discord_id = d.poster_discord_id " +
      // Cooking only. A place photograph earns an Elo like anything else, but
      // averaging it into a chef's standing would rate them on their holiday
      // snaps alongside their food.
      "WHERE d.matches_played > 0 AND d.category IN ('food','drink') " +
      "GROUP BY d.poster_discord_id " +
      "ORDER BY elo DESC LIMIT ?"
  )
    .bind(limit)
    .all<{ discord_id: string; username: string; elo: number }>();
  return result.results ?? [];
}
