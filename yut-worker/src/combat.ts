import osrs from "../config/osrs.json" with { type: "json" };
import {
  BANK_TRIP_ATTACKS,
  COMBAT_XP_PER_DAMAGE,
  CONTROLLED_XP_PER_DAMAGE,
  EAT_TICKS,
  FOOD_HEAL,
  HITPOINTS_XP_PER_DAMAGE,
  INVENTORY_FOOD,
  PLAYER_ATTACK_SPEED,
  POTION_DOSES,
  PRAYERS,
  SESSION_ATTACKS,
  SESSION_MIN_FRACTION,
  SLAYER_HELMET_MULTIPLIER,
  STYLE_BONUS,
  TICK_SECONDS,
  type CombatStyle,
  type GeItem,
  type SkillKey,
} from "./config.ts";

/**
 * Old School RuneScape's combat, as arithmetic. A check-in is one training
 * session against the player's Slayer task: the formulas here are the
 * wiki's (Combat level, Maximum melee hit, Accuracy, Combat experience) and
 * the numbers they run on — monster stats, scimitar and armour bonuses,
 * Slayer assignment tables — come from config/osrs.json, pulled from the
 * wiki by scripts/fetch-osrs.mjs. Nothing here is invented; the only
 * game-side knobs are how long a session is and how much food it carries.
 *
 * The session is computed as expected values rather than rolled dice, so a
 * retried check-in produces exactly the same numbers.
 */

export interface Monster {
  name: string;
  combat: number;
  hitpoints: number;
  att: number;
  str: number;
  def: number;
  attbns: number;
  strbns: number;
  dstab: number;
  dslash: number;
  dcrush: number;
  maxHit: number;
  speed: number;
  style: string;
  slayerXp: number;
  slayerLevel: number;
  bones: { item: string; xp: number } | null;
}

export interface Weapon {
  key: string;
  name: string;
  attack: number;
  aslash: number;
  str: number;
}

export interface Armour {
  key: string;
  name: string;
  defence: number;
  dstab: number;
  dslash: number;
  dcrush: number;
  str: number;
}

export interface SlayerAssignment {
  category: string;
  monster: string;
  min: number;
  max: number;
  weight: number;
  /** Unlock requirements from the master's table (Turael's carry combat levels). */
  combatReq?: number;
  slayerReq?: number;
}

export interface SlayerMaster {
  key: string;
  name: string;
  combat: number;
  slayer: number;
  points: number;
  tasks: SlayerAssignment[];
}

export type Levels = Record<SkillKey, number>;

export const MONSTERS: Record<string, Monster> = osrs.monsters as Record<string, Monster>;
export const WEAPONS: Weapon[] = osrs.weapons as Weapon[];
export const ARMOUR: Armour[] = osrs.armour as Armour[];
export const MASTERS: SlayerMaster[] = osrs.masters as SlayerMaster[];
const GLORY = osrs.extras.glory;

export function monsterByName(name: string): Monster | null {
  return MONSTERS[name] ?? null;
}

/** The combat level formula, melee only (no Ranged or Magic in this game). */
export function combatLevel(levels: Levels): number {
  const base = 0.25 * (levels.defence + levels.hitpoints + Math.floor(levels.prayer / 2));
  const melee = 0.325 * (levels.attack + levels.strength);
  return Math.floor(base + melee);
}

/** The best scimitar the player's Attack level can wield. */
export function weaponFor(attackLevel: number): Weapon {
  let best = WEAPONS[0];
  for (const weapon of WEAPONS) if (attackLevel >= weapon.attack) best = weapon;
  return best;
}

/** The best full set (full helm, platebody, platelegs, kiteshield) the player's Defence level can wear. */
export function armourFor(defenceLevel: number): Armour {
  let best = ARMOUR[0];
  for (const set of ARMOUR) if (defenceLevel >= set.defence) best = set;
  return best;
}

/** The strongest attack, strength and defence prayers the Prayer level allows. */
export function bestPrayers(prayerLevel: number): { attack: number; strength: number; defence: number; names: string[] } {
  const boost = { attack: 1, strength: 1, defence: 1 };
  const names: string[] = [];
  for (const prayer of PRAYERS) {
    if (prayerLevel < prayer.level) continue;
    const better =
      (prayer.attack ?? 1) > boost.attack || (prayer.strength ?? 1) > boost.strength || (prayer.defence ?? 1) > boost.defence;
    if (!better) continue;
    boost.attack = Math.max(boost.attack, prayer.attack ?? 1);
    boost.strength = Math.max(boost.strength, prayer.strength ?? 1);
    boost.defence = Math.max(boost.defence, prayer.defence ?? 1);
    names.push(prayer.name);
  }
  return { ...boost, names };
}

/** Hit chance from an attack roll and a defence roll. */
export function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  return attackRoll / (2 * (defenceRoll + 1));
}

/** The wiki's equipment bonuses for one item. */
export interface GearBonuses {
  astab: number;
  aslash: number;
  acrush: number;
  dstab: number;
  dslash: number;
  dcrush: number;
  str: number;
  speed?: number | null;
}

export interface Gear {
  slayerHelmet: boolean;
  glory: boolean;
  /** A dropped weapon worn in place of the scimitar the Attack level picks. */
  weapon?: GearBonuses & { key: string; name: string };
  /** Bonuses from the slots the armour sets leave empty (boots). */
  extra?: GearBonuses;
}

export interface SessionInput {
  levels: Levels;
  style: CombatStyle;
  gear: Gear;
  monster: Monster;
  /** Fraction of a full session, from the weekly ordinal. */
  weight: number;
  /** Levels added by a potion, already averaged over the session (potionBoost). */
  boost?: Boost;
  /** What a bite of the food in the inventory heals; a lobster's 12 unless something better was packed. */
  foodHeal?: number;
}

export type Boost = Partial<Record<"attack" | "strength" | "defence", number>>;

/**
 * What a four-dose potion is worth across a session. A dose lifts the level
 * by the wiki's flat part plus a fraction of the level, and the boost drains
 * a level a minute; four doses sipped evenly across the session leave the
 * boost's average over the minutes between sips (it cannot drain below
 * nothing), rounded to a level.
 */
export function potionBoost(levels: Levels, potion: NonNullable<GeItem["boost"]>, weight: number): Boost {
  const attacks = Math.max(1, Math.round(SESSION_ATTACKS * weight));
  const minutes = (attacks * PLAYER_ATTACK_SPEED * TICK_SECONDS) / 60;
  const between = minutes / POTION_DOSES;
  const boost: Boost = {};
  for (const skill of potion.skills) {
    const full = potion.flat + Math.floor(levels[skill] * potion.fraction);
    // Draining a level a minute from `full`: a wedge if it runs out before the next sip, a trapezium if not.
    const average = full >= between ? full - between / 2 : (full * full) / (2 * between);
    boost[skill] = Math.max(0, Math.round(average));
  }
  return boost;
}

export interface Session {
  weapon: Weapon;
  armour: Armour;
  prayers: string[];
  maxHit: number;
  hitChance: number;
  /** Swings actually made: the session's length less the time spent eating and banking. */
  attacks: number;
  attacksPlanned: number;
  damage: number;
  kills: number;
  damageTaken: number;
  foodEaten: number;
  bankTrips: number;
  /** XP by skill from the fighting alone; Slayer and Prayer are decided by the task and the bones. */
  xp: Partial<Record<SkillKey, number>>;
}

/**
 * One session. Max hit, accuracy and the damage taken all follow the wiki's
 * formulas; the player is assumed to wield the best scimitar and wear the
 * best full set their levels allow, with the strongest prayers they have.
 */
/** What a player's offence comes to against one opponent: the wiki's max hit and accuracy. */
export function offence(
  levels: Levels,
  style: CombatStyle,
  gear: Gear,
  opponent: Pick<Monster, "def" | "dslash"> & Partial<Pick<Monster, "dstab" | "dcrush">>,
  boost: Boost = {}
): {
  weapon: Weapon;
  armour: Armour;
  prayer: ReturnType<typeof bestPrayers>;
  maxHit: number;
  hitChance: number;
  effectiveDefence: number;
  gloryDef: number;
  /** Ticks between swings: four for a scimitar. */
  speed: number;
} {
  const scimitar = weaponFor(levels.attack);
  // A worn drop swings with its best attack bonus against the matching
  // defence; the scimitar slashes, as it always has.
  let weapon: Weapon = scimitar;
  let attackBonus = scimitar.aslash;
  let opponentDefence = opponent.dslash;
  let speed = PLAYER_ATTACK_SPEED;
  if (gear.weapon) {
    const g = gear.weapon;
    weapon = { key: g.key, name: g.name, attack: 0, aslash: g.aslash, str: g.str };
    const options: [number, number][] = [
      [g.aslash, opponent.dslash],
      [g.astab, opponent.dstab ?? opponent.dslash],
      [g.acrush, opponent.dcrush ?? opponent.dslash],
    ];
    [attackBonus, opponentDefence] = options.reduce((best, option) => (option[0] > best[0] ? option : best));
    speed = g.speed && g.speed > 0 ? g.speed : PLAYER_ATTACK_SPEED;
  }
  const extraStr = gear.extra?.str ?? 0;
  const armour = armourFor(levels.defence);
  const prayer = bestPrayers(levels.prayer);
  const bonus = STYLE_BONUS[style];
  const helm = gear.slayerHelmet ? SLAYER_HELMET_MULTIPLIER : 1;
  const gloryAttack = gear.glory ? GLORY.aslash : 0;
  const gloryStr = gear.glory ? GLORY.str : 0;
  const gloryDef = gear.glory ? GLORY.dslash : 0;

  // Effective levels: floor((level + potion boost) × prayer) + 8 + the style
  // bonus. A boost never changes what can be wielded or worn.
  const effectiveAttack = Math.floor((levels.attack + (boost.attack ?? 0)) * prayer.attack) + 8 + (bonus.attack ?? 0);
  const effectiveStrength = Math.floor((levels.strength + (boost.strength ?? 0)) * prayer.strength) + 8 + (bonus.strength ?? 0);
  const effectiveDefence = Math.floor((levels.defence + (boost.defence ?? 0)) * prayer.defence) + 8 + (bonus.defence ?? 0);

  const maxHit = Math.floor(
    Math.floor(0.5 + (effectiveStrength * (weapon.str + armour.str + gloryStr + extraStr + 64)) / 640) * helm
  );
  const attackRoll = Math.floor(effectiveAttack * (attackBonus + gloryAttack + 64) * helm);
  const defenceRoll = (opponent.def + 9) * (opponentDefence + 64);
  return { weapon, armour, prayer, maxHit, hitChance: hitChance(attackRoll, defenceRoll), effectiveDefence, gloryDef, speed };
}

/**
 * A quest's mini-fight: the expected damage of `attacks` swings at an enemy
 * with the player's usual kit. Flat — no weight, no food model — because it
 * is a party's shared boss bar, not a training session.
 */
export function questFight(
  levels: Levels,
  style: CombatStyle,
  gear: Gear,
  enemy: Pick<Monster, "def" | "dslash">,
  attacks: number
): number {
  const { maxHit, hitChance: chance, speed } = offence(levels, style, gear, enemy);
  return Math.floor(attacks * (PLAYER_ATTACK_SPEED / speed) * chance * (maxHit / 2));
}

export function simulateSession(input: SessionInput): Session {
  const { levels, style, gear, monster } = input;
  const { weapon, armour, prayer, maxHit, hitChance: chance, effectiveDefence, gloryDef, speed } = offence(
    levels,
    style,
    gear,
    monster,
    input.boost
  );
  const foodHeal = input.foodHeal ?? FOOD_HEAL;
  // A session is measured in four-tick swings; a slower weapon makes fewer of them.
  const damagePerAttack = chance * (maxHit / 2) * (PLAYER_ATTACK_SPEED / speed);

  // What the monster does back, which is what decides how long the food lasts.
  const monsterAttackRoll = (monster.att + 9) * (monster.attbns + 64);
  const extra = gear.extra;
  const armourDefence =
    monster.style === "stab"
      ? armour.dstab + (extra?.dstab ?? 0)
      : monster.style === "slash"
        ? armour.dslash + (extra?.dslash ?? 0)
        : armour.dcrush + (extra?.dcrush ?? 0);
  const monsterAttacksPerPlayerAttack = PLAYER_ATTACK_SPEED / Math.max(1, monster.speed);
  const takenWith = (defence: number) =>
    hitChance(monsterAttackRoll, defence * (armourDefence + gloryDef + 64)) * (monster.maxHit / 2) * monsterAttacksPerPlayerAttack;
  const takenPerAttack = takenWith(effectiveDefence);

  // A session is a fixed stretch of time. Damage taken costs some of it:
  // three ticks to eat each lobster, and a trip to the bank when the
  // inventory is empty. Better armour and Defence keep more of the time.
  const attacksPlanned = Math.max(1, Math.round(SESSION_ATTACKS * input.weight));
  const floor = Math.round(attacksPlanned * SESSION_MIN_FRACTION);
  /** The food eaten, the bank trips and the swings they cost, for a session of `swings` swings. */
  const cost = (swings: number, taken: number, heal: number) => {
    const food = Math.floor(Math.max(0, swings * taken - levels.hitpoints) / heal);
    const trips = Math.floor(food / INVENTORY_FOOD);
    return { food, trips, overhead: (food * EAT_TICKS) / PLAYER_ATTACK_SPEED + trips * BANK_TRIP_ATTACKS };
  };
  /** The session on lobsters, as it has always been worked out: four passes from the full length. */
  const onLobsters = (taken: number) => {
    let swings = attacksPlanned;
    for (let pass = 0; pass < 4; pass++) {
      swings = Math.max(floor, Math.round(attacksPlanned - cost(swings, taken, FOOD_HEAL).overhead));
    }
    return swings;
  };

  let attacks = onLobsters(takenPerAttack);
  if (input.boost || input.foodHeal) {
    // Something was bought for this session. The longest session the food
    // can pay for, found exactly — and never shorter than the session the
    // player would have had with nothing packed: gold cannot make it worse.
    let low = floor;
    let high = attacksPlanned;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (mid + cost(mid, takenPerAttack, foodHeal).overhead <= attacksPlanned) low = mid;
      else high = mid - 1;
    }
    const unpacked = onLobsters(takenWith(offence(levels, style, gear, monster).effectiveDefence));
    attacks = Math.max(low, unpacked);
  }
  const { food: foodEaten, trips: bankTrips } = cost(attacks, takenPerAttack, foodHeal);

  const damage = Math.floor(attacks * damagePerAttack);
  const kills = Math.max(1, Math.floor(damage / Math.max(1, monster.hitpoints)));
  const damageTaken = Math.floor(attacks * takenPerAttack);

  // Combat experience: 4 per damage to the trained skill, or 4/3 to each of
  // the three on controlled; Hitpoints always 4/3 per damage.
  const xp: Partial<Record<SkillKey, number>> = { hitpoints: Math.floor(damage * HITPOINTS_XP_PER_DAMAGE) };
  if (style === "controlled") {
    for (const skill of ["attack", "strength", "defence"] as const) xp[skill] = Math.floor(damage * CONTROLLED_XP_PER_DAMAGE);
  } else {
    const skill: SkillKey = style === "accurate" ? "attack" : style === "aggressive" ? "strength" : "defence";
    xp[skill] = Math.floor(damage * COMBAT_XP_PER_DAMAGE);
  }

  return {
    weapon,
    armour,
    prayers: prayer.names,
    maxHit,
    hitChance: chance,
    attacks,
    attacksPlanned,
    damage,
    kills,
    damageTaken,
    foodEaten,
    bankTrips,
    xp,
  };
}

/** The highest master the player qualifies for. Duradel also wants 50 Slayer. */
export function masterFor(combat: number, slayer: number): SlayerMaster {
  let master = MASTERS[0];
  for (const candidate of MASTERS) {
    if (combat >= candidate.combat && slayer >= candidate.slayer) master = candidate;
  }
  return master;
}

export function masterByKey(key: string): SlayerMaster {
  return MASTERS.find((m) => m.key === key) ?? MASTERS[0];
}

/**
 * Draws an assignment the way the master would: from the master's table,
 * weighted, skipping anything the player's Slayer level cannot damage.
 */
export function drawAssignment(
  rng: () => number,
  master: SlayerMaster,
  slayerLevel: number,
  combat: number,
  /** Monster keys the player has blocked. */
  blocked: string[] = []
): { assignment: SlayerAssignment; monster: Monster; amount: number } {
  const legal = master.tasks.filter((task) => {
    const monster = MONSTERS[task.monster];
    return (
      monster &&
      !blocked.includes(task.monster) &&
      slayerLevel >= (monster.slayerLevel ?? 1) &&
      slayerLevel >= (task.slayerReq ?? 1) &&
      combat >= (task.combatReq ?? 1)
    );
  });
  const pool = legal.length > 0 ? legal : master.tasks;
  const total = pool.reduce((sum, task) => sum + task.weight, 0);
  let roll = rng() * total;
  let picked = pool[pool.length - 1];
  for (const task of pool) {
    roll -= task.weight;
    if (roll < 0) {
      picked = task;
      break;
    }
  }
  const amount = picked.min + Math.floor(rng() * (picked.max - picked.min + 1));
  return { assignment: picked, monster: MONSTERS[picked.monster], amount };
}

/** "Hill giants", from a category or a monster name. */
export function pluralName(assignment: SlayerAssignment): string {
  const category = assignment.category;
  if (/s$/i.test(category) || /kalphite|tzhaar|dagannoth|elves|kurask|turoth|nechryael|bloodveld|shades|jellies/i.test(category)) return category;
  return `${category}s`;
}

export function levelsOf(xp: Partial<Record<SkillKey, number>>, levelForXp: (xp: number) => number): Levels {
  const keys: SkillKey[] = ["hitpoints", "attack", "strength", "defence", "prayer", "slayer", "woodcutting", "mining", "fishing", "farming"];
  return Object.fromEntries(keys.map((key) => [key, levelForXp(xp[key] ?? 0)])) as Levels;
}
