import { ACTS, ACT_WEEKS, LOG_TOTAL } from "./config.ts";
import { activeRoster, getAllSkills, getPlayers } from "./db.ts";
import { ACCENT, allowedMentions, escapeMarkdown } from "./discord.ts";
import { actForWeek, campaignWeek } from "./schedule.ts";
import { getBuildings, getStores, getTown, storesLine, buildingDef } from "./town.ts";
import type { Env } from "./types.ts";
import { levelForXp, tierForDefence } from "./xp.ts";

/**
 * The campaign log: one post on the first of the month, and the only
 * monthly message. Where the campaign stands, in counts.
 */
export async function composeMonthlyLog(env: Env, today: string) {
  const week = campaignWeek(today, env.CAMPAIGN_START);
  const act = actForWeek(week, ACT_WEEKS, ACTS.length);
  const roster = await activeRoster(env, today);
  const players = await getPlayers(env);
  const skills = await getAllSkills(env);
  const town = await getTown(env);
  const buildings = await getBuildings(env);

  const tiers = new Map<string, number>();
  for (const player of roster) {
    const tier = tierForDefence(levelForXp(skills.get(player.discord_id)?.defence ?? 0)).name;
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
  }
  const formLeaders = [...roster].sort((a, b) => b.form_weeks - a.form_weeks).slice(0, 3);
  const bingoLeaders = [...players].filter((p) => p.bingo_points > 0).sort((a, b) => b.bingo_points - a.bingo_points).slice(0, 3);

  const raids = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM raids GROUP BY status")
    .all<{ status: string; n: number }>()
    .then((r) => r.results)
    .catch(() => [] as { status: string; n: number }[]);
  const logs = await env.DB.prepare(
    "SELECT p.username AS username, COUNT(*) AS n FROM collection_log c JOIN players p ON p.discord_id = c.player_id GROUP BY c.player_id ORDER BY n DESC LIMIT 3"
  )
    .all<{ username: string; n: number }>()
    .then((r) => r.results)
    .catch(() => [] as { username: string; n: number }[]);

  const lines = [
    `**Campaign log — Act ${act} (${ACTS[act - 1]?.name ?? ""}), week ${week}.**`,
    `${roster.length} active. ${[...tiers.entries()].map(([tier, n]) => `${n} ${tier}`).join(", ") || "Nobody ranked yet."}`,
    formLeaders.length > 0
      ? `Form: ${formLeaders.map((p) => `${escapeMarkdown(p.username)} ${p.form_weeks}`).join(" · ")}.`
      : "",
    `${town.level > 0 ? "Town" : "Camp"}: ${storesLine(await getStores(env))}` +
      (town.level > 0
        ? ` · Town Hall ${town.level} · ${[...buildings.values()].filter((b) => b.level > 0 && b.key !== "town_hall").map((b) => `${buildingDef(b.key)?.name ?? b.key} ${b.level}`).join(", ") || "no buildings"}`
        : ""),
    raids.length > 0 ? `Raids: ${raids.map((r) => `${r.n} ${r.status}`).join(", ")}.` : "",
    bingoLeaders.length > 0 ? `Bingo: ${bingoLeaders.map((p) => `${escapeMarkdown(p.username)} ${p.bingo_points}`).join(" · ")}.` : "",
    logs.length > 0 ? `Collection log: ${logs.map((r) => `${escapeMarkdown(r.username)} ${r.n}/${LOG_TOTAL}`).join(" · ")}.` : "",
  ].filter(Boolean);

  return {
    embeds: [{ color: ACCENT, description: lines.join("\n") }],
    allowed_mentions: allowedMentions(),
  };
}
