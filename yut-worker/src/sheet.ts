import { LOG_TOTAL, SKILLS, SKILL_LABEL, type SkillKey } from "./config.ts";
import { clueLine } from "./clues.ts";
import {
  bankValue,
  checkinsBetween,
  countCheckinsTotal,
  getSkills,
  logCount,
  logEntries,
  openClue,
  unspentLamps,
} from "./db.ts";
import { renderCard, retryField, signedUrl } from "./cards.ts";

export { renderCard };
import { gpShort } from "./loot.ts";
import { activeTask, taskShort } from "./slayer.ts";
import { addDays, campaignWeek, actForWeek } from "./schedule.ts";
import { ACTS, ACT_WEEKS } from "./config.ts";
import type { Env, Player } from "./types.ts";
import { combatLevel, weaponFor } from "./combat.ts";
import {
  levelForXp,
  levelProgress,
  nextTier,
  tierForDefence,
  totalLevel,
  xpForLevel,
  xpToNext,
} from "./xp.ts";

/** Everything the sheet shows, gathered once. */
export interface SheetData {
  player: Player;
  skills: Partial<Record<SkillKey, number>>;
  levels: Record<SkillKey, number>;
  hpLevel: number;
  combat: number;
  weapon: string;
  total: number;
  tier: ReturnType<typeof tierForDefence>;
  formDots: string;
  formCount: number;
  lamps: number;
  clue: string | null;
  log: number;
  checkins: number;
  act: number;
  week: number;
  bossHeads: number;
  task: string | null;
  /** The bank's worth, in coins. */
  bank: number;
}

function cosmetics(player: Player): Record<string, string> {
  try {
    return JSON.parse(player.cosmetics || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export async function gatherSheet(env: Env, player: Player, day: string): Promise<SheetData> {
  const skills = await getSkills(env, player.discord_id);
  const levels = Object.fromEntries(
    SKILLS.map((skill) => [skill, levelForXp(skills[skill] ?? 0)])
  ) as Record<SkillKey, number>;
  const hpLevel = levels.hitpoints;
  const recent = await checkinsBetween(env, player.discord_id, addDays(day, -6), day);
  const days = new Set(recent.map((c) => c.day));
  let formDots = "";
  for (let i = 6; i >= 0; i--) formDots += days.has(addDays(day, -i)) ? "x" : ".";
  const lamps = await unspentLamps(env, player.discord_id);
  const clue = await openClue(env, player.discord_id);
  const week = campaignWeek(day, env.CAMPAIGN_START);
  return {
    player,
    skills,
    levels,
    hpLevel,
    combat: combatLevel(levels),
    weapon: weaponFor(levels.attack).key,
    total: totalLevel(skills, SKILLS),
    tier: tierForDefence(levels.defence),
    formDots,
    formCount: days.size,
    lamps: lamps.length,
    clue: clue ? clueLine(clue) : null,
    log: await logCount(env, player.discord_id),
    checkins: await countCheckinsTotal(env, player.discord_id),
    act: actForWeek(week, ACT_WEEKS, ACTS.length),
    week,
    bossHeads: (await logEntries(env, player.discord_id)).filter((e) => e.startsWith("boss:") && e !== "boss:raid_survivor").length,
    task: taskShort(await activeTask(env, player.discord_id)),
    bank: await bankValue(env, player.discord_id),
  };
}

export function sheetImageUrl(env: Env, data: SheetData, attempt = 0): Promise<string> {
  const clueMatch = data.clue?.match(/\((\w+)\) (\d+)\/(\d+)/);
  return signedUrl(env, `sheet/${data.player.discord_id}`, {
    p: data.player.discord_id,
    n: data.player.username,
    s: SKILLS.map((skill) => ({
      k: skill,
      l: data.levels[skill],
      pct: levelProgress(data.skills[skill] ?? 0),
    })),
    t: data.total,
    cb: data.combat,
    wp: data.weapon,
    tier: data.tier.key,
    tn: data.tier.name,
    d7: data.formDots,
    fw: data.player.form_weeks,
    rg: data.player.rings,
    lm: data.lamps,
    ...(clueMatch
      ? { cl: { tier: clueMatch[1], step: Number(clueMatch[2]), of: Number(clueMatch[3]) } }
      : {}),
    log: data.log,
    ...(data.player.title ? { ti: data.player.title } : {}),
    a: data.act,
    eq: cosmetics(data.player),
    bh: data.bossHeads,
    bp: data.player.bingo_points,
    sp: data.player.slayer_points,
    bk: Math.round(data.bank),
    ...(data.task ? { task: data.task } : {}),
    ...retryField(attempt),
  });
}

export interface ReportPayload {
  n: string;
  t: string;
  /** The stacks on the card, richest first; the rest are counted in `m`. */
  loot: { k: string; c: number }[];
  /** Stacks that did not fit on the card. */
  m?: number;
  /** The session's drops, in coins. */
  v?: number;
  xp: { k: string; x: number }[];
  /** Level-ups: skill, new level, and the level before. */
  lv?: { k: string; l: number; f?: number }[];
  task?: string;
  /** The session line: "23 hill giants · max hit 4 · 54% to hit · Rune scimitar" */
  s?: string;
  d: string;
}

/** The loot card that rides on every check-in line. */
export function reportImageUrl(env: Env, checkinId: number, payload: ReportPayload, attempt = 0): Promise<string> {
  return signedUrl(env, `report/${checkinId}`, { ...payload, ...retryField(attempt) });
}

export function casketImageUrl(
  env: Env,
  clueId: number,
  payload: { n: string; tier: string; loot: { k: string; c: number }[]; xp: number; d: string },
  attempt = 0
): Promise<string> {
  return signedUrl(env, `casket/${clueId}`, { ...payload, ...retryField(attempt) });
}

/** The card for a spoils pick: the headline, the container drawn large, and what came out. */
export interface SpoilsCardPayload {
  n: string;
  t: string;
  sub: string;
  /** The icon drawn large: the jar, the key, the book, the crate. */
  big: string;
  tier?: string;
  loot: { k: string; c: number }[];
  v?: number;
  d: string;
}

export function spoilsImageUrl(env: Env, spoilsId: number, payload: SpoilsCardPayload, attempt = 0): Promise<string> {
  return signedUrl(env, `spoils/${spoilsId}`, { ...payload, ...retryField(attempt) });
}

/** The diary card: every tier's bar, and the open tier's tasks. */
export interface DiaryCardPayload {
  n: string;
  tiers: { k: string; n: string; done: number; of: number; paid: boolean; lamp: number }[];
  /** The open tier's tasks: label, have, goal. */
  tasks: { l: string; h: number; g: number }[];
  open?: string;
  d: string;
}

export function diaryImageUrl(env: Env, playerId: string, payload: DiaryCardPayload, attempt = 0): Promise<string> {
  return signedUrl(env, `diary/${playerId}`, { ...payload, ...retryField(attempt) });
}

/** The gear card: every slot worn, the wardrobe count and what is being chased. */
export interface GearCardPayload {
  n: string;
  /** Slot label, item key, item name. */
  slots: { s: string; k: string; n: string }[];
  own: number;
  of: number;
  chase?: string;
  ti?: string;
  cb: number;
  d: string;
}

export function gearImageUrl(env: Env, playerId: string, payload: GearCardPayload, attempt = 0): Promise<string> {
  return signedUrl(env, `gear/${playerId}`, { ...payload, ...retryField(attempt) });
}

export function levelUpImageUrl(
  env: Env,
  playerId: string,
  name: string,
  skill: SkillKey,
  level: number,
  day: string,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `levelup/${playerId}`, {
    n: name,
    k: skill,
    l: level,
    d: day,
    ...retryField(attempt),
  });
}

export function standingsImageUrl(
  env: Env,
  stamp: number,
  title: string,
  rows: { n: string; hp: number; tier: string; fw: number; u: number }[],
  attempt = 0
): Promise<string> {
  return signedUrl(env, `standings/${stamp}`, { t: title, rows, ...retryField(attempt) });
}

/** The sheet as text, for the fallback and for /sheet before the render ships. */
export function textSheet(data: SheetData): string {
  const lines: string[] = [];
  const title = data.player.title ? ` · ${data.player.title}` : "";
  lines.push(`**${data.player.username}**${title} — ${data.tier.name} · Combat ${data.combat} · Total level ${data.total}`);
  const cells = SKILLS.map((skill) => {
    const xp = data.skills[skill] ?? 0;
    const level = data.levels[skill];
    const toNext = xpToNext(xp);
    return `${SKILL_LABEL[skill]} **${level}**${toNext > 0 ? ` (${toNext.toLocaleString("en-US")} to ${level + 1})` : ""}`;
  });
  lines.push(cells.slice(0, 3).join(" · "));
  lines.push(cells.slice(3, 6).join(" · "));
  lines.push(cells.slice(6, 9).join(" · "));
  const next = nextTier(data.tier);
  if (next) {
    const need = xpForLevel(next.level) - (data.skills.defence ?? 0);
    lines.push(`${next.name} at Defence ${next.level} — ${need.toLocaleString("en-US")} XP away.`);
  }
  lines.push(
    `Form ${formBar(data.formDots)} (${data.formCount} of 7) · Form weeks ${data.player.form_weeks} · Rings ${data.player.rings} · Lamps ${data.lamps}`
  );
  if (data.clue) lines.push(data.clue);
  if (data.task) lines.push(`🗡️ ${data.task} · Slayer points ${data.player.slayer_points}`);
  lines.push(
    `Log ${data.log}/${LOG_TOTAL} · Bank ${gpShort(data.bank)} · ${data.checkins} check-ins · Act ${data.act}, week ${data.week}`
  );
  return lines.join("\n");
}

export function formBar(dots: string): string {
  return dots.replace(/x/g, "🟩").replace(/\./g, "⬛");
}
