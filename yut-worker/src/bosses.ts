import bossData from "../config/bosses.json" with { type: "json" };
import { BOSS_CHEST_KILLS, BOSS_FIGHTS_PER_HEAD, BOSS_FIGHT_ATTACKS, GROUP_BOSSES, type CombatStyle } from "./config.ts";
import { levelsOf, questFight, type Gear, type Levels, type Monster } from "./combat.ts";
import { activeRoster, bankDepositStatement, getAllSkills, getPlayers, logEventStatement } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { seededRng } from "./events.ts";
import { dropBoost, gearDef } from "./gear.ts";
import { decodeRows, gpShort, rollRows, type DropRow, type Drops } from "./loot.ts";
import { campaignWeek, gameWeek } from "./schedule.ts";
import { cardText, panelCard, type ViewCard } from "./cards.ts";
import type { Env, Player } from "./types.ts";
import { levelForXp } from "./xp.ts";

/**
 * The boss of the week. One of the game's early group bosses — Scurrius,
 * Obor, Bryophyta — is up every campaign week, in rotation. After the
 * session, every check-in takes a swing at it: the damage goes into one pool
 * that the whole roster shares, sized so that most of the roster turning up
 * twice brings it down. The first time a player's own damage for the week
 * reaches a real kill's worth (the boss's own hitpoints), its real drop
 * table, and its lair chest's, rolls for them: one kill of their own a week.
 * When the pool is empty, everyone who fought that week gets a roll too. Two
 * rolls a week at most, which the year simulation needed: a roll a fight
 * made the banks six times what the kills pay.
 *
 * Stats and tables are the wiki's (config/bosses.json). The pool, like a
 * raid's, is measured in the roster's own damage, so a party of level 10s
 * and a party of level 60s both need about the same number of check-ins.
 */

interface BossFile {
  items: { k: string; n: string; v: number }[];
  bosses: Record<string, { stats: Monster; version: string; rows: number[][] }>;
}

const FILE = bossData as unknown as BossFile;
const tables = new Map<string, DropRow[]>();

export interface BossDef {
  key: string;
  name: string;
  emoji: string;
  stats: Monster;
}

/** The boss a campaign week fights; null before the campaign starts. */
export function bossFor(campaignWk: number): BossDef | null {
  if (campaignWk < 1) return null;
  const def = GROUP_BOSSES[(campaignWk - 1) % GROUP_BOSSES.length];
  const data = FILE.bosses[def.key];
  return data ? { key: def.key, name: def.name, emoji: def.emoji, stats: data.stats } : null;
}

/** A boss's drop table (its lair chest's rows included), decoded once. */
export function bossTable(key: string): DropRow[] {
  const cached = tables.get(key);
  if (cached) return cached;
  // The bones are part of the kill, not of the loot.
  const rows = decodeRows(FILE.items, FILE.bosses[key]?.rows ?? []).filter((row) => !/ bones$/i.test(row.item));
  tables.set(key, rows);
  return rows;
}

/** Every boss, for the gear catalogue's sources. */
export function bossKeys(): { key: string; name: string }[] {
  return GROUP_BOSSES.filter((boss) => FILE.bosses[boss.key]).map((boss) => ({ key: boss.key, name: boss.name }));
}

/** One fight's damage: the swings a check-in's weight allows, against the boss's real defence. */
export function bossFight(levels: Levels, style: CombatStyle, gear: Gear, boss: BossDef, weight: number): number {
  return Math.max(1, questFight(levels, style, gear, boss.stats, Math.max(1, Math.round(BOSS_FIGHT_ATTACKS * weight))));
}

/** The pool: the roster's mean full fight, times the fights a head the week asks for. */
export function bossPool(boss: BossDef, rosterLevels: Levels[]): number {
  const bare: Gear = { slayerHelmet: false, glory: false };
  const fights = rosterLevels.map((levels) => bossFight(levels, "controlled", bare, boss, 1));
  const mean = fights.length > 0 ? fights.reduce((sum, n) => sum + n, 0) / fights.length : 1;
  return Math.max(1, Math.round(Math.max(1, rosterLevels.length) * BOSS_FIGHTS_PER_HEAD * mean));
}

/** One roll of the table for a player, at the adapted rates for anything wearable. */
export function bossLoot(key: string, kills: number, seed: string, wishlist: string | null): Drops {
  return rollRows(bossTable(key), kills, seededRng(seed), undefined, dropBoost(wishlist));
}

export interface BossWeek {
  week: string;
  boss: string;
  roster: number;
  hp: number;
  kills_needed: number;
  damage: number;
  status: "open" | "done";
  completed_day: string | null;
}

export async function bossWeek(env: Env, week: string): Promise<BossWeek | null> {
  return env.DB.prepare("SELECT * FROM boss_weeks WHERE week = ?").bind(week).first<BossWeek>();
}

async function openWeek(env: Env, week: string, boss: BossDef, day: string): Promise<BossWeek> {
  const existing = await bossWeek(env, week);
  if (existing) return existing;
  const roster = await activeRoster(env, day);
  const skills = await getAllSkills(env);
  const pool = bossPool(boss, roster.map((player) => levelsOf(skills.get(player.discord_id) ?? {}, levelForXp)));
  await env.DB.prepare(
    "INSERT INTO boss_weeks (week, boss, roster, hp, kills_needed) VALUES (?, ?, ?, ?, 1) ON CONFLICT (week) DO NOTHING"
  )
    .bind(week, boss.key, roster.length, pool)
    .run();
  return (await bossWeek(env, week))!;
}

function lootLine(drops: Drops): string {
  const top = drops.stacks.slice(0, 3).map((stack) => `${stack.qty.toLocaleString("en-US")}× ${stack.item}`);
  return `${top.join(", ")}${drops.stacks.length > 3 ? `, +${drops.stacks.length - 3} more` : ""} (${gpShort(drops.total)})`;
}

function bankStatements(env: Env, playerId: string, drops: Drops, day: string): D1PreparedStatement[] {
  return drops.stacks.map((stack) => bankDepositStatement(env, playerId, stack.key, stack.qty, stack.value, day));
}

/** The wearables in a roll, by name: the things worth saying out loud. */
function uniques(drops: Drops): string[] {
  return drops.stacks.filter((stack) => gearDef(stack.key)).map((stack) => stack.item);
}

export interface BossHit {
  /** What the player reads, and the day's thread. */
  lines: string[];
  /** What only the player needs: a new piece for the wardrobe. */
  keep: string[];
  /** Group news for the channel itself: the boss has fallen. */
  channelLines: string[];
  loot: { k: string; c: number; v: number }[];
}

/**
 * A check-in's swing at the boss. Idempotent on the check-in: a retry finds
 * its row and does nothing.
 */
export async function bossHit(
  env: Env,
  player: Player,
  levels: Levels,
  style: CombatStyle,
  gear: Gear,
  checkinId: number,
  day: string,
  weight: number,
  now: number
): Promise<BossHit | null> {
  const boss = bossFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!boss) return null;
  const week = gameWeek(day);
  const row = await openWeek(env, week, boss, day);
  const damage = bossFight(levels, style, gear, boss, weight);
  const inserted = await env.DB.prepare(
    "INSERT INTO boss_hits (checkin_id, week, player_id, damage, day) VALUES (?, ?, ?, ?, ?) ON CONFLICT (checkin_id) DO NOTHING"
  )
    .bind(checkinId, week, player.discord_id, damage, day)
    .run();
  if (inserted.meta.changes === 0) return null;

  await env.DB.prepare("UPDATE boss_weeks SET damage = damage + ? WHERE week = ?").bind(damage, week).run();
  const after = (await bossWeek(env, week))!;
  const name = escapeMarkdown(player.username);
  const hit: BossHit = { lines: [], keep: [], channelLines: [], loot: [] };

  // A kill of the player's own: the first time their damage for the week
  // reaches the boss's real hitpoints, the table rolls for them. Once a week.
  const statements: D1PreparedStatement[] = [];
  let rolled = "";
  const mine = await env.DB.prepare("SELECT COALESCE(SUM(damage), 0) AS damage, COALESCE(SUM(kills), 0) AS kills FROM boss_hits WHERE week = ? AND player_id = ?")
    .bind(week, player.discord_id)
    .first<{ damage: number; kills: number }>();
  if ((mine?.kills ?? 0) === 0 && (mine?.damage ?? 0) >= boss.stats.hitpoints) {
    const drops = bossLoot(boss.key, 1, `${player.discord_id}:${day}:boss`, player.wishlist);
    statements.push(...bankStatements(env, player.discord_id, drops, day));
    await env.DB.prepare("UPDATE boss_hits SET kills = 1 WHERE checkin_id = ?").bind(checkinId).run();
    for (const stack of drops.stacks) hit.loot.push({ k: stack.key, c: stack.qty, v: stack.value });
    rolled = ` A kill of their own: ${lootLine(drops)}.`;
    for (const item of uniques(drops)) hit.keep.push(`${boss.emoji} **${item}** from ${boss.name}! \`/gear\` to wear it.`);
  }
  const left = Math.max(0, row.hp - after.damage);
  hit.lines.push(
    `${boss.emoji} ${name} hit **${boss.name}** for ${damage.toLocaleString("en-US")}` +
      (after.status === "done" || left === 0 ? "." : ` — ${left.toLocaleString("en-US")} of ${row.hp.toLocaleString("en-US")} left.`) +
      rolled
  );

  // The blow that empties the pool: everybody who fought this week shares the spoils.
  if (after.status === "open" && after.damage >= row.hp) {
    const closed = await env.DB.prepare("UPDATE boss_weeks SET status = 'done', completed_day = ? WHERE week = ? AND status = 'open'")
      .bind(day, week)
      .run();
    if (closed.meta.changes > 0) {
      const { results } = await env.DB.prepare(
        "SELECT player_id, SUM(damage) AS damage FROM boss_hits WHERE week = ? GROUP BY player_id ORDER BY damage DESC"
      )
        .bind(week)
        .all<{ player_id: string; damage: number }>();
      const players = new Map((await getPlayers(env)).map((p) => [p.discord_id, p]));
      const shares: string[] = [];
      for (const fighter of results) {
        const who = players.get(fighter.player_id);
        const drops = bossLoot(boss.key, BOSS_CHEST_KILLS, `${fighter.player_id}:${week}:bosschest`, who?.wishlist ?? null);
        statements.push(...bankStatements(env, fighter.player_id, drops, day));
        const found = uniques(drops);
        shares.push(
          `**${escapeMarkdown(who?.username ?? "someone")}** ${gpShort(drops.total)}${found.length > 0 ? ` and **${found.join(", ")}**` : ""}`
        );
        if (fighter.player_id === player.discord_id) {
          for (const stack of drops.stacks) hit.loot.push({ k: stack.key, c: stack.qty, v: stack.value });
        }
      }
      const top = results[0] ? players.get(results[0].player_id)?.username : null;
      hit.channelLines.push(
        `🏆 ${boss.emoji} **${boss.name} is down.** ${name} landed the last blow` +
          (top ? `; ${escapeMarkdown(top)} did the most damage (${results[0].damage.toLocaleString("en-US")})` : "") +
          `. Everyone who fought shares the spoils: ${shares.join(" · ")}.`
      );
      statements.push(logEventStatement(env, player.discord_id, day, checkinId, "boss_down", { boss: boss.key, week, fighters: results.length }, now));
    }
  }
  for (let i = 0; i < statements.length; i += 40) await env.DB.batch(statements.slice(i, i + 40));
  return hit;
}

function bar(done: number, of: number): string {
  const cells = 10;
  const filled = of > 0 ? Math.min(cells, Math.round((done / of) * cells)) : 0;
  return "▰".repeat(filled) + "▱".repeat(cells - filled);
}

/** One line for the morning post. */
export async function bossLine(env: Env, day: string): Promise<string | null> {
  const boss = bossFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!boss) return null;
  const row = await bossWeek(env, gameWeek(day));
  if (!row) return `${boss.emoji} Boss of the week: **${boss.name}**. Every check-in takes a swing; when it falls, everyone who fought shares the spoils. \`/boss\`.`;
  if (row.status === "done") return `${boss.emoji} **${boss.name}** is down. It can still be fought for its table until Monday.`;
  return `${boss.emoji} **${boss.name}** ${bar(row.damage, row.hp)} ${Math.min(100, Math.floor((row.damage / row.hp) * 100))}% — every check-in takes a swing. \`/boss\`.`;
}

/** `/boss`: the week's boss, the pool, who has hit it, and what it drops. */
/** The sprite a boss's card leads with: the thing it is fought for. */
const BOSS_SPRITE: Record<string, string> = { scurrius: "scurrius_spine", obor: "hill_giant_club", bryophyta: "bryophytas_essence" };

export async function bossView(env: Env, day: string): Promise<{ content: string; card?: ViewCard }> {
  const boss = bossFor(campaignWeek(day, env.CAMPAIGN_START));
  if (!boss) return { content: "No boss yet: the first one arrives with the campaign's first week." };
  const week = gameWeek(day);
  const row = await bossWeek(env, week);
  const lines = [
    `${boss.emoji} **Boss of the week: ${boss.name}** — combat ${boss.stats.combat}, Defence ${boss.stats.def}.`,
    row
      ? row.status === "done"
        ? `Down since ${row.completed_day}. It can still be fought for its table until Monday.`
        : `${bar(row.damage, row.hp)} ${row.damage.toLocaleString("en-US")} / ${row.hp.toLocaleString("en-US")} — sized for a roster of ${row.roster}.`
      : "Nobody has hit it yet this week. The first check-in opens the fight.",
  ];
  let fighters: { username: string; damage: number; fights: number }[] = [];
  if (row) {
    const { results } = await env.DB.prepare(
      "SELECT h.player_id, p.username, SUM(h.damage) AS damage, COUNT(*) AS fights FROM boss_hits h JOIN players p ON p.discord_id = h.player_id WHERE h.week = ? GROUP BY h.player_id ORDER BY damage DESC"
    )
      .bind(week)
      .all<{ username: string; damage: number; fights: number }>();
    fighters = results;
    results.forEach((r, i) => lines.push(`${i + 1}. **${escapeMarkdown(r.username)}** — ${r.damage.toLocaleString("en-US")} over ${r.fights} fight${r.fights === 1 ? "" : "s"}`));
  }
  const rare = bossTable(boss.key)
    .filter((r) => gearDef(r.key))
    .map((r) => r.item);
  lines.push(
    `Every check-in swings ${BOSS_FIGHT_ATTACKS} times at it after your session (fewer past your second of the week). The first time your damage for the week reaches ${boss.stats.hitpoints}, the boss's own hitpoints, its table rolls for you` +
      (rare.length > 0 ? `. On the table: **${[...new Set(rare)].join(", ")}**` : "") +
      `. When the group empties the bar, everyone who fought gets ${BOSS_CHEST_KILLS === 1 ? "a roll" : `${BOSS_CHEST_KILLS} rolls`}.`
  );
  const next = bossFor(campaignWeek(day, env.CAMPAIGN_START) + 1);
  if (next) lines.push(`Next week: ${next.emoji} ${next.name}.`);
  const left = row ? Math.max(0, row.hp - row.damage) : 0;
  const table = [...new Set(bossTable(boss.key).filter((r) => gearDef(r.key)).map((r) => r.key))];
  return {
    content: lines.join("\n"),
    card: panelCard(env, "boss", {
      t: boss.name,
      sub: `This week's boss - combat ${boss.stats.combat}`,
      big: BOSS_SPRITE[boss.key] ?? "giant_key",
      sections: [
        row
          ? {
              s: "bar",
              l: "Hitpoints",
              h: left,
              g: row.hp,
              r: row.status === "done" ? "Defeated" : `${left.toLocaleString("en-US")} / ${row.hp.toLocaleString("en-US")}`,
              c: "bad",
            }
          : { s: "bar", l: "Hitpoints", h: 1, g: 1, r: "Unfought", c: "bad" },
        {
          s: "rows",
          l: "Damage:",
          rows: fighters.slice(0, 8).map((f, i) => ({
            k: "attack",
            l: `${i + 1}. ${cardText(f.username)}`,
            r: f.damage.toLocaleString("en-US"),
            ...(f.damage >= boss.stats.hitpoints ? { c: "good" as const } : {}),
          })),
        },
        { s: "grid", l: "Drops:", items: table.map((k) => ({ k, c: 1 })) },
      ],
      d: day,
    }),
  };
}
