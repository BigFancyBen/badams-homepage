import {
  EXPEDITION_MAX_WEEKS,
  EXPEDITION_MIN_WEEKS,
  MAX_ATTACHMENT_BYTES,
  MAX_NOTE_LENGTH,
  RING_CAP,
  RING_CAP_GRADUATED,
  RING_EVERY_EARLY,
  RING_EVERY_LATE,
  RING_LATE_FROM_WEEK,
  STYLE_LABEL,
  isCombatStyle,
  isSkill,
} from "./config.ts";
import {
  activeRoster,
  addXp,
  attachProof,
  getAllSkills,
  getCheckinFor,
  getPlayer,
  getSkills,
  getPlayers,
  joinPlayer,
  updatePlayer,
} from "./db.ts";
import { ACCENT, allowedMentions, editInteractionReply, escapeMarkdown, postMessage, replyTo } from "./discord.ts";
import { getState } from "./db.ts";
import { attachmentKind, mirrorAttachment } from "./images.ts";
import {
  deferred,
  finishLater,
  handleInteraction,
  hub,
  postCheckinLine,
  receiptReply,
  reply,
  requireFresh,
  requirePlayer,
  runCheckin,
  sheetReply,
  today,
  type Answer,
} from "./interactions.ts";
import { setPing } from "./roles.ts";
import {
  buildMenu,
  doBuild,
  doRecruit,
  doRepair,
  raidPropose,
  raidStatus,
  recruitMenu,
  relicsView,
  repairMenu,
  townView,
  upgradeMenu,
  votesView,
} from "./actions.ts";
import { actOf, freshAction, playerAction } from "./interactions.ts";
import { bingoView } from "./bingo.ts";
import { spendPoints, taskView } from "./slayer.ts";
import { shopMenu } from "./shop.ts";
import { addDays, daysBetween, gameWeek } from "./schedule.ts";
import { runTick } from "./tick.ts";
import {
  buttonRow,
  EPHEMERAL,
  type DiscordAttachment,
  type DiscordUser,
  type Env,
  type Interaction,
  type InteractionOption,
} from "./types.ts";
import { performCheckin } from "./checkins.ts";
import { levelForXp, tierForDefence } from "./xp.ts";
import { combatLevel, levelsOf } from "./combat.ts";
import { resolveWeekFor } from "./weekly.ts";

/** Reads one option off a command, or off its first subcommand. */
function option(interaction: Interaction, name: string): InteractionOption | undefined {
  const options = interaction.data?.options ?? [];
  const direct = options.find((o) => o.name === name);
  if (direct) return direct;
  const sub = options.find((o) => o.type === 1);
  return sub?.options?.find((o) => o.name === name);
}

function subcommand(interaction: Interaction): string | null {
  return interaction.data?.options?.find((o) => o.type === 1)?.name ?? null;
}

function stringOption(interaction: Interaction, name: string): string | null {
  const value = option(interaction, name)?.value;
  return typeof value === "string" ? value : null;
}

function numberOption(interaction: Interaction, name: string): number | null {
  const value = option(interaction, name)?.value;
  return typeof value === "number" ? value : null;
}

function attachmentOption(interaction: Interaction, name: string): DiscordAttachment | null {
  const id = option(interaction, name)?.value;
  if (typeof id !== "string") return null;
  return interaction.data?.resolved?.attachments?.[id] ?? null;
}

export async function runCommand(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  now: number
): Promise<Answer> {
  const name = interaction.data?.name ?? "";
  const day = today(env, now);

  switch (name) {
    case "join":
      return joinCommand(env, ctx, user, day, now, stringOption(interaction, "ping") === "on");
    case "leave":
      return leaveCommand(env, ctx, user, day);
    case "expedition":
      return expeditionCommand(env, ctx, user, day, numberOption(interaction, "weeks") ?? 0);
    case "pings":
      return pingsCommand(env, user, day, stringOption(interaction, "mode") === "on");
    case "checkin":
      return checkinCommand(env, ctx, interaction, user, day, now);
    case "play":
      return hub(env, user, day);
    case "style":
      return styleCommand(env, user, day, stringOption(interaction, "style") ?? "");
    case "sheet": {
      const target = stringOption(interaction, "player") ?? user.id;
      const publicly = option(interaction, "public")?.value === true;
      return sheetReply(env, ctx, interaction, user, target, day, now, publicly);
    }
    case "lamp":
      return relay(env, ctx, interaction, user, "lamp", now);
    case "clue":
      return relay(env, ctx, interaction, user, "clue", now);
    case "log":
      return relay(env, ctx, interaction, user, "log", now);
    case "town":
      return playerAction(env, user, day, (p) => townView(env, p, day, now));
    case "recruit": {
      const kind = stringOption(interaction, "kind");
      return freshAction(env, user, day, (p) => (kind ? doRecruit(env, p, kind, day, now) : recruitMenu(env, p, day)));
    }
    case "upgrade":
      return freshAction(env, user, day, (p) => upgradeMenu(env, p));
    case "build": {
      const key = stringOption(interaction, "building");
      return freshAction(env, user, day, (p) => (key ? doBuild(env, p, key, day, now) : buildMenu(env, day)));
    }
    case "repair": {
      const key = stringOption(interaction, "building");
      return freshAction(env, user, day, (p) => (key ? doRepair(env, p, key, day, now) : repairMenu(env)));
    }
    case "vote":
      return playerAction(env, user, day, (p) => votesView(env, p));
    case "relics":
      return playerAction(env, user, day, () => relicsView(env));
    case "bingo":
      return playerAction(env, user, day, async (p) => ({ content: await bingoView(env, p, actOf(env, day)) }));
    case "task": {
      const sub = subcommand(interaction);
      if (sub && sub !== "status") {
        return freshAction(env, user, day, async (p) => {
          const levels = levelsOf(await getSkills(env, p.discord_id), levelForXp);
          return { content: await spendPoints(env, p, sub, levels, combatLevel(levels), day, now) };
        });
      }
      return playerAction(env, user, day, (p) => taskView(env, p));
    }
    case "shop":
      return playerAction(env, user, day, async (p) => shopMenu(p));
    case "raid": {
      const sub = subcommand(interaction);
      if (sub === "propose") return freshAction(env, user, day, (p) => raidPropose(env, p, day, now));
      if (sub === "sitout") return playerAction(env, user, day, async () => ({ content: "Sit out from the raid vote itself: press Sit out on the vote post." }));
      return playerAction(env, user, day, () => raidStatus(env, day));
    }
    case "freeze":
      return freezeCommand(env, user, day);
    case "standings":
      return standingsCommand(env, day);
    case "help":
      return helpCommand(env);
    case "admin":
      return adminCommand(env, ctx, interaction, user, day, now);
    default:
      return reply("That command is not one of mine.");
  }
}

/** A slash command that does what a hub button does. */
async function relay(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  customId: string,
  _now: number
): Promise<Answer> {
  return handleInteraction(env, ctx, {
    ...interaction,
    type: 3,
    data: { custom_id: customId, name: interaction.data?.name },
  });
}

// ── Roster ─────────────────────────────────────────────────────────

async function joinCommand(
  env: Env,
  ctx: ExecutionContext,
  user: DiscordUser,
  day: string,
  now: number,
  ping: boolean
): Promise<Answer> {
  const existing = await getPlayer(env, user.id);
  if (existing?.status === "active") return reply("You are already in.");
  await joinPlayer(env, user.id, user.username, now, day);
  if (ping) {
    await setPing(env, user.id, true);
    await updatePlayer(env, user.id, { ping_opt_in: 1 });
  }
  ctx.waitUntil(
    postMessage(env, {
      content: `**${escapeMarkdown(user.username)}** ${existing ? "is back in" : "joined"} the campaign.`,
      allowed_mentions: allowedMentions(),
    }).catch(() => undefined)
  );
  return reply(
    "You are in. Two a week is the whole game. Every morning the bot asks whether you worked out in the last 24 hours: press Yes when you did. `/checkin` adds a note or a photo." +
      (ping ? " You will be pinged on the morning post and Sunday's last call." : ""),
    { components: [buttonRow([{ label: "Yes, I worked out today", custom_id: `ci:${day}`, style: 3, emoji: "💪" }])] }
  );
}

async function leaveCommand(env: Env, ctx: ExecutionContext, user: DiscordUser, day: string): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  await updatePlayer(env, user.id, { status: "retired" });
  await setPing(env, user.id, false);
  ctx.waitUntil(
    postMessage(env, {
      content: `**${escapeMarkdown(user.username)}** retired from the campaign. Their sheet is kept.`,
      allowed_mentions: allowedMentions(),
    }).catch(() => undefined)
  );
  return reply("Retired. Your levels are kept; `/join` picks up where you left off.");
}

async function expeditionCommand(
  env: Env,
  ctx: ExecutionContext,
  user: DiscordUser,
  day: string,
  weeks: number
): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  if (!Number.isInteger(weeks) || weeks < EXPEDITION_MIN_WEEKS || weeks > EXPEDITION_MAX_WEEKS) {
    return reply(`Expeditions run ${EXPEDITION_MIN_WEEKS} to ${EXPEDITION_MAX_WEEKS} weeks.`);
  }
  // Returns on a Monday, so the week boundary is clean.
  const back = addDays(gameWeek(day), 7 * weeks);
  await updatePlayer(env, user.id, { status: "paused", paused_until: back });
  ctx.waitUntil(
    postMessage(env, {
      content: `**${escapeMarkdown(user.username)}** is on expedition until ${back}.`,
      allowed_mentions: allowedMentions(),
    }).catch(() => undefined)
  );
  return reply(`On expedition until ${back}. You are out of the group maths until then; check in any time to come back early.`);
}

async function pingsCommand(env: Env, user: DiscordUser, day: string, on: boolean): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const ok = await setPing(env, user.id, on);
  await updatePlayer(env, user.id, { ping_opt_in: on ? 1 : 0 });
  if (!ok) return reply("Could not change the role — the bot may be missing Manage Roles. Your preference is saved.");
  return reply(on ? "You will be pinged on the morning post and Sunday's last call." : "No more pings.");
}

// ── Check-in ───────────────────────────────────────────────────────

async function checkinCommand(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  day: string,
  now: number
): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const player = { ...gate.player, username: user.username };
  await updatePlayer(env, user.id, { username: user.username });

  const note = (stringOption(interaction, "note") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_LENGTH) || null;
  const attachment = attachmentOption(interaction, "photo");

  if (!attachment) {
    return runCheckin(env, ctx, player, day, now, { note, attachment: null }, "checkin");
  }

  const kind = attachmentKind(attachment);
  if (!kind) return reply("That file is not an image or a video.");
  if (attachment.size > MAX_ATTACHMENT_BYTES) return reply("That file is too big — 25 MB is the cap.");

  // Already said Yes today: the photo becomes that check-in's proof.
  const existing = await getCheckinFor(env, user.id, day);
  if (existing) {
    if (existing.attachment_r2_key) return reply("Today's check-in already carries proof.");
    ctx.waitUntil(
      finishLater(env, interaction, "Attaching proof", async () => {
        const mirrored = await mirrorAttachment(env, user.id, day, attachment);
        if (!mirrored) {
          await editInteractionReply(env, interaction.application_id, interaction.token, { content: "The photo could not be saved." });
          return;
        }
        await attachProof(env, existing.id, mirrored.key, mirrored.url, kind);
        // The proof is attached either way; the channel line is the part that
        // can fail (the bot may be locked out of the channel), and it says so.
        const posted = await postMessage(env, {
          content: `📸 **${escapeMarkdown(user.username)}** added proof to today's check-in.` + (kind === "video" ? `\n${mirrored.url}` : "") + (note ? `\n> ${escapeMarkdown(note)}` : ""),
          embeds: kind === "image" ? [{ color: ACCENT, image: { url: mirrored.url } }] : [],
          components: [buttonRow([{ label: "Verify", custom_id: `vf:${existing.id}`, style: 3, emoji: "💪" }])],
          allowed_mentions: allowedMentions(),
          ...replyTo(await getState(env, `daily_post:${day}`)),
        }).then(
          () => true,
          () => false
        );
        await editInteractionReply(env, interaction.application_id, interaction.token, {
          content: posted
            ? "Proof attached. Friends have 72 hours to press Verify."
            : "Proof attached, but the channel line could not be posted: the bot cannot write to the channel right now.",
          flags: EPHEMERAL,
        });
      })
    );
    return deferred();
  }

  // Mirroring the file first is a fetch, and a fetch does not fit inside
  // the three seconds Discord gives an interaction. Defer, then do the work.
  ctx.waitUntil(
    finishLater(env, interaction, "Photo check-in", async () => {
      const mirrored = await mirrorAttachment(env, user.id, day, attachment);
      const input = {
        note,
        attachment: mirrored ? { key: mirrored.key, url: mirrored.url, kind } : null,
      };
      const outcome = await performCheckin(env, player, day, now, input);
      if (!outcome.ok) {
        await editInteractionReply(env, interaction.application_id, interaction.token, { content: outcome.reason });
        return;
      }
      const receipt = await receiptReply(env, player, day, outcome);
      await editInteractionReply(env, interaction.application_id, interaction.token, {
        content: (mirrored ? "" : "The photo could not be saved, so this one carries no proof.\n") + receipt.content,
        components: receipt.components,
        flags: EPHEMERAL,
      });
      await postCheckinLine(env, player, day, outcome, input);
    })
  );
  return deferred();
}

async function styleCommand(env: Env, user: DiscordUser, day: string, style: string): Promise<Answer> {
  const gate = await requireFresh(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  if (!isCombatStyle(style)) return reply("That is not a combat style.");
  await updatePlayer(env, user.id, { combat_style: style });
  return reply(`Combat style set to ${STYLE_LABEL[style]}.`);
}

async function freezeCommand(env: Env, user: DiscordUser, day: string): Promise<Answer> {
  const gate = await requirePlayer(env, user, day);
  if ("refusal" in gate) return gate.refusal;
  const { player } = gate;
  const playerWeek = Math.floor(daysBetween(player.joined_day, day) / 7) + 1;
  const every = playerWeek >= RING_LATE_FROM_WEEK ? RING_EVERY_LATE : RING_EVERY_EARLY;
  const cap = player.graduated_at ? RING_CAP_GRADUATED : RING_CAP;
  return reply(
    `💍 Rings of Life: ${player.rings} of ${cap}. ${player.ring_progress} of ${every} Form weeks towards the next.\n` +
      "A Ring is spent for you at the Monday boundary on a week that closed at exactly one check-in — the streak survives. " +
      "A week at zero breaks regardless. Rings are earned, never bought."
  );
}

async function standingsCommand(env: Env, day: string): Promise<Answer> {
  const roster = await activeRoster(env, day);
  const skills = await getAllSkills(env);
  const rows = roster
    .map((p) => {
      const levels = levelsOf(skills.get(p.discord_id) ?? {}, levelForXp);
      const hp = combatLevel(levels);
      const hpXp = hp * 1e9 + (skills.get(p.discord_id)?.hitpoints ?? 0);
      return { name: p.username, hp, hpXp, tier: tierForDefence(levels.defence).name, fw: p.form_weeks };
    })
    .sort((a, b) => b.hpXp - a.hpXp);
  if (rows.length === 0) return reply("Nobody is on the roster yet.");
  return reply(
    rows.map((r, i) => `${i + 1}. **${escapeMarkdown(r.name)}** · ${r.tier} · Combat ${r.hp} · Form weeks ${r.fw}`).join("\n")
  );
}

async function helpCommand(env: Env): Promise<Answer> {
  return reply(
    [
      "**Yut Hut** — two a week is the whole game.",
      "Every morning the bot asks whether you worked out in the last 24 hours. Press Yes when you did (any exercise counts, one a day), No when you rested. `/checkin` adds a note or a photo.",
      "Every Yes is a training session against your Slayer task, scored the way Old School RuneScape scores it: your levels, weapon, armour and prayers decide the damage, and the damage decides the XP.",
      "The first two check-ins of the week are full value, the third and fourth half, the rest a fifth.",
      "A check-in in the last four days is what lets you play: `/lamp`, `/clue`, `/task`, `/town`, `/vote`, and verifying friends.",
      "Only people who `/join` are counted. Nobody else is ever named.",
      `Rules and commands: ${env.IMAGE_BASE_URL}/yut-hut`,
    ].join("\n")
  );
}

// ── Admin ──────────────────────────────────────────────────────────

async function adminCommand(
  env: Env,
  ctx: ExecutionContext,
  interaction: Interaction,
  user: DiscordUser,
  day: string,
  now: number
): Promise<Answer> {
  const sub = subcommand(interaction);
  switch (sub) {
    case "post-daily": {
      const report = await runTick(env, now, { post: true });
      return reply(`Posted. ${JSON.stringify(report).slice(0, 500)}`);
    }
    case "resolve-day": {
      const report = await runTick(env, now, { daily: true });
      return reply(`Resolved. ${JSON.stringify(report).slice(0, 800)}`);
    }
    case "resolve-week": {
      const summary = await resolveWeekFor(env, addDays(gameWeek(day), -7), day, now);
      return reply(JSON.stringify(summary).slice(0, 1500));
    }
    case "grant": {
      const target = stringOption(interaction, "player");
      const skill = stringOption(interaction, "skill") ?? "";
      const xp = numberOption(interaction, "xp") ?? 0;
      if (!target || !isSkill(skill) || xp <= 0) return reply("Usage: /admin grant player skill xp");
      await addXp(env, target, skill, xp);
      return reply(`Granted ${xp} ${skill} to <@${target}>.`);
    }
    case "roster": {
      const players = await getPlayers(env);
      return reply(
        players.length === 0
          ? "Nobody."
          : players
              .map((p) => `${escapeMarkdown(p.username)} · ${p.status} · last ${p.last_active_day ?? "never"} · form weeks ${p.form_weeks} · rings ${p.rings}`)
              .join("\n")
      );
    }
    default:
      return reply("Unknown admin subcommand.");
  }
}
