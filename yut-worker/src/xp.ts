import {
  CLUE_TIERS,
  LAMP_MAX,
  LAMP_MIN,
  LAMP_PER_LEVEL,
  LEVEL_CAP,
  ORDINAL_WEIGHTS,
  TIERS,
  WORKER_SLOT_PER_COMBAT,
  XP_DIVISOR,
  type ClueTier,
  type SkillKey,
  type Tier,
} from "./config.ts";

/**
 * RuneScape's experience table (XP_DIVISOR is 1; it is kept so the scale can
 * be revisited in year two without touching the formula).
 *
 *   XP(L) = floor( (1/4) · Σ_{l=1}^{L-1} floor( l + 300 · 2^(l/7) ) )
 *
 * Built once at module load. Index is the level; TABLE[1] is 0.
 */
const TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < LEVEL_CAP + 1; level++) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(Math.floor(points / 4) / XP_DIVISOR);
  }
  return table;
})();

export function xpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(LEVEL_CAP, Math.floor(level)));
  return TABLE[clamped];
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < LEVEL_CAP && xp >= TABLE[level + 1]) level++;
  return level;
}

/** XP still needed for the next level, or 0 at the cap. */
export function xpToNext(xp: number): number {
  const level = levelForXp(xp);
  return level >= LEVEL_CAP ? 0 : TABLE[level + 1] - xp;
}

/** 0-100, how far through the current level. 100 at the cap. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= LEVEL_CAP) return 100;
  const from = TABLE[level];
  const to = TABLE[level + 1];
  return Math.floor(((xp - from) / (to - from)) * 100);
}

/** The weight of the Nth check-in of the week. Past the table, the last entry. */
export function ordinalWeight(ordinal: number): number {
  const index = Math.max(0, Math.min(ORDINAL_WEIGHTS.length - 1, ordinal - 1));
  return ORDINAL_WEIGHTS[index];
}

/** The armour tier a Defence level can wear. */
export function tierForDefence(defenceLevel: number): Tier {
  let tier = TIERS[0];
  for (const candidate of TIERS) {
    if (defenceLevel >= candidate.level) tier = candidate;
  }
  return tier;
}

export function tierIndex(key: string): number {
  return TIERS.findIndex((tier) => tier.key === key);
}

/** The tier after this one, or null at Dragon. */
export function nextTier(tier: Tier): Tier | null {
  const index = tierIndex(tier.key);
  return index >= 0 && index < TIERS.length - 1 ? TIERS[index + 1] : null;
}

/** How many workers a combat level may own. */
export function workerSlots(combatLevel: number): number {
  return 1 + Math.floor(combatLevel / WORKER_SLOT_PER_COMBAT);
}

/** The clue tier a monster of this combat level drops. */
export function clueTierForMonster(monsterCombat: number): ClueTier {
  let tier = CLUE_TIERS[0];
  for (const candidate of CLUE_TIERS) {
    if (monsterCombat >= candidate.combat) tier = candidate;
  }
  return tier;
}

/** What a genie's lamp is worth rubbed into a skill at this level: ten times the level. */
export function lampXp(skillLevel: number): number {
  return Math.max(LAMP_MIN, Math.min(LAMP_MAX, LAMP_PER_LEVEL * skillLevel));
}

export function totalLevel(xpBySkill: Partial<Record<SkillKey, number>>, skills: SkillKey[]): number {
  return skills.reduce((sum, skill) => sum + levelForXp(xpBySkill[skill] ?? 0), 0);
}

/** The levels worth a framed scroll: every tenth, every fifth past 60, every one past 90. */
export function isLevelMilestone(level: number): boolean {
  return level % 10 === 0 || (level > 60 && level % 5 === 0) || level > 90;
}
