import type { Dish, Env } from "./types";

/**
 * The draw is a rotation. Both halves of a pair come off the least-played end
 * of the pool, so the whole catalog plays once before anything plays twice,
 * then again before anything plays three times. With hundreds of photographs
 * in the channel, a draw that weighted anything above the play count put the
 * same handful on the board over and over while most of the catalog sat unseen.
 *
 * Rating still shapes the pairing, but only as a tiebreak between dishes on the
 * same play count — never as a reason to reach past one that has played less.
 *
 * It is a preference rather than a gate: ordering by play count instead of
 * filtering on it lets the draw spill into the next count on its own when the
 * least-played dishes are all one person's, or have all been paired recently.
 *
 * Recency gets a share of the draw rather than the front of it. Every fourth
 * primary is reserved for something cooked in the last fortnight; the other
 * three are drawn from the unplayed catalog at large, recent or not.
 */

/** Close matchups are tense matchups — decided among the equally played. */
const ELO_BAND = 150;
/** Do not repeat a pair seen within this many recent matchups. The pool is small. */
const RECENT_PAIR_WINDOW = 20;
/** Every Nth matchup is a deliberate mismatch — upsets make the best results. */
const WIDE_GAP_EVERY = 5;

/** Anything cooked in the last fortnight counts as "new" for the fresh slot. */
const RECENT_WINDOW_DAYS = 14;
/**
 * How often the fresh slot fires. The channel is hundreds of photographs deep
 * and only two everyday matchups go up a day, so the unplayed backlog never
 * empties — which turned an unconditional "recent and unplayed goes first" into
 * the whole draw. Every primary came from the last fortnight and the rest of
 * the catalog was unreachable. One primary in four keeps recent cooking on the
 * board without the board being only recent cooking.
 */
const FRESH_SLOT_EVERY = 4;

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
  categories: Category[],
  freshSlot: boolean
): Promise<Dish | null> {
  const notOpen = excludeClause("id", exclude);
  const inCategory = `category IN (${categoryList(categories)})`;

  // The fresh slot. Something cooked recently and never played goes first, so
  // the game keeps tracking what people are actually cooking — but only on its
  // own cadence. It never jumps the rotation: anything unplayed is already at
  // the front of it, and this only decides which of the unplayed goes next.
  if (freshSlot) {
    const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const fresh = await env.DB.prepare(
      `SELECT * FROM dishes WHERE matches_played = 0 AND ${inCategory} ` +
        `AND posted_at > ?${notOpen} ORDER BY RANDOM() LIMIT 1`
    )
      .bind(recentCutoff)
      .first<Dish>();
    if (fresh) return fresh;
  }

  // Otherwise the least-played dish in the pool, drawn at random from
  // everything tied at that count — the unplayed backlog first, then the whole
  // catalog again a round at a time.
  //
  // Random rather than posted_at because ordering the backlog by date would
  // walk a backfilled catalog through the channel's history in chronological
  // order, which is both predictable and a tell — every matchup would pair two
  // dishes from the same era.
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
    // The deliberate mismatch, staged inside the least-played group rather
    // than across the whole catalog. Reaching for the widest rating gap
    // anywhere is reaching for a veteran every fifth matchup — only a
    // well-played dish has a rating far from the opening one.
    //
    // While the backlog is being swept that group is all unrated dishes on the
    // opening rating and there is no gap to find, which is the right answer:
    // there is no mismatch to stage between two dishes nobody has voted on.
    const stretched = await env.DB.prepare(
      `${notRecentlyPaired} ORDER BY d.matches_played ASC, ABS(d.elo - ?3) DESC LIMIT 1`
    )
      .bind(primary.id, recentCutoff, primary.elo, primary.category, primary.poster_discord_id)
      .first<Dish>();
    if (stretched) return stretched;
  }

  // Least played first, then rating. MAX(gap - band, 0) ties every rating
  // inside the band at zero so RANDOM chooses among them rather than always
  // taking the closest, and when the band is too tight for what is left it
  // falls through to the nearest rating outside it instead of skipping the
  // matchup entirely.
  const matched = await env.DB.prepare(
    `${notRecentlyPaired} ` +
      "ORDER BY d.matches_played ASC, MAX(ABS(d.elo - ?3) - ?6, 0) ASC, RANDOM() LIMIT 1"
  )
    .bind(
      primary.id,
      recentCutoff,
      primary.elo,
      primary.category,
      primary.poster_discord_id,
      ELO_BAND
    )
    .first<Dish>();
  if (matched) return matched;

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
/** A ranking round wants five, and is not worth posting below three. */
const BALLOT_MIN = 3;
/** At most this many from one person, so a round is nobody's photo album. */
const BALLOT_PER_POSTER = 2;

/**
 * The draw for a ranking round: the least-played end of one category, in the
 * same rotation the pair draw uses, capped so no one person fills the card.
 *
 * No fresh slot and no wide-gap rule here. Both exist to shape a two-way
 * question — which of these, and how close should it be — and neither has an
 * answer in a five-way round. The rotation already puts the unplayed backlog
 * first, and a spread of ratings across five is what the format is for rather
 * than something to stage.
 */
export async function pickBallot(
  env: Env,
  {
    size = 5,
    categories = DEFAULT_CATEGORIES,
    exclude = [],
  }: { size?: number; categories?: Category[]; exclude?: number[] } = {}
): Promise<Dish[] | null> {
  const notOpen = excludeClause("id", exclude);
  const inCategory = `category IN (${categoryList(categories)})`;

  // Deliberate headroom. The per-poster cap can skip a long run of one
  // person's photographs, and a candidate list exactly `size` long would come
  // up short on a pool that could have filled the card comfortably.
  const candidates = await env.DB.prepare(
    `SELECT * FROM dishes WHERE ${inCategory}${notOpen} ` +
      `ORDER BY matches_played ASC, RANDOM() LIMIT ?`
  )
    .bind(Math.max(1, size) * 5)
    .all<Dish>();

  const chosen: Dish[] = [];
  const perPoster = new Map<string, number>();

  for (const dish of candidates.results ?? []) {
    if (chosen.length >= size) break;
    const already = perPoster.get(dish.poster_discord_id) ?? 0;
    if (already >= BALLOT_PER_POSTER) continue;
    perPoster.set(dish.poster_discord_id, already + 1);
    chosen.push(dish);
  }

  // Below the floor there is nothing here worth posting — three is the fewest
  // that is a ranking rather than a matchup wearing an unfamiliar card.
  if (chosen.length < BALLOT_MIN) return null;

  // Shuffled for the same reason the pair draw randomizes sides: the query
  // hands them back least-played first, so slot 1 would otherwise always be
  // the photograph least likely to have been seen before.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }

  return chosen;
}

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

  const latest = await env.DB.prepare(
    "SELECT COALESCE(MAX(id), 0) AS id FROM matchups"
  ).first<{ id: number }>();
  const latestId = latest?.id ?? 0;
  const recentCutoff = Math.max(0, latestId - RECENT_PAIR_WINDOW);
  const wideGap = (latestId + 1) % WIDE_GAP_EVERY === 0;
  // Keyed off the matchup id like the wide-gap rule, so the cadence is the
  // draw's own rather than a coin flip that can come up heads five times over.
  const freshSlot = (latestId + 1) % FRESH_SLOT_EVERY === 0;

  const primary = await pickPrimary(env, exclude, categories, freshSlot);
  if (!primary) return null;

  const opponent = await pickOpponent(env, primary, recentCutoff, wideGap, exclude);
  if (!opponent) return null;

  // Randomize sides. Otherwise position 1 is always the newer dish and people
  // would learn to read the slot instead of the food.
  return Math.random() < 0.5
    ? { a: primary, b: opponent }
    : { a: opponent, b: primary };
}
