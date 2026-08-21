import { getMatchup, recordVote, tallyVotes, upsertPlayer } from "./db";
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
  const [prefix, rawMatchupId, side] = customId.split(":");
  if (prefix !== "v" || (side !== "a" && side !== "b")) {
    return reply("That button is not one of mine.");
  }

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

  await upsertPlayer(env, user.id, user.username, now);
  await recordVote(env, matchupId, user.id, pickedDishId, now);

  // Shown only after the vote is recorded, and only to the person who cast it.
  // The channel still sees nothing until close.
  const votes = await tallyVotes(env, matchup);
  const total = votes.a + votes.b;
  const yours = side === "a" ? votes.a : votes.b;
  const share = total === 0 ? 0 : Math.round((yours / total) * 100);
  const picked = side === "a" ? "1" : "2";

  return reply(
    `Locked in: **${picked}** — ${share}% of ${total} ${total === 1 ? "vote" : "votes"} so far. ` +
      `Change it any time before close.`
  );
}
