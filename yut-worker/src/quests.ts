import quests from "../config/quests.json" with { type: "json" };
import { questFight, type Gear, type Levels } from "./combat.ts";
import {
  CHAMPIONS_GUILD_QP,
  QUEST_CALENDAR,
  QUEST_FIGHT_ATTACKS,
  QUEST_LAMP,
  QUEST_PROOF_SUPPLIES,
  type CombatStyle,
} from "./config.ts";
import { activeRoster, checkinsInWeek, grantClaimStatement, logEntry, retryWrite } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { campaignWeek, gameWeek } from "./schedule.ts";
import type { Env, Player } from "./types.ts";
import type { CheckinInput } from "./checkins.ts";

/**
 * The Quest of the Week. Fifty-one Old School quests on a fixed calendar
 * (config.ts), easiest first — the free-to-play novice quests through Act 1,
 * Champions' Guild at 32 quest points like the game, Dragon Slayer at the
 * Elvarg beat — with every number from the wiki (config/quests.json): quest
 * points, the enemies to defeat with their real stats, how many items the
 * quest asks for.
 *
 * It is cooperative and it costs nothing extra: ordinary check-ins progress
 * it. The week's first check-in starts the quest. Every check-in brings one
 * supply (a note or a photo brings two) until the party has gathered
 * `min(items, ceil(roster / 2))`. Then every check-in is a mini-fight —
 * QUEST_FIGHT_ATTACKS swings with the player's usual kit against the current
 * enemy, in the quest's order, each enemy's pool being its hitpoints × how
 * many the quest makes you kill. The check-in that empties the last pool completes the quest:
 * the quest points go to the group, and everyone who checked in that week
 * gets an antique lamp sized by the quest's difficulty. Unfinished on Monday
 * is just unfinished.
 */

export interface QuestEnemy {
  name: string;
  count: number;
  hitpoints: number;
  combat: number;
  att: number;
  str: number;
  def: number;
  attbns: number;
  strbns: number;
  dslash: number;
  dstab: number;
  dcrush: number;
  maxHit: number;
  speed: number;
  style: string;
}

export interface QuestData {
  difficulty: string;
  length: string;
  qp: number;
  description: string;
  start: string;
  items: number;
  skills: Record<string, number>;
  enemies: QuestEnemy[];
}

export interface QuestRow {
  week: string;
  campaign_week: number;
  quest: string;
  roster: number;
  started_at: number | null;
  supplies: number;
  supplies_needed: number;
  damage: number;
  hp_total: number;
  status: "open" | "done" | "unfinished";
  completed_at: number | null;
  completed_day: string | null;
  qp: number;
  message_id: string | null;
}

const DATA = (quests as unknown as { quests: Record<string, QuestData> }).quests;

// ── Pure ───────────────────────────────────────────────────────────

/** The quest on the calendar for a campaign week, with its data. */
export function questFor(campaignWk: number): { name: string; data: QuestData } | null {
  const entry = QUEST_CALENDAR.find((q) => q.week === campaignWk);
  const data = entry ? DATA[entry.quest] : undefined;
  return entry && data ? { name: entry.quest, data } : null;
}

/**
 * Each enemy's pool, in the quest's order: its hitpoints × how many the
 * quest makes you kill. The party kills the quest's enemies once, together —
 * a bigger party just gets there sooner. (The roster still sizes the gather.)
 */
export function enemyPools(data: QuestData, _roster: number): number[] {
  return data.enemies.map((enemy) => Math.max(1, Math.round(enemy.hitpoints * enemy.count)));
}

/** The supplies a party of this size must gather: the quest's items, capped at half the roster. */
export function suppliesNeeded(data: QuestData, roster: number): number {
  return Math.min(data.items, Math.ceil(Math.max(1, roster) / 2));
}

/** Which enemy the party is on after `damage` in total, and how much of it is left. */
export function currentEnemy(
  data: QuestData,
  roster: number,
  damage: number
): { enemy: QuestEnemy; index: number; left: number; pool: number } | null {
  let carried = damage;
  const pools = enemyPools(data, roster);
  for (let i = 0; i < pools.length; i++) {
    if (carried < pools[i]) return { enemy: data.enemies[i], index: i, left: pools[i] - carried, pool: pools[i] };
    carried -= pools[i];
  }
  return null;
}

/** The lamp a finished quest pays each participant. */
export function questLampXp(data: QuestData): number {
  return QUEST_LAMP[data.difficulty] ?? QUEST_LAMP.Novice;
}

/** "quest:cooks_assistant" — the collection log key. */
export function questKey(name: string): string {
  return `quest:${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

// ── Storage ────────────────────────────────────────────────────────

export async function questRow(env: Env, week: string): Promise<QuestRow | null> {
  try {
    return await env.DB.prepare("SELECT * FROM quests WHERE week = ?").bind(week).first<QuestRow>();
  } catch {
    return null;
  }
}

/** Every quest point the group has earned. */
export async function totalQp(env: Env): Promise<number> {
  try {
    const row = await env.DB.prepare("SELECT COALESCE(SUM(qp), 0) AS qp FROM quests WHERE status = 'done'").first<{ qp: number }>();
    return row?.qp ?? 0;
  } catch {
    return 0;
  }
}

async function openQuest(env: Env, week: string, campaignWk: number, name: string, data: QuestData, roster: number, now: number): Promise<QuestRow> {
  const pools = enemyPools(data, roster);
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO quests (week, campaign_week, quest, roster, started_at, supplies, supplies_needed, damage, hp_total, status, qp) " +
        "VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 'open', ?) ON CONFLICT (week) DO NOTHING"
    )
      .bind(week, campaignWk, name, roster, now, suppliesNeeded(data, roster), pools.reduce((a, b) => a + b, 0), data.qp)
      .run()
  );
  return (await questRow(env, week)) as QuestRow;
}

// ── The check-in's contribution ────────────────────────────────────

export interface QuestHit {
  /** Lines for the receipt and the thread, in order. */
  lines: string[];
  /** Lines for the channel: only a completion. */
  channelLines: string[];
  completed: boolean;
}

const NONE: QuestHit = { lines: [], channelLines: [], completed: false };

export async function questHit(
  env: Env,
  player: Player,
  levels: Levels,
  style: CombatStyle,
  gear: Gear,
  checkinId: number,
  input: CheckinInput,
  day: string,
  now: number
): Promise<QuestHit> {
  const week = gameWeek(day);
  const campaignWk = campaignWeek(day, env.CAMPAIGN_START);
  const quest = questFor(campaignWk);
  if (!quest) return NONE;
  const { name, data } = quest;

  let row = await questRow(env, week);
  const lines: string[] = [];
  if (!row) {
    const roster = (await activeRoster(env, day)).length || 1;
    row = await openQuest(env, week, campaignWk, name, data, roster, now);
    lines.push(`📜 **${name}** begins (${data.difficulty}, ${data.qp} QP). ${data.description}`);
  }
  if (row.status !== "open") return NONE;

  // One contribution per check-in, however many times it is recomputed.
  const claimed = await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO quest_hits (checkin_id, week, player_id, supplies, damage, day) VALUES (?, ?, ?, 0, 0, ?) ON CONFLICT (checkin_id) DO NOTHING"
    )
      .bind(checkinId, week, player.discord_id, day)
      .run()
  );
  if (claimed.meta.changes === 0) return NONE;

  // Gather: a supply per check-in, two with proof, until the party has enough.
  let supplies = 0;
  let gathered = row.supplies >= row.supplies_needed;
  if (!gathered) {
    supplies = input.attachment || input.note ? QUEST_PROOF_SUPPLIES : 1;
    const after = Math.min(row.supplies_needed, row.supplies + supplies);
    gathered = after >= row.supplies_needed;
    lines.push(
      `🎒 Quest: supplies ${after}/${row.supplies_needed}` +
        (supplies > 1 ? " (a note or a photo carries two)" : "") +
        (gathered ? " — the party is ready." : ".")
    );
  }

  // Fight: once gathered, this check-in is a mini-fight against the current enemy.
  let damage = 0;
  if (gathered && row.hp_total > 0 && row.damage < row.hp_total) {
    const current = currentEnemy(data, row.roster, row.damage);
    if (current) {
      damage = Math.max(1, questFight(levels, style, gear, current.enemy, QUEST_FIGHT_ATTACKS));
      const dealt = Math.min(damage, row.hp_total - row.damage);
      const after = currentEnemy(data, row.roster, row.damage + dealt);
      const downed = !after || after.index > current.index;
      lines.push(
        `⚔️ Quest: ${dealt.toLocaleString("en-US")} to ${current.enemy.name}` +
          (downed
            ? ` — down!${after ? ` ${after.enemy.name} next (${after.left.toLocaleString("en-US")} HP).` : ""}`
            : ` (${(current.left - dealt).toLocaleString("en-US")} left).`)
      );
    }
  }

  await retryWrite(() =>
    env.DB.batch([
      env.DB
        .prepare(
          "UPDATE quests SET supplies = MIN(supplies_needed, supplies + ?), damage = MIN(hp_total, damage + ?) WHERE week = ? AND status = 'open'"
        )
        .bind(supplies, damage, week),
      env.DB.prepare("UPDATE quest_hits SET supplies = ?, damage = ? WHERE checkin_id = ?").bind(supplies, damage, checkinId),
    ])
  );

  // Done? The first check-in to see both bars full closes it — exactly once.
  const fresh = (await questRow(env, week)) ?? row;
  if (fresh.supplies < fresh.supplies_needed || fresh.damage < fresh.hp_total) {
    return { lines, channelLines: [], completed: false };
  }
  const closed = await retryWrite(() =>
    env.DB.prepare("UPDATE quests SET status = 'done', completed_at = ?, completed_day = ? WHERE week = ? AND status = 'open'")
      .bind(now, day, week)
      .run()
  );
  if (closed.meta.changes === 0) return { lines, channelLines: [], completed: false };

  const xp = questLampXp(data);
  const participants = [...new Set((await checkinsInWeek(env, week)).map((c) => c.player_id))];
  await env.DB.batch(
    participants.map((id) => grantClaimStatement(env, id, "lamp", { xp, source: "quest", reason: name }, day))
  );
  for (const id of participants) await logEntry(env, id, questKey(name), day);
  const total = await totalQp(env);
  lines.push(`🏆 **${name}** complete! ${data.qp} quest point${data.qp === 1 ? "" : "s"}; ${total} in all.`);
  return {
    lines,
    channelLines: [
      `🏆 **Quest complete: ${name}** — ${data.qp} quest point${data.qp === 1 ? "" : "s"}, ${total} in all. ` +
        `A ${xp.toLocaleString("en-US")} XP antique lamp waits on the next check-in for everyone who checked in this week.`,
    ],
    completed: true,
  };
}

// ── The week boundary and the morning post ─────────────────────────

/** Monday: settle the closed week's quest. Returns the summary line, or null when the week had no quest. */
export async function closeQuestWeek(env: Env, closedWeek: string): Promise<string | null> {
  const campaignWk = campaignWeek(closedWeek, env.CAMPAIGN_START);
  const quest = questFor(campaignWk);
  if (!quest) return null;
  const row = await questRow(env, closedWeek);
  if (!row) return `📜 ${quest.name}: nobody set out. It stays in the book.`;
  if (row.status === "done") return `📜 ${quest.name} complete — ${row.qp} QP; the group has ${await totalQp(env)}.`;
  if (row.status === "open") {
    await retryWrite(() => env.DB.prepare("UPDATE quests SET status = 'unfinished' WHERE week = ? AND status = 'open'").bind(closedWeek).run());
  }
  const current = currentEnemy(quest.data, row.roster, row.damage);
  const where =
    row.supplies < row.supplies_needed
      ? `supplies ${row.supplies}/${row.supplies_needed}`
      : current
        ? `${current.enemy.name} had ${current.left.toLocaleString("en-US")} HP left`
        : "so close";
  return `📜 ${quest.name} unfinished — ${where}. No penalty; next week is a new quest.`;
}

/** Monday's introduction. */
export function questIntro(env: Env, day: string): string | null {
  const quest = questFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!quest) return null;
  const { name, data } = quest;
  const fight = data.enemies.length > 0 ? ` Enemies: ${data.enemies.map((e) => `${e.count > 1 ? `${e.count} ` : ""}${e.name}`).join(", ")}.` : "";
  return (
    `📜 **Quest of the week: ${name}** (${data.difficulty}, ${data.qp} QP). ${data.description} ${data.start}` +
    (data.items > 0 ? ` Supplies to gather: ${data.items}.` : "") +
    fight +
    " The first check-in starts it; every check-in after helps."
  );
}

/** The Champions' Guild line for the week-18 beat: earned at 32 quest points, as in the game. */
export async function championsGuildLine(env: Env): Promise<string> {
  const qp = await totalQp(env);
  return qp >= CHAMPIONS_GUILD_QP
    ? `🏰 The Champions' Guild opens its doors: ${qp} quest points.`
    : `🏰 The Champions' Guild wants ${CHAMPIONS_GUILD_QP} quest points; the roster has ${qp}.`;
}

/** The short progress line for the morning post on other days. */
export async function questLine(env: Env, day: string): Promise<string | null> {
  const quest = questFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!quest) return null;
  const row = await questRow(env, gameWeek(day));
  return `Quest: ${quest.name} — ${await progressText(quest.data, row)}`;
}

async function progressText(data: QuestData, row: QuestRow | null): Promise<string> {
  if (!row) return "not started; the first check-in starts it.";
  if (row.status === "done") return "complete.";
  if (row.status === "unfinished") return "unfinished.";
  if (row.supplies < row.supplies_needed) return `supplies ${row.supplies}/${row.supplies_needed}.`;
  const current = currentEnemy(data, row.roster, row.damage);
  if (!current) return "complete.";
  return `${current.enemy.name} ${hpBar(current.left, current.pool)}${current.index + 1 < data.enemies.length ? ` (${data.enemies.length - current.index - 1} more to go)` : ""}.`;
}

function hpBar(left: number, pool: number): string {
  const filled = Math.round((Math.max(0, left) / Math.max(1, pool)) * 12);
  return `${"█".repeat(filled)}${"░".repeat(12 - filled)} ${left.toLocaleString("en-US")}/${pool.toLocaleString("en-US")}`;
}

// ── /quest ─────────────────────────────────────────────────────────

export async function questView(env: Env, day: string): Promise<{ content: string }> {
  const quest = questFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!quest) return { content: "No quest this week. The quest log is `/quest log`." };
  const { name, data } = quest;
  const row = await questRow(env, gameWeek(day));
  const lines = [`📜 **${name}** — ${data.difficulty}, ${data.qp} QP. ${data.description}`, data.start];
  if (data.items > 0) lines.push(`🎒 Supplies: ${row ? `${row.supplies}/${row.supplies_needed}` : `${data.items} listed; the party needs min(that, half the roster)`}. A note or a photo on a check-in carries two.`);
  if (data.enemies.length > 0) {
    const pools = enemyPools(data, row?.roster ?? Math.max(1, (await activeRoster(env, day)).length));
    let carried = row?.damage ?? 0;
    for (let i = 0; i < data.enemies.length; i++) {
      const enemy = data.enemies[i];
      const left = Math.max(0, pools[i] - Math.max(0, carried));
      carried -= pools[i];
      lines.push(`⚔️ ${enemy.count > 1 ? `${enemy.count}× ` : ""}${enemy.name} (level ${enemy.combat}): ${left === 0 ? "down" : hpBar(left, pools[i])}`);
    }
  }
  lines.push(`Status: ${await progressText(data, row)}`);
  if (row) {
    const hits = await env.DB.prepare("SELECT player_id, COUNT(*) AS n FROM quest_hits WHERE week = ? GROUP BY player_id").bind(row.week).all<{ player_id: string; n: number }>();
    if (hits.results.length > 0) lines.push(`Party: ${hits.results.length} adventurer${hits.results.length === 1 ? "" : "s"}, ${hits.results.reduce((s, h) => s + h.n, 0)} check-ins.`);
  }
  lines.push(`Reward: ${questLampXp(data).toLocaleString("en-US")} XP antique lamp for everyone who checked in this week. Quest points so far: ${await totalQp(env)}.`);
  return { content: lines.join("\n") };
}

export async function questLog(env: Env): Promise<{ content: string }> {
  const { results } = await env.DB.prepare("SELECT campaign_week, quest, status, qp FROM quests ORDER BY campaign_week").all<{ campaign_week: number; quest: string; status: string; qp: number }>();
  const total = await totalQp(env);
  const lines = [`📖 **Quest log** — ${total} quest point${total === 1 ? "" : "s"}${total >= CHAMPIONS_GUILD_QP ? " · Champions' Guild member" : ` · Champions' Guild at ${CHAMPIONS_GUILD_QP}`}`];
  for (const row of results) {
    lines.push(`Week ${row.campaign_week}: ${escapeMarkdown(row.quest)} — ${row.status === "done" ? `✅ ${row.qp} QP` : row.status === "unfinished" ? "unfinished" : "in progress"}`);
  }
  if (results.length === 0) lines.push("Nothing yet. The first check-in of a week starts its quest.");
  return { content: lines.join("\n").slice(0, 1900) };
}
