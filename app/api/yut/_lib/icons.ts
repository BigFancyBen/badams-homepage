import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GENERATED_ITEMS } from "./items.generated";

/**
 * Literal paths so the file tracer picks each PNG up. Anything not listed
 * here renders as no icon rather than a crash — the Worker may know about a
 * skill before this side has art for it.
 */
const ICON_PATHS: Record<string, string> = {
  attack: "app/api/yut/_assets/icons/attack.png",
  defence: "app/api/yut/_assets/icons/defence.png",
  strength: "app/api/yut/_assets/icons/strength.png",
  hitpoints: "app/api/yut/_assets/icons/hitpoints.png",
  prayer: "app/api/yut/_assets/icons/prayer.png",
  slayer: "app/api/yut/_assets/icons/slayer.png",
  woodcutting: "app/api/yut/_assets/icons/woodcutting.png",
  mining: "app/api/yut/_assets/icons/mining.png",
  fishing: "app/api/yut/_assets/icons/fishing.png",
  levelUpBackground: "app/api/yut/_assets/icons/levelUpBackground.png",
};

/**
 * Art the OSRS item database has no sprite for, kept by hand: boss heads,
 * pets, the crate, the gem and the small coin stack. Same format as the
 * generated sprites (centred on a 36px square, scaled 4x with no smoothing).
 * `name` is what a card calls the item.
 */
const HAND_ITEMS: Record<string, { path: string; name: string }> = {
  coins: { path: "app/api/yut/_assets/items/coins.png", name: "Coins" },
  gem: { path: "app/api/yut/_assets/items/gem.png", name: "Enchanted gem" },
  crate: { path: "app/api/yut/_assets/items/crate.png", name: "Crate" },
  bloodhound: { path: "app/api/yut/_assets/items/bloodhound.png", name: "Bloodhound" },
  baby_mole: { path: "app/api/yut/_assets/items/baby_mole.png", name: "Baby mole" },
  chompy_chick: { path: "app/api/yut/_assets/items/chompy_chick.png", name: "Chompy chick" },
  giant_mole: { path: "app/api/yut/_assets/items/giant_mole.png", name: "Giant Mole head" },
  kbd: { path: "app/api/yut/_assets/items/kbd.png", name: "King Black Dragon head" },
  kalphite_queen: { path: "app/api/yut/_assets/items/kalphite_queen.png", name: "Kalphite Queen head" },
  chaos_elemental: { path: "app/api/yut/_assets/items/chaos_elemental.png", name: "Chaos Elemental head" },
  corporeal_beast: { path: "app/api/yut/_assets/items/corporeal_beast.png", name: "Corporeal Beast head" },
  elvarg: { path: "app/api/yut/_assets/items/elvarg.png", name: "Elvarg's head" },
  beaver: { path: "app/api/yut/_assets/items/beaver.png", name: "Beaver" },
  heron: { path: "app/api/yut/_assets/items/heron.png", name: "Heron" },
  rock_golem: { path: "app/api/yut/_assets/items/rock_golem.png", name: "Rock golem" },
};

/**
 * OSRS inventory sprites for the loot cards, keyed by the item keys the Worker
 * sends. Every item in config/drops.json plus the shop and reward items comes
 * from items.generated.ts (yut-worker/scripts/export-icons.mjs pulls them from
 * the item database); the hand-kept art above wins where a key is in both.
 */
const ITEMS: Record<string, { path: string; name: string }> = { ...GENERATED_ITEMS, ...HAND_ITEMS };

function readDataUrl(relative: string | undefined): string | null {
  if (!relative) return null;
  try {
    const bytes = readFileSync(join(process.cwd(), relative));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

const iconCache = new Map<string, string | null>();

/** `data:image/png;base64,...` for a known skill icon, or null for an unknown one. */
export function iconDataUrl(name: string): string | null {
  const hit = iconCache.get(name);
  if (hit !== undefined) return hit;
  const url = readDataUrl(ICON_PATHS[name]);
  iconCache.set(name, url);
  return url;
}

const itemCache = new Map<string, string | null>();

/** `data:image/png;base64,...` for a known item sprite, or null for an unknown key. */
export function itemIconDataUrl(key: string): string | null {
  const hit = itemCache.get(key);
  if (hit !== undefined) return hit;
  const url = readDataUrl(ITEMS[key]?.path);
  itemCache.set(key, url);
  return url;
}

/** The OSRS item name behind a key, or null for an unknown key. */
export function itemName(key: string): string | null {
  return ITEMS[key]?.name ?? null;
}
