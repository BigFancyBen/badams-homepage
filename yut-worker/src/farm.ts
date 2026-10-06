import {
  CROPS,
  FREE_SEED,
  HARVEST_RANGE,
  PATCHES,
  SKILL_LABEL,
  TEARS_MIN,
  TEARS_PER_QP,
  TEAR_FULL_LEVEL,
  TEAR_XP_MAX,
  TEAR_XP_MIN,
  SKILLS,
  type Crop,
  type PatchKey,
  type SkillKey,
} from "./config.ts";
import { addXpStatement, bankDepositStatement, getSkills, logEventStatement } from "./db.ts";
import { seededRng } from "./events.ts";
import { gpShort, itemKeyOf, itemValue } from "./loot.ts";
import { gameWeek } from "./schedule.ts";
import { cardText, panelCard, type PanelTone, type ViewCard } from "./cards.ts";
import { buttonRow, type Env, type Player } from "./types.ts";
import { levelForXp } from "./xp.ts";

/**
 * The farm. Three patches — an allotment, a herb patch, a tree patch —
 * planted with the seeds the kills already drop. Levels, experience and
 * growth times are the wiki's. One run a game day: everything grown is
 * harvested (a tree is checked), and every empty patch is replanted with the
 * best seed in the bank the Farming level allows. Nothing dies and nothing is
 * lost by skipping a day; the crop waits.
 */

export interface PatchRow {
  player_id: string;
  patch: PatchKey;
  seed: string;
  planted_at: number;
  planted_day: string;
}

const CROP_BY_SEED = new Map(CROPS.map((crop) => [itemKeyOf(crop.seed), crop]));

export function cropFor(seedKey: string): Crop | undefined {
  return CROP_BY_SEED.get(seedKey);
}

export function isGrown(row: PatchRow, now: number): boolean {
  const crop = cropFor(row.seed);
  return !crop || now >= row.planted_at + crop.minutes * 60_000;
}

/** The best seed for a patch that the level allows and the bank can supply; the free seed is the allotment's fallback. */
export function bestSeed(patch: PatchKey, level: number, seeds: Map<string, number>, needed: number): Crop | null {
  const candidates = CROPS.filter((crop) => crop.patch === patch && crop.level <= level).sort((a, b) => b.level - a.level);
  for (const crop of candidates) {
    if ((seeds.get(itemKeyOf(crop.seed)) ?? 0) >= needed) return crop;
  }
  return candidates.find((crop) => crop.seed === FREE_SEED) ?? null;
}

/** What a grown patch gives: the yield (seeded on the player, the planting and the patch) and the experience. */
export function harvestOf(crop: Crop, seed: string): { qty: number; xp: number } {
  if (!crop.produce) return { qty: 0, xp: crop.harvestXp };
  const [low, high] = HARVEST_RANGE[crop.patch];
  const qty = low + Math.floor(seededRng(seed)() * (high - low + 1));
  return { qty, xp: qty * crop.harvestXp };
}

async function patchesOf(env: Env, playerId: string): Promise<PatchRow[]> {
  const { results } = await env.DB.prepare("SELECT * FROM farm_patches WHERE player_id = ?").bind(playerId).all<PatchRow>();
  return results;
}

async function seedStock(env: Env, playerId: string): Promise<Map<string, number>> {
  const keys = [...CROP_BY_SEED.keys()];
  const marks = keys.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(`SELECT item, qty FROM bank WHERE player_id = ? AND qty > 0 AND item IN (${marks})`)
    .bind(playerId, ...keys)
    .all<{ item: string; qty: number }>();
  return new Map(results.map((row) => [row.item, row.qty]));
}

export interface Line {
  content: string;
  components?: unknown[];
  card?: ViewCard;
}

export async function farmView(
  env: Env,
  player: Player,
  day: string,
  now: number,
  lead?: string,
  /** A run just made: what came out of the ground, for the card. */
  haul?: { items: { k: string; c: number }[]; xp: number }
): Promise<Line> {
  const rows = new Map((await patchesOf(env, player.discord_id)).map((row) => [row.patch, row]));
  const level = levelForXp((await getSkills(env, player.discord_id)).farming ?? 0);
  const stock = await seedStock(env, player.discord_id);
  const lines = [...(lead ? [lead] : []), `🌱 **${player.username}'s farm** — ${SKILL_LABEL.farming} ${level}`];
  const patchRows: { k?: string; l: string; r?: string; c?: PanelTone }[] = [];
  for (const patch of PATCHES) {
    const row = rows.get(patch.key);
    const crop = row ? cropFor(row.seed) : undefined;
    if (!row || !crop) {
      patchRows.push({ k: "seed_dibber", l: patch.name, r: "Empty", c: "dim" });
    } else {
      const minutes = Math.ceil((row.planted_at + crop.minutes * 60_000 - now) / 60_000);
      patchRows.push({
        k: itemKeyOf(crop.produce ?? crop.seed),
        l: `${patch.name}: ${crop.seed.replace(/ seed$/, "")}`,
        r: minutes <= 0 ? "Ready" : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`,
        c: minutes <= 0 ? "good" : "warn",
      });
    }
    if (!row || !crop) {
      const next = bestSeed(patch.key, level, stock, patch.seeds);
      lines.push(`**${patch.name}**: empty${next ? ` — a run plants ${next.seed.toLowerCase()}s` : " — no seed you can plant yet"}`);
    } else if (isGrown(row, now)) {
      lines.push(`**${patch.name}**: ${crop.seed.replace(/ seed$/, "")} — ready`);
    } else {
      lines.push(`**${patch.name}**: ${crop.seed.replace(/ seed$/, "")} — ready <t:${Math.floor((row.planted_at + crop.minutes * 60_000) / 1000)}:R>`);
    }
  }
  const held = [...stock.entries()]
    .map(([key, qty]) => ({ crop: cropFor(key)!, qty }))
    .sort((a, b) => b.crop.level - a.crop.level)
    .slice(0, 8)
    .map(({ crop, qty }) => `${qty}× ${crop.seed.replace(/ seed$/, "")}${crop.level > level ? ` (level ${crop.level})` : ""}`);
  lines.push(held.length > 0 ? `Seeds: ${held.join(", ")}.` : "No seeds in the bank; your kills drop them. Potato seeds are always to hand.");
  const ran = player.farm_day === day;
  lines.push(ran ? "Today's run is done. Next run after the 3am rollover." : "One run a day: harvest what has grown, replant with your best seeds.");
  return {
    content: lines.join("\n"),
    components: [buttonRow([{ label: ran ? "Run done today" : "Farm run", custom_id: "farm:run", style: 3, emoji: "🌱", disabled: ran }])],
    card: panelCard(env, "farm", {
      t: `${cardText(player.username)}'s farm`,
      sub: haul ? `Farming ${level} - +${haul.xp.toLocaleString("en-US")} XP` : `Farming ${level}`,
      big: haul?.items[0]?.k ?? "seed_dibber",
      sections: [
        ...(haul ? [{ s: "grid" as const, l: "Harvested:", items: haul.items }] : []),
        { s: "rows", rows: patchRows },
        {
          s: "grid",
          l: "Seeds:",
          items: [...stock.entries()]
            .map(([key, qty]) => ({ crop: cropFor(key)!, qty }))
            .sort((a, b) => b.crop.level - a.crop.level)
            .slice(0, 14)
            .map(({ crop, qty }) => ({ k: itemKeyOf(crop.seed), c: qty })),
        },
      ],
      // A patch's time left moves by the minute; the card is redrawn at most every ten.
      d: `${day}T${Math.floor(now / 600_000)}`,
    }),
  };
}

/** The day's run: harvest, then replant. */
export async function farmRun(env: Env, player: Player, day: string, now: number): Promise<Line> {
  if (player.farm_day === day) return farmView(env, player, day, now, "Today's run is already done.");
  // Claim the day first, so a double click cannot run twice.
  const claimed = await env.DB.prepare("UPDATE players SET farm_day = ? WHERE discord_id = ? AND (farm_day IS NULL OR farm_day <> ?)")
    .bind(day, player.discord_id, day)
    .run();
  if (claimed.meta.changes === 0) return farmView(env, { ...player, farm_day: day }, day, now, "Today's run is already done.");

  const skills = await getSkills(env, player.discord_id);
  const before = skills.farming ?? 0;
  let level = levelForXp(before);
  const rows = new Map((await patchesOf(env, player.discord_id)).map((row) => [row.patch, row]));
  const stock = await seedStock(env, player.discord_id);
  const statements: D1PreparedStatement[] = [];
  const bits: string[] = [];
  const harvested: { k: string; c: number }[] = [];
  let xp = 0;
  let worth = 0;

  for (const patch of PATCHES) {
    const row = rows.get(patch.key);
    const crop = row ? cropFor(row.seed) : undefined;
    if (!row || !crop || !isGrown(row, now)) continue;
    const harvest = harvestOf(crop, `${player.discord_id}:${row.planted_at}:${patch.key}`);
    xp += harvest.xp;
    if (crop.produce && harvest.qty > 0) {
      const key = itemKeyOf(crop.produce);
      const value = harvest.qty * itemValue(key);
      worth += value;
      statements.push(bankDepositStatement(env, player.discord_id, key, harvest.qty, value, day));
      bits.push(`${harvest.qty}× ${crop.produce}`);
      harvested.push({ k: key, c: harvest.qty });
    } else {
      bits.push(`checked the ${crop.seed.replace(/ seed$/, "").toLowerCase()} tree`);
    }
    statements.push(env.DB.prepare("DELETE FROM farm_patches WHERE player_id = ? AND patch = ?").bind(player.discord_id, patch.key));
    rows.delete(patch.key);
  }
  // Replant at the level the harvest reached.
  level = levelForXp(before + xp);
  const planted: string[] = [];
  for (const patch of PATCHES) {
    if (rows.has(patch.key)) continue;
    const crop = bestSeed(patch.key, level, stock, patch.seeds);
    if (!crop) continue;
    const key = itemKeyOf(crop.seed);
    const have = stock.get(key) ?? 0;
    if (have >= patch.seeds) {
      stock.set(key, have - patch.seeds);
      // The seeds leave the bank at their share of the stack's worth.
      statements.push(
        env.DB.prepare(
          "UPDATE bank SET value = value - CAST(value * ? / qty AS INTEGER), qty = qty - ? WHERE player_id = ? AND item = ? AND qty >= ?"
        ).bind(patch.seeds, patch.seeds, player.discord_id, key, patch.seeds)
      );
    }
    xp += crop.plantXp;
    statements.push(
      env.DB.prepare(
        "INSERT INTO farm_patches (player_id, patch, seed, planted_at, planted_day) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (player_id, patch) DO UPDATE SET seed = excluded.seed, planted_at = excluded.planted_at, planted_day = excluded.planted_day"
      ).bind(player.discord_id, patch.key, key, now, day)
    );
    planted.push(crop.seed.replace(/ seed$/, "").toLowerCase());
  }

  const gained = Math.floor(xp);
  if (gained > 0) statements.push(addXpStatement(env, player.discord_id, "farming", gained));
  statements.push(logEventStatement(env, player.discord_id, day, null, "farm_run", { xp: gained, worth, harvested: bits, planted }, now));
  await env.DB.batch(statements);

  const after = levelForXp(before + gained);
  const lead =
    `🌱 Farm run: ${bits.length > 0 ? `harvested ${bits.join(", ")}${worth > 0 ? ` (${gpShort(worth)}, banked)` : ""}` : "nothing was ready"}` +
    `${planted.length > 0 ? `; planted ${planted.join(", ")}` : ""}. +${gained.toLocaleString("en-US")} ${SKILL_LABEL.farming}` +
    (after > levelForXp(before) ? ` — **${SKILL_LABEL.farming} ${after}!**` : ".");
  return farmView(env, { ...player, farm_day: day }, day, now, lead, { items: harvested, xp: gained });
}

/**
 * Where today's run stands, for the menu: done, worth making (something has
 * grown, or a patch is empty and there is a seed for it), or still growing.
 * A run with nothing to do spends the day's run, so the menu does not offer it.
 */
export async function farmStatus(env: Env, player: Player, day: string, now: number): Promise<"done" | "ready" | "growing"> {
  if (player.farm_day === day) return "done";
  const rows = new Map((await patchesOf(env, player.discord_id)).map((row) => [row.patch, row]));
  if ([...rows.values()].some((row) => isGrown(row, now))) return "ready";
  if (rows.size >= PATCHES.length) return "growing";
  const level = levelForXp((await getSkills(env, player.discord_id)).farming ?? 0);
  const stock = await seedStock(env, player.discord_id);
  return PATCHES.some((patch) => !rows.has(patch.key) && bestSeed(patch.key, level, stock, patch.seeds)) ? "ready" : "growing";
}

/** Players with something grown and no run yet today, for the evening reminders. */
export async function farmNudges(env: Env, today: string, now: number): Promise<Set<string>> {
  const { results } = await env.DB.prepare(
    "SELECT f.*, p.farm_day AS farm_day FROM farm_patches f JOIN players p ON p.discord_id = f.player_id"
  ).all<PatchRow & { farm_day: string | null }>();
  const ready = new Set<string>();
  for (const row of results) if (row.farm_day !== today && isGrown(row, now)) ready.add(row.player_id);
  return ready;
}

// ── Tears of Guthix ────────────────────────────────────────────────

/** Experience per tear in a skill at this level: 60 from level 30, less below it, as in the game. */
export function tearXp(level: number): number {
  if (level >= TEAR_FULL_LEVEL) return TEAR_XP_MAX;
  return TEAR_XP_MIN + ((Math.max(1, level) - 1) * (TEAR_XP_MAX - TEAR_XP_MIN)) / (TEAR_FULL_LEVEL - 1);
}

/** Tears caught on a visit: the time in the cave grows with quest points. */
export function tearsCaught(questPoints: number, seed: string): number {
  const [low, high] = TEARS_PER_QP;
  return Math.max(TEARS_MIN, Math.round(questPoints * (low + seededRng(seed)() * (high - low))));
}

/** The skill the tears go into: the lowest by experience, the first of them on a tie. */
export function lowestSkill(xp: Partial<Record<SkillKey, number>>): SkillKey {
  let lowest: SkillKey = SKILLS[0];
  for (const skill of SKILLS) if ((xp[skill] ?? 0) < (xp[lowest] ?? 0)) lowest = skill;
  return lowest;
}

/** The weekly visit to Juna. */
export async function tearsVisit(env: Env, player: Player, day: string, now: number): Promise<Line> {
  const week = gameWeek(day);
  if (player.tears_week === week) return { content: "💧 Juna has heard your story this week. The cave opens again on Monday." };
  const claimed = await env.DB.prepare("UPDATE players SET tears_week = ? WHERE discord_id = ? AND (tears_week IS NULL OR tears_week <> ?)")
    .bind(week, player.discord_id, week)
    .run();
  if (claimed.meta.changes === 0) return { content: "💧 Juna has heard your story this week. The cave opens again on Monday." };

  const row = await env.DB.prepare("SELECT COALESCE(SUM(qp), 0) AS qp FROM quests WHERE status = 'done'").first<{ qp: number }>();
  const qp = row?.qp ?? 0;
  const skills = await getSkills(env, player.discord_id);
  const skill = lowestSkill(skills);
  const before = levelForXp(skills[skill] ?? 0);
  const tears = tearsCaught(qp, `${player.discord_id}:${week}:tears`);
  const xp = Math.floor(tears * tearXp(before));
  await env.DB.batch([
    addXpStatement(env, player.discord_id, skill, xp),
    logEventStatement(env, player.discord_id, day, null, "tears", { tears, skill, xp, qp }, now),
  ]);
  const after = levelForXp((skills[skill] ?? 0) + xp);
  return {
    card: panelCard(env, "tears", {
      t: "Tears of Guthix",
      sub: `${cardText(player.username)} - ${tears} tears`,
      big: "frozen_tear",
      sections: [
        { s: "stats", items: [{ l: "Tears", v: String(tears) }, { l: "Quest points", v: String(qp) }, { l: `${SKILL_LABEL[skill]} level`, v: String(after) }] },
        {
          s: "rows",
          rows: [{ k: skill, l: SKILL_LABEL[skill], r: `+${xp.toLocaleString("en-US")} XP`, c: "good" }],
        },
      ],
      d: day,
    }),
    content:
      `💧 **Tears of Guthix**: ${tears} tears caught (the party's ${qp} quest points buy the time). ` +
      `+${xp.toLocaleString("en-US")} ${SKILL_LABEL[skill]}, your lowest skill` +
      (after > before ? ` — **${SKILL_LABEL[skill]} ${after}!**` : ".") +
      " Back next week.",
  };
}
