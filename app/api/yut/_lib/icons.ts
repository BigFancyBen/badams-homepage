import { readFileSync } from "node:fs";
import { join } from "node:path";

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
 * OSRS inventory sprites for the loot cards, keyed by the item keys the Worker
 * sends. Each PNG is the sprite centred on a 36px square and scaled 4x with
 * no smoothing, so it stays crisp when a card draws it at 64px or 96px.
 * `name` is the OSRS item name, used where a card names the drop.
 */
const ITEMS: Record<string, { path: string; name: string }> = {
  coins: { path: "app/api/yut/_assets/items/coins.png", name: "Coins" },
  logs: { path: "app/api/yut/_assets/items/logs.png", name: "Logs" },
  ore: { path: "app/api/yut/_assets/items/ore.png", name: "Iron ore" },
  fish: { path: "app/api/yut/_assets/items/fish.png", name: "Raw lobster" },
  bars: { path: "app/api/yut/_assets/items/bars.png", name: "Steel bar" },
  lamp: { path: "app/api/yut/_assets/items/lamp.png", name: "Lamp" },
  casket: { path: "app/api/yut/_assets/items/casket.png", name: "Casket" },
  ring: { path: "app/api/yut/_assets/items/ring.png", name: "Ring of life" },
  clue_easy: { path: "app/api/yut/_assets/items/clue_easy.png", name: "Clue scroll (easy)" },
  clue_medium: { path: "app/api/yut/_assets/items/clue_medium.png", name: "Clue scroll (medium)" },
  clue_hard: { path: "app/api/yut/_assets/items/clue_hard.png", name: "Clue scroll (hard)" },
  clue_elite: { path: "app/api/yut/_assets/items/clue_elite.png", name: "Clue scroll (elite)" },
  clue_master: { path: "app/api/yut/_assets/items/clue_master.png", name: "Clue scroll (master)" },
  gem: { path: "app/api/yut/_assets/items/gem.png", name: "Enchanted gem" },
  crate: { path: "app/api/yut/_assets/items/crate.png", name: "Crate" },
  bob_shirt_red: { path: "app/api/yut/_assets/items/bob_shirt_red.png", name: "Bob's red shirt" },
  bob_shirt_blue: { path: "app/api/yut/_assets/items/bob_shirt_blue.png", name: "Bob's blue shirt" },
  bob_shirt_green: { path: "app/api/yut/_assets/items/bob_shirt_green.png", name: "Bob's green shirt" },
  highwayman_mask: { path: "app/api/yut/_assets/items/highwayman_mask.png", name: "Highwayman mask" },
  team_cape: { path: "app/api/yut/_assets/items/team_cape.png", name: "Team cape" },
  wooden_shield_g: { path: "app/api/yut/_assets/items/wooden_shield_g.png", name: "Wooden shield (g)" },
  ranger_boots: { path: "app/api/yut/_assets/items/ranger_boots.png", name: "Ranger boots" },
  wizard_boots: { path: "app/api/yut/_assets/items/wizard_boots.png", name: "Wizard boots" },
  black_cavalier: { path: "app/api/yut/_assets/items/black_cavalier.png", name: "Black cavalier" },
  cat_mask: { path: "app/api/yut/_assets/items/cat_mask.png", name: "Cat mask" },
  glory_t: { path: "app/api/yut/_assets/items/glory_t.png", name: "Amulet of glory (t)" },
  rune_helm_h1: { path: "app/api/yut/_assets/items/rune_helm_h1.png", name: "Rune helm (h1)" },
  robin_hood_hat: { path: "app/api/yut/_assets/items/robin_hood_hat.png", name: "Robin hood hat" },
  rune_g_set: { path: "app/api/yut/_assets/items/rune_g_set.png", name: "Rune (g) set" },
  rune_t_set: { path: "app/api/yut/_assets/items/rune_t_set.png", name: "Rune (t) set" },
  zamorak_cloak: { path: "app/api/yut/_assets/items/zamorak_cloak.png", name: "Zamorak cloak" },
  saradomin_cloak: { path: "app/api/yut/_assets/items/saradomin_cloak.png", name: "Saradomin cloak" },
  dragon_full_helm_ornament: {
    path: "app/api/yut/_assets/items/dragon_full_helm_ornament.png",
    name: "Dragon full helm (g)",
  },
  gilded_scimitar: { path: "app/api/yut/_assets/items/gilded_scimitar.png", name: "Gilded scimitar" },
  third_age_amulet: { path: "app/api/yut/_assets/items/third_age_amulet.png", name: "3rd age amulet" },
  ring_of_coins: { path: "app/api/yut/_assets/items/ring_of_coins.png", name: "Ring of coins" },
  third_age_full_helm: {
    path: "app/api/yut/_assets/items/third_age_full_helm.png",
    name: "3rd age full helmet",
  },
  third_age_cloak: { path: "app/api/yut/_assets/items/third_age_cloak.png", name: "3rd age cloak" },
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
  slayer_helmet: { path: "app/api/yut/_assets/items/slayer_helmet.png", name: "Slayer helmet" },
};

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
