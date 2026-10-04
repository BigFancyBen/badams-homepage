import { allowedMentions, postMessage } from "./discord";
import { getState, setState } from "./db";
import { dishFocus, dishUrl } from "./images";
import { parseWeekdays } from "./schedule";
import { drawRounds } from "./weekly-draw";
import type { Dish, Env } from "./types";

/**
 * The weekly Scrandle: the game the channel is named after, played on the
 * site rather than in Discord. Ten pairs of plates off the board, and for each
 * one the player guesses which the channel rated higher.
 *
 * Everything else here asks people what they think. This one asks what they
 * think everybody else thought, which only became a question worth asking once
 * the ratings meant something — see "Ratings carry a deviation" in the README.
 *
 * The Worker's whole part in it is to draw the pairs once a week, freeze them
 * into a JSON file in the public bucket, and say so in the channel. The site
 * reads that file; it never talks to the Worker or the database. A file rather
 * than a route for two reasons: the bucket is already public and the site
 * already knows its address, and a puzzle that is a file cannot change under
 * somebody half way through it. The ratings in it are the ratings on the day
 * it was drawn, whatever the board does afterwards.
 */

const HOUR = 60 * 60 * 1000;

/** How many pairs a puzzle holds. */
export const WEEKLY_ROUNDS = 10;
/** Below this many drawable pairs there is no puzzle worth posting. */
const MIN_ROUNDS = 5;
/** How many past puzzles' plates the draw steers around. */
const RECENT_PUZZLES = 6;

export const WEEKLY_CURRENT_KEY = "weekly/current.json";

function weeklyKey(number: number): string {
  return `weekly/${number}.json`;
}

export interface WeeklyPlate {
  id: number;
  image: string;
  name: string;
  chef: string;
  /** Rounded, as it stood when the puzzle was drawn. */
  rating: number;
  /** Where the food is in the frame, for the crop. Absent until classified. */
  focus?: [number, number];
}

export interface WeeklyPuzzle {
  number: number;
  postedAt: number;
  rounds: { a: WeeklyPlate; b: WeeklyPlate }[];
}

type PoolRow = Dish & { chef: string };

/**
 * Cooking that has been voted on. An unplayed plate is still on the opening
 * rating, and asking which of two 1500s the channel preferred is asking
 * nothing. Food only: it is the pool with the depth, and "which plate" is the
 * question the game is named for.
 */
async function weeklyPool(env: Env): Promise<PoolRow[]> {
  const result = await env.DB.prepare(
    "SELECT d.*, COALESCE(p.username, 'unknown chef') AS chef " +
      "FROM dishes d LEFT JOIN players p ON p.discord_id = d.poster_discord_id " +
      "WHERE d.category = 'food' AND d.matches_played > 0"
  ).all<PoolRow>();
  return result.results ?? [];
}

function plate(env: Env, dish: PoolRow): WeeklyPlate {
  return {
    id: dish.id,
    image: dishUrl(env, dish),
    name: dish.name ?? "",
    chef: dish.chef,
    rating: Math.round(dish.elo),
    focus: dishFocus(dish),
  };
}

async function buildPuzzle(
  env: Env,
  number: number,
  now: number
): Promise<WeeklyPuzzle | null> {
  const pool = await weeklyPool(env);
  const recentRaw = await getState(env, "weekly_recent");
  const recent = new Set<number>(recentRaw ? JSON.parse(recentRaw).flat() : []);

  const rounds = drawRounds(
    pool.map((dish) => ({
      id: dish.id,
      poster: dish.poster_discord_id,
      rating: Math.round(dish.elo),
      dish,
    })),
    recent,
    WEEKLY_ROUNDS
  );
  if (rounds.length < MIN_ROUNDS) return null;

  return {
    number,
    postedAt: now,
    rounds: rounds.map(([a, b]) => ({
      a: plate(env, a.dish),
      b: plate(env, b.dish),
    })),
  };
}

function putJson(env: Env, key: string, body: string): Promise<unknown> {
  return env.BUCKET.put(key, body, {
    httpMetadata: {
      contentType: "application/json",
      // Short. The site caches it too, and a puzzle that takes an hour to
      // appear after the bot announced it is the bot being wrong for an hour.
      cacheControl: "public, max-age=300",
    },
  });
}

/**
 * Draws this week's puzzle, publishes it, and tells the channel.
 *
 * Gated like the standings rather than like the rounds: any tick on the day,
 * at or after the hour, once six days have passed since the last one. A round
 * that misses its minute skips its week; this retries every tick until it
 * lands, because a week with no puzzle is a week the site shows a stale one.
 *
 * The order is publish, then announce, then record. A puzzle is written under
 * its number before anything else and read back from there if it exists, so a
 * tick that published and then failed to post announces the *same* puzzle on
 * the next one rather than drawing a second and swapping it under whoever had
 * already found the first. The worst case is the alert arriving a tick late.
 *
 * It does not ping. The standings are the one post that does, and this goes
 * out an hour after them.
 */
export async function postWeeklyIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  if (!force) {
    const date = new Date(now);
    if (!parseWeekdays(env.WEEKLY_WEEKDAY).includes(date.getUTCDay())) {
      return false;
    }
    if (date.getUTCHours() < Number(env.WEEKLY_HOUR_UTC || "18")) return false;

    const lastAt = Number(await getState(env, "last_weekly_at")) || 0;
    if (now - lastAt < 6 * 24 * HOUR) return false;
  }

  const number = (Number(await getState(env, "weekly_number")) || 0) + 1;

  const existing = await env.BUCKET.get(weeklyKey(number));
  let body = existing ? await existing.text() : null;
  if (!body) {
    const puzzle = await buildPuzzle(env, number, now);
    // Too little of the catalog has been voted on to fill a puzzle.
    if (!puzzle) return false;
    body = JSON.stringify(puzzle);
    await putJson(env, weeklyKey(number), body);
  }
  const puzzle = JSON.parse(body) as WeeklyPuzzle;

  await putJson(env, WEEKLY_CURRENT_KEY, body);

  await postMessage(env, {
    content:
      `**Scrandle #${number} is up.** ${puzzle.rounds.length} pairs off the board — ` +
      `pick the plate the channel rated higher.\n${env.WEEKLY_URL}`,
    allowed_mentions: allowedMentions(env),
  });

  const recentRaw = await getState(env, "weekly_recent");
  const recent: number[][] = recentRaw ? JSON.parse(recentRaw) : [];
  recent.push(puzzle.rounds.flatMap((round) => [round.a.id, round.b.id]));
  // The number first: it is the one that stops the next tick announcing this
  // puzzle a second time.
  await setState(env, "weekly_number", String(number));
  // A forced puzzle is an extra one and leaves the calendar alone, the same
  // way a forced contest does: the next scheduled day still draws.
  if (!force) await setState(env, "last_weekly_at", String(now));
  await setState(
    env,
    "weekly_recent",
    JSON.stringify(recent.slice(-RECENT_PUZZLES))
  );

  return true;
}

/** The current puzzle, straight out of the bucket. Null before the first one. */
export async function currentWeekly(env: Env): Promise<string | null> {
  const object = await env.BUCKET.get(WEEKLY_CURRENT_KEY);
  return object ? object.text() : null;
}
