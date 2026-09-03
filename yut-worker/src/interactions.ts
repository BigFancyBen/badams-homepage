import {
  EXTRA_VERIFICATION_SLAYER,
  FRESH_WINDOW_DAYS,
  LOG_TOTAL,
  MAX_COUNTED_VERIFICATIONS,
  QUIZ_BANK,
  QUIZ_RIGHT_XP,
  QUIZ_WRONG_COINS,
  SKILLS,
  SKILL_LABEL,
  STYLE_LABEL,
  VERIFIED_AUTHOR_SLAYER,
  VERIFIED_MULTIPLIER,
  VERIFIER_SLAYER,
  VERIFY_WINDOW_HOURS,
  isCombatStyle,
  isSkill,
  type SkillKey,
} from "./config.ts";
import {
  finishClue,
  hubButtons,
  lampValue,
  performCheckin,
  quizButtons,
  type CheckinInput,
  type CheckinOutcome,
} from "./checkins.ts";
import { clueSteps, doneIndices, remainingSteps, stepLabel, verificationSatisfies } from "./clues.ts";
import {
  addXp,
  addXpStatement,
  markStep,
  bumpVerifiedCount,
  countCheckinsBetween,
  getCheckinFor,
  recordAnswer,
  getCheckin,
  getEphemeralReply,
  getLamp,
  getPlayer,
  getSkills,
  getState,
  insertVerification,
  isFresh,
  joinPlayer,
  logEntries,
  logEntry,
  logEventStatement,
  openClue,
  rememberEphemeralReply,
  setCheckinMessage,
  setState,
  spendLamp,
  unspentLamps,
  updatePlayer,
} from "./db.ts";
import {
  ACCENT,
  allowedMentions,
  deleteInteractionReply,
  editInteractionReply,
  editMessage,
  escapeMarkdown,
  followUp,
  logToDiscord,
  postMessage,
  replyTo,
} from "./discord.ts";
import { runCommand } from "./commands.ts";
import { playersRoleId, setPing } from "./roles.ts";
import { refreshDailyPost } from "./digest.ts";
import { addDays, daysBetween, gameDay, gameWeek, parseHour } from "./schedule.ts";
import { gatherSheet, levelUpImageUrl, renderCard, reportImageUrl, sheetImageUrl, textSheet } from "./sheet.ts";
import { spendPoints, taskView } from "./slayer.ts";

function ordinalWordFor(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"][n - 1] ?? `${n}th`;
}

function weightWordFor(weight: number): string {
  return weight >= 1 ? "full value" : weight >= 0.5 ? "half value" : "a fifth";
}
import { creditStatements } from "./town.ts";
import {
  buildMenu,
  doBuild,
  doRecruit,
  doRepair,
  doUpgrade,
  doVote,
  recruitMenu,
  repairMenu,
  townView,
  upgradeMenu,
  votesView,
  type Line,
} from "./actions.ts";
import { getRelics } from "./relics.ts";
import { ACTS, ACT_WEEKS, TREASURE_SEEKER_MULTIPLIER } from "./config.ts";
import { bingoLines, bingoView, evaluateBingo } from "./bingo.ts";
import { shopMenu, shopPress } from "./shop.ts";
import { actForWeek, campaignWeek } from "./schedule.ts";

export function actOf(env: Env, day: string): number {
  return actForWeek(campaignWeek(day, env.CAMPAIGN_START), ACT_WEEKS, ACTS.length);
}
import {
  buttonRow,
  buttonRows,
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  type Button,
  type DiscordUser,
  type Env,
  type Interaction,
  type Player,
} from "./types.ts";
import { levelForXp } from "./xp.ts";
import { combatLevel, levelsOf } from "./combat.ts";

/**
 * A line for the person who clicked, before it has been decided whether to
 * send it or edit it over the last one. See deliver.
 */
export interface Ephemeral {
  content: string;
  components?: unknown[];
  embeds?: unknown[];
  scope?: string;
  /** Rewrite the ephemeral the button is on, rather than reply. */
  update?: boolean;
}

export type Answer = Ephemeral | Response;

export function reply(content: string, extra: Partial<Ephemeral> = {}): Ephemeral {
  return { content, ...extra };
}

const EDIT_WINDOW = 14 * 60 * 1000;

/**
 * One running reply per person per scope, rather than one message per click.
 * The first click gets a message; every click after it in the same scope
 * edits that message, until the token dies and this falls back to a fresh
 * one. Copied from scrandle, where the reasoning is written up at length.
 */
async function deliver(
  env: Env,
  now: number,
  interaction: Interaction,
  answer: Ephemeral
): Promise<Response> {
  const data = {
    content: answer.content,
    flags: EPHEMERAL,
    components: answer.components ?? [],
    embeds: answer.embeds ?? [],
  };

  if (answer.update && interaction.message && (interaction.message.flags ?? 0) & EPHEMERAL) {
    return Response.json({ type: InteractionResponseType.UPDATE_MESSAGE, data });
  }

  const fresh = Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data,
  });

  const userId = (interaction.member?.user ?? interaction.user)?.id;
  const key = answer.scope ?? interaction.data?.name ?? interaction.message?.id;
  if (!userId || !key || !interaction.token || !interaction.application_id) return fresh;

  // Only a button can be answered with DEFERRED_UPDATE_MESSAGE; Discord
  // rejects it for a slash command and shows "didn't respond in time" — which
  // is what the second /join of launch night got. A command always answers
  // fresh, and its reply becomes the running one for the buttons on it.
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const existing = await getEphemeralReply(env, key, userId);
    if (existing && now - existing.created_at < EDIT_WINDOW) {
      const edited = await editInteractionReply(env, existing.application_id, existing.token, data);
      if (edited) {
        return Response.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
      }
    }
  }

  await rememberEphemeralReply(env, key, userId, interaction.application_id, interaction.token, now);
  return fresh;
}

/** The ephemeral placeholder a slow path puts up before doing its work. */
export function deferred(): Response {
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: EPHEMERAL },
  });
}

export async function handleInteraction(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction
): Promise<Response> {
  const now = Date.now();
  const answer = await route(env, ctx, interaction, now);
  return answer instanceof Response ? answer : deliver(env, now, interaction, answer);
}

/**
 * Discord gives an interaction three seconds, network included, and a cold
 * D1 can spend most of that on its own — the first `/join` after a deploy
 * came back "didn't respond in time". So: run the handler, and if it has not
 * answered by ACK_BUDGET_MS, acknowledge now (a deferred ephemeral for a
 * command, a silent deferral for a button) and deliver the answer through the
 * webhook token when it arrives. The fast path is untouched.
 */
const ACK_BUDGET_MS = 2000;

export async function handleInTime(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction
): Promise<Response> {
  if (interaction.type === InteractionType.PING) return handleInteraction(env, ctx, interaction);

  // Test seam: wrangler.test.toml names one command to hold back, so the
  // harness can watch the late path work.
  const slow = env.SLOW_COMMAND && interaction.data?.name === env.SLOW_COMMAND;
  const work = (slow ? new Promise((r) => setTimeout(r, ACK_BUDGET_MS + 500)) : Promise.resolve()).then(() =>
    handleInteraction(env, ctx, interaction)
  );

  let timer: ReturnType<typeof setTimeout> | null = null;
  const late = new Promise<"late">((resolve) => {
    timer = setTimeout(() => resolve("late"), ACK_BUDGET_MS);
  });
  const first = await Promise.race([work, late]);
  if (first !== "late") {
    clearTimeout(timer);
    return first;
  }

  const isButton = interaction.type === InteractionType.MESSAGE_COMPONENT;
  ctx.waitUntil(
    work
      .then((response) => deliverLate(env, interaction, isButton, response))
      .catch((error) => logToDiscord(env, `Late delivery failed: ${String(error)}`))
  );
  return isButton ? Response.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE }) : deferred();
}

/** What the handler would have answered, sent through the token instead. */
async function deliverLate(
  env: Env,
  interaction: Interaction,
  isButton: boolean,
  response: Response
): Promise<void> {
  const body = (await response.json()) as { type: number; data?: unknown };
  const appId = interaction.application_id;
  const token = interaction.token;
  if (!appId || !token) return;
  switch (body.type) {
    case InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE:
      // A command's deferral put up a fresh ephemeral: fill it. A button was
      // only acknowledged: the reply is a new ephemeral under the same token.
      if (isButton) await followUp(env, appId, token, body.data);
      else await editInteractionReply(env, appId, token, body.data);
      return;
    case InteractionResponseType.UPDATE_MESSAGE:
      await editInteractionReply(env, appId, token, body.data);
      return;
    case InteractionResponseType.DEFERRED_UPDATE_MESSAGE:
      // The handler already edited an earlier running reply. A command's
      // placeholder would sit there "thinking" forever: take it down.
      if (!isButton) await deleteInteractionReply(env, appId, token);
      return;
    default:
      // The handler deferred itself and owns the token from here.
      return;
  }
}

export function today(env: Env, now: number): string {
  return gameDay(now, parseHour(env.ROLLOVER_HOUR_UTC) ?? 9);
}

async function route(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  now: number
): Promise<Answer> {
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  // This bot serves exactly one channel in one server. The signature proves
  // a request came from Discord; it does not prove it came from here.
  if (
    interaction.guild_id !== env.DISCORD_GUILD_ID ||
    (interaction.channel_id !== undefined && interaction.channel_id !== env.DISCORD_CHANNEL_ID)
  ) {
    return reply("This game only runs in its own channel.");
  }

  const user = interaction.member?.user ?? interaction.user;
  if (!user) return reply("Could not work out who you are.");

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return runCommand(env, ctx, interaction, user, now);
  }

  if (interaction.type !== InteractionType.MESSAGE_COMPONENT) {
    return reply("Unsupported interaction.");
  }

  const customId = interaction.data?.custom_id ?? "";
  const [prefix, a, b, c] = customId.split(":");
  const day = today(env, now);

  switch (prefix) {
    case "ci":
      return checkinFromButton(env, ctx, interaction, user, a, day, now);
    case "no":
      return restDay(env, ctx, user, a, day, now);
    case "join":
      return join(env, ctx, interaction, user, a || null, day, now);
    case "ping":
      return togglePing(env, user, a === "on", day);
    case "hub":
      return hub(env, user, day);
    case "sheet":
      return sheetReply(env, ctx, interaction, user, user.id, day, now);
    case "share":
      return share(env, ctx, user, a, b, day);
    case "lamp":
      return a ? rubLamp(env, user, Number(a), b, day, now) : lampMenu(env, user, day);
    case "clue":
      return clueReply(env, user, day);
    case "town":
      return townReply(env, user, day, now);
    case "recruit":
      return freshAction(env, user, day, (p) => (a ? doRecruit(env, p, a, day, now) : recruitMenu(env, p, day)));
    case "upg":
      return freshAction(env, user, day, (p) => (a ? doUpgrade(env, p, Number(a), day, now) : upgradeMenu(env, p)));
    case "build":
      return freshAction(env, user, day, (p) => (a ? doBuild(env, p, a, day, now) : buildMenu(env, day)));
    case "repair":
      return freshAction(env, user, day, (p) => (a ? doRepair(env, p, a, day, now) : repairMenu(env)));
    case "vote":
      return a
        ? freshAction(env, user, day, (p) => doVote(env, p, Number(a), b, now))
        : playerAction(env, user, day, (p) => votesView(env, p));
    case "bingo":
      return playerAction(env, user, day, async (p) => ({ content: await bingoView(env, p, actOf(env, day)) }));
    case "task":
      return a
        ? freshAction(env, user, day, async (p) => {
            const levels = levelsOf(await getSkills(env, p.discord_id), levelForXp);
            return { content: await spendPoints(env, p, a, levels, combatLevel(levels), day, now) };
          })
        : playerAction(env, user, day, (p) => taskView(env, p));
    case "shop":
      return a
        ? freshAction(env, user, day, (p) => shopPress(env, p, a, b, day, now, actOf(env, day)))
        : playerAction(env, user, day, async (p) => shopMenu(p));
    case "log":
      return logReply(env, user, day);
    case "vf":
      return verify(env, ctx, user, Number(a), day, now);
    case "quiz":
      return answerQuiz(env, user, Number(a), Number(b), Number(c), day, now);
    case "style":
      return setStyle(env, user, a, day);
    default:
      return reply("That button is not one of mine.");
  }
}

// ── Gates ──────────────────────────────────────────────────────────

export async function requirePlayer(
  env: Env,
  user: DiscordUser,
  day: string
): Promise<{ player: Player } | { refusal: Ephemeral }> {
  const player = await getPlayer(env, user.id);
  if (!player || player.status === "retired") {
    return {
      refusal: reply("You are not in the campaign yet.", {
        components: [buttonRow([{ label: "Join the campaign", custom_id: `join:${day}`, style: 3 }])],
      }),
    };
  }
  return { player };
}

/**
 * The key to every action: a check-in in the last four days. A stale player
 * is told so, once, and nothing else changes — lamps and claims wait.
 */
export async function requireFresh(
  env: Env,
  user: DiscordUser,
  day: string
): Promise<{ player: Player } | { refusal: Ephemeral }> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate;
  if (!isFresh(gate.player, day)) {
    const since = gate.player.last_active_day ? daysBetween(gate.player.last_active_day, day) : null;
    return {
      refusal: reply(
        since === null
          ? "Check in to play — you have not checked in yet."
          : `Check in to play — last seen ${since} day${since === 1 ? "" : "s"} ago. Anything inside ${FRESH_WINDOW_DAYS} days counts.`,
        { components: [buttonRow([{ label: "Yes, I worked out today", custom_id: `ci:${day}`, style: 3, emoji: "💪" }])] }
      ),
    };
  }
  return gate;
}

// ── Check-in ───────────────────────────────────────────────────────

async function checkinFromButton(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  buttonDay: string,
  day: string,
  now: number
): Promise<Answer> {
  if (buttonDay !== day) {
    return reply("That was yesterday's question. Today's is on the morning post.", {
      components: [buttonRow([{ label: "Yes, I worked out today", custom_id: `ci:${day}`, style: 3, emoji: "💪" }])],
    });
  }
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  await updatePlayer(env, user.id, { username: user.username });
  return runCheckin(env, ctx, { ...gate.player, username: user.username }, day, now, { note: null, attachment: null }, "ci");
}

/**
 * "No, rest day." Nothing is lost: it is written down so the roll call can
 * show who has answered, and the reply says where the week stands.
 */
async function restDay(
  env: Env,
  ctx: ExecutionContext,
  user: DiscordUser,
  buttonDay: string,
  day: string,
  now: number
): Promise<Answer> {
  if (buttonDay !== day) return reply("That was yesterday's question. Today's is on the morning post.");
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  if (await getCheckinFor(env, user.id, day)) return reply("You already said yes today.", { scope: "ci" });
  await recordAnswer(env, user.id, day, "no", now);
  ctx.waitUntil(refreshRollCall(env, day));
  const week = gameWeek(day);
  const done = await countCheckinsBetween(env, user.id, week, day);
  const daysLeft = 6 - daysBetween(week, day);
  const standing =
    done >= 2
      ? `Your two are already in this week.`
      : done === 1
        ? `One in this week, one to go${daysLeft > 0 ? `, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}.`
        : `Nothing in yet this week${daysLeft > 0 ? `; ${daysLeft} day${daysLeft === 1 ? "" : "s"} left for your two` : ""}.`;
  return reply(`Rest day noted. ${standing} Two a week is the whole game.`, { scope: "ci" });
}

/** Re-edits the morning post's roll call. Errors are swallowed; the post is decoration. */
export async function refreshRollCall(env: Env, day: string): Promise<void> {
  try {
    await refreshDailyPost(env, day, await playersRoleId(env));
  } catch (error) {
    await logToDiscord(env, `Roll call refresh failed: ${String(error)}`);
  }
}

/**
 * The fast path: the whole transaction, then the receipt, with the public
 * line and any card going out after the response in ctx.waitUntil.
 */
export async function runCheckin(
  env: Env,
  ctx: ExecutionContext,
  player: Player,
  day: string,
  now: number,
  input: CheckinInput,
  scope: string
): Promise<Ephemeral> {
  const outcome = await performCheckin(env, player, day, now, input);
  if (!outcome.ok) {
    return reply(outcome.reason, { scope, components: buttonRows(await hubButtons(env, player, day)) });
  }
  ctx.waitUntil(postCheckinLine(env, player, day, outcome, input));
  return receiptReply(env, player, day, outcome);
}

export async function receiptReply(
  env: Env,
  player: Player,
  day: string,
  outcome: CheckinOutcome
): Promise<Ephemeral> {
  const components: unknown[] = [];
  if (outcome.quiz) components.push(quizButtons(outcome.checkinId, outcome.quiz.index));
  components.push(...buttonRows(await hubButtons(env, player, day)));
  return reply(outcome.receipt.join("\n"), { components, scope: "ci" });
}

/** The one line the channel sees, as a reply to the morning post. */
export async function postCheckinLine(
  env: Env,
  player: Player,
  day: string,
  outcome: CheckinOutcome,
  input: CheckinInput
): Promise<void> {
  try {
    const dailyPost = await getState(env, `daily_post:${day}`);
    const embeds: unknown[] = [];
    const components: unknown[] = [];

    if (input.attachment?.kind === "image") {
      embeds.push({ color: ACCENT, image: { url: input.attachment.url } });
    }
    if (input.attachment) {
      components.push(buttonRow([{ label: "Verify", custom_id: `vf:${outcome.checkinId}`, style: 3, emoji: "💪" }]));
    }

    // The loot card: what the check-in produced, as OSRS item icons.
    const report = await renderCard(env, `reports/${outcome.checkinId}.png`, (attempt) =>
      reportImageUrl(
        env,
        outcome.checkinId,
        {
          n: player.username,
          t: `${ordinalWordFor(outcome.ordinal)} check-in this week - ${weightWordFor(outcome.weight)}`,
          loot: outcome.loot,
          xp: outcome.xpGained,
          ...(outcome.levelUps.length > 0 ? { lv: outcome.levelUps.map((up) => ({ k: up.skill, l: up.level })) } : {}),
          ...(outcome.task ? { task: outcome.task } : {}),
          d: day,
        },
        attempt
      )
    );
    if (report) embeds.push({ color: ACCENT, image: { url: report } });

    // And the level-up banner, when there is one.
    if (outcome.levelUps.length > 0) {
      const top = outcome.levelUps.reduce((best, up) => (up.level > best.level ? up : best));
      const url = await renderCard(
        env,
        `levelups/${player.discord_id}-${top.skill}-${top.level}.png`,
        (attempt) => levelUpImageUrl(env, player.discord_id, player.username, top.skill, top.level, day, attempt)
      );
      if (url) embeds.push({ color: ACCENT, image: { url } });
    }

    let content = outcome.publicLine;
    if (input.attachment?.kind === "video") content += `\n${input.attachment.url}`;
    if (input.note) content += `\n> ${escapeMarkdown(input.note).slice(0, 200)}`;

    const message = await postMessage(env, {
      content,
      embeds,
      components,
      allowed_mentions: allowedMentions(),
      ...replyTo(dailyPost),
    });
    await setCheckinMessage(env, outcome.checkinId, message.id);
  } catch (error) {
    await logToDiscord(env, `Check-in line failed: ${String(error)}`);
  }
  await refreshRollCall(env, day);
}

// ── Roster ─────────────────────────────────────────────────────────

async function join(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  thenCheckin: string | null,
  day: string,
  now: number
): Promise<Answer> {
  const existing = await getPlayer(env, user.id);
  if (existing && existing.status === "active") {
    if (thenCheckin === day) {
      return runCheckin(env, ctx, { ...existing, username: user.username }, day, now, { note: null, attachment: null }, "ci");
    }
    return reply("You are already in. Answer the morning post's question when you have worked out.", { scope: "ci" });
  }
  await joinPlayer(env, user.id, user.username, now, day);
  const player = (await getPlayer(env, user.id))!;
  ctx.waitUntil(
    postMessage(env, {
      content: `**${escapeMarkdown(user.username)}** ${existing ? "is back in" : "joined"} the campaign.`,
      allowed_mentions: allowedMentions(),
    }).catch(() => undefined)
  );
  if (thenCheckin === day) {
    return runCheckin(env, ctx, player, day, now, { note: null, attachment: null }, "ci");
  }
  return reply(
    "You are in. Two a week is the whole game: the first two check-ins each week are full value. Every morning the bot asks whether you worked out in the last 24 hours; press Yes when you did. `/checkin` adds a note or a photo.\n" +
      "Want the morning post and Sunday's last call to ping you? Press Ping me on the pinned board, or `/pings on`.",
    { scope: "ci", components: [buttonRow([{ label: "Yes, I worked out today", custom_id: `ci:${day}`, style: 3, emoji: "💪" }])] }
  );
}

async function togglePing(env: Env, user: DiscordUser, on: boolean, day: string): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const ok = await setPing(env, user.id, on);
  await updatePlayer(env, user.id, { ping_opt_in: on ? 1 : 0 });
  if (!ok) return reply("Could not change the role — the bot may be missing Manage Roles. Your preference is saved.");
  return reply(on ? "You will be pinged on the morning post and Sunday's last call. Nowhere else." : "No more pings.");
}

// ── The hub ────────────────────────────────────────────────────────

export async function hub(env: Env, user: DiscordUser, day: string): Promise<Ephemeral> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const { player } = gate;
  const lamps = await unspentLamps(env, player.discord_id);
  const clue = await openClue(env, player.discord_id);
  const lines = [`**${escapeMarkdown(player.username)}** — what would you like to do?`];
  if (lamps.length > 0) lines.push(`🧞 ${lamps.length} lamp${lamps.length === 1 ? "" : "s"} to rub.`);
  if (clue) lines.push(`📜 A clue in hand — ${remainingSteps(clue).length} step${remainingSteps(clue).length === 1 ? "" : "s"} left.`);
  lines.push(`Combat style: ${STYLE_LABEL[player.combat_style]}.`);
  const styleButtons: Button[] = (["accurate", "aggressive", "defensive", "controlled"] as const).map((style) => ({
    label: STYLE_LABEL[style].split(" (")[0],
    custom_id: `style:${style}`,
    style: player.combat_style === style ? 1 : 2,
  }));
  return reply(lines.join("\n"), {
    scope: "ci",
    components: [...buttonRows(await hubButtons(env, player, day)), buttonRow(styleButtons)],
  });
}

async function setStyle(env: Env, user: DiscordUser, style: string, day: string): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  if (!isCombatStyle(style)) return reply("That is not a combat style.");
  await updatePlayer(env, user.id, { combat_style: style });
  return reply(`Combat style set to ${STYLE_LABEL[style]}. Every check-in's combat XP goes there from now.`, { scope: "ci" });
}

// ── Sheet ──────────────────────────────────────────────────────────

/**
 * The sheet needs a render, which needs a round trip to Vercel, which does
 * not fit inside Discord's three seconds. So: a deferred placeholder now, the
 * image edited in when it is ready.
 */
export async function sheetReply(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  targetId: string,
  day: string,
  now: number,
  publicly = false
): Promise<Answer> {
  const target = await getPlayer(env, targetId);
  if (!target || target.status === "retired") {
    return targetId === user.id
      ? (await requirePlayer(env, user, day) as { refusal: Ephemeral }).refusal ?? reply("Not in the campaign.")
      : reply("They are not in the campaign.");
  }
  ctx.waitUntil(renderSheetInto(env, interaction, target, day, now, publicly));
  return deferred();
}

async function renderSheetInto(
  env: Env,
  interaction: Interaction,
  target: Player,
  day: string,
  now: number,
  publicly: boolean
): Promise<void> {
  try {
    const data = await gatherSheet(env, target, day);
    const stamp = now;
    const url = await renderCard(env, `sheets/${target.discord_id}-${stamp}.png`, (attempt) =>
      sheetImageUrl(env, data, attempt)
    );
    const text = textSheet(data);
    if (publicly) {
      await postMessage(env, {
        content: url ? "" : text,
        embeds: url ? [{ color: ACCENT, image: { url } }] : [],
        allowed_mentions: allowedMentions(),
      });
      await editInteractionReply(env, interaction.application_id, interaction.token, { content: "Posted." });
      return;
    }
    if (url) await setState(env, `sheet_url:${target.discord_id}:${stamp}`, url);
    await editInteractionReply(env, interaction.application_id, interaction.token, {
      content: url ? "" : text,
      embeds: url ? [{ color: ACCENT, image: { url } }] : [],
      components: url
        ? [buttonRow([{ label: "Share to channel", custom_id: `share:${target.discord_id}:${stamp}`, style: 2 }])]
        : [],
    });
  } catch (error) {
    await logToDiscord(env, `Sheet failed: ${String(error)}`);
    await editInteractionReply(env, interaction.application_id, interaction.token, {
      content: "The sheet did not render. Try again in a minute.",
    });
  }
}

async function share(
  env: Env,
  ctx: ExecutionContext,
  user: DiscordUser,
  playerId: string,
  stamp: string,
  _day: string
): Promise<Answer> {
  const url = await getState(env, `sheet_url:${playerId}:${stamp}`);
  if (!url) return reply("That sheet has gone. Ask for a fresh one with `/sheet`.");
  const player = await getPlayer(env, playerId);
  ctx.waitUntil(
    postMessage(env, {
      content: `**${escapeMarkdown(player?.username ?? user.username)}**'s sheet`,
      embeds: [{ color: ACCENT, image: { url } }],
      allowed_mentions: allowedMentions(),
    }).catch(() => undefined)
  );
  return reply("Shared.", { update: true });
}

// ── Lamps ──────────────────────────────────────────────────────────

async function lampMenu(env: Env, user: DiscordUser, day: string): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const lamps = await unspentLamps(env, user.id);
  if (lamps.length === 0) return reply("No lamps to rub. The Genie comes to about one check-in in twenty.", { scope: "ci" });
  const lamp = lamps[0];
  const skills = await getSkills(env, user.id);
  const buttons: Button[] = SKILLS.map((skill) => {
    const level = levelForXp(skills[skill] ?? 0);
    return {
      label: `${SKILL_LABEL[skill]} +${lampValue(lamp, level)}`,
      custom_id: `lamp:${lamp.id}:${skill}`,
      style: 1,
    };
  });
  return reply(
    `🧞 ${lamps.length === 1 ? "One lamp" : `${lamps.length} lamps`} (${lamp.source}). Pick a skill for this one` +
      (lamp.source === "genie" ? " — a genie's lamp is worth ten times the skill's level." : " — an antique lamp pays the same into any skill."),
    { scope: "ci", components: buttonRows(buttons) }
  );
}

async function rubLamp(
  env: Env,
  user: DiscordUser,
  lampId: number,
  skill: string,
  day: string,
  now: number
): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  if (!isSkill(skill)) return reply("That is not a skill.");
  const lamp = await getLamp(env, lampId);
  if (!lamp || lamp.player_id !== user.id) return reply("That lamp is not yours.");
  if (lamp.spent_at) return reply("Already rubbed.", { scope: "ci" });

  const skills = await getSkills(env, user.id);
  const before = skills[skill] ?? 0;
  const relics = await getRelics(env);
  const xp = Math.floor(lampValue(lamp, levelForXp(before)) * (relics.has("treasure_seeker") ? TREASURE_SEEKER_MULTIPLIER : 1));
  if (!(await spendLamp(env, lampId, skill, now))) return reply("Already rubbed.", { scope: "ci" });
  await addXp(env, user.id, skill, xp);
  await env.DB.batch([logEventStatement(env, user.id, day, null, "lamp_rubbed", { lamp: lampId, skill, xp }, now)]);
  const afterLevel = levelForXp(before + xp);
  const beforeLevel = levelForXp(before);
  await logEntry(env, user.id, "milestone:first_lamp", day);
  if (afterLevel >= 50 && beforeLevel < 50) await logEntry(env, user.id, `skill50:${skill}`, day);

  const remaining = await unspentLamps(env, user.id);
  const line =
    `🧞 +${xp} ${SKILL_LABEL[skill]}` +
    (afterLevel > beforeLevel ? ` — **${SKILL_LABEL[skill]} ${afterLevel}!**` : ` (${SKILL_LABEL[skill]} ${afterLevel})`) +
    (remaining.length > 0 ? ` ${remaining.length} more to rub.` : "");
  if (remaining.length > 0) {
    const next = await lampMenu(env, user, day);
    if (!(next instanceof Response)) return { ...next, content: `${line}\n${next.content}` };
  }
  return reply(line, { scope: "ci", components: buttonRows(await hubButtons(env, gate.player, day)) });
}

// ── Clue ───────────────────────────────────────────────────────────

async function clueReply(env: Env, user: DiscordUser, day: string): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const clue = await openClue(env, user.id);
  if (!clue) return reply("No clue in hand. One check-in in twelve drops one.", { scope: "ci" });
  const steps = clueSteps(clue);
  const done = new Set(doneIndices(clue));
  const lines = [`📜 **${clue.tier[0].toUpperCase()}${clue.tier.slice(1)} clue** — ${done.size}/${steps.length}, since ${clue.started_day}. Any order, one step per check-in. Dies at the Founding.`];
  steps.forEach((step, i) => {
    lines.push(`${done.has(i) ? "✅" : "▫️"} ${stepLabel(step)}`);
  });
  return reply(lines.join("\n"), { scope: "ci" });
}

// ── Town ───────────────────────────────────────────────────────────

/** A fresh-gated action from actions.ts, answered on the check-in scope. */
export async function freshAction(
  env: Env,
  user: DiscordUser,
  day: string,
  run: (player: Player) => Promise<Line>
): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const line = await run(gate.player);
  return reply(line.content, { scope: "ci", components: line.components });
}

/** A view any player may open, fresh or not. */
export async function playerAction(
  env: Env,
  user: DiscordUser,
  day: string,
  run: (player: Player) => Promise<Line>
): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const line = await run(gate.player);
  return reply(line.content, { scope: "ci", components: line.components });
}

async function townReply(env: Env, user: DiscordUser, day: string, now: number): Promise<Answer> {
  return playerAction(env, user, day, (player) => townView(env, player, day, now));
}

// ── Collection log ─────────────────────────────────────────────────

async function logReply(env: Env, user: DiscordUser, day: string): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const entries = await logEntries(env, user.id);
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const [category, ...rest] = entry.split(":");
    const list = groups.get(category) ?? [];
    list.push(rest.join(":").replace(/_/g, " "));
    groups.set(category, list);
  }
  const names: Record<string, string> = {
    event: "Random events",
    clue: "Clue uniques",
    boss: "Boss heads",
    pet: "Pets",
    title: "Titles",
    holiday: "Holiday",
    milestone: "Milestones",
    skill50: "Skills to 50",
    tier: "Tiers",
  };
  const lines = [`📗 **Collection log** — ${entries.length}/${LOG_TOTAL}`];
  for (const [category, list] of groups) {
    lines.push(`**${names[category] ?? category}** (${list.length}): ${list.join(", ")}`);
  }
  if (entries.length === 0) lines.push("Empty. Everything in it comes from check-ins.");
  return reply(lines.join("\n"), { scope: "ci" });
}

// ── Verification ───────────────────────────────────────────────────

export async function verify(
  env: Env,
  ctx: ExecutionContext,
  user: DiscordUser,
  checkinId: number,
  day: string,
  now: number
): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const checkin = await getCheckin(env, checkinId);
  if (!checkin) return reply("That check-in is gone.");
  if (checkin.player_id === user.id) return reply("You cannot verify your own.");
  if (!checkin.attachment_r2_key) return reply("Nothing to verify — no photo or video on that one.");
  if (now - checkin.created_at > VERIFY_WINDOW_HOURS * 60 * 60 * 1000) {
    return reply("That one is past verifying — the window is 72 hours.");
  }
  if (!(await insertVerification(env, checkinId, user.id, now))) {
    return reply("You already verified that one.");
  }

  const count = await bumpVerifiedCount(env, checkinId, now);
  const author = await getPlayer(env, checkin.player_id);
  const statements: D1PreparedStatement[] = [];
  const lines: string[] = [];

  if (count === 1) {
    // The author's combat XP is recomputed at ×1.5 and the difference paid,
    // plus the Slayer that says "showed up with proof".
    const bonus = Math.floor(checkin.combat_xp * (VERIFIED_MULTIPLIER - 1));
    const split = splitByStyle(checkin.combat_style, bonus);
    for (const [skill, xp] of Object.entries(split)) {
      if (xp) statements.push(addXpStatement(env, checkin.player_id, skill as SkillKey, xp));
    }
    statements.push(
      addXpStatement(env, checkin.player_id, "slayer", Math.floor(VERIFIED_AUTHOR_SLAYER * checkin.weight))
    );
    lines.push(`Verified. ${escapeMarkdown(author?.username ?? "They")} gets +${bonus} combat XP and Slayer; you get ${VERIFIER_SLAYER} Slayer on your own next check-in.`);
    await logEntry(env, checkin.player_id, "milestone:first_verified", day);
    // Verified steps on the author's clue.
    const clue = await openClue(env, checkin.player_id);
    const hit = clue
      ? remainingSteps(clue).find((step) => verificationSatisfies(step.key, checkin.attachment_kind))
      : undefined;
    if (clue && hit && author) {
      const done = [...doneIndices(clue), hit.index];
      if (done.length >= clueSteps(clue).length) {
        const opened = await finishClue(env, author, clue.id, clue.tier, day, now);
        lines.push(opened.publicBit);
      } else {
        await markStep(env, clue.id, done);
      }
    }
  } else if (count <= MAX_COUNTED_VERIFICATIONS) {
    statements.push(addXpStatement(env, checkin.player_id, "slayer", EXTRA_VERIFICATION_SLAYER));
    lines.push(`Verified (${count}). +${EXTRA_VERIFICATION_SLAYER} Slayer to them; ${VERIFIER_SLAYER} Slayer to you on your next check-in.`);
  } else {
    lines.push(`Verified (${count}). Nothing more to pay on this one, but it is on the record.`);
  }
  statements.push(logEventStatement(env, user.id, day, checkinId, "verified", { author: checkin.player_id, count }, now));
  await env.DB.batch(statements);

  // The verifier's own clue: "verify somebody else's check-in".
  const myClue = await openClue(env, user.id);
  const mine = myClue ? remainingSteps(myClue).find((step) => step.key === "verify_someone") : undefined;
  if (myClue && mine) {
    const done = [...doneIndices(myClue), mine.index];
    if (done.length >= clueSteps(myClue).length) {
      const opened = await finishClue(env, gate.player, myClue.id, myClue.tier, day, now);
      lines.push(opened.receipt);
    } else {
      await markStep(env, myClue.id, done);
      lines.push("📜 That was one of your clue's steps.");
    }
  }
  await logEntry(env, user.id, "milestone:first_verify_given", day);

  // Bingo cells that verification can complete, for both sides.
  try {
    const act = actOf(env, day);
    const mine = bingoLines(await evaluateBingo(env, gate.player, day, act, now), gate.player.username);
    if (mine.receipt) lines.push(mine.receipt);
    if (author) await evaluateBingo(env, author, day, act, now);
  } catch {
    // Bingo is decoration; the verification stands.
  }

  // The check-in line says who verified it.
  if (checkin.message_id) {
    const names = await (await import("./db")).verifierNames(env, checkinId);
    ctx.waitUntil(
      editMessage(env, checkin.message_id, {
        content: `${outcomeLineFrom(checkin.message_id)}`,
      }).catch(() => undefined)
    );
    ctx.waitUntil(appendVerified(env, checkin.message_id, names));
  }
  return reply(lines.join("\n"));
}

function outcomeLineFrom(_messageId: string): string {
  return "";
}

/** Re-reads the message and appends "verified by …" without losing the line. */
async function appendVerified(env: Env, messageId: string, names: string[]): Promise<void> {
  try {
    const response = await fetch(
      `${env.DISCORD_API_BASE || "https://discord.com/api/v10"}/channels/${env.DISCORD_CHANNEL_ID}/messages/${messageId}`,
      { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } }
    );
    if (!response.ok) return;
    const message = (await response.json()) as { content: string };
    const base = message.content.replace(/\n?✅ verified by .*$/s, "");
    await editMessage(env, messageId, {
      content: `${base}\n✅ verified by ${names.map(escapeMarkdown).join(", ")}`,
    });
  } catch {
    // The line stands without the suffix.
  }
}

function splitByStyle(style: string, xp: number): Partial<Record<SkillKey, number>> {
  switch (style) {
    case "accurate":
      return { attack: xp };
    case "aggressive":
      return { strength: xp };
    case "defensive":
      return { defence: xp };
    default:
      return { attack: Math.floor(xp / 3), strength: Math.floor(xp / 3), defence: Math.floor(xp / 3) };
  }
}

// ── Quiz ───────────────────────────────────────────────────────────

async function answerQuiz(
  env: Env,
  user: DiscordUser,
  checkinId: number,
  index: number,
  choice: number,
  day: string,
  now: number
): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const checkin = await getCheckin(env, checkinId);
  if (!checkin || checkin.player_id !== user.id) return reply("That question is not yours.");
  const question = QUIZ_BANK[index];
  if (!question) return reply("That question has gone.");

  const answered = await env.DB.prepare(
    "SELECT id, payload FROM events_log WHERE checkin_id = ? AND event_key = 'event:quiz_master'"
  )
    .bind(checkinId)
    .first<{ id: number; payload: string | null }>();
  if (!answered) return reply("That question has gone.");
  const payload = answered.payload ? JSON.parse(answered.payload) : {};
  if (payload.answered) return reply("Already answered.", { update: true });
  if (addDays(checkin.day, 1) < day) return reply("Too late — the Quiz Master wandered off.", { update: true });

  const right = choice === question.a;
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE events_log SET payload = ? WHERE id = ?").bind(
      JSON.stringify({ ...payload, answered: true, right }),
      answered.id
    ),
  ];
  if (right) {
    const split = splitByStyle(checkin.combat_style, QUIZ_RIGHT_XP);
    for (const [skill, xp] of Object.entries(split)) {
      if (xp) statements.push(addXpStatement(env, user.id, skill as SkillKey, xp));
    }
    await logEntry(env, user.id, "milestone:quiz_master", day);
  } else {
    statements.push(...creditStatements(env, "coins", QUIZ_WRONG_COINS, "quiz", day, user.id, now));
  }
  await env.DB.batch(statements);
  return reply(
    right
      ? `✅ Right: ${question.o[question.a]}. +${QUIZ_RIGHT_XP} combat XP.`
      : `❌ It was "${question.o[question.a]}". The Quiz Master took ${QUIZ_WRONG_COINS} coins for the camp anyway.`,
    { update: true, components: buttonRows(await hubButtons(env, gate.player, day)) }
  );
}
