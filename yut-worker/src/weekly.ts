import {
  ACTS,
  ACT_WEEKS,
  DUELLIST_WINS,
  FOUNDING_FORM_WEEKS,
  FOUNDING_LAMP_XP,
  GRADUATION_WEEK,
  LAMP_AUTO_RUB_DAYS,
  RIVALRY_FROM_WEEK,
  RIVALRY_LAMP_MAX,
  RIVALRY_LAMP_MIN,
  RIVALRY_LAMP_PER_HP,
  RIVALRY_MIN_ROSTER,
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
  grantLampStatement,
  insertRivalry,
  logEntry,
  logEventStatement,
  recentRivalries,
  resolveRivalry,
  rivalriesInWeek,
  rivalryWinsInARow,
  setState,
  spendLamp,
  staleLamps,
  updatePlayer,
  upsertWeekLog,
  weekLogFor,
} from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { seededRng } from "./events.ts";
import { drawPairs, judge, weeksBefore } from "./rivalries.ts";
import { actForWeek, addDays, campaignWeek, daysBetween, gameWeek, weekdayOf } from "./schedule.ts";
import { renderCard, standingsImageUrl } from "./sheet.ts";
import { resolveWeek } from "./streaks.ts";
import type { Env, Player } from "./types.ts";
import { lampXp, levelForXp, tierForHp } from "./xp.ts";

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
  rivalryResults: string[];
  rivalryDraw: string[];
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
    rivalryResults: [],
    rivalryDraw: [],
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
      ringEveryWeek: false,
      chapelBonus: 0,
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

  // ── Rivalries: resolve last week's, draw this week's ───────────
  const skills = await getAllSkills(env);
  const byId = new Map((await getPlayers(env)).map((p) => [p.discord_id, p]));
  const name = (id: string | null) => (id ? escapeMarkdown(byId.get(id)?.username ?? id) : "the town");

  const roster = await activeRoster(env, today);
  const rosterUnits = roster.map((p) => unitsBy.get(p.discord_id) ?? 0);
  const meanUnits = rosterUnits.length ? rosterUnits.reduce((a, b) => a + b, 0) / rosterUnits.length : 0;

  for (const rivalry of await rivalriesInWeek(env, closedWeek)) {
    if (rivalry.resolved) continue;
    const unitsA = unitsBy.get(rivalry.player_a) ?? 0;
    const unitsB = rivalry.player_b
      ? (unitsBy.get(rivalry.player_b) ?? 0)
      : Math.max(2, Math.round(meanUnits * 10) / 10);
    const verdict = judge(rivalry.player_a, unitsA, rivalry.player_b, unitsB);
    await resolveRivalry(env, rivalry.id, unitsA, unitsB, verdict.winner);

    const winners =
      verdict.winner === "both"
        ? [rivalry.player_a, rivalry.player_b!]
        : verdict.winner
          ? [verdict.winner]
          : [];
    for (const winner of winners) {
      const hp = levelForXp(skills.get(winner)?.hitpoints ?? 0);
      const xp = Math.max(RIVALRY_LAMP_MIN, Math.min(RIVALRY_LAMP_MAX, RIVALRY_LAMP_PER_HP * hp));
      await env.DB.batch([grantLampStatement(env, winner, xp, "rivalry", today)]);
      const units = winner === rivalry.player_a ? unitsA : unitsB;
      summary.rivalryResults.push(
        rivalry.player_b
          ? `${name(winner)} (${units.toFixed(1)})`
          : `${name(winner)} vs the town (${unitsA.toFixed(1)} to ${unitsB.toFixed(1)})`
      );
      if ((await rivalryWinsInARow(env, winner)) >= DUELLIST_WINS) {
        if (await logEntry(env, winner, "title:duellist", today)) {
          await env.DB.batch([grantClaimStatement(env, winner, "title", { title: "Duellist" }, today)]);
        }
      }
    }
    if (winners.length === 0) summary.rivalryResults.push("one dead heat");
  }

  const newWeek = gameWeek(today);
  const newCampaignWeek = campaignWeek(newWeek, env.CAMPAIGN_START);
  if (newCampaignWeek >= RIVALRY_FROM_WEEK && roster.length >= RIVALRY_MIN_ROSTER) {
    const recent = await recentRivalries(env, weeksBefore(newWeek));
    const byeCounts = new Map<string, number>();
    for (const r of recent) if (!r.player_b) byeCounts.set(r.player_a, (byeCounts.get(r.player_a) ?? 0) + 1);
    const rng = seededRng(`rivalries:${newWeek}`);
    const { pairs, bye } = drawPairs(rng, roster.map((p) => p.discord_id), recent, byeCounts);
    for (const [a, b] of pairs) {
      await insertRivalry(env, newWeek, a, b);
      summary.rivalryDraw.push(`${name(a)} vs ${name(b)}`);
    }
    if (bye) {
      await insertRivalry(env, newWeek, bye, null);
      summary.rivalryDraw.push(`${name(bye)} vs the town`);
    }
  }

  // ── Standings card ─────────────────────────────────────────────
  const rows = roster
    .map((p) => {
      const hpXp = skills.get(p.discord_id)?.hitpoints ?? 0;
      const hp = levelForXp(hpXp);
      return { n: p.username, hp, hpXp, tier: tierForHp(hp).key, fw: p.form_weeks, u: Math.round((unitsBy.get(p.discord_id) ?? 0) * 10) / 10 };
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
    await env.DB.batch([
      env.DB.prepare("UPDATE town SET level = level + 1, name = CASE WHEN level = 0 THEN 'the town' ELSE name END WHERE id = 1"),
      env.DB.prepare("UPDATE town_resources SET amount = CASE WHEN resource = 'coins' THEN 500 ELSE 200 END"),
    ]);
    summary.founding = `Founding ${act}: ${lamps} Founding lamp${lamps === 1 ? "" : "s"} waiting on the next check-in${expired > 0 ? `; ${expired} unfinished clue${expired === 1 ? "" : "s"} lost to the Founding` : ""}.`;
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
    const xp = lamp.source === "genie" ? lampXp(hp) : lamp.xp;
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
  if (summary.rivalryResults.length > 0) lines.push(`Rivalries: ${summary.rivalryResults.join(" · ")}.`);
  if (summary.rivalryDraw.length > 0) lines.push(`This week: ${summary.rivalryDraw.join(" · ")}.`);
  if (summary.founding) lines.push(`🏛️ ${summary.founding}`);
  return lines;
}

export function skillName(skill: string): string {
  return SKILL_LABEL[skill as SkillKey] ?? skill;
}

export function isMonday(day: string): boolean {
  return weekdayOf(day) === 1;
}
