import type { Env } from "./types";

/**
 * Folding two Discord accounts into one.
 *
 * People remake their account, and everything they posted and voted on stays
 * behind under the old snowflake: their photographs sit under a second name in
 * the chef standings, their votes count as a stranger's, and the one-vote-each
 * rule stops applying to them. Nothing in the schema knows the two are the same
 * person, so the fix is to rewrite the id everywhere it appears and drop the
 * spare `players` row.
 *
 * Every id-bearing column, as of migration 0012:
 *
 *   dishes.poster_discord_id       whose cooking it is — the chef standings
 *   votes.voter_discord_id         pair votes, one per matchup
 *   round_votes.voter_discord_id   ranking ballots, one row per rank
 *   contest_entries.author_discord_id
 *   contest_votes.voter_discord_id
 *   ephemeral_replies.user_discord_id  (dropped, not moved — see below)
 *   players.discord_id
 *
 * Add a column here when you add one there, or a merge will quietly leave half
 * the person behind.
 */

/** Snowflakes are all digits, and nothing else should reach the database. */
function isSnowflake(id: string): boolean {
  return /^[0-9]{5,25}$/.test(id);
}

export interface PlayerSummary {
  discord_id: string;
  username: string;
  first_seen: number;
  dishes: number;
  votes: number;
  round_votes: number;
  contest_entries: number;
  contest_votes: number;
}

/**
 * Who is in the catalog, so the old account can be found by name before it is
 * merged away. `q` matches the username case-insensitively; omit it for
 * everyone. Counts come with it because a name alone does not say which of two
 * near-identical rows is the account with ten years of dinners under it.
 */
export async function findPlayers(
  env: Env,
  q?: string
): Promise<PlayerSummary[]> {
  const like = q ? `%${q.toLowerCase()}%` : "%";
  const result = await env.DB.prepare(
    "SELECT p.discord_id, p.username, p.first_seen, " +
      "(SELECT COUNT(*) FROM dishes d WHERE d.poster_discord_id = p.discord_id) AS dishes, " +
      "(SELECT COUNT(*) FROM votes v WHERE v.voter_discord_id = p.discord_id) AS votes, " +
      "(SELECT COUNT(*) FROM round_votes rv WHERE rv.voter_discord_id = p.discord_id) AS round_votes, " +
      "(SELECT COUNT(*) FROM contest_entries ce WHERE ce.author_discord_id = p.discord_id) AS contest_entries, " +
      "(SELECT COUNT(*) FROM contest_votes cv WHERE cv.voter_discord_id = p.discord_id) AS contest_votes " +
      "FROM players p WHERE LOWER(p.username) LIKE ?1 " +
      "ORDER BY dishes DESC, p.username"
  )
    .bind(like)
    .all<PlayerSummary>();
  return result.results ?? [];
}

export interface MergeReport {
  ok: boolean;
  dryRun: boolean;
  from: string;
  to: string;
  /** Rows that move across. */
  moved: Record<string, number>;
  /**
   * Rows that cannot move because the surviving account already has one in the
   * same place — a matchup both accounts voted in, a round both ranked, a
   * contest both entered. The new account's answer is the one that stands, and
   * the old one's is dropped. There is no sensible way to merge two ballots.
   */
  dropped: Record<string, number>;
  reason?: string;
}

/** One `SELECT COUNT(*)`, unwrapped. */
async function count(env: Env, sql: string, ...binds: string[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Move everything `from` did onto `to`, and delete `from`.
 *
 * `to` is the account they keep using; it does not need to exist in `players`
 * yet — the old row's name and first_seen carry over if it does not. Idempotent:
 * running it twice is a no-op, because the second run finds nothing under the
 * old id.
 *
 * Pass `dryRun` to get the same report without writing anything. Do that first.
 */
export async function mergePlayers(
  env: Env,
  from: string,
  to: string,
  dryRun = false
): Promise<MergeReport> {
  const empty = { moved: {}, dropped: {}, from, to, dryRun };
  if (!isSnowflake(from) || !isSnowflake(to)) {
    return { ...empty, ok: false, reason: "from and to must be Discord ids" };
  }
  if (from === to) {
    return { ...empty, ok: false, reason: "from and to are the same account" };
  }

  // What collides, counted before anything moves — after the UPDATE these
  // queries can no longer tell the two accounts apart.
  const dropped = {
    votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM votes WHERE voter_discord_id = ?1 " +
        "AND matchup_id IN (SELECT matchup_id FROM votes WHERE voter_discord_id = ?2)",
      from,
      to
    ),
    round_votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM round_votes WHERE voter_discord_id = ?1 " +
        "AND round_id IN (SELECT round_id FROM round_votes WHERE voter_discord_id = ?2)",
      from,
      to
    ),
    contest_entries: await count(
      env,
      "SELECT COUNT(*) AS n FROM contest_entries WHERE author_discord_id = ?1 " +
        "AND contest_id IN (SELECT contest_id FROM contest_entries WHERE author_discord_id = ?2)",
      from,
      to
    ),
    contest_votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM contest_votes WHERE voter_discord_id = ?1 " +
        "AND contest_id IN (SELECT contest_id FROM contest_votes WHERE voter_discord_id = ?2)",
      from,
      to
    ),
  };

  const totals = {
    dishes: await count(
      env,
      "SELECT COUNT(*) AS n FROM dishes WHERE poster_discord_id = ?1",
      from
    ),
    votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM votes WHERE voter_discord_id = ?1",
      from
    ),
    round_votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM round_votes WHERE voter_discord_id = ?1",
      from
    ),
    contest_entries: await count(
      env,
      "SELECT COUNT(*) AS n FROM contest_entries WHERE author_discord_id = ?1",
      from
    ),
    contest_votes: await count(
      env,
      "SELECT COUNT(*) AS n FROM contest_votes WHERE voter_discord_id = ?1",
      from
    ),
  };

  const moved = {
    dishes: totals.dishes,
    votes: totals.votes - dropped.votes,
    round_votes: totals.round_votes - dropped.round_votes,
    contest_entries: totals.contest_entries - dropped.contest_entries,
    contest_votes: totals.contest_votes - dropped.contest_votes,
  };

  if (dryRun) return { ok: true, dryRun: true, from, to, moved, dropped };

  const db = env.DB;
  // One batch, which D1 runs as a transaction: either the person is merged or
  // nothing happened. Order matters only in that each DELETE clears the
  // collisions before the UPDATE that would otherwise hit the unique key.
  await db.batch([
    // The surviving row first, so a `to` that has never posted still ends up
    // with the old account's name and its first_seen rather than nothing.
    db
      .prepare(
        "INSERT OR IGNORE INTO players (discord_id, username, first_seen) " +
          "SELECT ?2, username, first_seen FROM players WHERE discord_id = ?1"
      )
      .bind(from, to),
    db
      .prepare(
        "UPDATE players SET first_seen = " +
          "(SELECT MIN(first_seen) FROM players WHERE discord_id IN (?1, ?2)) " +
          "WHERE discord_id = ?2"
      )
      .bind(from, to),

    db
      .prepare("UPDATE dishes SET poster_discord_id = ?2 WHERE poster_discord_id = ?1")
      .bind(from, to),

    db
      .prepare(
        "DELETE FROM votes WHERE voter_discord_id = ?1 " +
          "AND matchup_id IN (SELECT matchup_id FROM votes WHERE voter_discord_id = ?2)"
      )
      .bind(from, to),
    db
      .prepare("UPDATE votes SET voter_discord_id = ?2 WHERE voter_discord_id = ?1")
      .bind(from, to),

    db
      .prepare(
        "DELETE FROM round_votes WHERE voter_discord_id = ?1 " +
          "AND round_id IN (SELECT round_id FROM round_votes WHERE voter_discord_id = ?2)"
      )
      .bind(from, to),
    db
      .prepare("UPDATE round_votes SET voter_discord_id = ?2 WHERE voter_discord_id = ?1")
      .bind(from, to),

    db
      .prepare(
        "DELETE FROM contest_entries WHERE author_discord_id = ?1 " +
          "AND contest_id IN (SELECT contest_id FROM contest_entries WHERE author_discord_id = ?2)"
      )
      .bind(from, to),
    db
      .prepare(
        "UPDATE contest_entries SET author_discord_id = ?2 WHERE author_discord_id = ?1"
      )
      .bind(from, to),

    db
      .prepare(
        "DELETE FROM contest_votes WHERE voter_discord_id = ?1 " +
          "AND contest_id IN (SELECT contest_id FROM contest_votes WHERE voter_discord_id = ?2)"
      )
      .bind(from, to),
    db
      .prepare("UPDATE contest_votes SET voter_discord_id = ?2 WHERE voter_discord_id = ?1")
      .bind(from, to),

    // Dropped rather than moved: a private reply's token is dead fifteen
    // minutes after it is written, and the hourly sweep takes these anyway.
    db
      .prepare("DELETE FROM ephemeral_replies WHERE user_discord_id = ?1")
      .bind(from),

    db.prepare("DELETE FROM players WHERE discord_id = ?1").bind(from),
  ]);

  return { ok: true, dryRun: false, from, to, moved, dropped };
}
