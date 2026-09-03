import {
  ACTS,
  ACT_WEEKS,
  ALTAR_MULTIPLIER,
  BEEKEEPER_HOURS,
  CAMPAIGN_EVENTS,
  DRILL_DEMON_LAMP_PER_LEVEL,
  DRUNKEN_DWARF_COINS,
  EVIL_CHICKEN_DEFENCE,
  FISH,
  FORESTER_REPAIR,
  GATHER_UNITS_PER_SESSION,
  LOGS,
  OLD_MAN_RESOURCE,
  ORES,
  QUIZ_BANK,
  RECOVERY_CHECKINS,
  RECOVERY_LAMP_XP,
  RECOVERY_SILENT_DAYS,
  RECOVERY_WINDOW_DAYS,
  RING_CAP,
  RING_CAP_GRADUATED,
  SANDWICH_LADY_HP,
  SKILL_LABEL,
  SKILLS,
  VERIFIER_DAILY_CAP,
  VERIFIER_PAY_WINDOW_DAYS,
  VERIFIER_SLAYER,
  bestResource,
  type ResourceKey,
  type SkillKey,
} from "./config.ts";
import {
  checkinSatisfies,
  clueLine,
  clueSteps,
  clueTier,
  doneIndices,
  drawSteps,
  openCasket,
  remainingSteps,
  rollClue,
  stepLabel,
  type StepContext,
} from "./clues.ts";
import {
  addXpStatement,
  markStep,
  checkinsOn,
  completeClue,
  countCheckinsBetween,
  countCheckinsTotal,
  getCheckinFor,
  getSkills,
  grantLampStatement,
  insertCheckin,
  insertClue,
  logEntries,
  logEntry,
  logEventStatement,
  markClaimed,
  markVerificationsPaid,
  openClaims,
  openClue,
  recordAnswer,
  unpaidVerifications,
  updatePlayer,
} from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { eventLabel, pickQuiz, rollEvent, seededRng } from "./events.ts";
import { actForWeek, addDays, campaignWeek, daysBetween, gameWeek } from "./schedule.ts";
import {
  baseHaul,
  creditStatements,
  deliverSacks,
  effectiveLevel,
  eventChance,
  getBuildings,
  repairWorst,
  setBeekeeper,
} from "./town.ts";
import { getRelics } from "./relics.ts";
import { activeRaidFor, raidHit } from "./raids.ts";
import { bingoLines, evaluateBingo } from "./bingo.ts";
import { ensureTask, hasSlayerHelmet, progressTask, taskMonster, taskName, taskShort } from "./slayer.ts";
import { combatLevel, levelsOf, simulateSession, weaponFor, type Session } from "./combat.ts";
import { TRICKSTER_POINTS, XERIC_WEIGHT } from "./config.ts";
import { buttonRow, type Button, type Checkin, type Env, type Player } from "./types.ts";
import {
  clueTierForMonster,
  levelForXp,
  lampXp,
  nextTier,
  ordinalWeight,
  tierForDefence,
  xpForLevel,
  xpToNext,
} from "./xp.ts";

/**
 * The check-in. One transaction in the loose sense — a batch for the writes
 * that must land together, then the rest in order, every step re-runnable
 * because the rolls are seeded on the player and the day and the session is
 * arithmetic rather than dice.
 *
 * A check-in is one training session in Old School RuneScape terms: the
 * player fights their Slayer task for a fixed stretch of time with the best
 * scimitar, armour and prayers their levels allow (combat.ts). The damage
 * decides the combat XP, the kills decide the Slayer XP and the bones for
 * Prayer, and the haul on the way home decides the gathering XP.
 */

export interface CheckinOutcome {
  ok: true;
  checkinId: number;
  ordinal: number;
  weight: number;
  /** The full session log, line by line. */
  receipt: string[];
  /** The lines of the receipt only the player can act on — what the ephemeral keeps. */
  essentials: string[];
  /** The line the day's thread sees. */
  publicLine: string;
  levelUps: { skill: SkillKey; level: number; from: number }[];
  tierUp: string | null;
  quiz: { index: number } | null;
  hasLamp: boolean;
  hasClue: boolean;
  /** What the check-in produced, as item keys with counts, for the loot card. */
  loot: { k: string; c: number }[];
  xpGained: { k: string; x: number }[];
  task: string | null;
  /** The session, for the card: "23 hill giants · max hit 4 · 54% to hit". */
  session: string;
}

/** Turns an item's display name into its icon key. */
export function itemKey(name: string): string {
  if (name === "Amulet of glory (t)") return "glory_t";
  return name.toLowerCase().replace(/[()']/g, "").replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}

export interface CheckinRefusal {
  ok: false;
  reason: string;
}

export interface CheckinInput {
  note: string | null;
  attachment: { key: string; url: string; kind: "image" | "video" } | null;
}

function ordinalWord(n: number): string {
  const words = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];
  return words[n - 1] ?? `${n}th`;
}

function weightWord(weight: number): string {
  if (weight >= 1) return "full value";
  if (weight >= 0.5) return "half value";
  return "a fifth";
}

/** Which campaign effect (holiday) is on for a day, if any. */
export function effectFor(env: Env, day: string): string | undefined {
  const week = campaignWeek(day, env.CAMPAIGN_START);
  return CAMPAIGN_EVENTS.find((event) => event.week === week && event.effect)?.effect;
}

/** "23 hill giants: max hit 4, 54% to hit, 812 damage." */
function sessionLine(session: Session, name: string): string {
  const ate = session.foodEaten > 0 ? ` Ate ${session.foodEaten} lobster${session.foodEaten === 1 ? "" : "s"}${session.bankTrips > 0 ? ` and banked ${session.bankTrips === 1 ? "once" : `${session.bankTrips} times`}` : ""}.` : "";
  return (
    `⚔️ ${session.kills} ${name}: max hit ${session.maxHit}, ${Math.round(session.hitChance * 100)}% to hit, ${session.damage.toLocaleString("en-US")} damage. ` +
    `${session.weapon.name}, ${session.armour.name.toLowerCase()}${session.prayers.length > 0 ? `, ${session.prayers[session.prayers.length - 1]}` : ""}.${ate}`
  );
}

export async function performCheckin(
  env: Env,
  player: Player,
  day: string,
  now: number,
  input: CheckinInput
): Promise<CheckinOutcome | CheckinRefusal> {
  const week = gameWeek(day);
  const before = await countCheckinsBetween(env, player.discord_id, week, addDays(day, -1));
  const ordinal = before + 1;
  const relics = await getRelics(env);
  const weight =
    relics.has("xerics_endurance") && (ordinal === 3 || ordinal === 4) ? XERIC_WEIGHT : ordinalWeight(ordinal);

  const skillsBefore = await getSkills(env, player.discord_id);
  const levelsBefore = levelsOf(skillsBefore, levelForXp);
  const combatBefore = combatLevel(levelsBefore);
  const tierBefore = tierForDefence(levelsBefore.defence);
  const owned = new Set(await logEntries(env, player.discord_id));
  const buildings = await getBuildings(env);

  // ── The session ────────────────────────────────────────────────
  // The Slayer task is the opponent; a player with none gets one first.
  const { task, assignedNow } = await ensureTask(env, player, levelsBefore, combatBefore, day);
  const monster = taskMonster(task);
  const session = simulateSession({
    levels: levelsBefore,
    style: player.combat_style,
    gear: { slayerHelmet: hasSlayerHelmet(player), glory: owned.has("clue:Amulet of glory (t)") },
    monster,
    weight,
  });
  const monsterName = taskName(task);

  // The haul: what every check-in brings the town, plus the sacks the
  // player's workers filled since their last one.
  const haul = baseHaul(weight, tierBefore.haul, relics);
  const sacks = await deliverSacks(env, player, day, now, relics);
  for (const [resource, amount] of Object.entries(sacks.delivered)) {
    haul[resource as ResourceKey] = (haul[resource as ResourceKey] ?? 0) + (amount ?? 0);
  }
  const delivered = Object.values(haul).reduce((sum, n) => sum + (n ?? 0), 0);

  // Gathering: each log, ore and fish handled pays the XP of the best one
  // the player's level can take, up to a session's worth.
  const gatherCap = Math.max(1, Math.floor(GATHER_UNITS_PER_SESSION * weight));
  const gatherXp = (units: number, table: typeof LOGS, level: number) =>
    Math.floor(Math.min(units, gatherCap) * bestResource(table, level).xp);
  const logsHandled = (baseHaul(weight, tierBefore.haul).logs ?? 0) + (sacks.units.woodcutting ?? 0);
  const woodcuttingXp = gatherXp(logsHandled, LOGS, levelsBefore.woodcutting);
  const miningXp = gatherXp(sacks.units.mining ?? 0, ORES, levelsBefore.mining);
  const fishingXp = gatherXp(sacks.units.fishing ?? 0, FISH, levelsBefore.fishing);

  // Bones from the kills, buried at the Chapel's altar if there is one.
  const altar = ALTAR_MULTIPLIER[Math.min(ALTAR_MULTIPLIER.length - 1, Math.floor(effectiveLevel(buildings.get("chapel"))))] ?? 1;
  const prayerXp = monster.bones ? Math.floor(session.kills * monster.bones.xp * altar) : 0;

  const combatXpTotal = (session.xp.attack ?? 0) + (session.xp.strength ?? 0) + (session.xp.defence ?? 0);
  const hourUtc = new Date(now).getUTCHours();
  const checkinId = await insertCheckin(env, {
    player_id: player.discord_id,
    day,
    week,
    ordinal,
    weight,
    note: input.note,
    attachment_r2_key: input.attachment?.key ?? null,
    attachment_url: input.attachment?.url ?? null,
    attachment_kind: input.attachment?.kind ?? null,
    hp_xp: session.xp.hitpoints ?? 0,
    combat_xp: combatXpTotal,
    combat_style: player.combat_style,
    delivered: JSON.stringify(haul),
    session: JSON.stringify({
      monster: monster.name,
      kills: session.kills,
      damage: session.damage,
      maxHit: session.maxHit,
      hitChance: Math.round(session.hitChance * 100) / 100,
      attacks: session.attacks,
      weapon: session.weapon.key,
      armour: session.armour.key,
    }),
    hour_utc: hourUtc,
    created_at: now,
  });
  if (checinIdIsNull(checkinId)) {
    return { ok: false, reason: "Already in for today — the next day starts at 3am." };
  }

  const receipt: string[] = [];
  const essentials: string[] = [];
  /** A receipt line the player must see even though the session moved to the thread. */
  const keep = (line: string) => {
    receipt.push(line);
    essentials.push(line);
  };
  const publicBits: string[] = [];
  const statements: D1PreparedStatement[] = [];
  const loot: { k: string; c: number }[] = [];
  const addLoot = (key: string, count = 1) => {
    const existing = loot.find((item) => item.k === key);
    if (existing) existing.c += count;
    else loot.push({ k: key, c: count });
  };
  if (monster.bones) addLoot(itemKey(monster.bones.item), session.kills);
  for (const [resource, amount] of Object.entries(haul)) if ((amount ?? 0) > 0) addLoot(resource, amount ?? 0);

  // ── XP ─────────────────────────────────────────────────────────
  const gains: Partial<Record<SkillKey, number>> = { ...session.xp };
  if (prayerXp > 0) gains.prayer = prayerXp;
  if (woodcuttingXp > 0) gains.woodcutting = woodcuttingXp;
  if (miningXp > 0) gains.mining = miningXp;
  if (fishingXp > 0) gains.fishing = fishingXp;

  for (const [skill, amount] of Object.entries(gains)) {
    if (amount) statements.push(addXpStatement(env, player.discord_id, skill as SkillKey, amount));
  }
  // The base haul is credited here; the sacks carry their own ledger lines.
  for (const [resource, amount] of Object.entries(baseHaul(weight, tierBefore.haul, relics))) {
    statements.push(
      ...creditStatements(env, resource as ResourceKey, amount ?? 0, "haul", day, player.discord_id, now)
    );
  }
  statements.push(...sacks.statements);
  statements.push(
    logEventStatement(env, player.discord_id, day, checkinId, "checkin", { ordinal, weight, gains, haul, monster: monster.name, kills: session.kills, damage: session.damage }, now)
  );
  await env.DB.batch(statements);

  // ── Slayer task ────────────────────────────────────────────────
  const progress = await progressTask(env, player, task, assignedNow, session.kills, levelsBefore, combatBefore, day, checkinId, now);
  if (progress.xp > 0) gains.slayer = progress.xp;

  receipt.push(`**Checked in.** ${ordinalWord(ordinal)} this week, ${weightWord(weight)}.`);
  receipt.push(sessionLine(session, monsterName));
  if (assignedNow || progress.completed) keep(`🗡️ ${progress.line}`);
  else receipt.push(`🗡️ ${progress.line}`);
  publicBits.push(`⚔️ ${session.kills} ${monsterName} slain${progress.completed ? "" : ` (${progress.task.kills}/${progress.task.kills_needed} on task)`}.`);
  if (progress.publicBit) publicBits.push(progress.publicBit);

  // ── Level-ups, the weapon, the tier ────────────────────────────
  const skillsAfter = await getSkills(env, player.discord_id);
  const levelsAfter = levelsOf(skillsAfter, levelForXp);
  const levelUps: { skill: SkillKey; level: number; from: number }[] = [];
  for (const skill of SKILLS) {
    const gained = gains[skill] ?? 0;
    if (!gained) continue;
    const after = skillsAfter[skill] ?? 0;
    const levelBefore = levelsBefore[skill];
    const levelAfter = levelsAfter[skill];
    const toNext = xpToNext(after);
    const detail =
      skill === "prayer" && monster.bones
        ? ` — ${session.kills} ${monster.bones.item.toLowerCase()}${altar > 1 ? ` at the altar (${altar}×)` : ""}`
        : skill === "woodcutting"
          ? ` — ${Math.min(logsHandled, gatherCap)} ${bestResource(LOGS, levelsBefore.woodcutting).name.toLowerCase()}`
          : skill === "mining"
            ? ` — ${Math.min(sacks.units.mining ?? 0, gatherCap)} ${bestResource(ORES, levelsBefore.mining).name.toLowerCase()}`
            : skill === "fishing"
              ? ` — ${Math.min(sacks.units.fishing ?? 0, gatherCap)} ${bestResource(FISH, levelsBefore.fishing).name.toLowerCase()}`
              : "";
    receipt.push(
      `${SKILL_LABEL[skill]} ${levelAfter} (+${gained.toLocaleString("en-US")})${detail}${toNext > 0 ? ` · ${toNext.toLocaleString("en-US")} to ${levelAfter + 1}` : " · capped"}`
    );
    if (levelAfter > levelBefore) levelUps.push({ skill, level: levelAfter, from: levelBefore });
  }
  if (delivered > 0) {
    receipt.push(`Delivered ${haulLine(haul)} to the ${buildings.size > 0 ? "town" : "camp"}.`);
  }

  const weaponBefore = weaponFor(levelsBefore.attack);
  const weaponAfter = weaponFor(levelsAfter.attack);
  if (weaponAfter.key !== weaponBefore.key) {
    receipt.push(`**You can wield a ${weaponAfter.name.toLowerCase()} now.**`);
    publicBits.push(`🗡️ **${escapeMarkdown(player.username)} can wield a ${weaponAfter.name.toLowerCase()}.**`);
    addLoot(`${weaponAfter.key}_scimitar`);
  }

  const tierAfter = tierForDefence(levelsAfter.defence);
  let tierUp: string | null = null;
  if (tierAfter.key !== tierBefore.key) {
    tierUp = tierAfter.name;
    receipt.push(`**You can wear ${tierAfter.name.toLowerCase()} now${tierAfter.title ? ` — ${tierAfter.title}` : ""}.**`);
    addLoot(`${tierAfter.key}_platebody`);
    await logEntry(env, player.discord_id, `tier:${tierAfter.key}`, day);
    if (tierAfter.title && !player.title) {
      await updatePlayer(env, player.discord_id, { title: tierAfter.title });
    }
  } else {
    const next = nextTier(tierAfter);
    if (next) {
      const need = xpForLevel(next.level) - (skillsAfter.defence ?? 0);
      receipt.push(`${next.name} at Defence ${next.level} — ${need.toLocaleString("en-US")} XP away.`);
    }
  }
  const combatAfter = combatLevel(levelsAfter);
  if (combatAfter > combatBefore) receipt.push(`Combat level ${combatAfter}.`);
  for (const up of levelUps) publicBits.push(`**${SKILL_LABEL[up.skill]} ${up.level}!**`);
  if (tierUp) publicBits.push(`**${tierUp} now.**`);
  for (const skill of SKILLS) {
    if (levelsAfter[skill] >= 50 && levelsBefore[skill] < 50) {
      await logEntry(env, player.discord_id, `skill50:${skill}`, day);
    }
  }

  // ── Random event ───────────────────────────────────────────────
  const effect = effectFor(env, day);
  const rng = seededRng(`${player.discord_id}:${day}:event`);
  const event = rollEvent(
    rng,
    player.event_dry_streak,
    eventChance(buildings),
    effect,
    relics.has("trickster") ? TRICKSTER_POINTS : 0
  );
  let quiz: { index: number } | null = null;
  let gotLamp = false;
  let rings = player.rings;
  const ringCap = player.graduated_at ? RING_CAP_GRADUATED : RING_CAP;

  if (event) {
    const label = eventLabel(event, effect);
    const eventStatements: D1PreparedStatement[] = [];
    let line = "";
    switch (event) {
      case "genie":
        eventStatements.push(grantLampStatement(env, player.discord_id, 0, "genie", day));
        gotLamp = true;
        addLoot("lamp");
        line = `🧞 A ${label} appeared — you have a lamp. Rub it with /lamp.`;
        publicBits.push(`🧞 ${label === "Genie" ? "A genie appeared" : "The Grim Reaper called"} — ${escapeMarkdown(player.username)} has a lamp.`);
        break;
      case "old_man": {
        const resources: ResourceKey[] = ["coins", "ore", "logs", "fish"];
        const resource = resources[Math.floor(rng() * resources.length)];
        eventStatements.push(
          ...creditStatements(env, resource, OLD_MAN_RESOURCE, "crate", day, player.discord_id, now)
        );
        addLoot("crate");
        addLoot(resource, OLD_MAN_RESOURCE);
        line = `🎩 The Mysterious Old Man left a crate: ${OLD_MAN_RESOURCE} ${resource} for the camp.`;
        publicBits.push(`🎩 The Mysterious Old Man dropped ${OLD_MAN_RESOURCE} ${resource} on the camp.`);
        break;
      }
      case "drunken_dwarf":
        if (rings < ringCap) {
          rings++;
          addLoot("ring");
          line = `🍺 The Drunken Dwarf pressed a Ring of Life into your hand.`;
          publicBits.push(`🍺 The Drunken Dwarf gave ${escapeMarkdown(player.username)} a Ring of Life.`);
        } else {
          eventStatements.push(
            ...creditStatements(env, "coins", DRUNKEN_DWARF_COINS, "crate", day, player.discord_id, now)
          );
          addLoot("coins", DRUNKEN_DWARF_COINS);
          line = `🍺 The Drunken Dwarf tried to give you a Ring; you are full up, so he left ${DRUNKEN_DWARF_COINS} coins with the camp.`;
          publicBits.push(`🍺 The Drunken Dwarf left ${DRUNKEN_DWARF_COINS} coins.`);
        }
        break;
      case "evil_chicken":
        eventStatements.push(addXpStatement(env, player.discord_id, "defence", EVIL_CHICKEN_DEFENCE));
        gains.defence = (gains.defence ?? 0) + EVIL_CHICKEN_DEFENCE;
        line = `🐔 The Evil Chicken! You fended it off: +${EVIL_CHICKEN_DEFENCE} Defence.`;
        publicBits.push(`🐔 The Evil Chicken went for ${escapeMarkdown(player.username)}.`);
        break;
      case "sandwich_lady":
        eventStatements.push(addXpStatement(env, player.discord_id, "hitpoints", SANDWICH_LADY_HP));
        gains.hitpoints = (gains.hitpoints ?? 0) + SANDWICH_LADY_HP;
        line = `🥪 The Sandwich Lady: +${SANDWICH_LADY_HP} Hitpoints.`;
        publicBits.push(`🥪 The Sandwich Lady fed ${escapeMarkdown(player.username)}.`);
        break;
      case "beekeeper":
        await setBeekeeper(env, now + BEEKEEPER_HOURS * 60 * 60 * 1000);
        line = `🐝 The Beekeeper: the camp's workers are +25% for a day.`;
        publicBits.push(`🐝 The Beekeeper is in camp — workers +25% for 24h.`);
        break;
      case "quiz_master": {
        const index = pickQuiz(rng);
        quiz = { index };
        line = `❓ The Quiz Master: "${QUIZ_BANK[index].q}" — answer below.`;
        publicBits.push(`❓ The Quiz Master cornered ${escapeMarkdown(player.username)}.`);
        break;
      }
      case "freaky_forester": {
        const repaired = await repairWorst(env, FORESTER_REPAIR);
        if (repaired) {
          line = `🌲 The Freaky Forester patched up the ${repaired} by ${FORESTER_REPAIR}.`;
          publicBits.push(`🌲 The Freaky Forester patched up the ${repaired}.`);
        } else {
          eventStatements.push(
            ...creditStatements(env, "logs", FORESTER_REPAIR * 2, "crate", day, player.discord_id, now)
          );
          addLoot("logs", FORESTER_REPAIR * 2);
          line = `🌲 The Freaky Forester found nothing to repair and left ${FORESTER_REPAIR * 2} logs.`;
          publicBits.push(`🌲 The Freaky Forester left ${FORESTER_REPAIR * 2} logs.`);
        }
        break;
      }
      case "drill_demon": {
        // Sergeant Damien's exercises pay into a random combat skill, a
        // genie lamp's worth: ten times the skill's level.
        const combatSkills: SkillKey[] = ["attack", "strength", "defence"];
        const skill = combatSkills[Math.floor(rng() * combatSkills.length)];
        const xp = DRILL_DEMON_LAMP_PER_LEVEL * levelsAfter[skill];
        eventStatements.push(addXpStatement(env, player.discord_id, skill, xp));
        gains[skill] = (gains[skill] ?? 0) + xp;
        line = `😈 The Drill Demon put you through your paces: +${xp} ${SKILL_LABEL[skill]}.`;
        publicBits.push(`😈 The Drill Demon drilled ${escapeMarkdown(player.username)}.`);
        break;
      }
      case "prison_pete":
        eventStatements.push(
          grantLampStatement(env, player.discord_id, 0, "genie", day),
          grantLampStatement(env, player.discord_id, 0, "genie", day)
        );
        gotLamp = true;
        addLoot("lamp", 2);
        line = `🔒 Prison Pete! Two lamps.`;
        publicBits.push(`🔒 PRISON PETE. ${escapeMarkdown(player.username)} has two lamps.`);
        break;
    }
    eventStatements.push(
      logEventStatement(env, player.discord_id, day, checkinId, `event:${event}`, quiz ? { quiz: quiz.index, answered: false } : null, now)
    );
    await env.DB.batch(eventStatements);
    // A lamp or a quiz needs the player's hand; the rest is news.
    if (event === "genie" || event === "prison_pete" || event === "quiz_master") keep(line);
    else receipt.push(line);
    if (await logEntry(env, player.discord_id, `event:${event}`, day)) {
      publicBits.push(logLine(label, await logCountFor(env, player.discord_id)));
    }
    if (effect === "halloween" && event === "genie") {
      await logEntry(env, player.discord_id, "holiday:scythe", day);
    }
  }

  // ── Holiday drops for a check-in in the week ───────────────────
  const holidayEntry: Record<string, string> = {
    sandwich: "holiday:baguette",
    dwarf: "holiday:party_hat",
    valentines: "holiday:heart",
    easter: "holiday:egg",
    beekeeper: "holiday:bee_hat",
  };
  if (effect && holidayEntry[effect]) {
    if (await logEntry(env, player.discord_id, holidayEntry[effect], day)) {
      publicBits.push(logLine(holidayEntry[effect].split(":")[1].replace("_", " "), await logCountFor(env, player.discord_id)));
    }
  }

  // ── Clue scroll ────────────────────────────────────────────────
  // The tier is the task monster's: a hill giant drops easy clues, a black
  // demon hard ones, as in the game.
  const todays = await checkinsOn(env, day);
  const week1 = campaignWeek(day, env.CAMPAIGN_START);
  const act = actForWeek(week1, ACT_WEEKS, ACTS.length);
  let held = await openClue(env, player.discord_id);
  let hasClue = false;
  if (held) {
    const remaining = remainingSteps(held);
    if (remaining.length > 0) {
      const yesterday = await getCheckinFor(env, player.discord_id, addDays(day, -1));
      const ctx: StepContext = {
        checkin: { ...(await getCheckinFor(env, player.discord_id, day))! },
        othersToday: todays.filter((c) => c.player_id !== player.discord_id).length,
        checkedInYesterday: Boolean(yesterday),
        delivered,
        completedTask: progress.completed,
        sackWasFull: sacks.hadFullSack,
        raidWeek: Boolean(await activeRaidFor(env, player.discord_id)),
      };
      const hit = remaining.find((step) => checkinSatisfies(step.key, ctx));
      if (hit) {
        const done = [...doneIndices(held), hit.index];
        if (done.length >= clueSteps(held).length) {
          const opened = await finishClue(env, player, held.id, held.tier, day, now);
          receipt.push(opened.receipt);
          publicBits.push(opened.publicBit);
          if (opened.newEntry) publicBits.push(opened.newEntry);
          for (const item of opened.loot) addLoot(item.k, item.c);
          gotLamp = true;
          held = null;
        } else {
          await markStep(env, held.id, done);
          held = { ...held, done: JSON.stringify(done) };
          receipt.push(`📜 Clue step done: ${stepLabel(hit.key)}. ${clueLine(held)}`);
        }
      } else {
        receipt.push(`📜 ${clueLine(held)}`);
      }
    }
    hasClue = held !== null;
  } else {
    const clueRng = seededRng(`${player.discord_id}:${day}:clue`);
    if (rollClue(clueRng, false)) {
      const tier = clueTierForMonster(monster.combat);
      const steps = drawSteps(clueRng, tier, act);
      if (await insertClue(env, player.discord_id, tier.key, steps, day)) {
        hasClue = true;
        addLoot(`clue_${tier.key}`);
        receipt.push(`📜 A ${monsterName.replace(/s$/, "")} dropped a clue scroll (${tier.name.toLowerCase()})! ${steps.length} steps — first: ${stepLabelFor(steps[0])}. /clue shows the trail.`);
        publicBits.push(`📜 ${escapeMarkdown(player.username)} found a ${tier.name.toLowerCase()} clue scroll.`);
      }
    }
  }

  // ── Verifier Slayer, paid on your own check-in ─────────────────
  const unpaid = (await unpaidVerifications(env, player.discord_id)).filter(
    (v) => now - v.created_at <= VERIFIER_PAY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const paying = unpaid.slice(0, VERIFIER_DAILY_CAP);
  const expired = (await unpaidVerifications(env, player.discord_id)).filter(
    (v) => now - v.created_at > VERIFIER_PAY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  if (expired.length > 0) {
    await markVerificationsPaid(env, player.discord_id, expired.map((v) => v.checkin_id), 0);
  }
  if (paying.length > 0) {
    const slayer = VERIFIER_SLAYER * paying.length;
    await env.DB.batch([
      addXpStatement(env, player.discord_id, "slayer", slayer),
      logEventStatement(env, player.discord_id, day, checkinId, "verifier_paid", { count: paying.length }, now),
    ]);
    await markVerificationsPaid(env, player.discord_id, paying.map((v) => v.checkin_id), checkinId);
    gains.slayer = (gains.slayer ?? 0) + slayer;
    keep(`Slayer +${slayer} for ${paying.length === 1 ? "a check-in you verified" : `${paying.length} check-ins you verified`}.`);
  }

  // ── Pending claims (rewards credited while you were away) ──────
  const claims = await openClaims(env, player.discord_id);
  if (claims.length > 0) {
    const claimStatements: D1PreparedStatement[] = [];
    for (const claim of claims) {
      const payload = claim.payload ? JSON.parse(claim.payload) : {};
      if (claim.kind === "lamp") {
        claimStatements.push(grantLampStatement(env, player.discord_id, Number(payload.xp ?? 0), payload.source ?? "claim", day));
        gotLamp = true;
        addLoot("lamp");
        keep(`🎁 Waiting for you: a ${Number(payload.xp ?? 0).toLocaleString("en-US")} XP antique lamp (${payload.reason ?? payload.source ?? "reward"}).`);
      } else if (claim.kind === "ring") {
        if (rings < ringCap) rings++;
        addLoot("ring");
        keep(`🎁 Waiting for you: a Ring of Life (${payload.reason ?? "reward"}).`);
      } else if (claim.kind === "title") {
        await updatePlayer(env, player.discord_id, { title: String(payload.title) });
        keep(`🎁 Title unlocked: ${payload.title}.`);
      }
    }
    if (claimStatements.length > 0) await env.DB.batch(claimStatements);
    await markClaimed(env, claims.map((c) => c.id), now);
  }

  // ── Recovery quest ─────────────────────────────────────────────
  let recovery: Partial<Player> = {};
  const silentDays = player.last_active_day ? daysBetween(player.last_active_day, day) : 0;
  if (player.recovery_started_day && daysBetween(player.recovery_started_day, day) < RECOVERY_WINDOW_DAYS) {
    const count = player.recovery_count + 1;
    if (count >= RECOVERY_CHECKINS) {
      await env.DB.batch([
        grantLampStatement(env, player.discord_id, RECOVERY_LAMP_XP, "quest", day),
        logEventStatement(env, player.discord_id, day, checkinId, "recovery_complete", null, now),
      ]);
      gotLamp = true;
      addLoot("lamp");
      if (rings < ringCap) rings++;
      addLoot("ring");
      recovery = { recovery_started_day: null, recovery_count: 0, form_weeks: Math.max(1, player.form_weeks) };
      keep(`🏃 The Restless Lifter, complete: a ${RECOVERY_LAMP_XP.toLocaleString("en-US")} XP antique lamp, a Ring, and your form counter is back.`);
      publicBits.push(`🏃 ${escapeMarkdown(player.username)} finished The Restless Lifter.`);
    } else {
      recovery = { recovery_count: count };
      keep(`🏃 The Restless Lifter: ${count}/${RECOVERY_CHECKINS}.`);
    }
  } else if (player.recovery_started_day) {
    recovery = { recovery_started_day: null, recovery_count: 0 };
  }
  if (Object.keys(recovery).length === 0 && silentDays >= RECOVERY_SILENT_DAYS) {
    recovery = { recovery_started_day: day, recovery_count: 1 };
    keep(`🏃 Welcome back. The Restless Lifter is open: ${RECOVERY_CHECKINS} check-ins in ${RECOVERY_WINDOW_DAYS} days for a lamp and a Ring.`);
    publicBits.push(`🏃 ${escapeMarkdown(player.username)} is back after ${silentDays} days.`);
  }

  // ── Milestones ─────────────────────────────────────────────────
  const total = await countCheckinsTotal(env, player.discord_id);
  for (const mark of [1, 50, 100, 200]) {
    if (total === mark) {
      if (await logEntry(env, player.discord_id, `milestone:checkin_${mark}`, day)) {
        publicBits.push(logLine(mark === 1 ? "First check-in" : `${mark}th check-in`, await logCountFor(env, player.discord_id)));
      }
    }
  }
  if (total === 100) await logEntry(env, player.discord_id, "pet:beaver", day);

  // ── Raid ───────────────────────────────────────────────────────
  const hit = await raidHit(env, player, session.damage, day, now, relics);
  if (hit) {
    receipt.push(hit.line);
    publicBits.push(hit.line);
    await env.DB.batch([
      logEventStatement(env, player.discord_id, day, checkinId, "raid_hit", { damage: hit.damage }, now),
    ]);
  }

  // ── Bingo ──────────────────────────────────────────────────────
  const bingo = bingoLines(await evaluateBingo(env, { ...player, last_active_day: day }, day, act, now), player.username);
  if (bingo.receipt) receipt.push(bingo.receipt);
  if (bingo.publicBit) publicBits.push(bingo.publicBit);

  await updatePlayer(env, player.discord_id, {
    last_active_day: day,
    event_dry_streak: event ? 0 : player.event_dry_streak + 1,
    rings,
    ...recovery,
  });
  // The answer to the morning question, for the roll call.
  try {
    await recordAnswer(env, player.discord_id, day, "yes", now);
  } catch {
    // The check-in row is the record that matters.
  }

  // ── Form line ──────────────────────────────────────────────────
  const recent = await countCheckinsBetween(env, player.discord_id, addDays(day, -6), day);
  receipt.push(`Form: ${recent} of the last 7 days · Form weeks ${player.form_weeks} · Rings ${rings}`);

  const publicLine =
    `**${escapeMarkdown(player.username)}** checked in (${ordinalWord(ordinal)} this week, ${weightWord(weight)}).` +
    (publicBits.length > 0 ? `\n${publicBits.join("\n")}` : "");

  const xpGained = Object.entries(gains)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([skill, amount]) => ({ k: skill, x: amount ?? 0 }));

  return {
    ok: true,
    checkinId: checkinId!,
    ordinal,
    weight,
    receipt,
    essentials,
    publicLine,
    levelUps,
    tierUp,
    quiz,
    hasLamp: gotLamp,
    hasClue,
    loot,
    xpGained,
    task: taskShort(progress.completed ? progress.next : progress.task),
    session: `${session.kills} ${monsterName} · max hit ${session.maxHit} · ${Math.round(session.hitChance * 100)}% to hit · ${session.weapon.name}`,
  };
}

function checinIdIsNull(id: number | null): id is null {
  return id === null;
}

export function haulLine(haul: Partial<Record<ResourceKey, number>>): string {
  return Object.entries(haul)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([r, n]) => `${n} ${r}`)
    .join(", ");
}

function logLine(name: string, count: number): string {
  return `📗 New log entry: ${name} (${count}/90).`;
}

async function logCountFor(env: Env, playerId: string): Promise<number> {
  return (await logEntries(env, playerId)).length;
}

function stepLabelFor(step: string): string {
  return stepLabel(step);
}

/** Opens the casket at the end of a trail. Shared with the verify path. */
export async function finishClue(
  env: Env,
  player: Player,
  clueId: number,
  tierKey: string,
  day: string,
  now: number
): Promise<{ receipt: string; publicBit: string; newEntry: string | null; loot: { k: string; c: number }[]; xp: number }> {
  const tier = clueTier(tierKey);
  const owned = new Set(await logEntries(env, player.discord_id));
  const rng = seededRng(`${player.discord_id}:${clueId}:casket`);
  const loot = openCasket(rng, tier, owned);
  await completeClue(env, clueId, day, loot);
  await env.DB.batch([
    grantLampStatement(env, player.discord_id, loot.xp, "casket", day),
    ...creditStatements(env, "coins", loot.coins, "casket", day, player.discord_id, now),
    logEventStatement(env, player.discord_id, day, null, "casket", { tier: tier.key, ...loot }, now),
  ]);
  let newEntry: string | null = null;
  if (loot.unique) {
    if (await logEntry(env, player.discord_id, `clue:${loot.unique}`, day)) {
      newEntry = logLine(loot.unique, await logCountFor(env, player.discord_id));
    }
    if (loot.unique === "Bloodhound") await logEntry(env, player.discord_id, "pet:bloodhound", day);
  }
  const first = await logEntry(env, player.discord_id, "milestone:first_casket", day);
  const receipt =
    `📜 Casket opened (${tier.name.toLowerCase()}): a ${loot.xp.toLocaleString("en-US")} XP antique lamp, ${loot.coins} coins to the camp` +
    (loot.unique ? `, and **${loot.unique}**.` : loot.duplicate ? ", and a duplicate turned into extra XP." : ".");
  const publicBit =
    `📜 ${escapeMarkdown(player.username)} opened a ${tier.name.toLowerCase()} casket` +
    (loot.unique ? ` — **${loot.unique}**!` : ".") +
    (first ? ` ${logLine("First casket", await logCountFor(env, player.discord_id))}` : "");
  const items: { k: string; c: number }[] = [{ k: "casket", c: 1 }, { k: "lamp", c: 1 }, { k: "coins", c: loot.coins }];
  if (loot.unique) items.push({ k: itemKey(loot.unique), c: 1 });
  return { receipt, publicBit, newEntry, loot: items, xp: loot.xp };
}

/** The buttons under a receipt: the play hub. */
export async function hubButtons(env: Env, player: Player, day: string): Promise<Button[]> {
  const lamps = await (await import("./db")).unspentLamps(env, player.discord_id);
  const clue = await openClue(env, player.discord_id);
  const buttons: Button[] = [];
  if (lamps.length > 0) buttons.push({ label: `Lamp (${lamps.length})`, custom_id: "lamp", style: 3, emoji: "🧞" });
  if (clue) buttons.push({ label: "Clue", custom_id: "clue", emoji: "📜" });
  buttons.push({ label: "Sheet", custom_id: `sheet:${day}`, emoji: "📋" });
  buttons.push({ label: "Town", custom_id: "town", emoji: "🏘️" });
  buttons.push({ label: "Log", custom_id: "log", emoji: "📗" });
  buttons.push({ label: "Task", custom_id: "task", emoji: "🗡️" });
  buttons.push({ label: "Bingo", custom_id: "bingo", emoji: "🎯" });
  buttons.push({ label: "Shop", custom_id: "shop", emoji: "🛒" });
  buttons.push({ label: "Votes", custom_id: "vote", emoji: "🗳️" });
  return buttons;
}

/** A quiz's three answers as buttons. */
export function quizButtons(checkinId: number, index: number) {
  const question = QUIZ_BANK[index];
  return buttonRow(
    question.o.map((option, i) => ({
      label: option.slice(0, 80),
      custom_id: `quiz:${checkinId}:${index}:${i}`,
      style: 1,
    }))
  );
}

/** A player's lamp value if this is a genie lamp, else the fixed amount. */
export function lampValue(lamp: { xp: number; source: string }, skillLevel: number): number {
  return lamp.source === "genie" ? lampXp(skillLevel) : lamp.xp;
}

export type { Checkin };
