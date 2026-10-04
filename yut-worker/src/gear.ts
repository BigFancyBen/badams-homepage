import gearData from "../config/gear.json" with { type: "json" };
import {
  GEAR,
  GEAR_RATE_MULTIPLIER,
  GEAR_SLOTS,
  WISHLIST_RATE_MULTIPLIER,
  type GearItem,
  type GearSlot,
} from "./config.ts";
import { MASTERS, MONSTERS, type Gear, type GearBonuses, type Levels } from "./combat.ts";
import { logEntries } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { dropTable, oneIn } from "./loot.ts";
import { hasSlayerHelmet } from "./slayer.ts";
import { bossKeys, bossTable } from "./bosses.ts";
import { buttonRow, buttonRows, type Button, type Env, type Player } from "./types.ts";

/**
 * Gear. The equipment the Slayer monsters really drop can be worn: a weapon,
 * boots or the black mask counts in the session with the wiki's bonuses
 * (config/gear.json), and everything else is a look worn over the armour or a
 * trophy to show. An item is owned when it is in the bank — or, for a clue
 * unique, in the collection log — and one of each slot is worn at a time.
 */

export interface GearDef extends GearItem {
  key: string;
}

/** The item-key rule, as checkins.ts spells it (kept here to avoid a cycle). */
function keyOf(name: string): string {
  if (name === "Amulet of glory (t)") return "glory_t";
  return name.toLowerCase().replace(/[()']/g, "").replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}

export const GEAR_DEFS: GearDef[] = GEAR.map((item) => ({ ...item, key: keyOf(item.item) }));
const BY_KEY = new Map(GEAR_DEFS.map((def) => [def.key, def]));
const BONUSES = (gearData as unknown as { items: Record<string, GearBonuses & { name: string }> }).items;

export function gearDef(key: string | null | undefined): GearDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

export type Worn = Partial<Record<GearSlot, string>>;

export function wornOf(player: Player): Worn {
  try {
    return JSON.parse(player.gear || "{}") as Worn;
  } catch {
    return {};
  }
}

/** Every catalogue key the player owns: bank stacks, and clue uniques from the log. */
export async function ownedGear(env: Env, player: Player): Promise<Set<string>> {
  const owned = new Set<string>();
  const keys = GEAR_DEFS.filter((def) => !def.clue).map((def) => def.key);
  const marks = keys.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(`SELECT item FROM bank WHERE player_id = ? AND qty > 0 AND item IN (${marks})`)
    .bind(player.discord_id, ...keys)
    .all<{ item: string }>();
  for (const row of results) owned.add(row.item);
  const log = new Set(await logEntries(env, player.discord_id));
  for (const def of GEAR_DEFS) if (def.clue && log.has(`clue:${def.item}`)) owned.add(def.key);
  return owned;
}

export function meetsReq(def: GearDef, levels: Levels): boolean {
  return Object.entries(def.req ?? {}).every(([skill, level]) => levels[skill as keyof Levels] >= (level ?? 0));
}

function reqText(def: GearDef): string {
  return Object.entries(def.req ?? {})
    .map(([skill, level]) => `${level} ${skill[0].toUpperCase()}${skill.slice(1)}`)
    .join(", ");
}

/**
 * What the session fights in: the Slayer helmet (or a worn black mask), the
 * glory, and whatever worn weapon and boots are owned and wieldable.
 */
export function sessionGear(player: Player, levels: Levels, owned: Set<string>, glory: boolean): Gear {
  const worn = wornOf(player);
  const usable = (slot: GearSlot) => {
    const def = gearDef(worn[slot]);
    return def && def.stats && owned.has(def.key) && meetsReq(def, levels) ? def : undefined;
  };
  const weapon = usable("weapon");
  const boots = usable("boots");
  const mask = usable("head");
  const weaponStats = weapon ? BONUSES[weapon.key] : undefined;
  const bootStats = boots ? BONUSES[boots.key] : undefined;
  return {
    slayerHelmet: hasSlayerHelmet(player) || Boolean(mask),
    glory,
    ...(weapon && weaponStats ? { weapon: { ...weaponStats, key: weapon.key, name: weapon.item } } : {}),
    ...(bootStats ? { extra: bootStats } : {}),
  };
}

/** The multiplier a drop row gets: wearables at the game's adapted rate, the chased item at twice that. */
export function dropBoost(wishlist: string | null): (row: { key: string }) => number {
  return (row) => {
    if (!BY_KEY.has(row.key)) return 1;
    return GEAR_RATE_MULTIPLIER * (row.key === wishlist ? WISHLIST_RATE_MULTIPLIER : 1);
  };
}

// ── Where things drop ──────────────────────────────────────────────

interface Source {
  monster: string;
  /** The wiki's rate per kill. */
  p: number;
  masters: string[];
}

let sourceCache: Map<string, Source[]> | null = null;

/** Every monster that drops each catalogue item, best rate first, with the masters who assign it. */
export function gearSources(): Map<string, Source[]> {
  if (sourceCache) return sourceCache;
  const sources = new Map<string, Source[]>();
  for (const [key, monster] of Object.entries(MONSTERS)) {
    const masters = MASTERS.filter((master) => master.tasks.some((task) => task.monster === key)).map((master) => master.name);
    for (const row of dropTable(key)) {
      if (!BY_KEY.has(row.key)) continue;
      const list = sources.get(row.key) ?? [];
      const existing = list.find((source) => source.monster === monster.name);
      if (existing) existing.p = Math.max(existing.p, row.p);
      else list.push({ monster: monster.name, p: row.p, masters });
      sources.set(row.key, list);
    }
  }
  // The bosses of the week drop a few pieces of their own.
  for (const boss of bossKeys()) {
    for (const row of bossTable(boss.key)) {
      if (!BY_KEY.has(row.key)) continue;
      const list = sources.get(row.key) ?? [];
      if (!list.some((source) => source.monster === boss.name)) list.push({ monster: boss.name, p: row.p, masters: ["boss of the week"] });
      sources.set(row.key, list);
    }
  }
  for (const list of sources.values()) list.sort((a, b) => b.p - a.p);
  sourceCache = sources;
  return sources;
}

/** "Kurask 1/192 (Chaeldar, Nieve), Turoth 1/250" — at the adapted rate. */
export function sourceLine(def: GearDef, chased = false): string {
  if (def.clue) return "clue caskets";
  const list = gearSources().get(def.key) ?? [];
  if (list.length === 0) return "not on any task monster's table";
  const boost = GEAR_RATE_MULTIPLIER * (chased ? WISHLIST_RATE_MULTIPLIER : 1);
  return list
    .slice(0, 3)
    .map((source) => `${source.monster} ${oneIn(Math.min(1, source.p * boost))}${source.masters.length ? ` (${source.masters.slice(0, 3).join(", ")})` : ""}`)
    .join(", ");
}

function statText(def: GearDef): string {
  const b = BONUSES[def.key];
  if (def.slot === "head") return "+16⅔% on task";
  if (!b) return "";
  if (def.slot === "weapon") {
    const best = Math.max(b.astab, b.aslash, b.acrush);
    return `attack +${best}, strength +${b.str}${b.speed && b.speed !== 4 ? `, ${b.speed}-tick` : ""}`;
  }
  return `defence +${b.dslash}${b.str ? `, strength +${b.str}` : ""}`;
}

// ── /gear ──────────────────────────────────────────────────────────

export interface Line {
  content: string;
  components?: unknown[];
}

const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: "Weapon", head: "Head", cape: "Cape", neck: "Neck", body: "Body", legs: "Legs",
  shield: "Shield", gloves: "Gloves", boots: "Boots", ring: "Ring", trophy: "Trophy",
};

export async function gearView(env: Env, player: Player, levels: Levels, lead?: string): Promise<Line> {
  const owned = await ownedGear(env, player);
  const worn = wornOf(player);
  const lines = [
    ...(lead ? [lead] : []),
    `🛡️ **${escapeMarkdown(player.username)}'s gear** — wardrobe ${owned.size}/${GEAR_DEFS.length}`,
  ];
  const wearing: string[] = [];
  for (const slot of GEAR_SLOTS) {
    const def = gearDef(worn[slot]);
    if (!def || !owned.has(def.key)) continue;
    const idle = def.stats && !meetsReq(def, levels) ? ` — needs ${reqText(def)}` : def.stats ? ` (${statText(def)})` : "";
    wearing.push(`${SLOT_LABEL[slot]}: **${def.item}**${idle}`);
  }
  lines.push(wearing.length > 0 ? wearing.join(" · ") : "Nothing worn over your armour yet. Slayer monsters drop boots, weapons, masks and looks.");

  const chase = gearDef(player.wishlist);
  if (chase) {
    lines.push(
      owned.has(chase.key)
        ? `🎯 Chasing **${chase.item}** — you have it. \`/gear chase\` picks the next.`
        : `🎯 Chasing **${chase.item}**: ${sourceLine(chase, true)}.`
    );
  } else {
    lines.push("🎯 Not chasing anything. `/gear chase` doubles one item's drop rate; `/gear catalogue` lists what there is.");
  }

  const spare = GEAR_DEFS.filter((def) => owned.has(def.key));
  const buttons: Button[] = spare.slice(0, 20).map((def) => ({
    label: `${worn[def.slot] === def.key ? "Take off" : "Wear"} ${def.item}`.slice(0, 80),
    custom_id: `gear:w:${def.key}`,
    style: worn[def.slot] === def.key ? 2 : def.stats ? 3 : 1,
  }));
  if (spare.length > 20) lines.push(`${spare.length - 20} more in the wardrobe than fit here: \`/gear wear\` takes a name.`);
  return {
    content: lines.join("\n"),
    components: [...buttonRows(buttons).slice(0, 4), buttonRow([{ label: "Show off", custom_id: "gear:show", style: 2, emoji: "✨" }])],
  };
}

/** A fuzzy match on the catalogue: the whole name, then the start, then anywhere. */
export function findGear(text: string): GearDef | undefined {
  const needle = text.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    GEAR_DEFS.find((def) => def.item.toLowerCase() === needle || def.key === needle) ??
    GEAR_DEFS.find((def) => def.item.toLowerCase().startsWith(needle)) ??
    GEAR_DEFS.find((def) => def.item.toLowerCase().includes(needle))
  );
}

/** Wears an owned item in its slot, or takes it off if it is already on. */
export async function gearWear(env: Env, player: Player, levels: Levels, key: string): Promise<Line> {
  const def = gearDef(key) ?? findGear(key);
  if (!def) return gearView(env, player, levels, "That is not in the catalogue.");
  const owned = await ownedGear(env, player);
  if (!owned.has(def.key)) return gearView(env, player, levels, `You do not own ${def.item}: ${sourceLine(def)}.`);
  const worn = wornOf(player);
  let lead: string;
  if (worn[def.slot] === def.key) {
    delete worn[def.slot];
    lead = `Took off ${def.item}.`;
  } else {
    worn[def.slot] = def.key;
    lead =
      def.stats && !meetsReq(def, levels)
        ? `Wearing ${def.item} for the look; it needs ${reqText(def)} before it counts.`
        : `Wearing ${def.item}${def.stats ? ` (${statText(def)})` : ""}.`;
  }
  const gear = JSON.stringify(worn);
  await env.DB.prepare("UPDATE players SET gear = ? WHERE discord_id = ?").bind(gear, player.discord_id).run();
  return gearView(env, { ...player, gear }, levels, lead);
}

export async function gearChase(env: Env, player: Player, levels: Levels, text: string): Promise<Line> {
  const def = findGear(text);
  if (!def) return gearView(env, player, levels, `Nothing in the catalogue matches "${text.slice(0, 40)}". \`/gear catalogue\` lists it.`);
  if (def.clue) return gearView(env, player, levels, `${def.item} comes from clue caskets; there is no drop rate to double.`);
  await env.DB.prepare("UPDATE players SET wishlist = ? WHERE discord_id = ?").bind(def.key, player.discord_id).run();
  return gearView(env, { ...player, wishlist: def.key }, levels, `Chasing ${def.item}. Its drop rate is doubled again for you.`);
}

/** One slot of the catalogue, with where each piece drops. */
export async function gearCatalogue(env: Env, player: Player, slot: string): Promise<Line> {
  const owned = await ownedGear(env, player);
  const slots = (GEAR_SLOTS as string[]).includes(slot) ? [slot as GearSlot] : GEAR_SLOTS;
  const lines = [`📖 **Gear catalogue** — you own ${owned.size} of ${GEAR_DEFS.length}. Rates are per kill, at this game's adapted rate (${GEAR_RATE_MULTIPLIER}× the wiki's).`];
  for (const s of slots) {
    const defs = GEAR_DEFS.filter((def) => def.slot === s);
    if (slots.length > 1) {
      lines.push(`**${SLOT_LABEL[s]}** (${defs.filter((def) => owned.has(def.key)).length}/${defs.length}): ${defs.map((def) => (owned.has(def.key) ? `**${def.item}**` : def.item)).join(", ")}`);
      continue;
    }
    lines.push(`**${SLOT_LABEL[s]}**`);
    for (const def of defs) {
      lines.push(`${owned.has(def.key) ? "✅" : "▫️"} ${def.item}${def.stats ? ` (${statText(def)}${def.req ? `; needs ${reqText(def)}` : ""})` : ""} — ${sourceLine(def)}`);
    }
  }
  if (slots.length > 1) lines.push("`/gear catalogue slot:` shows where one slot's pieces drop.");
  return { content: lines.join("\n").slice(0, 1950) };
}

/** What the gear card draws: every slot's item key, worn look first, else the armour underneath. */
export function gearCardSlots(player: Player, owned: Set<string>, base: { weapon: string; armour: string }): { s: string; k: string; n: string }[] {
  const worn = wornOf(player);
  const underneath: Partial<Record<GearSlot, { k: string; n: string }>> = {
    weapon: { k: `${base.weapon}_scimitar`, n: `${base.weapon[0].toUpperCase()}${base.weapon.slice(1)} scimitar` },
    body: { k: `${base.armour}_platebody`, n: `${base.armour[0].toUpperCase()}${base.armour.slice(1)} platebody` },
  };
  const out: { s: string; k: string; n: string }[] = [];
  for (const slot of GEAR_SLOTS) {
    const def = gearDef(worn[slot]);
    if (def && owned.has(def.key)) out.push({ s: SLOT_LABEL[slot], k: def.key, n: def.item });
    else if (underneath[slot]) out.push({ s: SLOT_LABEL[slot], ...underneath[slot]! });
  }
  return out;
}
