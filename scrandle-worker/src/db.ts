import type { Dish, Env, Matchup } from "./types";

export async function getState(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM state WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setState(
  env: Env,
  key: string,
  value: string
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO state (key, value) VALUES (?, ?) " +
      "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
  )
    .bind(key, value)
    .run();
}

export async function getDish(env: Env, id: number): Promise<Dish | null> {
  return env.DB.prepare("SELECT * FROM dishes WHERE id = ?")
    .bind(id)
    .first<Dish>();
}

export async function getOpenMatchup(env: Env): Promise<Matchup | null> {
  return env.DB.prepare(
    "SELECT * FROM matchups WHERE status = 'open' ORDER BY created_at ASC LIMIT 1"
  ).first<Matchup>();
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
 * Records the voter and their vote in one round trip.
 *
 * Both upsert, so people can change their pick until close — the UNIQUE
 * constraint on (matchup_id, voter_discord_id) is what actually enforces one
 * vote each. Batched rather than sequential because Discord abandons an
 * interaction that takes longer than three seconds to answer, and a button
 * that silently does nothing is worse than a slow one.
 */
export async function castVote(
  env: Env,
  matchupId: number,
  voter: { id: string; username: string },
  pickedDishId: number,
  now: number
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO players (discord_id, username, first_seen) VALUES (?, ?, ?) " +
        "ON CONFLICT (discord_id) DO UPDATE SET username = excluded.username"
    ).bind(voter.id, voter.username, now),
    env.DB.prepare(
      "INSERT INTO votes (matchup_id, voter_discord_id, picked_dish_id, voted_at) " +
        "VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (matchup_id, voter_discord_id) " +
        "DO UPDATE SET picked_dish_id = excluded.picked_dish_id, voted_at = excluded.voted_at"
    ).bind(matchupId, voter.id, pickedDishId, now),
  ]);
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
      "WHERE d.matches_played > 0 " +
      "GROUP BY d.poster_discord_id " +
      "ORDER BY elo DESC LIMIT ?"
  )
    .bind(limit)
    .all<{ discord_id: string; username: string; elo: number }>();
  return result.results ?? [];
}
