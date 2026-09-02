import {
  ACCENT,
  WIN,
  allowedMentions,
  ballotEmbed,
  editMessage,
  escapeMarkdown,
  logToDiscord,
  messageUrl,
  postMessage,
  replyTo,
  sourceLink,
} from "./discord";
import {
  getDueRounds,
  getOpenMatchups,
  getOpenRounds,
  heldDishIds,
  getRound,
  getRoundBallots,
  getRoundByMessage,
  getRoundEntries,
  getState,
  playerName,
  setState,
} from "./db";
import { scoreRanking, type RankingResult } from "./elo";
import {
  ballotImageUrl,
  ballotResultImageUrl,
  cardKey,
  dishUrl,
  renderCard,
} from "./images";
import { pickBallot, type Category } from "./matchmaking";
import { parseWeekdays, postSlotKey } from "./schedule";
import type { Env, Round, RoundDish } from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * A ranking round.
 *
 * Five photographs on one card, and each voter clicks them in the order they
 * like them — first click is their favourite. It replaced the place-vs-place
 * pair because a pair asks the wrong question of places: two holiday snaps
 * side by side is a coin toss, while five in an order is a real opinion and
 * gets four times the information out of the same click.
 *
 * A ballot does not have to be finished. Click one and wander off and that is
 * a valid vote — see scoreRanking for why a partial ballot still says
 * something about every pair it touches. That is deliberate: a round that
 * demanded five clicks from everybody would collect fewer opinions than the
 * one-click matchup it replaced, not more.
 */

/** Position labels, for the result card. Beyond five it falls back to "6th". */
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

function ordinal(index: number): string {
  return ORDINALS[index] ?? `${index + 1}th`;
}

/**
 * One row of numbered buttons, plus a way out. Five is the most Discord will
 * put in an action row, which is also the most photographs worth ranking in
 * one go — the card has to stay readable on a phone.
 */
function ballotButtons(roundId: number, entries: RoundDish[]) {
  return [
    {
      type: 1,
      components: entries.map((entry) => ({
        type: 2,
        style: 2,
        label: String(entry.slot),
        custom_id: `b:${roundId}:${entry.slot}`,
      })),
    },
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "Start over", custom_id: `bx:${roundId}` },
      ],
    },
  ];
}

/**
 * Creates the row and its entries, renders the card against the round id,
 * posts it, and records the message. Mirrors createAndPost on the pair side,
 * including the reason the row has to exist before the post: the id goes in
 * the image URL, and a failed post would otherwise strand an open round.
 */
async function createAndPost(
  env: Env,
  category: Category,
  dishes: { id: number }[],
  now: number,
  closesAt: number,
  preamble: string
): Promise<void> {
  const inserted = await env.DB.prepare(
    "INSERT INTO rounds (category, created_at, closes_at) VALUES (?, ?, ?) " +
      "RETURNING id"
  )
    .bind(category, now, closesAt)
    .first<{ id: number }>();

  if (!inserted) throw new Error("Failed to create round row");
  const roundId = inserted.id;

  await env.DB.batch(
    dishes.map((dish, index) =>
      env.DB.prepare(
        "INSERT INTO round_entries (round_id, dish_id, slot, elo_before) " +
          "VALUES (?, ?, ?, (SELECT elo FROM dishes WHERE id = ?))"
      ).bind(roundId, dish.id, index + 1, dish.id)
    )
  );

  const entries = await getRoundEntries(env, roundId);

  const image = await renderCard(env, cardKey("ballot", roundId), (attempt) =>
    ballotImageUrl(env, roundId, entries, attempt)
  );

  if (!image) {
    await logToDiscord(
      env,
      `Round #${roundId} posted without a card — the render never came back. ` +
        `Retry it with /admin/repair-card?round=${roundId}.`
    );
  }

  try {
    const links = entries
      .map((entry) => sourceLink(env, entry, `#${entry.slot}`))
      .join(" · ");

    const message = await postMessage(env, {
      content: `${preamble}\n${links}`,
      embeds: image ? [{ color: ACCENT, image: { url: image } }] : [],
      components: ballotButtons(roundId, entries),
      allowed_mentions: allowedMentions(env),
    });

    await env.DB.prepare("UPDATE rounds SET message_id = ? WHERE id = ?")
      .bind(message.id, roundId)
      .run();
  } catch (error) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM round_entries WHERE round_id = ?").bind(roundId),
      env.DB.prepare("DELETE FROM rounds WHERE id = ?").bind(roundId),
    ]);
    throw error;
  }
}

/**
 * The weekly place round. Runs on the weekdays listed in PLACE_WEEKDAY at
 * PLACE_HOUR_UTC, keeps its own slot key so it never claims the food schedule's
 * hour, and takes a flat window rather than closing on a posting hour — it is
 * not part of the food cadence and must not hand its slot to it.
 *
 * Places are drawn nowhere else. The everyday matchup filters them out.
 */
export async function postPlaceRoundIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  const weekdays = parseWeekdays(env.PLACE_WEEKDAY);

  if (!force) {
    if (weekdays.length === 0) return false;

    const date = new Date(now);
    if (!weekdays.includes(date.getUTCDay())) return false;
    if (date.getUTCHours() !== Number(env.PLACE_HOUR_UTC || "18")) return false;
    if (date.getUTCMinutes() !== 0) return false;

    // One per named slot, so an hourly retry cannot double-post.
    if ((await getState(env, "last_place_slot")) === postSlotKey(now)) {
      return false;
    }
  }

  // Whatever is live keeps its photographs to itself — the open pair matchups,
  // any round that has not closed yet, and a running caption contest.
  const live: number[] = await heldDishIds(env);
  for (const matchup of await getOpenMatchups(env)) {
    live.push(matchup.dish_a_id, matchup.dish_b_id);
  }

  const dishes = await pickBallot(env, {
    size: Number(env.PLACE_BALLOT_SIZE || "5"),
    categories: ["place"],
    exclude: live,
  });
  // Too few places in the catalog, or too many of them one person's.
  if (!dishes) return false;

  await createAndPost(
    env,
    "place",
    dishes,
    now,
    now + Number(env.PLACE_WINDOW_HOURS || "24") * HOUR,
    "Bonus round — rank the places. Click them best first; you can stop whenever."
  );

  await setState(env, "last_place_slot", postSlotKey(now));

  return true;
}

/** The ballot log: everyone's order, in the order they started ranking. */
function ballotLines(
  ballots: { name: string; dishIds: number[] }[],
  slotOf: Map<number, number>
): string[] {
  return ballots.map((ballot) => {
    const order = ballot.dishIds
      .map((id) => `#${slotOf.get(id) ?? "?"}`)
      .join(" › ");
    return `**${escapeMarkdown(ballot.name)}** ${order}`;
  });
}

async function closeOne(env: Env, round: Round, now: number): Promise<void> {
  const entries = await getRoundEntries(env, round.id);
  if (entries.length === 0) throw new Error(`Round ${round.id} has no entries`);

  const ballots = await getRoundBallots(env, round.id);

  // A round nobody ranked is not a round played, for the same reason an
  // unvoted matchup is not: it would burn every photograph's unplayed status
  // and skew the rotation with no rating information to show for it. It gets
  // no result post either — there is nothing to reveal, and a new message to
  // say so would be louder than anything the round managed while it was open.
  if (ballots.length === 0) {
    await env.DB.prepare(
      "UPDATE rounds SET status = 'closed', closed_at = ? WHERE id = ?"
    )
      .bind(now, round.id)
      .run();

    if (round.message_id) {
      await editMessage(env, round.message_id, {
        content: `**Round #${round.id} — closed.** Nobody ranked them.`,
        components: [],
        allowed_mentions: allowedMentions(env),
      });
    }
    return;
  }

  const results = scoreRanking(
    entries.map((entry) => ({ id: entry.id, elo: entry.elo })),
    ballots.map((ballot) => ballot.dishIds)
  );

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const statements = [
    env.DB.prepare(
      "UPDATE rounds SET status = 'closed', closed_at = ? WHERE id = ?"
    ).bind(now, round.id),
  ];

  for (const result of results) {
    const entry = byId.get(result.id);
    if (!entry) continue;
    const after = entry.elo + result.delta;

    statements.push(
      env.DB.prepare(
        "UPDATE dishes SET elo = ?, matches_played = matches_played + 1 WHERE id = ?"
      ).bind(after, result.id),
      env.DB.prepare(
        "UPDATE round_entries SET elo_before = ?, elo_after = ?, wins = ?, " +
          "firsts = ? WHERE round_id = ? AND dish_id = ?"
      ).bind(entry.elo, after, result.wins, result.firsts, round.id, result.id)
    );
  }

  // One round played, not four. The rotation counts rounds; the four
  // comparisons a photograph appears in are a scoring detail, not four turns
  // on the board.
  await env.DB.batch(statements);

  const image = await renderResultCard(env, round, entries, results, ballots.length);

  if (!image) {
    await logToDiscord(
      env,
      `Round #${round.id} closed without a result card — the render never ` +
        `came back. Retry it with /admin/repair-card?round=${round.id}.`
    );
  }

  const winner = byId.get(results[0].id);
  const chef = winner ? await playerName(env, winner.poster_discord_id) : null;

  const slotOf = new Map(entries.map((entry) => [entry.id, entry.slot]));
  const log = ballotEmbed(
    "How everyone ranked them",
    ballotLines(ballots, slotOf)
  );

  const count = ballots.length;

  // A message of its own rather than an edit to the ballot, for the reason
  // spelled out over postResult in matchups.ts: a day-old card is a day of
  // channel traffic above the fold, and Discord shows nothing for an edit.
  const result = await postMessage(env, {
    content:
      `**Round #${round.id} — the result.** ` +
      `${chef ? `**${escapeMarkdown(chef)}** takes it.` : "It is decided."}\n` +
      `${count} ${count === 1 ? "ballot" : "ballots"}.\n` +
      entries
        .map((entry) => sourceLink(env, entry, `#${entry.slot}`))
        .join(" · "),
    embeds: [...(image ? [{ color: WIN, image: { url: image } }] : []), log],
    allowed_mentions: allowedMentions(env),
    ...replyTo(round.message_id),
  });

  await env.DB.prepare("UPDATE rounds SET result_message_id = ? WHERE id = ?")
    .bind(result.id, round.id)
    .run();

  if (round.message_id) {
    // Content and components only, so the ballot card stays under the pointer.
    await editMessage(env, round.message_id, {
      content:
        `**Round #${round.id} — closed.** ` +
        `[The result is in.](${messageUrl(env, result.id)})`,
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

/** Shared by the close path and the repair, so both draw the same card. */
function renderResultCard(
  env: Env,
  round: Round,
  entries: RoundDish[],
  results: RankingResult[],
  ballots: number,
  stamp?: number
): Promise<string | null> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const rows = results.flatMap((result, index) => {
    const entry = byId.get(result.id);
    if (!entry) return [];
    return [
      {
        u: dishUrl(env, entry),
        t: entry.name ?? "",
        p: ordinal(index),
        d: Math.round(result.delta),
      },
    ];
  });

  return renderCard(
    env,
    cardKey("ballot-result", round.id, stamp),
    (attempt) => ballotResultImageUrl(env, round.id, rows, ballots, attempt)
  );
}

export async function closeDueRounds(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  const due = force ? await getOpenRounds(env) : await getDueRounds(env, now);
  for (const round of due) {
    await closeOne(env, round, now);
  }
  return due.length;
}

/**
 * Re-renders a round's card and puts it back on the message. Same reasoning as
 * repairCard on the pair side, including the stamp: the replacement has to
 * arrive at a URL Discord has never seen, or its proxy answers from whatever
 * it cached the first time. And, as there, a closed round is repaired on its
 * result post rather than on the ballot — they are two messages now.
 *
 * A closed round gets its ballot log rebuilt alongside the card. A PATCH
 * replaces the embeds it names wholesale, so sending only the image would
 * quietly delete the log.
 */
export async function repairRoundCard(
  env: Env,
  target: { roundId?: number; messageId?: string }
): Promise<{ repaired: boolean; round?: number; reason?: string }> {
  const round = target.messageId
    ? await getRoundByMessage(env, target.messageId)
    : await getRound(env, target.roundId ?? 0);
  if (!round) return { repaired: false, reason: "no such round" };
  if (!round.message_id) {
    return { repaired: false, reason: "that round was never posted" };
  }

  const entries = await getRoundEntries(env, round.id);
  if (entries.length === 0) {
    return { repaired: false, reason: "round has no entries" };
  }

  const open = round.status === "open";
  const stamp = Date.now();

  if (open) {
    const image = await renderCard(
      env,
      cardKey("ballot", round.id, stamp),
      (attempt) => ballotImageUrl(env, round.id, entries, attempt)
    );
    if (!image) {
      return {
        repaired: false,
        round: round.id,
        reason: "the card still will not render",
      };
    }
    await editMessage(env, round.message_id, {
      embeds: [{ color: ACCENT, image: { url: image } }],
    });
    return { repaired: true, round: round.id };
  }

  const ballots = await getRoundBallots(env, round.id);

  // Read back what the close recorded rather than scoring the round again.
  // Re-scoring would run against the ratings the round already produced, and
  // a repair is meant to redraw a card, not to restate the result.
  const results: RankingResult[] = entries
    .map((entry) => ({
      id: entry.id,
      delta: (entry.elo_after ?? 0) - (entry.elo_before ?? 0),
      wins: entry.wins ?? 0,
      firsts: entry.firsts ?? 0,
    }))
    .sort((x, y) => y.wins - x.wins || y.firsts - x.firsts || x.id - y.id);

  const image = await renderResultCard(
    env,
    round,
    entries,
    results,
    ballots.length,
    stamp
  );
  if (!image) {
    return {
      repaired: false,
      round: round.id,
      reason: "the card still will not render",
    };
  }

  const slotOf = new Map(entries.map((entry) => [entry.id, entry.slot]));
  // Rounds closed before the reveal got a post of its own still carry their
  // result card on the ballot message.
  await editMessage(env, round.result_message_id ?? round.message_id, {
    embeds: [
      { color: WIN, image: { url: image } },
      ballotEmbed("How everyone ranked them", ballotLines(ballots, slotOf)),
    ],
  });

  return { repaired: true, round: round.id };
}
