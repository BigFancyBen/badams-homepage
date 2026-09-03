import {
  BINGO_BLACKOUT_POINTS,
  BINGO_GRIDS,
  BINGO_GROUP_CRATE,
  BINGO_LINE_POINTS,
  SKILLS,
  TIERS,
  WORKER_TIERS,
  type SkillKey,
} from "./config.ts";
import {
  activeRoster,
  checkinsBetween,
  countEvents,
  getSkills,
  getState,
  logEntries,
  setState,
  updatePlayer,
} from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { addDays, gameWeek, weekdayOf } from "./schedule.ts";
import { creditStatements, getWorkers } from "./town.ts";
import type { Env, Player } from "./types.ts";
import { levelForXp, tierIndex } from "./xp.ts";

/**
 * Bingo: a 5×5 grid per act, the same tasks for everyone, every cell claimed
 * by the game from what a player has actually done. Points are personal and
 * buy things in the shop; a completed line pays extra, the whole grid pays a
 * lot, and when every active player has a line the town gets a crate.
 */

interface Stats {
  total: number;
  weekCount: number;
  weekdaysThisWeek: number;
  twoInARow: boolean;
  earliest: boolean;
  latest: boolean;
  hasNote: boolean;
  hasPrNote: boolean;
  saturday: boolean;
  sunday: boolean;
  monday: boolean;
  sameDay3: boolean;
  verifiedCheckins: number;
  verifiedVideo: boolean;
  verifiedThisWeek: number;
  verifiesGiven: number;
  lampsRubbed: number;
  quizWon: boolean;
  casket: boolean;
  hp: number;
  tierIdx: number;
  maxSkill: number;
  formWeeks: number;
  workers: number;
  workerTierIdx: number;
  deliveredThisWeek: number;
  sacks: number;
  repairs: number;
  builds: number;
  ballots: number;
  raidDamage: number;
  raidVerified: boolean;
  raidSurvivor: boolean;
  raidWin: boolean;
}

type Check = (s: Stats) => boolean;

/** Every task the grids can name. Points: 1 routine, 2 effort, 3 milestone. */
export const TASKS: Record<string, { label: string; points: number; check: Check }> = {
  first_checkin: { label: "First check-in", points: 1, check: (s) => s.total >= 1 },
  two_in_week: { label: "Two check-ins in one week", points: 2, check: (s) => s.weekCount >= 2 },
  verified_checkin: { label: "A verified check-in", points: 2, check: (s) => s.verifiedCheckins >= 1 },
  early_checkin: { label: "Check in before 8am", points: 2, check: (s) => s.earliest },
  late_checkin: { label: "Check in after 8pm", points: 1, check: (s) => s.latest },
  reach_mithril: { label: "Reach Mithril", points: 3, check: (s) => s.tierIdx >= tierIndex("mithril") },
  reach_adamant: { label: "Reach Adamant", points: 3, check: (s) => s.tierIdx >= tierIndex("adamant") },
  reach_rune: { label: "Reach Rune", points: 3, check: (s) => s.tierIdx >= tierIndex("rune") },
  reach_rune_g: { label: "Reach Rune (g)", points: 3, check: (s) => s.tierIdx >= tierIndex("rune_g") },
  reach_dragon: { label: "Reach Dragon", points: 3, check: (s) => s.tierIdx >= tierIndex("dragon") },
  hp_55: { label: "Hitpoints 55", points: 3, check: (s) => s.hp >= 55 },
  note: { label: "Check in with a note", points: 1, check: (s) => s.hasNote },
  note_pr: { label: "A note that says PR", points: 1, check: (s) => s.hasPrNote },
  saturday: { label: "A Saturday check-in", points: 1, check: (s) => s.saturday },
  sunday: { label: "A Sunday check-in", points: 2, check: (s) => s.sunday },
  monday: { label: "A Monday check-in", points: 1, check: (s) => s.monday },
  verify_3: { label: "Verify three friends", points: 2, check: (s) => s.verifiesGiven >= 3 },
  verify_video: { label: "A verified video", points: 2, check: (s) => s.verifiedVideo },
  two_verified_week: { label: "Two verified in one week", points: 2, check: (s) => s.verifiedThisWeek >= 2 },
  two_in_a_row: { label: "Two days in a row", points: 2, check: (s) => s.twoInARow },
  same_day_3: { label: "Same day as three others", points: 2, check: (s) => s.sameDay3 },
  four_weekdays: { label: "Four different weekdays in one week", points: 2, check: (s) => s.weekdaysThisWeek >= 4 },
  form_3: { label: "Three Form weeks in a row", points: 3, check: (s) => s.formWeeks >= 3 },
  form_4: { label: "Four Form weeks in a row", points: 3, check: (s) => s.formWeeks >= 4 },
  form_6: { label: "Six Form weeks in a row", points: 3, check: (s) => s.formWeeks >= 6 },
  form_8: { label: "Eight Form weeks in a row", points: 3, check: (s) => s.formWeeks >= 8 },
  rub_lamp: { label: "Rub a lamp", points: 2, check: (s) => s.lampsRubbed >= 1 },
  checkins_10: { label: "10 check-ins", points: 3, check: (s) => s.total >= 10 },
  checkins_25: { label: "25 check-ins", points: 2, check: (s) => s.total >= 25 },
  checkins_50: { label: "50 check-ins", points: 3, check: (s) => s.total >= 50 },
  checkins_100: { label: "100 check-ins", points: 3, check: (s) => s.total >= 100 },
  quiz_win: { label: "Beat the Quiz Master", points: 2, check: (s) => s.quizWon },
  skill_30: { label: "Any skill to 30", points: 3, check: (s) => s.maxSkill >= 30 },
  skill_40: { label: "Any skill to 40", points: 3, check: (s) => s.maxSkill >= 40 },
  skill_50: { label: "Any skill to 50", points: 3, check: (s) => s.maxSkill >= 50 },
  skill_60: { label: "Any skill to 60", points: 3, check: (s) => s.maxSkill >= 60 },
  casket: { label: "Open a casket", points: 2, check: (s) => s.casket },
  recruit_worker: { label: "Recruit a worker", points: 1, check: (s) => s.workers >= 2 },
  worker_black: { label: "A Black worker", points: 2, check: (s) => s.workerTierIdx >= 3 },
  worker_mithril: { label: "A Mithril worker", points: 3, check: (s) => s.workerTierIdx >= 4 },
  worker_rune: { label: "A Rune worker", points: 3, check: (s) => s.workerTierIdx >= 6 },
  worker_dragon: { label: "A Dragon worker", points: 3, check: (s) => s.workerTierIdx >= 7 },
  deliver_500_week: { label: "Deliver 500 in a week", points: 3, check: (s) => s.deliveredThisWeek >= 500 },
  sacks_10: { label: "Ten sack deliveries", points: 2, check: (s) => s.sacks >= 10 },
  repair_building: { label: "Repair a building", points: 2, check: (s) => s.repairs >= 1 },
  build_something: { label: "Build or raise a building", points: 2, check: (s) => s.builds >= 1 },
  cast_ballot: { label: "Cast a ballot", points: 1, check: (s) => s.ballots >= 1 },
  raid_damage_1000: { label: "1,000 raid damage", points: 3, check: (s) => s.raidDamage >= 1000 },
  raid_checkin_verified: { label: "A verified raid check-in", points: 2, check: (s) => s.raidVerified },
  raid_survivor: { label: "Four check-ins in a raid week", points: 3, check: (s) => s.raidSurvivor },
  raid_win: { label: "Be on a winning raid", points: 3, check: (s) => s.raidWin },
};

async function count(env: Env, sql: string, ...binds: unknown[]): Promise<number> {
  try {
    const row = await env.DB.prepare(sql).bind(...binds).first<{ n: number }>();
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

async function gather(env: Env, player: Player, day: string): Promise<Stats> {
  const id = player.discord_id;
  const week = gameWeek(day);
  const weekRows = await checkinsBetween(env, id, week, day);
  const all = await checkinsBetween(env, id, "2000-01-01", day);
  const skills = await getSkills(env, id);
  const levels = SKILLS.map((skill: SkillKey) => levelForXp(skills[skill] ?? 0));
  const hp = levelForXp(skills.hitpoints ?? 0);
  const entries = new Set(await logEntries(env, id));
  const workers = await getWorkers(env, id);
  const days = new Set(all.map((c) => c.day));
  const weekDelivered = weekRows.reduce((sum, c) => {
    try {
      const haul = JSON.parse(c.delivered ?? "{}") as Record<string, number>;
      return sum + Object.values(haul).reduce((a, b) => a + (b ?? 0), 0);
    } catch {
      return sum;
    }
  }, 0);

  const isEarly = (h: number) => h >= 9 && h < 14;
  const isLate = (h: number) => h >= 2 && h < 9;
  const sameDay3 = (await count(env,
    "SELECT COUNT(*) AS n FROM (SELECT day FROM checkins WHERE day IN (SELECT day FROM checkins WHERE player_id = ?) AND player_id != ? GROUP BY day HAVING COUNT(*) >= 3)",
    id, id)) > 0;

  return {
    total: all.length,
    weekCount: weekRows.length,
    weekdaysThisWeek: new Set(weekRows.map((c) => weekdayOf(c.day))).size,
    twoInARow: all.some((c) => days.has(addDays(c.day, -1))),
    earliest: all.some((c) => isEarly(c.hour_utc)),
    latest: all.some((c) => isLate(c.hour_utc)),
    hasNote: all.some((c) => (c.note ?? "").trim().length > 0),
    hasPrNote: all.some((c) => /\bPR\b/i.test(c.note ?? "")),
    saturday: all.some((c) => weekdayOf(c.day) === 6),
    sunday: all.some((c) => weekdayOf(c.day) === 0),
    monday: all.some((c) => weekdayOf(c.day) === 1),
    sameDay3,
    verifiedCheckins: all.filter((c) => c.verified_count > 0).length,
    verifiedVideo: all.some((c) => c.verified_count > 0 && c.attachment_kind === "video"),
    verifiedThisWeek: weekRows.filter((c) => c.verified_count > 0).length,
    verifiesGiven: await count(env, "SELECT COUNT(*) AS n FROM verifications WHERE verifier_id = ?", id),
    lampsRubbed: await countEvents(env, id, "lamp_rubbed"),
    quizWon: entries.has("milestone:quiz_master"),
    casket: entries.has("milestone:first_casket"),
    hp,
    tierIdx: tierIndexForHp(hp),
    maxSkill: Math.max(...levels),
    formWeeks: player.form_weeks,
    workers: workers.length,
    workerTierIdx: Math.max(-1, ...workers.map((w) => WORKER_TIERS.findIndex((t) => t.key === w.tier))),
    deliveredThisWeek: weekDelivered,
    sacks: await count(env, "SELECT COUNT(DISTINCT day) AS n FROM town_ledger WHERE kind = 'sack' AND player_id = ?", id),
    repairs: await count(env, "SELECT COUNT(*) AS n FROM town_ledger WHERE kind = 'repair' AND player_id = ?", id),
    builds: await count(env, "SELECT COUNT(*) AS n FROM town_ledger WHERE kind = 'build' AND player_id = ?", id),
    ballots: await count(env, "SELECT COUNT(*) AS n FROM vote_ballots WHERE player_id = ?", id),
    raidDamage: await count(env, "SELECT COALESCE(SUM(CAST(json_extract(payload, '$.damage') AS INTEGER)), 0) AS n FROM events_log WHERE player_id = ? AND event_key = 'raid_hit'", id),
    raidVerified: (await count(env,
      "SELECT COUNT(*) AS n FROM checkins c JOIN raids r ON c.day >= r.start_day AND c.day <= r.end_day WHERE c.player_id = ? AND c.verified_count > 0",
      id)) > 0,
    raidSurvivor: entries.has("boss:raid_survivor"),
    raidWin: [...entries].some((e) => e.startsWith("boss:") && e !== "boss:raid_survivor"),
  };
}

function tierIndexForHp(hp: number): number {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) if (hp >= TIERS[i].hp) index = i;
  return index;
}

export const LINES: number[][] = (() => {
  const lines: number[][] = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);
  return lines;
})();

export async function claimedCells(env: Env, act: number, playerId: string): Promise<Set<number>> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT idx FROM bingo_claims WHERE act = ? AND player_id = ?"
    )
      .bind(act, playerId)
      .all<{ idx: number }>();
    return new Set(results.map((r) => r.idx));
  } catch {
    return new Set();
  }
}

export interface BingoResult {
  newCells: string[];
  points: number;
  newLines: number;
  blackout: boolean;
  crate: boolean;
}

/**
 * Looks at everything the player has done and claims what is due. Cheap
 * enough to run on every check-in and every verify.
 */
export async function evaluateBingo(env: Env, player: Player, day: string, act: number, now: number): Promise<BingoResult> {
  const result: BingoResult = { newCells: [], points: 0, newLines: 0, blackout: false, crate: false };
  const grid = BINGO_GRIDS[act];
  if (!grid) return result;
  const claimed = await claimedCells(env, act, player.discord_id);
  if (claimed.size >= 25) return result;
  const stats = await gather(env, player, day);

  const statements: D1PreparedStatement[] = [];
  grid.forEach((key, idx) => {
    if (claimed.has(idx)) return;
    const task = TASKS[key];
    if (!task || !task.check(stats)) return;
    claimed.add(idx);
    result.newCells.push(task.label);
    result.points += task.points;
    statements.push(
      env.DB.prepare("INSERT INTO bingo_claims (act, player_id, idx, claimed_day) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING").bind(act, player.discord_id, idx, day)
    );
  });
  if (statements.length === 0) return result;

  // Lines and the blackout, paid once each.
  const { results: paid } = await env.DB.prepare(
    "SELECT award FROM bingo_awards WHERE act = ? AND player_id = ?"
  )
    .bind(act, player.discord_id)
    .all<{ award: string }>();
  const paidSet = new Set(paid.map((r) => r.award));
  LINES.forEach((line, n) => {
    if (paidSet.has(`line:${n}`)) return;
    if (line.every((idx) => claimed.has(idx))) {
      result.newLines++;
      result.points += BINGO_LINE_POINTS;
      statements.push(
        env.DB.prepare("INSERT INTO bingo_awards (act, player_id, award, points, awarded_day) VALUES (?, ?, ?, ?, ?)").bind(act, player.discord_id, `line:${n}`, BINGO_LINE_POINTS, day)
      );
    }
  });
  if (claimed.size >= 25 && !paidSet.has("blackout")) {
    result.blackout = true;
    result.points += BINGO_BLACKOUT_POINTS;
    statements.push(
      env.DB.prepare("INSERT INTO bingo_awards (act, player_id, award, points, awarded_day) VALUES (?, ?, ?, ?, ?)").bind(act, player.discord_id, "blackout", BINGO_BLACKOUT_POINTS, day)
    );
  }
  await env.DB.batch(statements);
  await updatePlayer(env, player.discord_id, { bingo_points: player.bingo_points + result.points });

  // The group crate: every active player with at least one line.
  if (result.newLines > 0 && !(await getState(env, `bingo_crate:${act}`))) {
    const roster = await activeRoster(env, day);
    let everyone = roster.length > 0;
    for (const member of roster) {
      const cells = await claimedCells(env, act, member.discord_id);
      if (!LINES.some((line) => line.every((idx) => cells.has(idx)))) {
        everyone = false;
        break;
      }
    }
    if (everyone) {
      await setState(env, `bingo_crate:${act}`, day);
      await env.DB.batch(creditStatements(env, "coins", BINGO_GROUP_CRATE, "crate", day, null, now));
      result.crate = true;
    }
  }
  return result;
}

export function bingoLines(result: BingoResult, name: string): { receipt: string | null; publicBit: string | null } {
  if (result.newCells.length === 0) return { receipt: null, publicBit: null };
  const receipt =
    `🎯 Bingo: ${result.newCells.join(", ")} (+${result.points} points` +
    (result.newLines > 0 ? `, ${result.newLines} line${result.newLines === 1 ? "" : "s"}` : "") +
    (result.blackout ? ", BLACKOUT" : "") +
    ").";
  const publicBit =
    result.blackout
      ? `🎯 ${escapeMarkdown(name)} blacked out the bingo card!`
      : result.newLines > 0
        ? `🎯 ${escapeMarkdown(name)} completed a bingo line.`
        : null;
  return { receipt, publicBit: result.crate ? `${publicBit ?? ""} 🎁 Everyone has a line — ${BINGO_GROUP_CRATE} coins to the town.`.trim() : publicBit };
}

/** The grid as text, for /bingo. */
export async function bingoView(env: Env, player: Player, act: number): Promise<string> {
  const grid = BINGO_GRIDS[act];
  if (!grid) return "No bingo card this act.";
  const claimed = await claimedCells(env, act, player.discord_id);
  const lines = [`🎯 **Act ${act} bingo** — ${claimed.size}/25, ${player.bingo_points} points to spend in \`/shop\`.`];
  for (let r = 0; r < 5; r++) {
    lines.push(
      [0, 1, 2, 3, 4]
        .map((c) => {
          const idx = r * 5 + c;
          const task = TASKS[grid[idx]];
          return `${claimed.has(idx) ? "✅" : "▫️"} ${task?.label ?? grid[idx]} (${task?.points ?? 0})`;
        })
        .join(" · ")
    );
  }
  const done = LINES.filter((line) => line.every((idx) => claimed.has(idx))).length;
  lines.push(`${done} line${done === 1 ? "" : "s"} of 12. Lines +${BINGO_LINE_POINTS}, blackout +${BINGO_BLACKOUT_POINTS}. Every cell claims itself from your check-ins.`);
  return lines.join("\n");
}
