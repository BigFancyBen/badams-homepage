import {
  appendToBallot,
  clearBallot,
  getBallot,
  getMatchup,
  getRound,
  getRoundEntries,
  recordVote,
  upsertPlayer,
} from "./db";
import {
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  type Env,
  type Interaction,
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

  if (interaction.type !== InteractionType.MESSAGE_COMPONENT) {
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
