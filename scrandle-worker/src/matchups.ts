import {
  allowedMentions,
  editMessage,
  logToDiscord,
  postMessage,
} from "./discord";
import {
  chefStandings,
  getDish,
  getDueMatchups,
  getOpenMatchup,
  getState,
  playerName,
  setState,
  tallyVotes,
} from "./db";
import { updateElo } from "./elo";
import { matchupImageUrl, resultImageUrl, standingsImageUrl } from "./images";
import { pickPair } from "./matchmaking";
import type { Env, Matchup } from "./types";

const HOUR = 60 * 60 * 1000;
const ACCENT = 0x81a1c1;
const WIN = 0xa3be8c;

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
 * Posts at most one matchup per tick, and only when nothing is still open.
 * Deliberately does not ping the Tasters role: a ping tied to a matchup would
 * correlate with new dishes entering the pool, which is a tell.
 */
export async function postMatchupIfDue(env: Env, now: number): Promise<boolean> {
  const open = await getOpenMatchup(env);
  if (open) return false;

  const lastAt = Number(await getState(env, "last_matchup_at")) || 0;
  const minGap = Number(env.MIN_HOURS_BETWEEN_MATCHUPS || "24") * HOUR;
  if (now - lastAt < minGap) return false;

  const pair = await pickPair(env);
  if (!pair) return false;

  const windowMs = Number(env.VOTE_WINDOW_HOURS || "24") * HOUR;
  const inserted = await env.DB.prepare(
    "INSERT INTO matchups (dish_a_id, dish_b_id, created_at, closes_at) " +
      "VALUES (?, ?, ?, ?) RETURNING id"
  )
    .bind(pair.a.id, pair.b.id, now, now + windowMs)
    .first<{ id: number }>();

  if (!inserted) throw new Error("Failed to create matchup row");
  const matchupId = inserted.id;

  const image = await matchupImageUrl(env, matchupId, pair.a, pair.b);
  const closesAtSeconds = Math.floor((now + windowMs) / 1000);

  // The row has to exist before the post so its id can go in the image URL,
  // which means a failed post would otherwise strand an open matchup that
  // nobody can vote on and that blocks every future one until it expires.
  try {
    const message = await postMessage(env, {
      content:
        `**Matchup #${matchupId}** — which would you rather eat?\n` +
        `Closes <t:${closesAtSeconds}:R>. Your vote is private; you can change it until close.`,
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

  await setState(env, "last_matchup_at", String(now));

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
  const selfVotes = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM votes v JOIN dishes d ON d.id = v.picked_dish_id " +
      "WHERE v.matchup_id = ? AND v.voter_discord_id = d.poster_discord_id"
  )
    .bind(matchup.id)
    .first<{ n: number }>();

  const winner =
    votes.a === votes.b
      ? "A draw."
      : votes.a > votes.b
        ? `**${chefA}** takes it.`
        : `**${chefB}** takes it.`;

  const selfNote =
    selfVotes && selfVotes.n > 0
      ? `\n${selfVotes.n} ${selfVotes.n === 1 ? "person" : "people"} voted for their own dish.`
      : "";

  if (matchup.message_id) {
    await editMessage(env, matchup.message_id, {
      content:
        `**Matchup #${matchup.id} — closed.** ${winner}\n` +
        `${total} ${total === 1 ? "vote" : "votes"}.${selfNote}`,
      embeds: [{ color: WIN, image: { url: image } }],
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

export async function closeDueMatchups(env: Env, now: number): Promise<number> {
  const due = await getDueMatchups(env, now);
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
  await logToDiscord(env, `Posted standings for ${rows.length} chefs.`);

  return true;
}
