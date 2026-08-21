import type { Dish, Env } from "./types";

/** Close matchups are tense matchups. */
const ELO_BAND = 150;
/** Do not repeat a pair seen within this many recent matchups. The pool is small. */
const RECENT_PAIR_WINDOW = 20;
/** Every Nth matchup is a deliberate mismatch — upsets make the best results. */
const WIDE_GAP_EVERY = 5;

/** Anything cooked in the last fortnight counts as "new" and jumps the queue. */
const RECENT_WINDOW_DAYS = 14;

async function pickPrimary(env: Env): Promise<Dish | null> {
  // Something cooked recently and never played goes first — that is the case
  // the guaranteed-slot rule was written for, and it keeps the game tracking
  // what people are actually cooking.
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const fresh = await env.DB.prepare(
    "SELECT * FROM dishes WHERE first_matchup_id IS NULL AND category IS NOT NULL " +
      "AND posted_at > ? ORDER BY RANDOM() LIMIT 1"
  )
    .bind(recentCutoff)
    .first<Dish>();
  if (fresh) return fresh;

  // Otherwise draw at random from the unplayed backlog. Ordering this by
  // posted_at would walk a backfilled catalog through the channel's history in
  // chronological order, which is both predictable and a tell — every matchup
  // would pair two dishes from the same era.
  const unplayed = await env.DB.prepare(
    "SELECT * FROM dishes WHERE first_matchup_id IS NULL AND category IS NOT NULL " +
      "ORDER BY RANDOM() LIMIT 1"
  ).first<Dish>();
  if (unplayed) return unplayed;

  return env.DB.prepare(
    "SELECT * FROM dishes WHERE category IS NOT NULL " +
      "ORDER BY matches_played ASC, RANDOM() LIMIT 1"
  ).first<Dish>();
}

async function pickOpponent(
  env: Env,
  primary: Dish,
  recentCutoff: number,
  wideGap: boolean
): Promise<Dish | null> {
  // ?4 is the primary's category. Pairing a cocktail against a casserole is
  // not a question anyone can answer, so the categories have to match.
  const notRecentlyPaired =
    "SELECT * FROM dishes d WHERE d.id != ?1 AND d.category = ?4 AND NOT EXISTS (" +
    "  SELECT 1 FROM matchups m WHERE m.id > ?2 AND (" +
    "    (m.dish_a_id = ?1 AND m.dish_b_id = d.id) OR" +
    "    (m.dish_a_id = d.id AND m.dish_b_id = ?1)" +
    "  )" +
    ")";

  if (wideGap) {
    const stretched = await env.DB.prepare(
      `${notRecentlyPaired} ORDER BY ABS(d.elo - ?3) DESC, d.matches_played ASC LIMIT 1`
    )
      .bind(primary.id, recentCutoff, primary.elo, primary.category)
      .first<Dish>();
    if (stretched) return stretched;
  }

  const banded = await env.DB.prepare(
    `${notRecentlyPaired} AND ABS(d.elo - ?3) <= ?5 ` +
      "ORDER BY d.matches_played ASC, ABS(d.elo - ?3) ASC, RANDOM() LIMIT 1"
  )
    .bind(primary.id, recentCutoff, primary.elo, primary.category, ELO_BAND)
    .first<Dish>();
  if (banded) return banded;

  // Band too tight for the current catalog — take the nearest rating instead
  // of skipping the matchup entirely.
  const nearest = await env.DB.prepare(
    `${notRecentlyPaired} ORDER BY ABS(d.elo - ?3) ASC, d.matches_played ASC LIMIT 1`
  )
    .bind(primary.id, recentCutoff, primary.elo, primary.category)
    .first<Dish>();
  if (nearest) return nearest;

  // Everything has been paired with this dish recently. Allow a repeat.
  return env.DB.prepare(
    "SELECT * FROM dishes WHERE id != ? AND category = ? " +
      "ORDER BY matches_played ASC, RANDOM() LIMIT 1"
  )
    .bind(primary.id, primary.category)
    .first<Dish>();
}

export async function pickPair(
  env: Env
): Promise<{ a: Dish; b: Dish } | null> {
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dishes"
  ).first<{ n: number }>();
  if (!count || count.n < 2) return null;

  const primary = await pickPrimary(env);
  if (!primary) return null;

  const latest = await env.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) AS id FROM matchups"
  ).first<{ id: number }>();
  const latestId = latest?.id ?? 0;
  const recentCutoff = Math.max(0, latestId - RECENT_PAIR_WINDOW);
  const wideGap = (latestId + 1) % WIDE_GAP_EVERY === 0;

  const opponent = await pickOpponent(env, primary, recentCutoff, wideGap);
  if (!opponent) return null;

  // Randomize sides. Otherwise position 1 is always the newer dish and people
  // would learn to read the slot instead of the food.
  return Math.random() < 0.5
    ? { a: primary, b: opponent }
    : { a: opponent, b: primary };
}
