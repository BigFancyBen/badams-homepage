import {
  appendToBallot,
  appendToContestBallot,
  clearBallot,
  clearContestBallot,
  getBallot,
  getContest,
  getContestBallot,
  getContestEntries,
  getEntryByAuthor,
  getMatchup,
  getRound,
  getRoundEntries,
  humanEntryCount,
  recordVote,
  upsertEntry,
  upsertPlayer,
} from "./db";
import {
  MAX_CAPTION_LENGTH,
  MAX_HUMAN_ENTRIES,
  PICKS,
} from "./contests";
import {
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  type Env,
  type Interaction,
  type InteractionComponent,
} from "./types";

function reply(content: string) {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  });
}

/**
 * Every response here is ephemeral. That is the whole reason this uses buttons
 * instead of a native Discord poll: nobody sees who voted, and there is no
 * running tally to bandwagon onto.
 *
 * Only until the round closes, mind. The reveal now names who picked what —
 * see ballotEmbed. Secrecy while people are still voting is the part that
 * mattered; secrecy afterwards was only ever a side effect of it.
 */
export async function handleInteraction(
  env: Env,
  interaction: Interaction
): Promise<Response> {
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  // Modal submits arrive as their own interaction type, not as a component
  // click, so the caption contest's writing phase needs both let through here.
  if (
    interaction.type !== InteractionType.MESSAGE_COMPONENT &&
    interaction.type !== InteractionType.MODAL_SUBMIT
  ) {
    return reply("Unsupported interaction.");
  }

  // This bot serves exactly one channel in one server. The signature check
  // proves a request came from Discord; it does not prove it came from here.
  if (
    interaction.guild_id !== env.DISCORD_GUILD_ID ||
    (interaction.channel_id !== undefined &&
      interaction.channel_id !== env.DISCORD_CHANNEL_ID)
  ) {
    return reply("This game only runs in its own channel.");
  }

  const user = interaction.member?.user ?? interaction.user;
  if (!user) return reply("Could not work out who you are.");

  const customId = interaction.data?.custom_id ?? "";
  const [prefix, rawId, rawSlot] = customId.split(":");
  const now = Date.now();

  if (prefix === "v") {
    return handleVote(env, Number(rawId), rawSlot, user, now);
  }

  if (prefix === "b" || prefix === "bx") {
    return handleBallot(
      env,
      Number(rawId),
      prefix === "bx" ? null : Number(rawSlot),
      user,
      now
    );
  }

  // The caption contest. `cw` opens the box, `cm` is the box coming back,
  // `c`/`cx` are the ballot — the same shape as `b`/`bx` one format over.
  if (prefix === "cw") {
    return openCaptionModal(env, Number(rawId), user, now);
  }

  if (prefix === "cm") {
    return submitCaption(
      env,
      Number(rawId),
      readModalValue(interaction.data?.components, "caption"),
      user,
      now
    );
  }

  if (prefix === "c" || prefix === "cx") {
    return handleCaptionBallot(
      env,
      Number(rawId),
      prefix === "cx" ? null : Number(rawSlot),
      user,
      now
    );
  }

  return reply("That button is not one of mine.");
}

async function handleVote(
  env: Env,
  matchupId: number,
  side: string,
  user: { id: string; username: string },
  now: number
): Promise<Response> {
  if (side !== "a" && side !== "b") return reply("That button is not one of mine.");

  const matchup = await getMatchup(env, matchupId);
  if (!matchup) return reply("That matchup is gone.");

  if (matchup.status !== "open" || matchup.closes_at <= now) {
    return reply("Voting on that one has closed.");
  }

  const pickedDishId = side === "a" ? matchup.dish_a_id : matchup.dish_b_id;

  await upsertPlayer(env, user.id, user.username, now);
  await recordVote(env, matchupId, user.id, pickedDishId, now);

  // Confirmation only, and only to the person who cast it. No running tally:
  // the channel sees nothing until close, and neither should a voter.
  return reply(`Voted ${side === "a" ? "1" : "2"}.`);
}

/**
 * Reads back somebody's ballot so far. Said in slot numbers, because that is
 * what is printed on the card and on the buttons — the dish ids never leave
 * the database.
 */
function orderLine(slots: number[], total: number): string {
  const order = slots.map((slot) => `#${slot}`).join(" › ");
  return slots.length >= total
    ? `Your order: ${order}. That is all of them.`
    : `Your order: ${order}. Add more, or leave it there — a partial ballot counts.`;
}

/**
 * A click on a ranking round. `slot` null means "start over".
 *
 * Clicks are appended in the order they arrive: first click is their
 * favourite. There is no undo of a single pick on purpose — working out what
 * "un-rank the third one" should do to the fourth and fifth is a worse
 * interface than clearing and going again, and clearing is one button.
 */
async function handleBallot(
  env: Env,
  roundId: number,
  slot: number | null,
  user: { id: string; username: string },
  now: number
): Promise<Response> {
  const round = await getRound(env, roundId);
  if (!round) return reply("That round is gone.");

  if (round.status !== "open" || round.closes_at <= now) {
    return reply("Ranking on that one has closed.");
  }

  await upsertPlayer(env, user.id, user.username, now);

  if (slot === null) {
    await clearBallot(env, roundId, user.id);
    return reply("Cleared. Start again whenever you like.");
  }

  const entries = await getRoundEntries(env, roundId);
  const picked = entries.find((entry) => entry.slot === slot);
  if (!picked) return reply("That one is not in this round.");

  const ballot = await getBallot(env, roundId, user.id);
  const slots = ballot.map((row) => row.slot);

  if (ballot.some((row) => row.dish_id === picked.id)) {
    return reply(`You already ranked #${slot}. ${orderLine(slots, entries.length)}`);
  }

  await appendToBallot(env, roundId, user.id, picked.id, now);

  return reply(orderLine([...slots, slot], entries.length));
}

/**
 * Pulls the caption out of a submitted modal.
 *
 * Discord has shipped two shapes for a modal's components — a text input
 * inside an action row, and one inside a Label — and which arrives depends on
 * how the modal was declared and on the API version. Walking the tree for the
 * custom_id we asked for is shorter than either shape's index path and
 * survives both.
 */
function readModalValue(
  components: InteractionComponent[] | undefined,
  customId: string
): string | null {
  for (const node of components ?? []) {
    if (node.custom_id === customId && typeof node.value === "string") {
      return node.value;
    }
    const nested = readModalValue(node.components, customId);
    if (nested !== null) return nested;
  }
  return null;
}

/**
 * Opens the caption box. The only interaction here that answers with anything
 * other than an ephemeral message — a modal is the sole way Discord will take
 * free text from somebody without giving them a message box in the channel,
 * which would show everyone else what they wrote.
 */
async function openCaptionModal(
  env: Env,
  contestId: number,
  user: { id: string; username: string },
  now: number
): Promise<Response> {
  const contest = await getContest(env, contestId);
  if (!contest) return reply("That contest is gone.");
  if (contest.status !== "writing" || contest.writing_closes_at <= now) {
    return reply("Writing on that one has closed.");
  }

  // Pre-filled with whatever they already wrote, so the button is an edit as
  // well as an entry — there is no separate way to change your mind, and
  // without this a second click would look like it had lost the first one.
  const existing = await getEntryByAuthor(env, contestId, user.id);

  if (!existing) {
    const written = await humanEntryCount(env, contestId);
    if (written >= MAX_HUMAN_ENTRIES) {
      return reply(
        `This one is full — ${MAX_HUMAN_ENTRIES} captions already in. ` +
          `There will be another.`
      );
    }
  }

  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `cm:${contestId}`,
      title: `Caption contest #${contestId}`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "caption",
              label: "Your caption",
              style: 1,
              min_length: 1,
              max_length: MAX_CAPTION_LENGTH,
              required: true,
              placeholder: "Write your caption here.",
              ...(existing ? { value: existing.text } : {}),
            },
          ],
        },
      ],
    },
  });
}

/** Records a submitted caption. Writing again replaces, never duplicates. */
async function submitCaption(
  env: Env,
  contestId: number,
  raw: string | null,
  user: { id: string; username: string },
  now: number
): Promise<Response> {
  const contest = await getContest(env, contestId);
  if (!contest) return reply("That contest is gone.");
  if (contest.status !== "writing" || contest.writing_closes_at <= now) {
    return reply("Writing on that one has closed.");
  }

  // Collapse the whitespace as well as trimming it. A caption goes into a
  // numbered list where a stray line break would split it across two entries
  // and make one person's look like two.
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CAPTION_LENGTH);
  if (!text) return reply("That was empty. Have another go.");

  const existing = await getEntryByAuthor(env, contestId, user.id);

  if (!existing) {
    // Re-checked here, not only when the modal opened. A modal can sit open on
    // somebody's screen for as long as they like, and the contest can fill up
    // underneath it.
    const written = await humanEntryCount(env, contestId);
    if (written >= MAX_HUMAN_ENTRIES) {
      return reply(`This one filled up while you were writing. Sorry.`);
    }
  }

  await upsertPlayer(env, user.id, user.username, now);
  await upsertEntry(env, contestId, user.id, text, now);

  return reply(
    existing
      ? `Changed it to: “${text}”`
      : `In. Yours reads: “${text}”\nClick again to change it before the vote opens.`
  );
}

/** Somebody's contest ballot so far, in the slot numbers on the buttons. */
function contestOrderLine(slots: number[]): string {
  const order = slots.map((slot) => `#${slot}`).join(" › ");
  return slots.length >= PICKS
    ? `Your top ${PICKS}: ${order}. That is the lot — Start over to change it.`
    : `Your order: ${order}. ${PICKS - slots.length} more to go, or leave it there — a partial ballot counts.`;
}

/**
 * A click on a caption. `slot` null means "start over".
 *
 * Capped at three, unlike the ranking round, which takes as many as you like.
 * Three is what was asked for and it is the right cap here for a reason the
 * photo rounds do not have: a contest can carry ten captions, and ranking all
 * ten is a chore that would collect fewer ballots rather than better ones.
 *
 * Ranking your own is allowed. It costs one of your three, which is its own
 * disincentive, and the reveal names every ballot — the same bargain the pair
 * matchup already makes with self-votes.
 */
async function handleCaptionBallot(
  env: Env,
  contestId: number,
  slot: number | null,
  user: { id: string; username: string },
  now: number
): Promise<Response> {
  const contest = await getContest(env, contestId);
  if (!contest) return reply("That contest is gone.");
  if (
    contest.status !== "voting" ||
    (contest.voting_closes_at ?? 0) <= now
  ) {
    return reply("Voting on that one has closed.");
  }

  await upsertPlayer(env, user.id, user.username, now);

  if (slot === null) {
    await clearContestBallot(env, contestId, user.id);
    return reply("Cleared. Start again whenever you like.");
  }

  const entries = await getContestEntries(env, contestId);
  const picked = entries.find((entry) => entry.slot === slot);
  if (!picked) return reply("That one is not in this contest.");

  const ballot = await getContestBallot(env, contestId, user.id);
  const slots = ballot.map((row) => row.slot);

  if (ballot.some((row) => row.entry_id === picked.id)) {
    return reply(`You already ranked #${slot}. ${contestOrderLine(slots)}`);
  }

  if (ballot.length >= PICKS) {
    return reply(
      `You have already picked ${PICKS}. ${contestOrderLine(slots)}`
    );
  }

  await appendToContestBallot(env, contestId, user.id, picked.id, now);

  return reply(contestOrderLine([...slots, slot]));
}
