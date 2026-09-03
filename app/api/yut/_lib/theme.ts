/** RuneScape-flavoured palette for the Yut Hut cards. */
export const RS = {
  yellow: "#ffff00",
  /** Level 99. */
  orange: "#ff981f",
  panel: "#3e3529",
  panelDark: "#2b251c",
  border: "#5c4d36",
  /** Skill labels and footer copy. */
  parchment: "#d9c9a5",
  barTrack: "#1a1610",
  barFill: "#7fb347",
  navy: "#002783",
  shadow: "2px 2px 0 #000",
} as const;

export const TIER_COLOR: Record<string, string> = {
  bronze: "#8b5a2b",
  iron: "#4a4a4a",
  steel: "#9aa0a6",
  black: "#1c1c1c",
  mithril: "#3b5b9d",
  adamant: "#2f6b3a",
  rune: "#3a7ca5",
  rune_t: "#3a7ca5",
  rune_g: "#c9a227",
  rune_or: "#c9a227",
  dragon: "#b02020",
};

export function tierColor(tier: string): string {
  return TIER_COLOR[tier] ?? RS.border;
}

/** Shop-bought sheet trims: the colour of the inner frame line. */
export const TRIM_COLOR: Record<string, string> = {
  gold: "#c9a227",
  silver: "#c0c0c0",
  obsidian: "#2b2b2b",
  "third-age": "#e8dcae",
};

/** Obsidian is near-black on a dark panel, so it gets a glow line beside it. */
export const OBSIDIAN_GLOW = "#7a5cff";

/** null for no trim or an unknown one: the sheet then draws no inner line. */
export function trimColor(trim: string | undefined): string | null {
  return trim ? (TRIM_COLOR[trim] ?? null) : null;
}

/** A 3x3 grid read row by row, in the spirit of the stats tab. */
export const SKILL_ORDER = [
  "attack",
  "hitpoints",
  "mining",
  "strength",
  "prayer",
  "fishing",
  "defence",
  "slayer",
  "woodcutting",
] as const;

export const SKILL_LABEL: Record<string, string> = {
  attack: "Attack",
  hitpoints: "Hitpoints",
  mining: "Mining",
  strength: "Strength",
  prayer: "Prayer",
  fishing: "Fishing",
  defence: "Defence",
  slayer: "Slayer",
  woodcutting: "Woodcutting",
};

export function skillLabel(key: string): string {
  return SKILL_LABEL[key] ?? (key ? key[0].toUpperCase() + key.slice(1) : "");
}

export const FONT = {
  body: "RuneScape",
  bold: "RuneScape Bold",
  chat: "RuneScape Chat",
  npc: "RuneScape NPC",
} as const;

export const SHEET_WIDTH = 900;
export const SHEET_HEIGHT = 560;
