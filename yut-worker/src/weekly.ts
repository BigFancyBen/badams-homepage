import {
  ACTS,
  ACT_WEEKS,
  FOUNDING_FORM_WEEKS,
  FOUNDING_LAMP_XP,
  GRADUATION_WEEK,
  LAMP_AUTO_RUB_DAYS,
  SKILL_LABEL,
  type SkillKey,
} from "./config.ts";
import {
  activeRoster,
  addXp,
  checkinsInWeek,
  expireOpenClues,
  getAllSkills,
  getPlayingPlayers,
  getPlayers,
  grantClaimStatement,
  logEntry,
  logEventStatement,
  setState,
  spendLamp,
  staleLamps,
  updatePlayer,
  upsertWeekLog,
  weekLogFor,
} from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { seededRng } from "./events.ts";
import { actForWeek, addDays, campaignWeek, daysBetween, gameWeek, weekdayOf } from "./schedule.ts";
import { renderCard, standingsImageUrl } from "./sheet.ts";
import { resolveWeek } from "./streaks.ts";
import type { Env, Player } from "./types.ts";
import { lampXp, levelForXp, tierForDefence } from "./xp.ts";
import { combatLevel, levelsOf } from "./combat.ts";
import { founding } from "./town.ts";
import { drawRelics, getRelics } from "./relics.ts";
import { openBuildVote, openRelicVote } from "./votes.ts";
import { proposeRaid } from "./raids.ts";
import { TREASURE_SEEKER_MULTIPLIER } from "./config.ts";

/**
 * The Monday boundary. Everything that resolves once a week lives here, and
 * it runs inside the daily tick on the first game day of the new week, for
 * the week that just closed.
 */

export interface WeekSummary {
  week: string;
  inForm: number;
  held: number;
  broke: number;
  ringsEarned: string[];
  graduated: string[];
  standingsUrl: string | null;
  founding: string | null;
}

export async function resolveWeekFor(
  env: Env,
  closedWeek: string,
  today: string,
  now: number
): Promise<WeekSummary> {
  const summary: WeekSummary = {
    week: closedWeek,
    inForm: 0,
    held: 0,
    broke: 0,
    ringsEarned: [],
    graduated: [],
    standingsUrl: null,
    founding: null,
  };

  const players = await getPlayingPlayers(env);
  const paused = (await getPlayers(env)).filter((p) => p.status === "paused");
  const weekCheckins = await checkinsInWeek(env, closedWeek);
  const unitsBy = new Map<string, number>();
  const countBy = new Map<string, number>();
  for (const checkin of weekCheckins) {
    unitsBy.set(checkin.player_id, (unitsBy.get(checkin.player_id) ?? 0) + checkin.weight);
    countBy.set(checkin.player_id, (countBy.get(checkin.player_id) ?? 0) + 1);
  }

  const campaignWk = campaignWeek(closedWeek, env.CAMPAIGN_START);
  const relics = await getRelics(env);

  for (const player of [...players, ...paused]) {
    // A player who joined after the week closed has nothing to resolve.
    if (player.joined_day > addDays(closedWeek, 6)) continue;
    const playerWeek = Math.floor(daysBetween(gameWeek(player.joined_day), closedWeek) / 7) + 1;
    const result = resolveWeek({
      checkins: countBy.get(player.discord_id) ?? 0,
      formWeeks: player.form_weeks,
      rings: player.rings,
      ringProgress: player.ring_progress,
      playerWeek,
      graduated: Boolean(player.graduated_at),
      paused: player.status === "paused",
      ringEveryWeek: relics.has("last_recall"),
      ringCapBonus: relics.has("last_recall") ? 1 : 0,
    });

    const fields: Partial<Player> = {
      form_weeks: result.formWeeks,
      best_form_weeks: Math.max(player.best_form_weeks, result.formWeeks),
      rings: result.rings,
      ring_progress: result.ringProgress,
    };

    if (result.outcome === "form") summary.inForm++;
    if (result.outcome === "held") summary.held++;
    if (result.outcome === "broke") summary.broke++;
    if (result.ringEarned) summary.ringsEarned.push(player.username);

    if (result.prayerXp > 0) await addXp(env, player.discord_id, "prayer", result.prayerXp);

    // Graduation: week 13 of a player's own campaign.
    if (!player.graduated_at && playerWeek >= GRADUATION_WEEK) {
      fields.graduated_at = now;
      summary.graduated.push(player.username);
      await logEntry(env, player.discord_id, "title:graduate", closedWeek);
    }
    if (result.formWeeks >= 12) {
      if (await logEntry(env, player.discord_id, "title:unbreakable", closedWeek)) {
        await env.DB.batch([
          grantClaimStatement(env, player.discord_id, "title", { title: "the Unbreakable" }, today),
        ]);
      }
    }
    if (result.formWeeks >= 3) await logEntry(env, player.discord_id, "milestone:three_form_weeks", closedWeek);
    if (result.formWeeks >= 6) await logEntry(env, player.discord_id, "milestone:six_form_weeks", closedWeek);

    // Holiday rings: Easter's Sunday check-in, Christmas's two form weeks.
    const sunday = addDays(closedWeek, 6);
    if (campaignWk === 28 && weekCheckins.some((c) => c.player_id === player.discord_id && c.day === sunday)) {
      await env.DB.batch([
        grantClaimStatement(env, player.discord_id, "ring", { reason: "the Easter egg" }, today),
      ]);
    }
    if (campaignWk === 16 && result.outcome === "form") {
      const log = await weekLogFor(env, player.discord_id);
      const lastWeek = log.find((row) => row.week === addDays(closedWeek, -7));
      if (lastWeek?.outcome === "form") {
        await env.DB.batch([
          grantClaimStatement(env, player.discord_id, "ring", { reason: "in form both holiday weeks" }, today),
        ]);
      }
    }

    await updatePlayer(env, player.discord_id, fields);
    await upsertWeekLog(env, {
      player_id: player.discord_id,
      week: closedWeek,
      checkins: countBy.get(player.discord_id) ?? 0,
      outcome: result.outcome,
      form_weeks_after: result.formWeeks,
      prayer_xp: result.prayerXp,
    });
    await env.DB.batch([
      logEventStatement(env, player.discord_id, today, null, `week:${result.outcome}`, { week: closedWeek, ...result }, now),
    ]);
  }

  // ── Standings ──────────────────────────────────────────────────
  const skills = await getAllSkills(env);
  const roster = await activeRoster(env, today);
  const newWeek = gameWeek(today);
  const newCampaignWeek = campaignWeek(newWeek, env.CAMPAIGN_START);

  // ── Standings card ─────────────────────────────────────────────
  const rows = roster
    .map((p) => {
      const levels = levelsOf(skills.get(p.discord_id) ?? {}, levelForXp);
      const cb = combatLevel(levels);
      const hpXp = cb * 1e9 + (skills.get(p.discord_id)?.hitpoints ?? 0);
      return { n: p.username, hp: cb, hpXp, tier: tierForDefence(levels.defence).key, fw: p.form_weeks, u: Math.round((unitsBy.get(p.discord_id) ?? 0) * 10) / 10 };
    })
    .sort((a, b) => b.hpXp - a.hpXp);
  // Re-read form weeks after the updates above.
  const fresh = new Map((await getPlayers(env)).map((p) => [p.username, p.form_weeks]));
  for (const row of rows) row.fw = fresh.get(row.n) ?? row.fw;
  if (rows.length > 0) {
    const stamp = Number(closedWeek.replace(/-/g, ""));
    summary.standingsUrl = await renderCard(env, `cards/standings-${closedWeek}.png`, (attempt) =>
      standingsImageUrl(
        env,
        stamp,
        `Week ${campaignWk} standings`,
        rows.map(({ n, hp, tier, fw, u }) => ({ n, hp, tier, fw, u })),
        attempt
      )
    );
  }

  // ── Founding, at the end of an act ─────────────────────────────
  if (campaignWk > 0 && campaignWk % ACT_WEEKS === 0) {
    const act = actForWeek(campaignWk, ACT_WEEKS, ACTS.length);
    const actStart = campaignWk - ACT_WEEKS + 1;
    let lamps = 0;
    for (const player of players) {
      const log = await weekLogFor(env, player.discord_id);
      const formWeeks = log.filter((row) => {
        const wk = campaignWeek(row.week, env.CAMPAIGN_START);
        return wk >= actStart && wk <= campaignWk && row.outcome === "form";
      }).length;
      if (formWeeks >= FOUNDING_FORM_WEEKS) {
        lamps++;
        await env.DB.batch([
          grantClaimStatement(
            env,
            player.discord_id,
            "lamp",
            { xp: FOUNDING_LAMP_XP, source: "founding", reason: `Founding ${act}` },
            today
          ),
        ]);
      }
    }
    const expired = await expireOpenClues(env, today);
    const combatLevels = new Map(roster.map((p) => [p.discord_id, combatLevel(levelsOf(skills.get(p.discord_id) ?? {}, levelForXp))]));
    const town = await founding(env, roster, combatLevels, today, now);
    await env.DB.prepare("UPDATE town_resources SET amount = CASE WHEN resource = 'coins' THEN 500 ELSE 200 END").run();
    summary.founding =
      `Founding ${act}: Town Hall ${town.level}, ${town.workersGranted} Bronze worker${town.workersGranted === 1 ? "" : "s"} handed out, ` +
      `${lamps} Founding lamp${lamps === 1 ? "" : "s"} waiting on the next check-in` +
      (expired > 0 ? `; ${expired} unfinished clue${expired === 1 ? "" : "s"} lost to the Founding` : "") +
      ".";
  }

  // ── The new week's group business ──────────────────────────────
  const newAct = actForWeek(newCampaignWeek, ACT_WEEKS, ACTS.length);
  try {
    if (newAct >= 2) await openBuildVote(env, today, now, newAct);
  } catch {
    // No vote this week; the next Monday tries again.
  }
  if (newCampaignWeek === 27 || newCampaignWeek === 40) {
    const picks = drawRelics(seededRng(`relics:${newCampaignWeek}`), relics);
    try {
      await openRelicVote(env, today, now, picks);
    } catch {
      // Same.
    }
  }
  if (newCampaignWeek === 27 || newCampaignWeek === 50) {
    try {
      await proposeRaid(env, today, now, newAct, "the campaign");
    } catch {
      // Same.
    }
  }

  await setState(env, `week_summary:${closedWeek}`, JSON.stringify(summary));
  return summary;
}

/** Lamps nobody rubbed inside fourteen days go into Hitpoints. */
export async function autoRubLamps(env: Env, today: string, now: number): Promise<number> {
  const skills = await getAllSkills(env);
  let rubbed = 0;
  for (const lamp of await staleLamps(env, addDays(today, -LAMP_AUTO_RUB_DAYS))) {
    const hp = levelForXp(skills.get(lamp.player_id)?.hitpoints ?? 0);
    const relicsHeld = await getRelics(env);
    const xp = Math.floor((lamp.source === "genie" ? lampXp(hp) : lamp.xp) * (relicsHeld.has("treasure_seeker") ? TREASURE_SEEKER_MULTIPLIER : 1));
    if (await spendLamp(env, lamp.id, "hitpoints", now)) {
      await addXp(env, lamp.player_id, "hitpoints", xp);
      await env.DB.batch([
        logEventStatement(env, lamp.player_id, today, null, "lamp_auto", { lamp: lamp.id, xp }, now),
      ]);
      rubbed++;
    }
  }
  return rubbed;
}

export function summaryLines(summary: WeekSummary): string[] {
  const lines: string[] = [];
  lines.push(
    `Week resolved: ${summary.inForm} in form` +
      (summary.held > 0 ? `, ${summary.held} held by a Ring` : "") +
      (summary.broke > 0 ? `, ${summary.broke} broke` : "") +
      "."
  );
  if (summary.ringsEarned.length > 0) lines.push(`Rings earned: ${summary.ringsEarned.map(escapeMarkdown).join(", ")}.`);
  if (summary.graduated.length > 0) lines.push(`🎓 Graduated: ${summary.graduated.map(escapeMarkdown).join(", ")}.`);
  if (summary.founding) lines.push(`🏛️ ${summary.founding}`);
  return lines;
}

export function skillName(skill: string): string {
  return SKILL_LABEL[skill as SkillKey] ?? skill;
}

export function isMonday(day: string): boolean {
  return weekdayOf(day) === 1;
}
