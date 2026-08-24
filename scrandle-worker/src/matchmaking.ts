import type { Dish, Env } from "./types";

/** Close matchups are tense matchups. */
const ELO_BAND = 150;
/** Do not repeat a pair seen within this many recent matchups. The pool is small. */
const RECENT_PAIR_WINDOW = 20;
/** Every Nth matchup is a deliberate mismatch — upsets make the best results. */
const WIDE_GAP_EVERY = 5;

/** Anything cooked in the last fortnight counts as "new" and jumps the queue. */
const RECENT_WINDOW_DAYS = 14;

/** The classifier's labels that can enter a matchup. Anything else cannot. */
const CATEGORIES = ["food", "drink", "place", "person"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * The everyday draw. Places and people are bonus-only — drawn on their own
 * days by the weekly place and person matchups — so they are not in here.
 */
export const DEFAULT_CATEGORIES: Category[] = ["food", "drink"];

/**
 * Ids come straight out of the database and are integer-checked here, so they
 * are inlined rather than bound — the placeholder count varies with the list
 * length, and the alternative is rebuilding every query's bind order.
 */
function excludeClause(column: string, ids: number[]): string {
  const safe = ids.filter((id) => Number.isInteger(id));
  return safe.length ? ` AND ${column} NOT IN (${safe.join(",")})` : "";
}

/**
 * Inlined for the same reason as the ids, and checked against the known list
 * rather than escaped — a category that is not one of ours is a bug, not a
 * value to pass through to SQL.
 */
function categoryList(categories: Category[]): string {
  const safe = categories.filter((c) => CATEGORIES.includes(c));
  if (safe.length === 0) throw new Error("No valid categories to draw from");
  return safe.map((c) => `'${c}'`).join(",");
}

async function pickPrimary(
  env: Env,
  exclude: number[],
  categories: Category[]
): Promise<Dish | null> {
  // Something cooked recently and never played goes first — that is the case
  // the guaranteed-slot rule was written for, and it keeps the game tracking
  // what people are actually cooking.
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const notOpen = excludeClause("id", exclude);
  const inCategory = `category IN (${categoryList(categories)})`;
  const fresh = await env.DB.prepare(
    `SELECT * FROM dishes WHERE first_matchup_id IS NULL AND ${inCategory} ` +
      `AND posted_at > ?${notOpen} ORDER BY RANDOM() LIMIT 1`
  )
    .bind(recentCutoff)
    .first<Dish>();
  if (fresh) return fresh;

  // Otherwise draw at random from the unplayed backlog. Ordering this by
  // posted_at would walk a backfilled catalog through the channel's history in
  // chronological order, which is both predictable and a tell — every matchup
  // would pair two dishes from the same era.
  const unplayed = await env.DB.prepare(
    `SELECT * FROM dishes WHERE first_matchup_id IS NULL AND ${inCategory}` +
      `${notOpen} ORDER BY RANDOM() LIMIT 1`
  ).first<Dish>();
  if (unplayed) return unplayed;

  return env.DB.prepare(
    `SELECT * FROM dishes WHERE ${inCategory}` +
      `${notOpen} ORDER BY matches_played ASC, RANDOM() LIMIT 1`
  ).first<Dish>();
}

async function pickOpponent(
  env: Env,
  primary: Dish,
  recentCutoff: number,
  wideGap: boolean,
  exclude: number[]
): Promise<Dish | null> {
  // ?4 is the primary's category, ?5 its poster. Categories have to match —
  // pairing a cocktail against a casserole is not a question anyone can answer
  // — and the poster must differ: two photographs from the same person is not a
  // matchup anyone can take a side on, so we never pit someone against himself.
  const notRecentlyPaired =
    "SELECT * FROM dishes d WHERE d.id != ?1 AND d.category = ?4 " +
    "AND d.poster_discord_id != ?5 AND NOT EXISTS (" +
    "  SELECT 1 FROM matchups m WHERE m.id > ?2 AND (" +
    "    (m.dish_a_id = ?1 AND m.dish_b_id = d.id) OR" +
    "    (m.dish_a_id = d.id AND m.dish_b_id = ?1)" +
    "  )" +
    ")" +
    excludeClause("d.id", exclude);

  if (wideGap) {
    const stretched = await env.DB.prepare(
      `${notRecentlyPaired} ORDER BY ABS(d.elo - ?3) DESC, d.matches_played ASC LIMIT 1`
    )
      .bind(primary.id, recentCutoff, primary.elo, primary.category, primary.poster_discord_id)
      .first<Dish>();
    if (stretched) return stretched;
  }

  const banded = await env.DB.prepare(
    `${notRecentlyPaired} AND ABS(d.elo - ?3) <= ?6 ` +
      "ORDER BY d.matches_played ASC, ABS(d.elo - ?3) ASC, RANDOM() LIMIT 1"
  )
    .bind(primary.id, recentCutoff, primary.elo, primary.category, primary.poster_discord_id, ELO_BAND)
    .first<Dish>();
  if (banded) return banded;

  // Band too tight for the current catalog — take the nearest rating instead
  // of skipping the matchup entirely.
  const nearest = await env.DB.prepare(
    `${notRecentlyPaired} ORDER BY ABS(d.elo - ?3) ASC, d.matches_played ASC LIMIT 1`
  )
    .bind(primary.id, recentCutoff, primary.elo, primary.category, primary.poster_discord_id)
    .first<Dish>();
  if (nearest) return nearest;

  // Every eligible opponent has been paired with this dish recently. Allow a
  // repeat pairing — but still never the same poster; that rule does not bend,
  // so this can come back empty and skip the matchup when a category holds only
  // one person's photographs.
  return env.DB.prepare(
    "SELECT * FROM dishes WHERE id != ? AND category = ? AND poster_discord_id != ?" +
      `${excludeClause("id", exclude)} ORDER BY matches_played ASC, RANDOM() LIMIT 1`
  )
    .bind(primary.id, primary.category, primary.poster_discord_id)
    .first<Dish>();
}

/**
 * `exclude` keeps dishes that are already live out of the draw — the same
 * photograph appearing in two simultaneous matchups would be indefensible.
 * `categories` narrows the pool: the place and person bonuses draw those
 * categories, everything else draws food and drink.
 *
 * Returns null when no valid opponent exists — including when a category holds
 * only one person's photographs, since the opponent can never share the
 * primary's poster.
 */
export async function pickPair(
  env: Env,
  {
    exclude = [],
    categories = DEFAULT_CATEGORIES,
  }: { exclude?: number[]; categories?: Category[] } = {}
): Promise<{ a: Dish; b: Dish } | null> {
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM dishes WHERE category IN (${categoryList(categories)})`
  ).first<{ n: number }>();
  if (!count || count.n < 2) return null;

  const primary = await pickPrimary(env, exclude, categories);
  if (!primary) return null;

  const latest = await env.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) AS id FROM matchups"
  ).first<{ id: number }>();
  const latestId = latest?.id ?? 0;
  const recentCutoff = Math.max(0, latestId - RECENT_PAIR_WINDOW);
  const wideGap = (latestId + 1) % WIDE_GAP_EVERY === 0;

  const opponent = await pickOpponent(env, primary, recentCutoff, wideGap, exclude);
  if (!opponent) return null;

  // Randomize sides. Otherwise position 1 is always the newer dish and people
  // would learn to read the slot instead of the food.
  return Math.random() < 0.5
    ? { a: primary, b: opponent }
    : { a: opponent, b: primary };
}
