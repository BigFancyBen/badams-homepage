import {
  SLAYER_HELMET_COST,
  SLAYER_SKIP_COST,
  SLAYER_STREAK_BONUS,
  SLAYER_XP_BOUGHT,
  SLAYER_XP_COST,
} from "./config.ts";
import { addXpStatement, logEntry, logEventStatement, updatePlayer } from "./db.ts";
import { seededRng } from "./events.ts";
import {
  drawAssignment,
  masterByKey,
  masterFor,
  pluralName,
  type Levels,
  type Monster,
  type SlayerMaster,
  MONSTERS,
} from "./combat.ts";
import type { Env, Player } from "./types.ts";

/**
 * Slayer tasks, the way Old School does them. Every player always holds a
 * task from the highest master their combat level (and, for Duradel, Slayer
 * level) allows: "kill N of these", drawn from that master's real
 * assignment table. A check-in is a training session against the task
 * monster (combat.ts); every kill on task pays the monster's Slayer
 * experience, and finishing the task pays the master's points and hands the
 * next task over on the spot. Tasks do not expire. Skipping one costs 30
 * points, as at the Slayer Rewards shop.
 */

export interface SlayerTask {
  id: number;
  player_id: string;
  master: string;
  /** The monster, as a key into config/osrs.json. */
  monster: string;
  kills_needed: number;
  kills: number;
  assigned_day: string;
  due_day: string;
  status: "active" | "done" | "expired" | "skipped";
  points_awarded: number;
}

export { masterFor, masterByKey };

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

/** "hill giants", for a task. */
export function taskName(task: SlayerTask): string {
  const master = masterByKey(task.master);
  const assignment = master.tasks.find((t) => t.monster === task.monster);
  const name = assignment ? pluralName(assignment) : `${task.monster}s`;
  return name.toLowerCase();
}

export function taskMonster(task: SlayerTask): Monster {
  return MONSTERS[task.monster] ?? Object.values(MONSTERS)[0];
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
 * Hands out a task from the master the player's levels earn. Seeded on the
 * player and the day so a retry assigns the same one.
 */
export async function assignTask(
  env: Env,
  player: Player,
  levels: Levels,
  combat: number,
  day: string,
  salt = ""
): Promise<SlayerTask> {
  const master = masterFor(combat, levels.slayer);
  const rng = seededRng(`${player.discord_id}:${day}:task${salt}`);
  const drawn = drawAssignment(rng, master, levels.slayer, combat);
  const inserted = await env.DB.prepare(
    "INSERT INTO slayer_tasks (player_id, master, monster, kills_needed, kills, assigned_day, due_day, status) VALUES (?, ?, ?, ?, 0, ?, ?, 'active')"
  )
    .bind(player.discord_id, master.key, drawn.monster.name, drawn.amount, day, day)
    .run();
  return {
    id: Number(inserted.meta.last_row_id),
    player_id: player.discord_id,
    master: master.key,
    monster: drawn.monster.name,
    kills_needed: drawn.amount,
    kills: 0,
    assigned_day: day,
    due_day: day,
    status: "active",
    points_awarded: 0,
  };
}

/** The task a check-in fights: the open one, or a fresh assignment. */
export async function ensureTask(
  env: Env,
  player: Player,
  levels: Levels,
  combat: number,
  day: string
): Promise<{ task: SlayerTask; assignedNow: boolean }> {
  const task = await activeTask(env, player.discord_id);
  if (task) return { task, assignedNow: false };
  return { task: await assignTask(env, player, levels, combat, day), assignedNow: true };
}

export interface TaskProgress {
  task: SlayerTask;
  master: SlayerMaster;
  /** Kills that counted towards the task this session. */
  onTask: number;
  completed: boolean;
  /** Slayer XP paid for the on-task kills. */
  xp: number;
  points: number;
  next: SlayerTask | null;
  line: string;
  publicBit: string | null;
}

/**
 * Credits a session's kills to the task. Every on-task kill pays the
 * monster's Slayer XP; completing pays points and assigns the next task.
 */
export async function progressTask(
  env: Env,
  player: Player,
  task: SlayerTask,
  assignedNow: boolean,
  kills: number,
  levels: Levels,
  combat: number,
  day: string,
  checkinId: number,
  now: number
): Promise<TaskProgress> {
  const master = masterByKey(task.master);
  const monster = taskMonster(task);
  const onTask = Math.max(0, Math.min(kills, task.kills_needed - task.kills));
  const done = task.kills + onTask;
  const completed = done >= task.kills_needed;
  const xp = onTask * (monster.slayerXp ?? monster.hitpoints);
  const name = taskName(task);
  const statements: D1PreparedStatement[] = [];
  if (xp > 0) statements.push(addXpStatement(env, player.discord_id, "slayer", xp));

  if (!completed) {
    statements.push(env.DB.prepare("UPDATE slayer_tasks SET kills = ? WHERE id = ?").bind(done, task.id));
    await env.DB.batch(statements);
    const line =
      (assignedNow ? `${master.name} assigns you ${task.kills_needed} ${name}. ` : "") +
      `Task: ${capitalise(name)} ${done}/${task.kills_needed} for ${master.name}.`;
    return { task: { ...task, kills: done }, master, onTask, completed: false, xp, points: 0, next: null, line, publicBit: null };
  }

  // Done: points, streak, the next task.
  const taskNumber = player.slayer_streak + 1;
  const points = master.points * streakMultiplier(taskNumber);
  statements.push(
    env.DB.prepare("UPDATE slayer_tasks SET kills = ?, status = 'done', points_awarded = ? WHERE id = ?").bind(done, points, task.id),
    logEventStatement(env, player.discord_id, day, checkinId, "task_done", { task: task.id, master: master.key, monster: task.monster, xp, points }, now)
  );
  await env.DB.batch(statements);
  await updatePlayer(env, player.discord_id, {
    slayer_points: player.slayer_points + points,
    slayer_streak: taskNumber,
    tasks_done: player.tasks_done + 1,
  });
  if (taskNumber === 10) await logEntry(env, player.discord_id, "slayer:task_10", day);
  if (taskNumber === 50) await logEntry(env, player.discord_id, "slayer:task_50", day);
  await logEntry(env, player.discord_id, "milestone:first_task", day);

  const updatedLevels = { ...levels };
  const next = await assignTask(env, player, updatedLevels, combat, day, ":next");
  const nextMaster = masterByKey(next.master);
  const streakNote = streakMultiplier(taskNumber) > 1 ? ` (${taskNumber}th task in a row: ${streakMultiplier(taskNumber)}× points)` : "";
  const line =
    `Task done: ${task.kills_needed} ${name} for ${master.name}. +${points} Slayer points${streakNote}. ` +
    `${nextMaster.name} assigns you ${next.kills_needed} ${taskName(next)}.`;
  const publicBit = `🗡️ Task done: ${task.kills_needed} ${name} for ${master.name}.`;
  return { task: { ...task, kills: done, status: "done" }, master, onTask, completed: true, xp, points, next, line, publicBit };
}

/** Short form for cards: "Hill giants 23/40 for Mazchna". */
export function taskShort(task: SlayerTask | null): string | null {
  if (!task) return null;
  return `Task: ${capitalise(taskName(task))} ${task.kills}/${task.kills_needed} for ${masterByKey(task.master).name}`;
}

export interface TaskView {
  content: string;
  components?: unknown[];
}

export async function taskView(env: Env, player: Player): Promise<TaskView> {
  const task = await activeTask(env, player.discord_id);
  const lines = [
    `🗡️ ${task ? taskShort(task) : "No Slayer task yet. Your first check-in gets one."}`,
    `Slayer points: ${player.slayer_points}. Tasks in a row: ${player.slayer_streak}. Tasks done: ${player.tasks_done}.`,
    "Every check-in is a training session against your task. Each kill on task pays the monster's Slayer XP; finishing pays the master's points. The 10th, 50th and 100th task in a row pay 5×, 15× and 25×.",
    `Spend points: skip the task (${SLAYER_SKIP_COST}), ${SLAYER_XP_BOUGHT.toLocaleString("en-US")} Slayer XP (${SLAYER_XP_COST}), the Slayer helmet (${SLAYER_HELMET_COST}) for +16⅔% accuracy and damage on task and the title Slayer Master.`,
  ];
  return {
    content: lines.join("\n"),
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: `Skip task (${SLAYER_SKIP_COST})`, custom_id: "task:skip", disabled: !task || player.slayer_points < SLAYER_SKIP_COST },
          { type: 2, style: 1, label: `Slayer XP (${SLAYER_XP_COST})`, custom_id: "task:xp", disabled: player.slayer_points < SLAYER_XP_COST },
          { type: 2, style: 1, label: `Slayer helmet (${SLAYER_HELMET_COST})`, custom_id: "task:helmet", disabled: player.slayer_points < SLAYER_HELMET_COST },
        ],
      },
    ],
  };
}

export function hasSlayerHelmet(player: Player): boolean {
  try {
    return JSON.parse(player.cosmetics || "{}").helm === "Slayer helmet";
  } catch {
    return false;
  }
}

export async function spendPoints(
  env: Env,
  player: Player,
  what: string,
  levels: Levels,
  combat: number,
  day: string,
  now: number
): Promise<string> {
  if (what === "skip") {
    const task = await activeTask(env, player.discord_id);
    if (!task) return "No task to skip.";
    if (player.slayer_points < SLAYER_SKIP_COST) return `Skipping costs ${SLAYER_SKIP_COST} points; you have ${player.slayer_points}.`;
    await env.DB.prepare("UPDATE slayer_tasks SET status = 'skipped' WHERE id = ?").bind(task.id).run();
    await updatePlayer(env, player.discord_id, { slayer_points: player.slayer_points - SLAYER_SKIP_COST });
    const next = await assignTask(env, player, levels, combat, day, ":skip" + now);
    return `Skipped. ${masterByKey(next.master).name} assigns you ${next.kills_needed} ${taskName(next)}. (−${SLAYER_SKIP_COST} points.)`;
  }
  if (what === "xp") {
    if (player.slayer_points < SLAYER_XP_COST) return `${SLAYER_XP_BOUGHT.toLocaleString("en-US")} Slayer XP costs ${SLAYER_XP_COST} points; you have ${player.slayer_points}.`;
    await env.DB.batch([
      addXpStatement(env, player.discord_id, "slayer", SLAYER_XP_BOUGHT),
      logEventStatement(env, player.discord_id, day, null, "slayer_xp_bought", { xp: SLAYER_XP_BOUGHT }, now),
    ]);
    await updatePlayer(env, player.discord_id, { slayer_points: player.slayer_points - SLAYER_XP_COST });
    return `+${SLAYER_XP_BOUGHT.toLocaleString("en-US")} Slayer. (−${SLAYER_XP_COST} points.)`;
  }
  if (what === "helmet") {
    if (hasSlayerHelmet(player)) return "You already have the Slayer helmet.";
    if (player.slayer_points < SLAYER_HELMET_COST) return `The Slayer helmet costs ${SLAYER_HELMET_COST} points; you have ${player.slayer_points}.`;
    let cosmetics: Record<string, string> = {};
    try {
      cosmetics = JSON.parse(player.cosmetics || "{}");
    } catch {
      cosmetics = {};
    }
    cosmetics.helm = "Slayer helmet";
    await updatePlayer(env, player.discord_id, {
      slayer_points: player.slayer_points - SLAYER_HELMET_COST,
      title: "Slayer Master",
      cosmetics: JSON.stringify(cosmetics),
    });
    await logEntry(env, player.discord_id, "title:slayer_master", day);
    return `The Slayer helmet is yours: +16⅔% accuracy and damage on task, and the title Slayer Master. (−${SLAYER_HELMET_COST} points.)`;
  }
  return "That is not something Slayer points buy.";
}
