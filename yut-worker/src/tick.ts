import { refreshBoard } from "./board.ts";
import {
  activeRoster,
  checkinsOn,
  expireBounties,
  forgetStaleEphemeralReplies,
  getPlayers,
  getState,
  setState,
  updatePlayer,
} from "./db.ts";
import { composeDigest, composeLastCall, digestPayload, trimmedDigestPayload } from "./digest.ts";
import { allowedMentions, editMessage, logToDiscord, postMessage } from "./discord.ts";
import { playersRoleId } from "./roles.ts";
import {
  addDays,
  dailySlotDue,
  gameDay,
  gameWeek,
  hourSlotKey,
  parseHour,
  parseWeekday,
  weeklySlotDue,
} from "./schedule.ts";
import { quietDayDecay } from "./town.ts";
import type { Env } from "./types.ts";
import { autoRubLamps, resolveWeekFor } from "./weekly.ts";

/**
 * One tick does everything that is due. Each phase is its own try/catch so
 * one failing cannot take the rest down, and each is guarded by a slot key
 * in `state` so a retried tick is a no-op.
 */
export async function runTick(env: Env, now: number, force: { daily?: boolean; post?: boolean; lastCall?: boolean } = {}): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};
  const rollover = parseHour(env.ROLLOVER_HOUR_UTC) ?? 9;
  const today = gameDay(now, rollover);
  const yesterday = addDays(today, -1);

  // ── The daily resolution ───────────────────────────────────────
  // gameDay() only changes at the rollover hour, so "last_daily_day is not
  // today" is exactly "the day has turned and nobody has resolved it yet" —
  // a missed tick catches up on the next one.
  try {
    const last = await getState(env, "last_daily_day");
    if (force.daily || last !== today) {
      await setState(env, "last_daily_day", today);
      const daily: Record<string, unknown> = {};

      // Expeditions come home.
      for (const player of await getPlayers(env)) {
        if (player.status === "paused" && player.paused_until && player.paused_until <= today) {
          await updatePlayer(env, player.discord_id, { status: "active", paused_until: null });
        }
      }

      daily.bountiesExpired = await expireBounties(env, today);
      daily.lampsAutoRubbed = await autoRubLamps(env, today, now);

      const roster = await activeRoster(env, yesterday);
      const yesterdays = await checkinsOn(env, yesterday);
      daily.quietDay = await quietDayDecay(env, yesterday, yesterdays.length, roster.length, now);

      // Monday: the week that just closed.
      if (gameWeek(today) === today) {
        const closed = addDays(today, -7);
        daily.week = await resolveWeekFor(env, closed, today, now);
      }

      // Yesterday's post loses its buttons.
      const previous = await getState(env, `daily_post:${yesterday}`);
      if (previous) {
        try {
          const parts = JSON.parse((await getState(env, `daily_parts:${yesterday}`)) ?? "null");
          if (parts) await editMessage(env, previous, trimmedDigestPayload(parts));
        } catch (error) {
          await logToDiscord(env, `Trim failed: ${String(error)}`);
        }
      }

      report.daily = daily;
    }
  } catch (error) {
    await logToDiscord(env, `Daily resolution failed: ${String(error)}`);
    report.dailyError = String(error);
  }

  // ── The morning post ───────────────────────────────────────────
  try {
    const postHour = parseHour(env.DAILY_POST_HOUR_UTC);
    const last = await getState(env, "last_daily_post_day");
    const hour = new Date(now).getUTCHours();
    // Past the hour rather than on it, so a tick that arrived late still posts.
    const due = postHour !== null && hour >= postHour && hour >= rollover;
    if (force.post || (due && last !== today)) {
      await setState(env, "last_daily_post_day", today);
      const parts = await composeDigest(env, today);
      const roster = await activeRoster(env, today);
      const roleId = await playersRoleId(env);
      const message = await postMessage(env, digestPayload(parts, today, roleId, roster.length));
      await setState(env, `daily_post:${today}`, message.id);
      await setState(env, `daily_parts:${today}`, JSON.stringify(parts));
      report.posted = message.id;
      await refreshBoard(env, today);
    }
  } catch (error) {
    await logToDiscord(env, `Morning post failed: ${String(error)}`);
    report.postError = String(error);
  }

  // ── Sunday last call ───────────────────────────────────────────
  try {
    const weekday = parseWeekday(env.LAST_CALL_WEEKDAY);
    const hour = parseHour(env.LAST_CALL_HOUR_UTC);
    const slot = hourSlotKey(now);
    if (force.lastCall || (weeklySlotDue(now, weekday, hour) && (await getState(env, "last_last_call")) !== slot)) {
      await setState(env, "last_last_call", slot);
      const roster = await activeRoster(env, today);
      if (roster.length > 0) {
        const roleId = await playersRoleId(env);
        const content = await composeLastCall(env, today);
        await postMessage(env, {
          content: roleId ? `<@&${roleId}> ${content}` : content,
          allowed_mentions: allowedMentions(roleId),
        });
        report.lastCall = true;
      }
    }
  } catch (error) {
    await logToDiscord(env, `Last call failed: ${String(error)}`);
  }

  // Housekeeping, last because nothing waits on it.
  try {
    await forgetStaleEphemeralReplies(env, now - 15 * 60 * 1000);
  } catch (error) {
    await logToDiscord(env, `Ephemeral sweep failed: ${String(error)}`);
  }

  return report;
}

export { dailySlotDue };
