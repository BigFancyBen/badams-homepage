import {
  ACCENT,
  WIN,
  allowedMentions,
  ballotEmbed,
  editMessage,
  escapeMarkdown,
  messageUrl,
  postMessage,
  replyTo,
  sourceLink,
} from "./discord";
import {
  getContestBallots,
  getContestEntries,
  getDueVoting,
  getDueWriting,
  getLiveContests,
  getDish,
  getOpenMatchups,
  heldDishIds,
  getState,
  humanEntryCount,
  insertBotEntry,
  playerName,
  setState,
} from "./db";
import { dishUrl } from "./images";
import { pickOne, type Category } from "./matchmaking";
import { parseWeekdays, postSlotKey } from "./schedule";
import type { Contest, ContestEntry, Env } from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * The caption contest.
 *
 * One photograph, everybody writes a line, then everybody ranks the lines. It
 * is the first format here that asks players to *make* something rather than
 * judge something, which is why it is the only one that can use the categories
 * nothing else could: a receipt, a meme, a shopping haul, somebody's cat. Those
 * photographs are not good enough to rate, and "which of these two receipts is
 * better" is not a question anyone can answer. As a prompt, though, a baffling
 * photograph beats a beautiful one.
 *
 * The bot enters too, anonymously. The classifier already wrote a deadpan name
 * for every photograph when it labelled it — that line goes on the board
 * alongside the human ones with nothing marking it, and where it placed is
 * announced with the result.
 *
 * Two phases and a result, so three messages. Voting cannot be posted until the
 * writing is over, and editing the first message into a ballot would bury the
 * vote under a day of channel traffic; the same is true of the result a day
 * after that. Each gets a post of its own, replying to the one before it, and
 * each older post is edited down to a link forward.
 */

/** The pool. Everything the rest of the game has no question to ask of. */
export const CONTEST_CATEGORIES: Category[] = [
  "ingredient",
  "pet",
  "document",
  "screenshot",
  "other",
];

/**
 * Below this many human captions there is no contest — one person against the
 * bot is not a vote, it is a referendum on the bot. Two humans plus the bot is
 * three on the board, the same floor the ranking round uses.
 */
const MIN_HUMAN_ENTRIES = 2;

/**
 * Discord allows five buttons to an action row and five rows to a message, but
 * the ballot needs a row for `Start over`, and a wall of thirty captions is
 * nobody's idea of a vote. Nine humans plus the bot fills two rows exactly.
 */
export const MAX_HUMAN_ENTRIES = 9;

/** How many a voter ranks. Their top three, best first. */
export const PICKS = 3;

/**
 * Borda points by position. First is worth three, and the gap between first
 * and second is the same as between second and third — a caption that wins
 * outright should not be able to lose to one that came second on every ballot
 * without that being close.
 */
const POINTS = [3, 2, 1];

/** Captions are one line. The classifier's own names are capped the same way. */
export const MAX_CAPTION_LENGTH = 120;

/** The label under the photograph while captions are being collected. */
function writeButton(contestId: number) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: "Write a caption",
          custom_id: `cw:${contestId}`,
        },
      ],
    },
  ];
}

/**
 * Numbered buttons, one per caption, plus a way out. Numbers rather than the
 * captions themselves: a Discord button label is 80 characters and a caption
 * is a sentence, so the text lives in the message and the buttons point at it.
 */
function ballotButtons(contestId: number, entries: ContestEntry[]) {
  const rows = [];
  for (let i = 0; i < entries.length; i += 5) {
    rows.push({
      type: 1,
      components: entries.slice(i, i + 5).map((entry) => ({
        type: 2,
        style: 2,
        label: String(entry.slot),
        custom_id: `c:${contestId}:${entry.slot}`,
      })),
    });
  }
  rows.push({
    type: 1,
    components: [
      { type: 2, style: 2, label: "Start over", custom_id: `cx:${contestId}` },
    ],
  });
  return rows;
}

/** The captions as a numbered list, which is what the buttons refer to. */
function captionLines(entries: ContestEntry[]): string {
  return entries
    .map((entry) => `**${entry.slot}.** ${escapeMarkdown(entry.text)}`)
    .join("\n");
}

/**
 * Opens a contest: draws one photograph and posts it with a button.
 *
 * Runs on the weekdays in CAPTION_WEEKDAY at CAPTION_HOUR_UTC, keeps its own
 * slot key so it never claims the food schedule's hour, and refuses while
 * another contest is still live — two open contests would split both the
 * writing and the voting, and there is only ever one worth arguing about.
 */
export async function postCaptionContestIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  if (!force) {
    const weekdays = parseWeekdays(env.CAPTION_WEEKDAY);
    if (weekdays.length === 0) return false;

    const date = new Date(now);
    if (!weekdays.includes(date.getUTCDay())) return false;
    if (date.getUTCHours() !== Number(env.CAPTION_HOUR_UTC || "16")) return false;
    if (date.getUTCMinutes() !== 0) return false;

    if ((await getState(env, "last_caption_slot")) === postSlotKey(now)) {
      return false;
    }
  }

  // One at a time, forced or not. Unlike a bonus matchup this is not a thing
  // to run beside itself: a second contest would ask people to write and to
  // rank at the same time, on two photographs, in one channel.
  if ((await getLiveContests(env)).length > 0) return false;

  // Whatever is live keeps its photograph to itself. Nothing pairs a contest
  // with a matchup today — the pools are disjoint categories — but that is a
  // property of the current pools rather than a rule anything enforces.
  const live: number[] = await heldDishIds(env);
  for (const matchup of await getOpenMatchups(env)) {
    live.push(matchup.dish_a_id, matchup.dish_b_id);
  }

  const dish = await pickOne(env, {
    categories: CONTEST_CATEGORIES,
    exclude: live,
  });
  // Nothing in the residue categories at all, or the only one is already live.
  if (!dish) return false;

  const writingCloses =
    now + Number(env.CAPTION_WRITING_HOURS || "24") * HOUR;

  const inserted = await env.DB.prepare(
    "INSERT INTO contests (dish_id, created_at, writing_closes_at) " +
      "VALUES (?, ?, ?) RETURNING id"
  )
    .bind(dish.id, now, writingCloses)
    .first<{ id: number }>();
  if (!inserted) throw new Error("Failed to create contest row");
  const contestId = inserted.id;

  // The photograph goes up as itself. Every other format composites several
  // images into a card and needs a render for it; one photograph needs no
  // layout, and R2 already serves it at a public URL — so there is nothing
  // here that can fail to render, and no repair path to write.
  try {
    const message = await postMessage(env, {
      content:
        `**Caption contest #${contestId}.** What is going on here?\n` +
        `Write one line. You have a day; the vote opens when the writing closes.\n` +
        sourceLink(env, dish, "Original"),
      embeds: [{ color: ACCENT, image: { url: dishUrl(env, dish) } }],
      components: writeButton(contestId),
      allowed_mentions: allowedMentions(env),
    });

    await env.DB.prepare("UPDATE contests SET submit_message_id = ? WHERE id = ?")
      .bind(message.id, contestId)
      .run();
  } catch (error) {
    await env.DB.prepare("DELETE FROM contests WHERE id = ?").bind(contestId).run();
    throw error;
  }

  if (!force) await setState(env, "last_caption_slot", postSlotKey(now));

  return true;
}

/** Fisher-Yates. The order captions were written in must not be readable. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Closes the writing and opens the vote: adds the bot's caption, shuffles
 * everything, assigns slots, and posts the ballot.
 *
 * The bot's entry is added here rather than at creation on purpose. Adding it
 * up front would mean a contest that nobody entered still has a caption in it,
 * and the abandon path below could not tell "nobody wrote anything" from "one
 * person did".
 */
async function openVoting(env: Env, contest: Contest, now: number): Promise<void> {
  const dish = await getDish(env, contest.dish_id);
  if (!dish) throw new Error(`Contest ${contest.id} has a missing photograph`);

  const humans = await humanEntryCount(env, contest.id);

  if (humans < MIN_HUMAN_ENTRIES) {
    await abandon(env, contest, humans, now);
    return;
  }

  // The classifier's own name for this photograph, entered anonymously. It is
  // already written, already deadpan, and until now has only ever appeared
  // beside its own picture.
  const botCaption = (dish.name ?? "").trim();
  if (botCaption) {
    await insertBotEntry(
      env,
      contest.id,
      botCaption.slice(0, MAX_CAPTION_LENGTH),
      now
    );
  }

  const entries = shuffle(await getContestEntries(env, contest.id));
  const votingCloses = now + Number(env.CAPTION_VOTING_HOURS || "24") * HOUR;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE contests SET status = 'voting', voting_closes_at = ? WHERE id = ?"
    ).bind(votingCloses, contest.id),
    ...entries.map((entry, index) =>
      env.DB.prepare("UPDATE contest_entries SET slot = ? WHERE id = ?").bind(
        index + 1,
        entry.id
      )
    ),
  ]);

  const numbered = await getContestEntries(env, contest.id);

  const message = await postMessage(env, {
    content:
      `**Caption contest #${contest.id} — the vote.**\n` +
      `${numbered.length} captions. Click your top ${PICKS} in order, best first.\n\n` +
      captionLines(numbered),
    embeds: [{ color: ACCENT, image: { url: dishUrl(env, dish) } }],
    components: ballotButtons(contest.id, numbered),
    allowed_mentions: allowedMentions(env),
    ...replyTo(contest.submit_message_id),
  });

  await env.DB.prepare("UPDATE contests SET vote_message_id = ? WHERE id = ?")
    .bind(message.id, contest.id)
    .run();

  // Point the writing post at the vote and take its button away, so a contest
  // does not sit in the channel looking like it is still open. A link rather
  // than "below": a day of writing means a day of channel traffic between the
  // two, and "below" is only true for whoever was reading at the time.
  if (contest.submit_message_id) {
    await editMessage(env, contest.submit_message_id, {
      content:
        `**Caption contest #${contest.id} — writing is closed.** ` +
        `${numbered.length} captions went in. ` +
        `[The vote is here.](${messageUrl(env, message.id)})`,
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

/** Too few captions to vote on. Say so plainly and give the photo back. */
async function abandon(
  env: Env,
  contest: Contest,
  humans: number,
  now: number
): Promise<void> {
  await env.DB.prepare(
    "UPDATE contests SET status = 'closed', closed_at = ? WHERE id = ?"
  )
    .bind(now, contest.id)
    .run();

  if (contest.submit_message_id) {
    await editMessage(env, contest.submit_message_id, {
      content:
        `**Caption contest #${contest.id} — abandoned.** ` +
        `${humans === 0 ? "Nobody wrote one" : "Only one caption came in"}, ` +
        `so there was nothing to vote on.`,
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

export async function openDueVoting(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  const due = force
    ? (await getLiveContests(env)).filter((c) => c.status === "writing")
    : await getDueWriting(env, now);
  for (const contest of due) {
    await openVoting(env, contest, now);
  }
  return due.length;
}

interface Scored {
  entry: ContestEntry;
  points: number;
  firsts: number;
}

/**
 * Borda from the ballots. Not Elo: a caption has no rating to carry into the
 * next contest, because it will never appear in one — it exists for this
 * photograph and no other. A contest has a winner, which is a different thing
 * from a rating, and pretending otherwise would have meant inventing a pool
 * for captions to be rated against.
 */
function score(
  entries: ContestEntry[],
  ballots: { entryIds: number[] }[]
): Scored[] {
  const points = new Map<number, number>();
  const firsts = new Map<number, number>();
  for (const entry of entries) {
    points.set(entry.id, 0);
    firsts.set(entry.id, 0);
  }

  for (const ballot of ballots) {
    ballot.entryIds.slice(0, PICKS).forEach((entryId, index) => {
      if (!points.has(entryId)) return;
      points.set(entryId, (points.get(entryId) ?? 0) + POINTS[index]);
      if (index === 0) firsts.set(entryId, (firsts.get(entryId) ?? 0) + 1);
    });
  }

  return entries
    .map((entry) => ({
      entry,
      points: points.get(entry.id) ?? 0,
      firsts: firsts.get(entry.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.firsts - a.firsts ||
        (a.entry.slot ?? 0) - (b.entry.slot ?? 0)
    );
}

/** "the bot" for the machine's entry, the author's name for anyone else's. */
async function authorName(env: Env, entry: ContestEntry): Promise<string> {
  if (!entry.author_discord_id) return "the bot";
  return playerName(env, entry.author_discord_id);
}

async function closeOne(env: Env, contest: Contest, now: number): Promise<void> {
  const entries = await getContestEntries(env, contest.id);
  const ballots = await getContestBallots(env, contest.id);

  if (entries.length === 0) {
    await env.DB.prepare(
      "UPDATE contests SET status = 'closed', closed_at = ? WHERE id = ?"
    )
      .bind(now, contest.id)
      .run();
    return;
  }

  const results = score(entries, ballots);
  const names = new Map<number, string>();
  for (const result of results) {
    names.set(result.entry.id, await authorName(env, result.entry));
  }

  // The photograph counts as used whether or not anyone voted. Unlike a
  // matchup, where an unvoted round is deliberately not a match played, there
  // is no rating here to be skewed by counting it — and a contest nobody
  // ranked is still a contest everybody saw, so putting the same receipt back
  // at the front of the rotation would be the wrong answer.
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE contests SET status = 'closed', closed_at = ? WHERE id = ?"
    ).bind(now, contest.id),
    env.DB.prepare(
      "UPDATE dishes SET matches_played = matches_played + 1 WHERE id = ?"
    ).bind(contest.dish_id),
    ...results.map((result) =>
      env.DB.prepare(
        "UPDATE contest_entries SET points = ?, firsts = ? WHERE id = ?"
      ).bind(result.points, result.firsts, result.entry.id)
    ),
  ]);

  // No ballot means the contest never got past writing, which in turn means
  // nobody has anything to be shown the result of.
  if (!contest.vote_message_id) return;

  const dish = await getDish(env, contest.dish_id);

  // The captions go in an embed rather than the message text. A message is
  // capped at 2000 characters and ten captions with their authors can pass
  // that — and a content that is too long fails the whole edit, which would
  // take the result down with it rather than just truncating it.
  const table = ballotEmbed(
    ballots.length === 0 ? "The captions" : "The result",
    results.map((result, index) => {
      const who = escapeMarkdown(names.get(result.entry.id) ?? "someone");
      const text = escapeMarkdown(result.entry.text);
      if (ballots.length === 0) return `**${result.entry.slot}.** ${text} — *${who}*`;
      const pts = `${result.points} ${result.points === 1 ? "pt" : "pts"}`;
      return `**${ordinal(index)}** · ${pts} — ${text} *(${who})*`;
    })
  );

  const photo = dish
    ? [{ color: WIN, image: { url: dishUrl(env, dish) } }]
    : [];

  if (ballots.length === 0) {
    // Still a reveal, unlike an unvoted matchup: nobody has seen who wrote
    // which caption, and that is most of what a contest is for.
    await postResult(env, contest, {
      content: `**Caption contest #${contest.id} — closed.** Nobody voted.`,
      embeds: [...photo, table],
    });
    return;
  }

  const winner = results[0];
  const winnerName = names.get(winner.entry.id) ?? "someone";

  // Where the machine came is the line people will read first, so it gets its
  // own sentence rather than being left for them to find in the table.
  const botIndex = results.findIndex((r) => !r.entry.author_discord_id);
  const botLine =
    botIndex === -1
      ? ""
      : botIndex === 0
        ? " The bot wrote that one."
        : ` The bot came ${ordinal(botIndex)} of ${results.length}.`;

  const log = ballotEmbed(
    "How everyone voted",
    ballots.map((ballot) => {
      const order = ballot.entryIds
        .map((id) => {
          const found = results.find((r) => r.entry.id === id);
          return `#${found?.entry.slot ?? "?"}`;
        })
        .join(" › ");
      return `**${escapeMarkdown(ballot.name)}** ${order}`;
    })
  );

  await postResult(env, contest, {
    content:
      `**Caption contest #${contest.id} — the result.** ` +
      `**${escapeMarkdown(winnerName)}** takes it.\n` +
      `${ballots.length} ${ballots.length === 1 ? "ballot" : "ballots"}.${botLine}`,
    embeds: [...photo, table, log],
  });
}

/**
 * The reveal as its own message, replying to the ballot, with the ballot edited
 * down to a pointer at it. The same move the matchups and the ranking rounds
 * make, and for the same reason — see postResult in matchups.ts.
 *
 * It matters more here than anywhere else. A contest runs for two days across
 * two posts, so by the time the winner is announced the ballot is the older of
 * two things already buried, and an edit to it is the one thing in the whole
 * game nobody would ever find.
 */
async function postResult(
  env: Env,
  contest: Contest,
  body: { content: string; embeds: unknown[] }
): Promise<void> {
  const result = await postMessage(env, {
    ...body,
    allowed_mentions: allowedMentions(env),
    ...replyTo(contest.vote_message_id),
  });

  await env.DB.prepare("UPDATE contests SET result_message_id = ? WHERE id = ?")
    .bind(result.id, contest.id)
    .run();

  if (!contest.vote_message_id) return;

  // Content and components only, so the photograph stays on the ballot and the
  // numbered captions the buttons referred to stay readable underneath it.
  await editMessage(env, contest.vote_message_id, {
    content:
      `**Caption contest #${contest.id} — voting is closed.** ` +
      `[The result is here.](${messageUrl(env, result.id)})`,
    components: [],
    allowed_mentions: allowedMentions(env),
  });
}

const ORDINALS = [
  "1st", "2nd", "3rd", "4th", "5th",
  "6th", "7th", "8th", "9th", "10th",
];

function ordinal(index: number): string {
  return ORDINALS[index] ?? `${index + 1}th`;
}

export async function closeDueContests(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  const due = force
    ? (await getLiveContests(env)).filter((c) => c.status === "voting")
    : await getDueVoting(env, now);
  for (const contest of due) {
    await closeOne(env, contest, now);
  }
  return due.length;
}
