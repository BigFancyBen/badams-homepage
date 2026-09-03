import { LOG_TOTAL, SKILLS, SKILL_LABEL, type SkillKey } from "./config.ts";
import { clueLine } from "./clues.ts";
import {
  checkinsBetween,
  countCheckinsTotal,
  getSkills,
  logCount,
  logEntries,
  openClue,
  unspentLamps,
} from "./db.ts";
import { base64UrlFromString, hmacBase64Url } from "./encoding.ts";
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

/**
 * The render endpoints live in the Next app on Vercel — Workers Free gives
 * 10ms of CPU, nowhere near enough to rasterize anything. We hand the render
 * a signed URL carrying everything it needs and it returns a PNG.
 */
async function signedUrl(env: Env, route: string, payload: unknown): Promise<string> {
  const data = base64UrlFromString(JSON.stringify(payload));
  const sig = await hmacBase64Url(env.YUT_IMAGE_SECRET, data);
  return `${env.IMAGE_BASE_URL}/api/yut/${route}?d=${data}&s=${sig}`;
}

function retryField(attempt: number): { r?: number } {
  return attempt > 0 ? { r: attempt } : {};
}

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
    ...(data.task ? { task: data.task } : {}),
    ...retryField(attempt),
  });
}

export interface ReportPayload {
  n: string;
  t: string;
  loot: { k: string; c: number }[];
  xp: { k: string; x: number }[];
  lv?: { k: string; l: number }[];
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

const RENDER_ATTEMPTS = 3;

/**
 * Renders a card, mirrors it into R2, and returns a public URL for the copy.
 * Discord fetches an embed image once and caches it against the URL forever,
 * so the fetch happens here where a failure can be retried, and Discord only
 * ever sees a static object. Null if the card never rendered.
 */
export async function renderCard(
  env: Env,
  key: string,
  mint: (attempt: number) => Promise<string>
): Promise<string | null> {
  for (let attempt = 0; attempt < RENDER_ATTEMPTS; attempt++) {
    const url = await mint(attempt);
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) continue;
      bytes = await response.arrayBuffer();
    } catch {
      continue;
    }
    if (bytes.byteLength === 0) continue;

    try {
      await env.BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return `${env.R2_PUBLIC_BASE}/${key}`;
    } catch {
      return url;
    }
  }
  return null;
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
  lines.push(`Log ${data.log}/${LOG_TOTAL} · ${data.checkins} check-ins · Act ${data.act}, week ${data.week}`);
  return lines.join("\n");
}

export function formBar(dots: string): string {
  return dots.replace(/x/g, "🟩").replace(/\./g, "⬛");
}
