import {
  SLAYER_LAMP_COST,
  SLAYER_LAMP_XP,
  SLAYER_MASTERS,
  SLAYER_SKIP_COST,
  SLAYER_STREAK_BONUS,
  SLAYER_TITLE_COST,
  type SlayerMaster,
} from "./config.ts";
import { addDays } from "./schedule.ts";
import { addXpStatement, grantLampStatement, logEntry, logEventStatement, updatePlayer } from "./db.ts";
import { seededRng } from "./events.ts";
import type { Env, Player } from "./types.ts";

/**
 * Slayer tasks, the way Old School does them. Every player always holds a
 * task from a Slayer master: "slay N <monster>". Every check-in is a kill.
 * Finish inside the deadline and the master pays Slayer XP and Slayer
 * points, and hands you the next task on the spot; miss it and the task
 * expires, the streak resets, and the next check-in gets a fresh one. The
 * master is picked by Hitpoints level, so the tasks grow with the player.
 */

export interface SlayerTask {
  id: number;
  player_id: string;
  master: string;
  monster: string;
  kills_needed: number;
  kills: number;
  assigned_day: string;
  due_day: string;
  status: "active" | "done" | "expired" | "skipped";
  points_awarded: number;
}

export function masterFor(hpLevel: number): SlayerMaster {
  let master = SLAYER_MASTERS[0];
  for (const candidate of SLAYER_MASTERS) if (hpLevel >= candidate.hp) master = candidate;
  return master;
}

export function masterDef(key: string): SlayerMaster {
  return SLAYER_MASTERS.find((m) => m.key === key) ?? SLAYER_MASTERS[0];
}

/** The points multiplier for the Nth task in a row: 10th ×5, 50th ×15, 100th ×25. */
export function streakMultiplier(taskNumber: number): number {
  let multiplier = 1;
  for (const bonus of SLAYER_STREAK_BONUS) {
    if (taskNumber > 0 && taskNumber % bonus.every === 0) multiplier = Math.max(multiplier, bonus.multiplier);
  }
  return multiplier;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function activeTask(env: Env, playerId: string): Promise<SlayerTask | null> {
  try {
    return await env.DB.prepare(
      "SELECT * FROM slayer_tasks WHERE player_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
    )
      .bind(playerId)
      .first<SlayerTask>();
  } catch {
    return null;
  }
}

/**
 * Hands out a task. Seeded on the player and the day so a retry assigns the
 * same one. `kills` may be pre-credited when the assigning check-in counts.
 */
export async function assignTask(
  env: Env,
  player: Player,
  hpLevel: number,
  day: string,
  salt = ""
): Promise<SlayerTask> {
  const master = masterFor(hpLevel);
  const rng = seededRng(`${player.discord_id}:${day}:task${salt}`);
  const monster = master.monsters[Math.floor(rng() * master.monsters.length)];
  const [low, high] = master.kills;
  const needed = low + Math.floor(rng() * (high - low + 1));
  const due = addDays(day, master.days);
  const inserted = await env.DB.prepare(
    "INSERT INTO slayer_tasks (player_id, master, monster, kills_needed, kills, assigned_day, due_day, status) VALUES (?, ?, ?, ?, 0, ?, ?, 'active')"
  )
    .bind(player.discord_id, master.key, monster, needed, day, due)
    .run();
  return {
    id: Number(inserted.meta.last_row_id),
    player_id: player.discord_id,
    master: master.key,
    monster,
    kills_needed: needed,
    kills: 0,
    assigned_day: day,
    due_day: due,
    status: "active",
    points_awarded: 0,
  };
}

export interface TaskProgress {
  task: SlayerTask;
  completed: boolean;
  xp: number;
  points: number;
  next: SlayerTask | null;
  line: string;
  publicBit: string | null;
}

/**
 * One kill, on a check-in. Assigns a task first if the player has none.
 * Completing pays out and assigns the next task immediately.
 */
export async function progressTask(
  env: Env,
  player: Player,
  hpLevel: number,
  day: string,
  checkinId: number,
  now: number,
  extraKills = 0
): Promise<TaskProgress> {
  let task = await activeTask(env, player.discord_id);
  let assignedNow = false;
  if (!task) {
    task = await assignTask(env, player, hpLevel, day);
    assignedNow = true;
  }
  const master = masterDef(task.master);
  const kills = Math.min(task.kills_needed, task.kills + 1 + extraKills);
  const completed = kills >= task.kills_needed;

  if (!completed) {
    await env.DB.prepare("UPDATE slayer_tasks SET kills = ? WHERE id = ?").bind(kills, task.id).run();
    const line =
      (assignedNow ? `${master.name} assigns you: ${task.kills_needed} ${task.monster}, due ${task.due_day}. ` : "") +
      `Slayer task: ${capitalise(task.monster)} ${kills}/${task.kills_needed} for ${master.name}, due ${task.due_day}.`;
    return { task: { ...task, kills }, completed: false, xp: 0, points: 0, next: null, line, publicBit: null };
  }

  // Done: XP, points, streak, the next task.
  const taskNumber = player.slayer_streak + 1;
  const points = master.points * streakMultiplier(taskNumber);
  const xp = master.xpPerKill * task.kills_needed;
  await env.DB.batch([
    env.DB.prepare("UPDATE slayer_tasks SET kills = ?, status = 'done', points_awarded = ? WHERE id = ?").bind(kills, points, task.id),
    addXpStatement(env, player.discord_id, "slayer", xp),
    logEventStatement(env, player.discord_id, day, checkinId, "task_done", { task: task.id, master: master.key, monster: task.monster, xp, points }, now),
  ]);
  await updatePlayer(env, player.discord_id, {
    slayer_points: player.slayer_points + points,
    slayer_streak: taskNumber,
    tasks_done: player.tasks_done + 1,
  });
  if (taskNumber === 10) await logEntry(env, player.discord_id, "slayer:task_10", day);
  if (taskNumber === 50) await logEntry(env, player.discord_id, "slayer:task_50", day);
  await logEntry(env, player.discord_id, "milestone:first_task", day);

  const next = await assignTask(env, player, hpLevel, day, ":next");
  const nextMaster = masterDef(next.master);
  const streakNote = streakMultiplier(taskNumber) > 1 ? ` (${taskNumber}th task in a row — ${streakMultiplier(taskNumber)}× points)` : "";
  const line =
    `Slayer task done: ${task.kills_needed} ${task.monster} for ${master.name}. +${xp.toLocaleString("en-US")} Slayer, +${points} Slayer points${streakNote}. ` +
    `${nextMaster.name} assigns you: ${next.kills_needed} ${next.monster}, due ${next.due_day}.`;
  const publicBit = `🗡️ Slayer task done — ${task.kills_needed} ${task.monster} for ${master.name}.`;
  return { task: { ...task, kills, status: "done" }, completed: true, xp, points, next, line, publicBit };
}

/** Tasks past their due day expire, and the streak resets. Daily. */
export async function expireTasks(env: Env, today: string): Promise<number> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, player_id FROM slayer_tasks WHERE status = 'active' AND due_day < ?"
    )
      .bind(today)
      .all<{ id: number; player_id: string }>();
    if (results.length === 0) return 0;
    await env.DB.batch([
      ...results.map((row) => env.DB.prepare("UPDATE slayer_tasks SET status = 'expired' WHERE id = ?").bind(row.id)),
      ...results.map((row) => env.DB.prepare("UPDATE players SET slayer_streak = 0 WHERE discord_id = ?").bind(row.player_id)),
    ]);
    return results.length;
  } catch {
    return 0;
  }
}

export function taskLine(task: SlayerTask | null): string {
  if (!task) return "No Slayer task yet. Your first check-in gets one.";
  const master = masterDef(task.master);
  return `Slayer task: ${capitalise(task.monster)} ${task.kills}/${task.kills_needed} for ${master.name}, due ${task.due_day}.`;
}

/** Short form for cards: "Hill giants 3/5 for Mazchna". */
export function taskShort(task: SlayerTask | null): string | null {
  if (!task) return null;
  return `Slayer task: ${capitalise(task.monster)} ${task.kills}/${task.kills_needed} for ${masterDef(task.master).name}`;
}

export interface TaskView {
  content: string;
  components?: unknown[];
}

export async function taskView(env: Env, player: Player): Promise<TaskView> {
  const task = await activeTask(env, player.discord_id);
  const lines = [
    `🗡️ ${taskLine(task)}`,
    `Slayer points: ${player.slayer_points}. Tasks in a row: ${player.slayer_streak}. Tasks done: ${player.tasks_done}.`,
    `Every check-in is one kill. Miss the due day and the task expires and the streak resets; nothing else is lost.`,
    `Spend points: skip the task (${SLAYER_SKIP_COST}), a ${SLAYER_LAMP_XP.toLocaleString("en-US")} XP lamp (${SLAYER_LAMP_COST}), the Slayer helmet and the title Slayer Master (${SLAYER_TITLE_COST}).`,
  ];
  return {
    content: lines.join("\n"),
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: `Skip task (${SLAYER_SKIP_COST})`, custom_id: "task:skip", disabled: !task || player.slayer_points < SLAYER_SKIP_COST },
          { type: 2, style: 1, label: `Lamp (${SLAYER_LAMP_COST})`, custom_id: "task:lamp", disabled: player.slayer_points < SLAYER_LAMP_COST },
          { type: 2, style: 1, label: `Slayer helmet (${SLAYER_TITLE_COST})`, custom_id: "task:helmet", disabled: player.slayer_points < SLAYER_TITLE_COST },
        ],
      },
    ],
  };
}

export async function spendPoints(
  env: Env,
  player: Player,
  what: string,
  hpLevel: number,
  day: string,
  now: number
): Promise<string> {
  if (what === "skip") {
    const task = await activeTask(env, player.discord_id);
    if (!task) return "No task to skip.";
    if (player.slayer_points < SLAYER_SKIP_COST) return `Skipping costs ${SLAYER_SKIP_COST} points; you have ${player.slayer_points}.`;
    await env.DB.prepare("UPDATE slayer_tasks SET status = 'skipped' WHERE id = ?").bind(task.id).run();
    await updatePlayer(env, player.discord_id, { slayer_points: player.slayer_points - SLAYER_SKIP_COST });
    const next = await assignTask(env, { ...player, slayer_points: player.slayer_points - SLAYER_SKIP_COST }, hpLevel, day, ":skip" + now);
    return `Skipped. ${masterDef(next.master).name} assigns you: ${next.kills_needed} ${next.monster}, due ${next.due_day}. (−${SLAYER_SKIP_COST} points.)`;
  }
  if (what === "lamp") {
    if (player.slayer_points < SLAYER_LAMP_COST) return `A lamp costs ${SLAYER_LAMP_COST} points; you have ${player.slayer_points}.`;
    await env.DB.batch([grantLampStatement(env, player.discord_id, SLAYER_LAMP_XP, "slayer", day)]);
    await updatePlayer(env, player.discord_id, { slayer_points: player.slayer_points - SLAYER_LAMP_COST });
    return `A ${SLAYER_LAMP_XP.toLocaleString("en-US")} XP lamp, banked. Rub it from the hub. (−${SLAYER_LAMP_COST} points.)`;
  }
  if (what === "helmet") {
    if (player.slayer_points < SLAYER_TITLE_COST) return `The Slayer helmet costs ${SLAYER_TITLE_COST} points; you have ${player.slayer_points}.`;
    let cosmetics: Record<string, string> = {};
    try {
      cosmetics = JSON.parse(player.cosmetics || "{}");
    } catch {
      cosmetics = {};
    }
    cosmetics.helm = "Slayer helmet";
    await updatePlayer(env, player.discord_id, {
      slayer_points: player.slayer_points - SLAYER_TITLE_COST,
      title: "Slayer Master",
      cosmetics: JSON.stringify(cosmetics),
    });
    await logEntry(env, player.discord_id, "title:slayer_master", day);
    return `The Slayer helmet is yours, and the title Slayer Master. (−${SLAYER_TITLE_COST} points.)`;
  }
  return "That is not something Slayer points buy.";
}
