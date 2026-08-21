import { castVote, getMatchup, tallyVotes } from "./db";
import {
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  type Env,
  type Interaction,
} from "./types";

/** Discord button styles. */
const SECONDARY = 2;
const SUCCESS = 3;

type Side = "a" | "b";

function reply(content: string) {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL },
  });
}

/**
 * The voter's own copy of the ballot.
 *
 * A button on the shared matchup message looks identical to everyone, so
 * clicking it can't leave a mark — Discord has no per-viewer component state.
 * The answer is a second, private message that belongs to one voter: its
 * buttons show the pick, the chosen side green and ticked, the other still
 * live so they can switch. Its own buttons are prefixed `e:` so the handler
 * knows to edit this card in place rather than send another one.
 */
function ballot(
  matchupId: number,
  picked: Side,
  votes: { a: number; b: number }
) {
  const total = votes.a + votes.b;
  const mine = picked === "a" ? votes.a : votes.b;
  const share = total === 0 ? 0 : Math.round((mine / total) * 100);
  const label = picked === "a" ? "1" : "2";
  const other = picked === "a" ? "2" : "1";

  const button = (side: Side, text: string) => ({
    type: 2,
    style: side === picked ? SUCCESS : SECONDARY,
    label: side === picked ? `✓ ${text}` : text,
    custom_id: `e:${matchupId}:${side}`,
  });

  return {
    content:
      `**Voted ${label}.** ${share}% of ${total} ` +
      `${total === 1 ? "vote" : "votes"} so far. ` +
      `Press ${other} to switch — you can change it until close.`,
    components: [
      { type: 1, components: [button("a", "1"), button("b", "2")] },
    ],
    flags: EPHEMERAL,
  };
}

/**
 * Votes stay private. Nobody sees who voted or the running tally in the
 * channel until close, which is why this uses buttons rather than a native
 * Discord poll — every response here is ephemeral.
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

  const customId = interaction.data?.custom_id ?? "";
  const [prefix, rawMatchupId, rawSide] = customId.split(":");
  // `v:` is the matchup message everyone sees; `e:` is a voter's own ballot.
  const fromBallot = prefix === "e";
  if ((prefix !== "v" && !fromBallot) || (rawSide !== "a" && rawSide !== "b")) {
    return reply("That button is not one of mine.");
  }
  const side: Side = rawSide;

  const user = interaction.member?.user ?? interaction.user;
  if (!user) return reply("Could not work out who you are.");

  const matchupId = Number(rawMatchupId);
  const matchup = await getMatchup(env, matchupId);
  if (!matchup) return reply("That matchup is gone.");

  const now = Date.now();
  if (matchup.status !== "open" || matchup.closes_at <= now) {
    return reply("Voting on that one has closed.");
  }

  const pickedDishId = side === "a" ? matchup.dish_a_id : matchup.dish_b_id;
  await castVote(env, matchupId, user, pickedDishId, now);

  const votes = await tallyVotes(env, matchup);
  const data = ballot(matchupId, side, votes);

  // Switching from the private ballot rewrites that same card, so a voter ends
  // up with one message showing their current pick rather than a pile of them.
  return Response.json({
    type: fromBallot
      ? InteractionResponseType.UPDATE_MESSAGE
      : InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data,
  });
}
