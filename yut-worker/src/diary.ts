import { DIARY, SKILLS, type DiaryStat, type DiaryTier } from "./config.ts";
import { combatLevel, levelsOf } from "./combat.ts";
import { bankValue, countCaskets, countCheckinsTotal, getSkills, grantLampStatement, logEventStatement } from "./db.ts";
import { spoilsCounts } from "./spoils.ts";
import type { Env, Player } from "./types.ts";
import { levelForXp, totalLevel } from "./xp.ts";

/**
 * The Achievement Diary: four tiers of tasks, every one read off what the
 * player's check-ins have already produced — there is nothing to claim. A
 * tier completed pays the diary's own antique lamp (2,500 / 7,500 / 15,000 /
 * 50,000), once, at the check-in that finishes it.
 */

export type DiaryStats = Record<DiaryStat, number>;

export async function diaryStats(env: Env, player: Player): Promise<DiaryStats> {
  const skills = await getSkills(env, player.discord_id);
  const kills = await env.DB.prepare(
    "SELECT COALESCE(SUM(json_extract(session, '$.kills')), 0) AS n FROM checkins WHERE player_id = ? AND session IS NOT NULL"
  )
    .bind(player.discord_id)
    .first<{ n: number }>();
  const verified = await env.DB.prepare("SELECT COUNT(*) AS n FROM verifications WHERE verifier_id = ?")
    .bind(player.discord_id)
    .first<{ n: number }>();
  const spoils = await spoilsCounts(env, player.discord_id);
  return {
    checkins: await countCheckinsTotal(env, player.discord_id),
    kills: kills?.n ?? 0,
    tasks: player.tasks_done,
    bank: Math.floor(await bankValue(env, player.discord_id)),
    combat: combatLevel(levelsOf(skills, levelForXp)),
    total: totalLevel(skills, SKILLS),
    spoils: spoils.opened,
    containers: spoils.containers.length,
    form: Math.max(player.form_weeks, player.best_form_weeks),
    verified: verified?.n ?? 0,
    caskets: await countCaskets(env, player.discord_id),
    spent: player.gp_spent ?? 0,
  };
}

export interface TierProgress {
  tier: DiaryTier;
  done: number;
  complete: boolean;
  /** Whether the lamp has been paid. */
  paid: boolean;
  tasks: { label: string; have: number; goal: number; done: boolean }[];
}

/** Every tier against the stats — pure. */
export function diaryProgress(stats: DiaryStats, paid: Set<string>): TierProgress[] {
  return DIARY.map((tier) => {
    const tasks = tier.tasks.map((task) => {
      const have = Math.min(stats[task.stat] ?? 0, task.goal);
      return { label: task.label, have, goal: task.goal, done: have >= task.goal };
    });
    const done = tasks.filter((task) => task.done).length;
    return { tier, done, complete: done === tasks.length, paid: paid.has(tier.key), tasks };
  });
}

async function paidTiers(env: Env, playerId: string): Promise<Set<string>> {
  const { results } = await env.DB.prepare("SELECT tier FROM diary WHERE player_id = ?").bind(playerId).all<{ tier: string }>();
  return new Set(results.map((row) => row.tier));
}

export async function diaryFor(env: Env, player: Player): Promise<TierProgress[]> {
  return diaryProgress(await diaryStats(env, player), await paidTiers(env, player.discord_id));
}

/**
 * Pays any tier that is complete and unpaid, in order — a tier is only paid
 * once the ones before it are. Returns the tiers paid now and the progress.
 */
export async function evaluateDiary(
  env: Env,
  player: Player,
  day: string,
  now: number
): Promise<{ completed: DiaryTier[]; progress: TierProgress[] }> {
  const progress = await diaryFor(env, player);
  const completed: DiaryTier[] = [];
  for (const row of progress) {
    if (!row.complete) break;
    if (row.paid) continue;
    const inserted = await env.DB.prepare(
      "INSERT INTO diary (player_id, tier, completed_day) VALUES (?, ?, ?) ON CONFLICT (player_id, tier) DO NOTHING"
    )
      .bind(player.discord_id, row.tier.key, day)
      .run();
    if (inserted.meta.changes === 0) continue;
    await env.DB.batch([
      grantLampStatement(env, player.discord_id, row.tier.lamp, "diary", day),
      logEventStatement(env, player.discord_id, day, null, "diary", { tier: row.tier.key }, now),
    ]);
    row.paid = true;
    completed.push(row.tier);
  }
  return { completed, progress };
}

/** The tier being worked on: the first one not paid. */
export function currentTier(progress: TierProgress[]): TierProgress | null {
  return progress.find((row) => !row.paid) ?? null;
}

function bar(done: number, of: number): string {
  const cells = 8;
  const filled = of > 0 ? Math.round((done / of) * cells) : 0;
  return "▰".repeat(filled) + "▱".repeat(cells - filled);
}

function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  return n.toLocaleString("en-US");
}

/** `/diary` as text: every tier's bar, and the open tier's tasks. */
export function diaryText(name: string, progress: TierProgress[]): string {
  const lines = [`📘 **${name}'s Achievement Diary**`];
  const open = currentTier(progress);
  for (const row of progress) {
    lines.push(
      `${row.paid ? "✅" : row === open ? "▶️" : "🔒"} **${row.tier.name}** ${bar(row.done, row.tasks.length)} ${row.done}/${row.tasks.length}` +
        ` — ${row.tier.lamp.toLocaleString("en-US")} XP antique lamp${row.paid ? ", paid" : ""}`
    );
    if (row !== open) continue;
    for (const task of row.tasks) {
      lines.push(`　${task.done ? "✅" : "▫️"} ${task.label}${task.done ? "" : ` (${short(task.have)}/${short(task.goal)})`}`);
    }
  }
  if (!open) lines.push("Every tier complete.");
  else lines.push("Nothing to claim: a tier pays its lamp at the check-in that finishes it.");
  return lines.join("\n");
}

/** The open tier's nearest unfinished task, for the receipt: "Easy diary 4/6 (next: Kill 100 monsters, 62/100)". */
export function diaryNext(progress: TierProgress[]): string | null {
  const open = currentTier(progress);
  if (!open) return null;
  const closest = open.tasks
    .filter((task) => !task.done)
    .sort((a, b) => b.have / b.goal - a.have / a.goal)[0];
  return (
    `${open.tier.name} diary ${open.done}/${open.tasks.length}` +
    (closest ? ` (next: ${closest.label}, ${short(closest.have)}/${short(closest.goal)})` : "")
  );
}
