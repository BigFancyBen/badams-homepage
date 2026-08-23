import { allowedMentions, editMessage, postMessage } from "./discord";
import {
  chefStandings,
  getDish,
  getDueMatchups,
  getOpenMatchup,
  getOpenMatchups,
  getState,
  playerName,
  setState,
  tallyVotes,
} from "./db";
import { updateElo } from "./elo";
import { matchupImageUrl, resultImageUrl, standingsImageUrl } from "./images";
import { pickPair } from "./matchmaking";
import { nextPostTime, parsePostHours, postSlotKey } from "./schedule";
import type { Dish, Env, Matchup } from "./types";

const HOUR = 60 * 60 * 1000;
const ACCENT = 0x81a1c1;
const WIN = 0xa3be8c;

/**
 * Jump link to the message a dish came from, so people can read the original
 * context. Note this also reveals the poster — anyone who clicks sees who
 * cooked it.
 */
function sourceLink(env: Env, dish: Dish, label: string): string {
  return `[${label}](https://discord.com/channels/${env.DISCORD_GUILD_ID}/${env.DISCORD_CHANNEL_ID}/${dish.discord_message_id})`;
}

function voteButtons(matchupId: number) {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "1", custom_id: `v:${matchupId}:a` },
        { type: 2, style: 2, label: "2", custom_id: `v:${matchupId}:b` },
      ],
    },
  ];
}

/**
 * Creates the row, renders the card against its id, posts it, and records the
 * message. Shared by the everyday matchup and the Wednesday place bonus.
 */
async function createAndPost(
  env: Env,
  pair: { a: Dish; b: Dish },
  now: number,
  closesAt: number,
  preamble = ""
): Promise<void> {
  const inserted = await env.DB.prepare(
    "INSERT INTO matchups (dish_a_id, dish_b_id, created_at, closes_at) " +
      "VALUES (?, ?, ?, ?) RETURNING id"
  )
    .bind(pair.a.id, pair.b.id, now, closesAt)
    .first<{ id: number }>();

  if (!inserted) throw new Error("Failed to create matchup row");
  const matchupId = inserted.id;

  const image = await matchupImageUrl(env, matchupId, pair.a, pair.b);

  // The row has to exist before the post so its id can go in the image URL,
  // which means a failed post would otherwise strand an open matchup that
  // nobody can vote on and that blocks every future one until it expires.
  try {
    // Just the two jump links — no preamble. The card already carries the
    // question and the matchup number. The place bonus is the exception: it
    // runs beside an ordinary matchup, so it has to say which one it is.
    const links = `${sourceLink(env, pair.a, "#1")} · ${sourceLink(env, pair.b, "#2")}`;
    const message = await postMessage(env, {
      content: preamble ? `${preamble}
${links}` : links,
      embeds: [{ color: ACCENT, image: { url: image } }],
      components: voteButtons(matchupId),
      allowed_mentions: allowedMentions(env),
    });

    await env.DB.prepare("UPDATE matchups SET message_id = ? WHERE id = ?")
      .bind(message.id, matchupId)
      .run();
  } catch (error) {
    await env.DB.prepare("DELETE FROM matchups WHERE id = ?").bind(matchupId).run();
    throw error;
  }
}

/**
 * Posts at most one matchup per tick, and only when nothing is still open.
 * Deliberately does not ping the Tasters role: a ping tied to a matchup would
 * correlate with new dishes entering the pool, which is a tell.
 */
export async function postMatchupIfDue(
  env: Env,
  now: number,
  { force = false, overlap = false }: { force?: boolean; overlap?: boolean } = {}
): Promise<boolean> {
  // Never post over a matchup that is still open, even when forced — two live
  // matchups split the vote. `overlap` is the single deliberate exception: an
  // admin-triggered bonus matchup running beside the scheduled one. The close
  // path already iterates every open matchup and votes are keyed to a matchup
  // id on the button, so the only cost is the split attention.
  const liveDishIds: number[] = [];
  if (overlap) {
    for (const live of await getOpenMatchups(env)) {
      liveDishIds.push(live.dish_a_id, live.dish_b_id);
    }
  } else if (await getOpenMatchup(env)) {
    return false;
  }

  const hours = parsePostHours(env.POST_HOURS_UTC);

  if (!force) {
    // Post on named hours rather than "N hours since the last one". Elapsed
    // time drifts: one late post pushes every post after it, and within days
    // the matchup is landing at an arbitrary hour. Fixed hours stay put.
    if (hours.length > 0 && !hours.includes(new Date(now).getUTCHours())) {
      return false;
    }

    // One post per named hour, so a retry inside the same hour cannot
    // double-post. Deliberately not an elapsed-time floor — see postSlotKey.
    if ((await getState(env, "last_matchup_slot")) === postSlotKey(now)) {
      return false;
    }
  }

  const pair = await pickPair(env, { exclude: liveDishIds });
  if (!pair) return false;

  // Closes when the next matchup is due, not a fixed span from right now. A
  // forced post at an odd hour therefore gets a short window rather than one
  // that runs past the next scheduled slot and blocks it.
  const closesAt = nextPostTime(
    hours,
    now,
    Number(env.VOTE_WINDOW_HOURS || "24") * HOUR
  );

  await createAndPost(env, pair, now, closesAt);

  // A bonus matchup does not claim the hour's slot. Marking it would make an
  // overlapping post fired during a named hour swallow that hour's scheduled
  // matchup, which is the exact cycle-skipping this flag exists to avoid.
  if (!overlap) await setState(env, "last_matchup_slot", postSlotKey(now));

  return true;
}

/**
 * The Wednesday bonus: places rather than plates. Three things make it its own
 * function instead of a flag on the everyday matchup.
 *
 * It runs *beside* whatever ordinary matchup is open — that is what makes it a
 * bonus — so it deliberately skips the one-at-a-time rule, drawing on the same
 * exception the admin overlap flag uses.
 *
 * It gets a flat 24-hour window instead of closing on the next posting hour.
 * It is not part of the food cadence and must not hand its slot to it: closing
 * on the schedule would end it at 9pm the same evening.
 *
 * And it keeps its own slot key, so posting one never marks the food slot as
 * used. Places are drawn only here — the everyday matchup filters them out.
 */
export async function postPlaceMatchupIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  if (!force) {
    const weekday = Number(env.PLACE_WEEKDAY ?? "-1");
    if (!Number.isInteger(weekday) || weekday < 0) return false;

    const date = new Date(now);
    if (date.getUTCDay() !== weekday) return false;
    if (date.getUTCHours() !== Number(env.PLACE_HOUR_UTC || "18")) return false;

    // One per named hour, so an hourly retry cannot double-post. Same
    // reasoning as last_matchup_slot, on a key of its own.
    if ((await getState(env, "last_place_slot")) === postSlotKey(now)) {
      return false;
    }
  }

  // Whatever is live keeps its photographs to itself.
  const liveDishIds: number[] = [];
  for (const live of await getOpenMatchups(env)) {
    liveDishIds.push(live.dish_a_id, live.dish_b_id);
  }

  const pair = await pickPair(env, {
    exclude: liveDishIds,
    categories: ["place"],
  });
  // Fewer than two places in the catalog, or both of them already live.
  if (!pair) return false;

  const window = Number(env.PLACE_WINDOW_HOURS || "24") * HOUR;
  await createAndPost(env, pair, now, now + window, "Bonus round — place vs place.");

  await setState(env, "last_place_slot", postSlotKey(now));

  return true;
}

async function closeOne(env: Env, matchup: Matchup, now: number): Promise<void> {
  const [dishA, dishB] = await Promise.all([
    getDish(env, matchup.dish_a_id),
    getDish(env, matchup.dish_b_id),
  ]);
  if (!dishA || !dishB) throw new Error(`Matchup ${matchup.id} has a missing dish`);

  const votes = await tallyVotes(env, matchup);
  const next = updateElo(dishA.elo, dishB.elo, votes.a, votes.b);

  const closeMatchup = env.DB.prepare(
    "UPDATE matchups SET status = 'closed', closed_at = ?, votes_a = ?, votes_b = ?, " +
      "elo_a_before = ?, elo_b_before = ?, elo_a_after = ?, elo_b_after = ? WHERE id = ?"
  ).bind(now, votes.a, votes.b, dishA.elo, dishB.elo, next.a, next.b, matchup.id);

  // A matchup nobody voted on is not a match played. Counting it would burn
  // both dishes' unplayed status and skew the low-matches_played preference
  // without any rating information to show for it.
  if (votes.a + votes.b === 0) {
    await closeMatchup.run();

    // Still strip the buttons. Leaving them live on a closed matchup means the
    // card looks votable forever, and anyone who clicks gets told voting has
    // closed by a message that gives no sign of it.
    if (matchup.message_id) {
      await editMessage(env, matchup.message_id, {
        content: `**Matchup #${matchup.id} — closed.** Nobody voted.`,
        components: [],
        allowed_mentions: allowedMentions(env),
      });
    }
    return;
  }

  await env.DB.batch([
    closeMatchup,
    env.DB.prepare(
      "UPDATE dishes SET elo = ?, matches_played = matches_played + 1, " +
        "first_matchup_id = COALESCE(first_matchup_id, ?) WHERE id = ?"
    ).bind(next.a, matchup.id, dishA.id),
    env.DB.prepare(
      "UPDATE dishes SET elo = ?, matches_played = matches_played + 1, " +
        "first_matchup_id = COALESCE(first_matchup_id, ?) WHERE id = ?"
    ).bind(next.b, matchup.id, dishB.id),
  ]);

  const [chefA, chefB] = await Promise.all([
    playerName(env, dishA.poster_discord_id),
    playerName(env, dishB.poster_discord_id),
  ]);

  const image = await resultImageUrl(
    env,
    matchup.id,
    dishA,
    dishB,
    votes.a,
    votes.b,
    chefA,
    chefB
  );

  const total = votes.a + votes.b;

  const winner =
    votes.a === votes.b
      ? "A draw."
      : votes.a > votes.b
        ? `**${chefA}** takes it.`
        : `**${chefB}** takes it.`;

  if (matchup.message_id) {
    await editMessage(env, matchup.message_id, {
      content:
        `**Matchup #${matchup.id} — closed.** ${winner}\n` +
        `${total} ${total === 1 ? "vote" : "votes"}.\n` +
        `${sourceLink(env, dishA, "#1")} · ${sourceLink(env, dishB, "#2")}`,
      embeds: [{ color: WIN, image: { url: image } }],
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

export async function closeDueMatchups(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  // Forcing ignores closes_at and shuts whatever is open — used to exercise
  // the reveal on demand rather than waiting out a vote window.
  const due = force
    ? await getOpenMatchups(env)
    : await getDueMatchups(env, now);

  for (const matchup of due) {
    await closeOne(env, matchup, now);
  }
  return due.length;
}

/** Weekly standings post. The one place a role ping is appropriate. */
export async function postStandingsIfDue(
  env: Env,
  now: number
): Promise<boolean> {
  const weekday = Number(env.STANDINGS_WEEKDAY ?? "-1");
  if (weekday < 0) return false;

  const date = new Date(now);
  if (date.getUTCDay() !== weekday) return false;
  if (date.getUTCHours() < Number(env.STANDINGS_HOUR_UTC || "17")) return false;

  const lastAt = Number(await getState(env, "last_standings_at")) || 0;
  if (now - lastAt < 6 * 24 * HOUR) return false;

  const standings = await chefStandings(env);
  if (standings.length === 0) return false;

  const snapshotRaw = await getState(env, "standings_snapshot");
  const snapshot: Record<string, number> = snapshotRaw
    ? JSON.parse(snapshotRaw)
    : {};

  const rows = standings.map((chef) => {
    const previous = snapshot[chef.discord_id];
    const elo = Math.round(chef.elo);
    return {
      n: chef.username,
      e: elo,
      d: previous === undefined ? 0 : elo - Math.round(previous),
    };
  });

  const image = await standingsImageUrl(
    env,
    Math.floor(now / 1000),
    "Chef standings",
    rows
  );

  const ping = env.TASTER_ROLE_ID ? `<@&${env.TASTER_ROLE_ID}> ` : "";
  await postMessage(env, {
    content: `${ping}This week in the kitchen.`,
    embeds: [{ color: ACCENT, image: { url: image } }],
    allowed_mentions: allowedMentions(env),
  });

  const nextSnapshot: Record<string, number> = {};
  for (const chef of standings) nextSnapshot[chef.discord_id] = chef.elo;

  await setState(env, "standings_snapshot", JSON.stringify(nextSnapshot));
  await setState(env, "last_standings_at", String(now));

  return true;
}
