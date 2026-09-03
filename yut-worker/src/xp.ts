import {
  CLUE_TIERS,
  COMBAT_XP,
  HP_XP,
  LAMP_MAX,
  LAMP_MIN,
  LAMP_PER_LEVEL,
  LEVEL_CAP,
  ORDINAL_WEIGHTS,
  STYLE_SPLIT,
  TIERS,
  WORKER_SLOT_PER_HP,
  XP_DIVISOR,
  type ClueTier,
  type CombatStyle,
  type SkillKey,
  type Tier,
} from "./config.ts";

/**
 * RuneScape's experience table, divided by XP_DIVISOR.
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

export function tierForHp(hpLevel: number): Tier {
  let tier = TIERS[0];
  for (const candidate of TIERS) {
    if (hpLevel >= candidate.hp) tier = candidate;
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

export function workerSlots(hpLevel: number): number {
  return 1 + Math.floor(hpLevel / WORKER_SLOT_PER_HP);
}

export function clueTierForHp(hpLevel: number): ClueTier {
  let tier = CLUE_TIERS[0];
  for (const candidate of CLUE_TIERS) {
    if (hpLevel >= candidate.hp) tier = candidate;
  }
  return tier;
}

/** What a genie lamp is worth rubbed into a skill at this level. */
export function lampXp(skillLevel: number): number {
  return Math.max(LAMP_MIN, Math.min(LAMP_MAX, LAMP_PER_LEVEL * skillLevel));
}

/**
 * The XP one check-in pays, before verification and lamps.
 *
 * Hitpoints and combat are the same base and the same weight; combat is split
 * by style. Controlled thirds are floored, so a controlled check-in at weight
 * 1 pays 66 to each — the one place the rounding is visible, and RuneScape's
 * controlled style loses the same rounding.
 */
export function checkinXp(
  weight: number,
  style: CombatStyle,
  hpMultiplier = 1
): { hp: number; combat: Partial<Record<SkillKey, number>>; combatTotal: number } {
  const hp = Math.floor(HP_XP * weight * hpMultiplier);
  const combatTotal = Math.floor(COMBAT_XP * weight);
  const combat: Partial<Record<SkillKey, number>> = {};
  for (const [skill, share] of Object.entries(STYLE_SPLIT[style])) {
    combat[skill as SkillKey] = Math.floor(combatTotal * (share ?? 0));
  }
  return { hp, combat, combatTotal };
}

export function totalLevel(xpBySkill: Partial<Record<SkillKey, number>>, skills: SkillKey[]): number {
  return skills.reduce((sum, skill) => sum + levelForXp(xpBySkill[skill] ?? 0), 0);
}
