/**
 * Every number in the game, in one place.
 *
 * Two rules sit above everything here and every formula obeys them: two check-
 * ins a week is the whole game (the first two are full value, the third and
 * fourth half, the rest a fifth), and only players exist (nobody who has not
 * joined is counted, named, pinged or penalised). Nothing in this file is ever
 * awarded for anything but a check-in.
 *
 * The designer edits this file and nothing else. The simulation and production
 * run the same table.
 */

import choices from "../config/choices.json" with { type: "json" };

// ── Skills ─────────────────────────────────────────────────────────

export type SkillKey =
  | "hitpoints"
  | "attack"
  | "strength"
  | "defence"
  | "prayer"
  | "slayer"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "farming";

export const SKILLS: SkillKey[] = [
  "hitpoints",
  "attack",
  "strength",
  "defence",
  "prayer",
  "slayer",
  "woodcutting",
  "mining",
  "fishing",
  "farming",
];

export const SKILL_LABEL: Record<SkillKey, string> = Object.fromEntries(
  choices.skills.map((s) => [s.value, s.name])
) as Record<SkillKey, string>;

export function isSkill(key: string): key is SkillKey {
  return (SKILLS as string[]).includes(key);
}

/**
 * RuneScape's experience table, exactly — level 99 is 13,034,431 XP and every
 * unlock sits at its RuneScape level. Experience is earned the way Old School
 * pays it: a check-in is one training session against the player's Slayer
 * task, and the session's damage decides the XP (see combat.ts). 99 is
 * unreachable in a year by design.
 */
export const XP_DIVISOR = 1;
export const LEVEL_CAP = 99;

/** Everybody starts at Hitpoints 10, as in the game. */
export const STARTING_HITPOINTS_XP = 1154;

// ── The session (combat.ts) ────────────────────────────────────────

/**
 * Combat experience per point of damage: 4 to the trained skill, or 4/3 to
 * each of Attack, Strength and Defence on controlled, and 4/3 to Hitpoints
 * always. Wiki: Combat experience.
 */
export const COMBAT_XP_PER_DAMAGE = 4;
export const CONTROLLED_XP_PER_DAMAGE = 4 / 3;
export const HITPOINTS_XP_PER_DAMAGE = 4 / 3;

/** A scimitar swings every four ticks. */
export const PLAYER_ATTACK_SPEED = 4;

/**
 * The one knob that is the game's rather than RuneScape's: how long a
 * full-value session is, in swings (a four-tick weapon makes 800 in a little
 * over half an hour). Damage taken costs time out of it — three ticks per lobster eaten,
 * and a bank trip when the inventory runs dry — which is what gives Defence
 * and armour their job. Tuned so two sessions a week, every week, reach
 * Dragon (60 Attack and Defence) by the finale — with the Founding lamps and
 * the weekly quest lamps counted (scripts/calibrate.mjs: 2/wk Defence 60 in
 * week 45, 5/wk in week 35, 1/wk ends in Adamant). It was 800 before the
 * quests' lamps existed.
 */
export const SESSION_ATTACKS = 600;
/** A lobster heals 12 and takes three ticks to eat; an inventory carries 27 with a weapon and no shield swap. */
export const FOOD_HEAL = 12;
export const EAT_TICKS = 3;
export const INVENTORY_FOOD = 27;
/** A trip to the bank and back, in swings' worth of time (about three minutes). */
export const BANK_TRIP_ATTACKS = 75;
/** However bad it goes, a session keeps this much of its time. */
export const SESSION_MIN_FRACTION = 0.2;

/** Style bonuses to effective levels: +3 to one, or +1 to all three on controlled. */
export const STYLE_BONUS: Record<CombatStyle, Partial<Record<"attack" | "strength" | "defence", number>>> = {
  accurate: { attack: 3 },
  aggressive: { strength: 3 },
  defensive: { defence: 3 },
  controlled: { attack: 1, strength: 1, defence: 1 },
};

/** The Slayer helmet: +16⅔% accuracy and damage on task. */
export const SLAYER_HELMET_MULTIPLIER = 7 / 6;

/** The melee prayers, by Prayer level, as effective-level multipliers. */
export const PRAYERS: { name: string; level: number; attack?: number; strength?: number; defence?: number }[] = [
  { name: "Thick Skin", level: 1, defence: 1.05 },
  { name: "Burst of Strength", level: 4, strength: 1.05 },
  { name: "Clarity of Thought", level: 7, attack: 1.05 },
  { name: "Rock Skin", level: 10, defence: 1.1 },
  { name: "Superhuman Strength", level: 13, strength: 1.1 },
  { name: "Improved Reflexes", level: 16, attack: 1.1 },
  { name: "Steel Skin", level: 28, defence: 1.15 },
  { name: "Ultimate Strength", level: 31, strength: 1.15 },
  { name: "Incredible Reflexes", level: 34, attack: 1.15 },
  { name: "Chivalry", level: 60, attack: 1.15, strength: 1.18, defence: 1.2 },
  { name: "Piety", level: 70, attack: 1.2, strength: 1.23, defence: 1.25 },
];

/** Burying the kills' bones at the Chapel: a gilded altar pays 250%, 300% with one burner, 350% with two. */
export const ALTAR_MULTIPLIER = [1, 2.5, 3, 3.5];

export type CombatStyle = "accurate" | "aggressive" | "defensive" | "controlled";

export const COMBAT_STYLES: CombatStyle[] = [
  "accurate",
  "aggressive",
  "defensive",
  "controlled",
];

export function isCombatStyle(value: string): value is CombatStyle {
  return (COMBAT_STYLES as string[]).includes(value);
}

export const STYLE_LABEL: Record<CombatStyle, string> = Object.fromEntries(
  choices.styles.map((s) => [s.value, s.name])
) as Record<CombatStyle, string>;

// ── The weight ─────────────────────────────────────────────────────

/**
 * By ordinal within the calendar game week, not a rolling window: a rolling
 * window makes a steady five-a-week player's every check-in "the fifth" and
 * pays them a fifth forever. A calendar week resets, is legible ("you've done
 * your two"), and gives Sunday a deadline.
 */
export const ORDINAL_WEIGHTS = [1.0, 1.0, 0.5, 0.5, 0.2, 0.2, 0.2];

/** Slayer for the author of a verified check-in, before the weight. */
export const VERIFIED_AUTHOR_SLAYER = 500;
/** Combat XP multiplier once a check-in is verified. */
export const VERIFIED_MULTIPLIER = 1.5;
/** Slayer for pressing Verify, paid on the verifier's own next check-in. */
export const VERIFIER_SLAYER = 100;
/** Extra Slayer to the author for each verification past the first, up to this many. */
export const EXTRA_VERIFICATION_SLAYER = 50;
export const MAX_COUNTED_VERIFICATIONS = 3;
/** How long the Verify button stays live. */
export const VERIFY_WINDOW_HOURS = 72;
/** How long a verifier's pending Slayer waits for their own check-in. */
export const VERIFIER_PAY_WINDOW_DAYS = 7;
/** How many verifications one person can be paid for in a day. */
export const VERIFIER_DAILY_CAP = 3;

/**
 * Gathering: every log, ore and fish the player handles pays the experience
 * of the best one their level can take — the wiki's tables. A session
 * handles at most this many of each resource (× weight); the rest still
 * reaches the town, it just is not the player's own skilling.
 */
export const GATHER_UNITS_PER_SESSION = 100;

export interface Resource {
  name: string;
  level: number;
  xp: number;
}

export const LOGS: Resource[] = [
  { name: "Logs", level: 1, xp: 25 },
  { name: "Oak logs", level: 15, xp: 37.5 },
  { name: "Willow logs", level: 30, xp: 67.5 },
  { name: "Teak logs", level: 35, xp: 85 },
  { name: "Maple logs", level: 45, xp: 100 },
  { name: "Mahogany logs", level: 50, xp: 125 },
  { name: "Yew logs", level: 60, xp: 175 },
  { name: "Magic logs", level: 75, xp: 250 },
  { name: "Redwood logs", level: 90, xp: 380 },
];

export const ORES: Resource[] = [
  { name: "Copper ore", level: 1, xp: 17.5 },
  { name: "Iron ore", level: 15, xp: 35 },
  { name: "Silver ore", level: 20, xp: 40 },
  { name: "Coal", level: 30, xp: 50 },
  { name: "Gold ore", level: 40, xp: 65 },
  { name: "Mithril ore", level: 55, xp: 80 },
  { name: "Adamantite ore", level: 70, xp: 95 },
  { name: "Runite ore", level: 85, xp: 125 },
];

export const FISH: Resource[] = [
  { name: "Shrimps", level: 1, xp: 10 },
  { name: "Sardine", level: 5, xp: 20 },
  { name: "Herring", level: 10, xp: 30 },
  { name: "Anchovies", level: 15, xp: 40 },
  { name: "Trout", level: 20, xp: 50 },
  { name: "Pike", level: 25, xp: 60 },
  { name: "Salmon", level: 30, xp: 70 },
  { name: "Tuna", level: 35, xp: 80 },
  { name: "Lobster", level: 40, xp: 90 },
  { name: "Swordfish", level: 50, xp: 100 },
  { name: "Monkfish", level: 62, xp: 120 },
  { name: "Shark", level: 76, xp: 110 },
];

/** The best resource a level can take. */
export function bestResource(table: Resource[], level: number): Resource {
  let best = table[0];
  for (const row of table) if (level >= row.level) best = row;
  return best;
}

// ── Roster ─────────────────────────────────────────────────────────

/** A player with no check-in in this many days drops out of the active roster. */
export const ACTIVE_WINDOW_DAYS = 21;
/** A check-in inside this many days is what unlocks every action. */
export const FRESH_WINDOW_DAYS = 4;
/** Form: this many check-ins in the trailing seven days. */
export const FORM_CHECKINS = 2;
export const EXPEDITION_MIN_WEEKS = 1;
export const EXPEDITION_MAX_WEEKS = 8;

// ── Per-player phases, from /join ──────────────────────────────────

/** Week 13: Graduation. */
export const GRADUATION_WEEK = 13;

// ── Rings of Life (the freeze) ─────────────────────────────────────

export const RING_CAP = 2;
export const RING_CAP_GRADUATED = 3;
/** Form weeks per ring, before and after the player's week 9. */
export const RING_EVERY_EARLY = 3;
export const RING_EVERY_LATE = 2;
export const RING_LATE_FROM_WEEK = 9;
/** Weeks 3-4 of a player's campaign: the first ring comes at the first Form week. */
export const EARLY_RING_WEEK_FROM = 3;
export const EARLY_RING_WEEK_TO = 4;

// ── Recovery quest ─────────────────────────────────────────────────

export const RECOVERY_SILENT_DAYS = 14;
export const RECOVERY_WINDOW_DAYS = 14;
export const RECOVERY_CHECKINS = 3;
export const RECOVERY_LAMP_XP = 7500;

// ── Lamps ──────────────────────────────────────────────────────────

/**
 * A genie's lamp pays ten times the chosen skill's level, as in the game.
 * The bigger lamps the campaign hands out (quests, Foundings, raids, caskets)
 * are the Achievement Diary's antique lamps: 2,500 / 7,500 / 15,000 / 50,000.
 */
export const LAMP_PER_LEVEL = 10;
export const LAMP_MIN = 10;
export const LAMP_MAX = 990;
export const ANTIQUE_LAMP = { easy: 2500, medium: 7500, hard: 15000, elite: 50000 };
/** Unrubbed lamps go into Hitpoints after this long. */
export const LAMP_AUTO_RUB_DAYS = 14;
/** The evening reminder starts saying so this many days before a lamp rubs itself. */
export const LAMP_REMINDER_DAYS = 3;

// ── Random events ──────────────────────────────────────────────────

export type EventKey =
  | "genie"
  | "old_man"
  | "drunken_dwarf"
  | "evil_chicken"
  | "sandwich_lady"
  | "beekeeper"
  | "quiz_master"
  | "freaky_forester"
  | "drill_demon"
  | "prison_pete";

/** One in this many check-ins rolls an event. The Tavern lowers it. */
export const EVENT_CHANCE = 6;
/** The Nth eventless check-in in a row is guaranteed one. */
export const EVENT_PITY = 12;

export const EVENT_TABLE: { key: EventKey; weight: number; label: string }[] = [
  { key: "genie", weight: 30, label: "Genie" },
  { key: "old_man", weight: 15, label: "Mysterious Old Man" },
  { key: "drunken_dwarf", weight: 12, label: "Drunken Dwarf" },
  { key: "evil_chicken", weight: 10, label: "Evil Chicken" },
  { key: "sandwich_lady", weight: 8, label: "Sandwich Lady" },
  { key: "beekeeper", weight: 8, label: "Beekeeper" },
  { key: "quiz_master", weight: 7, label: "Quiz Master" },
  { key: "freaky_forester", weight: 5, label: "Freaky Forester" },
  { key: "drill_demon", weight: 3, label: "Drill Demon" },
  { key: "prison_pete", weight: 2, label: "Prison Pete" },
];

export const EVIL_CHICKEN_DEFENCE = 500;
export const SANDWICH_LADY_HP = 500;
export const OLD_MAN_RESOURCE = 150;
export const DRUNKEN_DWARF_COINS = 200;
export const QUIZ_RIGHT_XP = 500;
export const QUIZ_WRONG_COINS = 50;
export const FORESTER_REPAIR = 30;
export const BEEKEEPER_HOURS = 24;
export const BEEKEEPER_BONUS = 0.25;
/** The Drill Demon's exercises pay a genie lamp's worth (ten × level) into a random combat skill. */
export const DRILL_DEMON_LAMP_PER_LEVEL = 10;

/** Three-button trivia. The right answer is index `a`. */
export const QUIZ_BANK: { q: string; o: [string, string, string]; a: number }[] = [
  { q: "What level does a rune scimitar need?", o: ["30 Attack", "40 Attack", "50 Attack"], a: 1 },
  { q: "Which skill does the Genie's lamp go into?", o: ["Whichever you pick", "Always Hitpoints", "Random"], a: 0 },
  { q: "How many XP for level 99?", o: ["9,999,999", "13,034,431", "20,000,000"], a: 1 },
  { q: "Which ore makes a bronze bar?", o: ["Copper and tin", "Iron", "Coal and tin"], a: 0 },
  { q: "What does the Drunken Dwarf hand you?", o: ["A kebab and a beer", "A lamp", "A rune"], a: 0 },
  { q: "Where does the tutorial happen?", o: ["Lumbridge", "Tutorial Island", "Varrock"], a: 1 },
  { q: "Level 92 is what fraction of the way to 99?", o: ["A quarter", "A half", "Three quarters"], a: 1 },
  { q: "Which metal comes right after steel?", o: ["Mithril", "Black", "Adamant"], a: 1 },
  { q: "Which metal needs 60 to wear?", o: ["Rune", "Dragon", "Adamant"], a: 1 },
  { q: "The Evil Chicken belongs to which quest line?", o: ["Recipe for Disaster", "Dragon Slayer", "Cook's Assistant"], a: 0 },
  { q: "A deadlift mainly trains which side?", o: ["Anterior chain", "Posterior chain", "Neither"], a: 1 },
  { q: "The 'big three' lifts are squat, bench and…", o: ["Curl", "Deadlift", "Row"], a: 1 },
  { q: "A standard Olympic bar weighs about…", o: ["15 kg", "20 kg", "25 kg"], a: 1 },
  { q: "Progressive overload means…", o: ["Doing more over time", "Never resting", "Only lifting heavy"], a: 0 },
  { q: "How many days a week does this game want?", o: ["Seven", "Two", "Five"], a: 1 },
  { q: "RPE 10 means…", o: ["An easy warm-up", "Nothing left in the tank", "Ten reps"], a: 1 },
  { q: "Which is a hinge movement?", o: ["Squat", "Romanian deadlift", "Bench press"], a: 1 },
  { q: "Zone 2 cardio is roughly…", o: ["Conversational pace", "All-out sprint", "Walking only"], a: 0 },
  { q: "What does DOMS stand for?", o: ["Daily Overload Muscle Strain", "Delayed Onset Muscle Soreness", "Dynamic Output Max Set"], a: 1 },
  { q: "Which skill do verified check-ins feed?", o: ["Slayer", "Prayer", "Fishing"], a: 0 },
  { q: "What does the Mysterious Old Man bring?", o: ["A crate for the town", "A ring", "A boss"], a: 0 },
  { q: "Which boss guards the Dragon Slayer quest?", o: ["Elvarg", "Giant Mole", "KBD"], a: 0 },
  { q: "Kalphite Queen is found in the…", o: ["Wilderness", "Kharidian Desert", "Morytania"], a: 1 },
  { q: "The Corporeal Beast is weak to…", o: ["Spears", "Magic", "Ranged"], a: 0 },
  { q: "A Ring of Life saves your streak on a week with…", o: ["Zero check-ins", "Exactly one", "Any number"], a: 1 },
  { q: "How long does a worker's sack fill for?", o: ["24 hours", "96 hours", "Forever"], a: 1 },
  { q: "Which building lifts the event chance?", o: ["Tavern", "Chapel", "Bank"], a: 0 },
  { q: "Where do quitters' workers go?", o: ["Deleted", "To the town at half rate", "To the top player"], a: 1 },
  { q: "The Beekeeper's bonus lasts…", o: ["24 hours", "A week", "One check-in"], a: 0 },
  { q: "Which is NOT a real RuneScape random event?", o: ["Sandwich Lady", "Freaky Forester", "Angry Barista"], a: 2 },
  { q: "A 'pull day' typically trains…", o: ["Back and biceps", "Chest and triceps", "Quads"], a: 0 },
  { q: "Creatine's main job is…", o: ["Rehydrating ATP faster", "Burning fat", "Building bone"], a: 0 },
  { q: "A plank mostly trains…", o: ["Core", "Calves", "Forearms"], a: 0 },
  { q: "Which grip is on the top of the bar?", o: ["Overhand", "Underhand", "Hook only"], a: 0 },
  { q: "One 'unit' in this game is…", o: ["One weighted check-in", "One hour", "One rep"], a: 0 },
  { q: "A dragon helm needs which tier here?", o: ["Hitpoints 60", "Hitpoints 40", "Any"], a: 0 },
  { q: "Who repairs the worst building?", o: ["Freaky Forester", "Prison Pete", "Quiz Master"], a: 0 },
  { q: "Prison Pete hands out…", o: ["Two lamps", "A pet", "Coins"], a: 0 },
  { q: "The Genie lamp in RS gives XP up to…", o: ["990", "5,000", "100"], a: 0 },
  { q: "Which is the deepest tier this game has?", o: ["Rune", "Dragon", "Third-age"], a: 1 },
];

// ── Tiers ──────────────────────────────────────────────────────────

/**
 * A player's tier is the full armour set their Defence level can wear —
 * the game's own requirements: bronze and iron at 1 (so everyone starts in
 * iron), steel 5, black 10,
 * mithril 20, adamant 30, rune 40, dragon 60. Attack picks the scimitar
 * the same way (combat.ts). The Rune (t), (g) and (or) sets are clue
 * rewards, not levels, so they are cosmetics in the collection log.
 */
export interface Tier {
  key: string;
  name: string;
  /** Defence level the set needs. */
  level: number;
  title?: string;
  haul: number;
}

export const TIERS: Tier[] = [
  { key: "bronze", name: "Bronze", level: 1, title: "Recruit", haul: 1 },
  { key: "iron", name: "Iron", level: 1, haul: 1 },
  { key: "steel", name: "Steel", level: 5, haul: 1 },
  { key: "black", name: "Black", level: 10, haul: 1 },
  { key: "mithril", name: "Mithril", level: 20, title: "Regular", haul: 1 },
  { key: "adamant", name: "Adamant", level: 30, title: "Veteran", haul: 1.25 },
  { key: "rune", name: "Rune", level: 40, title: "Champion", haul: 1.5 },
  { key: "dragon", name: "Dragon", level: 60, title: "Dragon Slayer", haul: 2 },
];

/** Worker slots = 1 + floor(combat level / this). */
export const WORKER_SLOT_PER_COMBAT = 25;

// ── Town ───────────────────────────────────────────────────────────

export type ResourceKey = "coins" | "ore" | "logs" | "fish" | "bars";
export const RESOURCES: ResourceKey[] = ["coins", "ore", "logs", "fish", "bars"];

/** Every check-in delivers this, × weight × tier haul multiplier. */
export const BASE_HAUL: Partial<Record<ResourceKey, number>> = { coins: 20, logs: 10 };

/** Quiet day: fewer check-ins than ceil(this × A) costs every store 1%. */
export const QUIET_DAY_FRACTION = 0.25;
export const QUIET_DAY_DECAY = 0.01;

export const SACK_CAP_HOURS = 96;
export const WORKER_FISH_PER_DAY = 6;
export const UNFED_RATE = 0.5;
export const BUILDING_DECAY_PER_DAY = 3;
export const REPAIR_LOGS_PER_POINT = 2;
export const QUITTER_WORKER_RATE = 0.5;

export type WorkerKind = "miner" | "woodcutter" | "fisher" | "merchant";
export const WORKER_KINDS: WorkerKind[] = ["miner", "woodcutter", "fisher", "merchant"];
export const WORKER_RESOURCE: Record<WorkerKind, ResourceKey> = {
  miner: "ore",
  woodcutter: "logs",
  fisher: "fish",
  merchant: "coins",
};
export const WORKER_SKILL: Partial<Record<WorkerKind, SkillKey>> = {
  miner: "mining",
  woodcutter: "woodcutting",
  fisher: "fishing",
};

export interface WorkerTier {
  key: string;
  name: string;
  rate: number;
  cost: Partial<Record<ResourceKey, number>>;
  /** Furnace level needed, if any. */
  furnace?: number;
  /** Owner must be at least this tier. */
  ownerTier?: string;
}

export const WORKER_TIERS: WorkerTier[] = [
  { key: "bronze", name: "Bronze", rate: 2, cost: {} },
  { key: "iron", name: "Iron", rate: 3, cost: { coins: 150, ore: 20 } },
  { key: "steel", name: "Steel", rate: 4, cost: { coins: 250, ore: 40 } },
  { key: "black", name: "Black", rate: 5, cost: { coins: 400, ore: 60, logs: 20 } },
  { key: "mithril", name: "Mithril", rate: 7, cost: { coins: 700, ore: 100, logs: 40 } },
  { key: "adamant", name: "Adamant", rate: 9, cost: { coins: 1200, ore: 160, logs: 80 } },
  { key: "rune", name: "Rune", rate: 12, cost: { coins: 2000, ore: 250, logs: 120, bars: 20 }, furnace: 2 },
  { key: "dragon", name: "Dragon", rate: 16, cost: { coins: 3500, ore: 400, logs: 200, bars: 50 }, furnace: 3, ownerTier: "dragon" },
];

/** Each further recruit costs this × workers already owned, in coins. */
export const RECRUIT_COST_PER_OWNED = 300;

// ── Clue scrolls ───────────────────────────────────────────────────

export const CLUE_CHANCE = 12;

export interface ClueTier {
  key: string;
  name: string;
  /** Combat level of the monster that drops it, as the game does. */
  combat: number;
  steps: number;
  /** The antique lamp inside. */
  xp: number;
  coins: number;
  /** One in this many caskets holds a unique. */
  uniqueChance: number;
  uniques: string[];
  verifiedSteps: number;
}

export const CLUE_TIERS: ClueTier[] = [
  { key: "easy", name: "Easy", combat: 1, steps: 2, xp: ANTIQUE_LAMP.easy, coins: 100, uniqueChance: 3, verifiedSteps: 0,
    uniques: ["Bob shirt (red)", "Bob shirt (blue)", "Bob shirt (green)", "Highwayman mask", "Team cape", "Wooden shield (g)"] },
  { key: "medium", name: "Medium", combat: 40, steps: 3, xp: ANTIQUE_LAMP.medium, coins: 200, uniqueChance: 4, verifiedSteps: 0,
    uniques: ["Ranger boots", "Wizard boots", "Black cavalier", "Cat mask", "Amulet of glory (t)", "Rune helm (h1)"] },
  { key: "hard", name: "Hard", combat: 80, steps: 4, xp: ANTIQUE_LAMP.hard, coins: 400, uniqueChance: 5, verifiedSteps: 1,
    uniques: ["Robin hood hat", "Rune (g) set", "Rune (t) set", "Zamorak cloak", "Saradomin cloak"] },
  { key: "elite", name: "Elite", combat: 120, steps: 5, xp: ANTIQUE_LAMP.elite, coins: 700, uniqueChance: 6, verifiedSteps: 1,
    uniques: ["Dragon full helm ornament", "Gilded scimitar", "Third-age amulet", "Ring of coins"] },
  { key: "master", name: "Master", combat: 180, steps: 6, xp: ANTIQUE_LAMP.elite, coins: 1000, uniqueChance: 8, verifiedSteps: 2,
    uniques: ["Third-age full helm", "Third-age cloak", "Bloodhound"] },
];

export type ClueStepKey =
  | "verified_photo"
  | "verified_video"
  | "weekend"
  | "monday"
  | "early"
  | "late"
  | "two_in_a_row"
  | "with_two_others"
  | "deliver_200"
  | "long_note"
  | "verify_someone"
  | "raid_checkin"
  | "task_complete"
  | "full_sack";

/** `from` is the act a step becomes drawable in: sacks need the town (Act 2), raids Act 3. */
export const CLUE_STEPS: { key: ClueStepKey; label: string; verified: boolean; from?: number }[] = [
  { key: "verified_photo", label: "a check-in with a verified photo", verified: true },
  { key: "verified_video", label: "a check-in with a verified video", verified: true },
  { key: "weekend", label: "a weekend check-in", verified: false },
  { key: "monday", label: "a Monday check-in", verified: false },
  { key: "early", label: "a check-in before 8am", verified: false },
  { key: "late", label: "a check-in after 8pm", verified: false },
  { key: "two_in_a_row", label: "two days in a row", verified: false },
  { key: "with_two_others", label: "a check-in on the same day as two others", verified: false },
  { key: "deliver_200", label: "deliver 200+ resources in one check-in", verified: false, from: 2 },
  { key: "long_note", label: "a check-in with a note of 20+ words", verified: false },
  { key: "verify_someone", label: "verify somebody else's check-in", verified: false },
  { key: "raid_checkin", label: "a check-in during a raid week", verified: false, from: 3 },
  { key: "task_complete", label: "a check-in that completes a Slayer task", verified: false },
  { key: "full_sack", label: "a check-in while holding a full sack", verified: false, from: 2 },
];

// ── Collection log ─────────────────────────────────────────────────

export const LOG_TOTAL = 90;
export const LOG_COLLECTOR_AT = 30;
export const LOG_GOLEM_AT = 60;

// ── Campaign ───────────────────────────────────────────────────────

export const ACT_WEEKS = 13;
export const ACTS = [
  { number: 1, name: "Lumbridge" },
  { number: 2, name: "Varrock" },
  { number: 3, name: "The Wilderness" },
  { number: 4, name: "Dragon Slayer" },
];
export const FOUNDING_LAMP_XP = ANTIQUE_LAMP.hard;
export const FOUNDING_FORM_WEEKS = 6;

/**
 * Dated beats. `week` is the campaign week (1-based); `post` is what the
 * morning post carries that Monday; `effect` keys are read by the code that
 * cares (events.ts for the Halloween swap, and so on).
 */
export const CAMPAIGN_EVENTS: { week: number; key: string; post: string; effect?: string }[] = [
  { week: 1, key: "launch", post: "The campaign begins. Two a week is the whole game. Every check-in this fortnight is worth double Hitpoints." },
  { week: 2, key: "off_the_island", post: "Off the Island: anyone with two check-ins this week earns the Steel title and the first bingo card." },
  { week: 7, key: "halloween", post: "Halloween week. The Grim Reaper is standing in for the Genie, and the Evil Chicken is out in force.", effect: "halloween" },
  { week: 8, key: "restless_ghost", post: "The Restless Ghost: sixty check-ins across the roster this week unlocks the Chapel early." },
  { week: 11, key: "thanksgiving", post: "Thanksgiving week. The Sandwich Lady is everywhere.", effect: "sandwich" },
  { week: 13, key: "founding_1", post: "Founding I. The camp becomes a town. Every active player gets a free Bronze worker." },
  { week: 14, key: "act_2", post: "Act 2 — Varrock. Workers unlock. The first build vote is open." },
  { week: 15, key: "christmas", post: "Christmas week. The Drunken Dwarf is having a party; a Ring for anyone in form both holiday weeks.", effect: "dwarf" },
  { week: 18, key: "champions_guild", post: "Champions' Guild: Rune players get their title on the board." },
  { week: 22, key: "valentines", post: "Valentine's week: verifying a friend pays 50 Slayer.", effect: "valentines" },
  { week: 26, key: "founding_2", post: "Founding II. Barracks and Walls blueprints unlock." },
  { week: 27, key: "act_3", post: "Act 3 — The Wilderness. First relic vote. The Giant Mole has been sighted." },
  { week: 28, key: "easter", post: "Easter week: the Evil Chicken has laid an egg. A Ring for a Sunday check-in.", effect: "easter" },
  { week: 39, key: "founding_3", post: "Founding III." },
  { week: 40, key: "act_4", post: "Act 4 — Dragon Slayer. Second relic vote. Dragon workers unlock." },
  { week: 42, key: "independence", post: "Independence week: the Beekeeper is in town all week.", effect: "beekeeper" },
  { week: 44, key: "oziach", post: "Oziach is handing out capes to anyone at Dragon." },
  { week: 48, key: "finale_vote", post: "The finale build vote: the Dragon Statue." },
  { week: 50, key: "elvarg", post: "Elvarg. Fourteen days." },
  { week: 52, key: "finale", post: "The finale. Year standings, carved names, and Founding IV." },
];

// ── Shop ───────────────────────────────────────────────────────────

export const SHOP: { key: string; name: string; points: number }[] = [
  { key: "small_lamp", name: "Antique lamp (2,500 XP)", points: 15 },
  { key: "title", name: "A title", points: 25 },
  { key: "trim", name: "Sheet trim skin", points: 30 },
  { key: "worker_name", name: "Name or skin a worker", points: 10 },
  { key: "crate", name: "Town crate (500 coins)", points: 20 },
  { key: "pet", name: "Pet on the sheet", points: 50 },
  { key: "act_cape", name: "Act cape", points: 60 },
];

/** Discord's hard cap on a message. Everything the bot writes stays under it. */
export const MAX_NOTE_LENGTH = 200;
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// ── Buildings ──────────────────────────────────────────────────────

export type BuildingKey =
  | "town_hall"
  | "bank"
  | "furnace"
  | "dock"
  | "mill"
  | "cart"
  | "chapel"
  | "tavern"
  | "barracks"
  | "walls"
  | "statue";

export interface Building {
  key: BuildingKey;
  name: string;
  /** Level 1 cost. Level 2 is 2.5×, level 3 is 6×. */
  cost: Partial<Record<ResourceKey, number>>;
  /** Act the blueprint arrives in. */
  from: number;
  /** One line for the vote card. */
  effect: string;
  maxLevel: number;
}

export const BUILDINGS: Building[] = [
  { key: "town_hall", name: "Town Hall", cost: {}, from: 2, effect: "Level = Foundings so far; caps every other building", maxLevel: 4 },
  { key: "bank", name: "Bank", cost: { logs: 150, coins: 200 }, from: 2, effect: "Sacks fill for 24h longer per level", maxLevel: 3 },
  { key: "furnace", name: "Furnace", cost: { logs: 200, coins: 300 }, from: 2, effect: "Smelts ore into bars; L2 unlocks Rune workers, L3 Dragon", maxLevel: 3 },
  { key: "dock", name: "Fishing Dock", cost: { logs: 150, coins: 200, ore: 50 }, from: 2, effect: "Fish +25% per level", maxLevel: 3 },
  { key: "mill", name: "Lumber Mill", cost: { logs: 150, coins: 200, ore: 50 }, from: 2, effect: "Logs +25% per level", maxLevel: 3 },
  { key: "cart", name: "Mine Cart", cost: { logs: 150, coins: 200, ore: 50 }, from: 2, effect: "Ore +25% per level", maxLevel: 3 },
  { key: "chapel", name: "Chapel", cost: { logs: 200, coins: 300 }, from: 2, effect: "A gilded altar: the bones from your kills pay 250%, then 300%, then 350%", maxLevel: 3 },
  { key: "tavern", name: "Tavern", cost: { logs: 250, coins: 400 }, from: 2, effect: "Random events 1 in 6 → 1 in 5 → 1 in 4", maxLevel: 2 },
  { key: "barracks", name: "Barracks", cost: { logs: 300, coins: 600, ore: 100 }, from: 3, effect: "Raid damage +10% per level", maxLevel: 3 },
  { key: "walls", name: "Walls", cost: { logs: 300, coins: 600, ore: 100 }, from: 3, effect: "Raid heals −5 per miss per level", maxLevel: 3 },
  { key: "statue", name: "Dragon Statue", cost: { logs: 900, coins: 2000, bars: 100 }, from: 4, effect: "The finale; +10% everything, forever", maxLevel: 1 },
];

export const BUILDING_LEVEL_COST_MULTIPLIER = [1, 2.5, 6, 12];
/** Condition below this halves the bonus; at zero it is gone. */
export const BUILDING_HALF_AT = 50;
export const BANK_HOURS_PER_LEVEL = 24;
export const GATHER_BUILDING_BONUS = 0.25;
export const TAVERN_EVENT_CHANCE = [6, 5, 4];
export const BARRACKS_DAMAGE_PER_LEVEL = 0.1;
export const WALLS_HEAL_REDUCTION_PER_LEVEL = 5;
export const STATUE_BONUS = 0.1;
export const FOUNDING_OUTPUT_BONUS = 0.1;
/** Delivered ore smelted at the Furnace: this fraction, five to a bar. */
export const SMELT_FRACTION = 0.2;
export const ORE_PER_BAR = 5;
export const QUITTER_SILENT_DAYS = 21;

// ── Relics ─────────────────────────────────────────────────────────

export type RelicKey =
  | "xerics_endurance"
  | "trickster"
  | "fire_sale"
  | "production_master"
  | "last_recall"
  | "berserker"
  | "treasure_seeker"
  | "golden_god";

export const RELICS: { key: RelicKey; name: string; effect: string }[] = [
  { key: "xerics_endurance", name: "Xeric’s Endurance", effect: "The 3rd and 4th check-ins of the week weigh 0.75 instead of 0.5" },
  { key: "trickster", name: "Trickster", effect: "Random events four points likelier" },
  { key: "fire_sale", name: "Fire Sale", effect: "Worker upgrades cost 25% less" },
  { key: "production_master", name: "Production Master", effect: "Worker output +20%" },
  { key: "last_recall", name: "Last Recall", effect: "Ring cap +1, and a Ring every Form week" },
  { key: "berserker", name: "Berserker", effect: "Raid damage +25%" },
  { key: "treasure_seeker", name: "Treasure Seeker", effect: "Lamps worth 1.5×" },
  { key: "golden_god", name: "Golden God", effect: "Every check-in hauls +20 coins" },
];

export const XERIC_WEIGHT = 0.75;
export const TRICKSTER_POINTS = 4;
export const FIRE_SALE_DISCOUNT = 0.25;
export const PRODUCTION_MASTER_BONUS = 0.2;
export const BERSERKER_BONUS = 0.25;
export const TREASURE_SEEKER_MULTIPLIER = 1.5;
export const GOLDEN_GOD_COINS = 20;

// ── Votes ──────────────────────────────────────────────────────────

export const VOTE_HOURS: Record<string, number> = { relic: 72, build: 48, raid: 48, finale: 72 };
export const VOTE_MIN_QUORUM = 2;
export const BUILD_VOTE_OPTIONS = 4;
/** A raid needs this share of the active roster saying yes, and at least this many. */
export const RAID_YES_FRACTION = 0.6;
export const RAID_MIN_YES = 3;
export const RAID_PROPOSAL_COOLDOWN_DAYS = 7;

// ── Raids ──────────────────────────────────────────────────────────

export const RAID_DAYS = 7;
export const RAID_COOLDOWN_WEEKS = 2;
/**
 * Boss Hitpoints = roster × this × the roster's mean full-session damage,
 * × the boss multiplier: everybody doing exactly their two falls 17% short,
 * and a couple of third sessions carry it. Damage is the session's own.
 */
export const RAID_HP_UNITS_PER_HEAD = 2.4;
export const RAID_HEAL_PER_MISS = 20;
export const RAID_HEAL_CAP_PER_DAY = 80;
export const RAID_SUCCESS_LAMP_XP = ANTIQUE_LAMP.hard;
export const RAID_SUCCESS_COINS = 1000;
export const RAID_SUCCESS_BARS = 200;
export const RAID_FAIL_STORE_LOSS = 0.15;
export const RAID_FAIL_CONDITION_LOSS = 20;
export const RAID_LOCK_AFTER_FAILURES = 3;
export const RAID_LOCK_WEEKS = 4;

export const BOSSES: { key: string; name: string; hp: number; days: number; healMultiplier: number; from: number }[] = [
  { key: "giant_mole", name: "Giant Mole", hp: 0.8, days: 7, healMultiplier: 1, from: 3 },
  { key: "kbd", name: "King Black Dragon", hp: 1, days: 7, healMultiplier: 1, from: 3 },
  { key: "kalphite_queen", name: "Kalphite Queen", hp: 1, days: 7, healMultiplier: 1, from: 3 },
  { key: "chaos_elemental", name: "Chaos Elemental", hp: 1, days: 7, healMultiplier: 1, from: 3 },
  { key: "corporeal_beast", name: "Corporeal Beast", hp: 1.2, days: 7, healMultiplier: 1, from: 3 },
  { key: "elvarg", name: "Elvarg", hp: 2, days: 14, healMultiplier: 0.5, from: 4 },
];

// ── Bingo ──────────────────────────────────────────────────────────

/** Points for a completed line and for the whole grid. */
export const BINGO_LINE_POINTS = 5;
export const BINGO_BLACKOUT_POINTS = 40;
/** When every active player has a line, the town gets this many coins. */
export const BINGO_GROUP_CRATE = 500;

/**
 * Twenty-five task keys per act, row-major. The checks live in bingo.ts;
 * every cell is claimed by the game from check-in data — there is no
 * self-claim. Acts 2–4 swap in worker, raid and Dragon cells.
 */
export const BINGO_GRIDS: Record<number, string[]> = {
  1: [
    "first_checkin", "two_in_week", "verified_checkin", "early_checkin", "reach_mithril",
    "note", "saturday", "verify_3", "two_in_a_row", "form_3",
    "late_checkin", "rub_lamp", "checkins_10", "sunday", "same_day_3",
    "monday", "reach_adamant", "verify_video", "two_verified_week", "four_weekdays",
    "note_pr", "quiz_win", "skill_30", "form_6", "reach_rune",
  ],
  2: [
    "recruit_worker", "worker_black", "deliver_500_week", "repair_building", "build_something",
    "checkins_25", "verified_checkin", "form_4", "early_checkin", "sunday",
    "note", "two_in_a_row", "rub_lamp", "same_day_3", "monday",
    "verify_3", "skill_40", "reach_rune", "worker_mithril", "sacks_10",
    "four_weekdays", "late_checkin", "quiz_win", "verify_video", "cast_ballot",
  ],
  3: [
    "raid_damage_1000", "raid_checkin_verified", "raid_survivor", "raid_win", "checkins_50",
    "verified_checkin", "form_6", "two_in_a_row", "rub_lamp", "same_day_3",
    "worker_rune", "deliver_500_week", "repair_building", "build_something", "cast_ballot",
    "monday", "sunday", "early_checkin", "late_checkin", "note",
    "verify_3", "four_weekdays", "skill_50", "reach_rune_g", "quiz_win",
  ],
  4: [
    "worker_dragon", "hp_55", "checkins_100", "reach_dragon", "raid_win",
    "verified_checkin", "form_8", "two_in_a_row", "rub_lamp", "same_day_3",
    "deliver_500_week", "repair_building", "build_something", "cast_ballot", "monday",
    "sunday", "early_checkin", "late_checkin", "note", "verify_3",
    "four_weekdays", "skill_60", "quiz_win", "verify_video", "casket",
  ],
};

// ── Shop choices ───────────────────────────────────────────────────

export const SHOP_TITLES = ["of Lumbridge", "the Relentless", "Ironman", "of the Wilderness", "the Early Riser"];
export const SHOP_TRIMS = ["gold", "silver", "obsidian", "third-age"];
export const SHOP_PETS = ["Baby Mole", "Chompy chick"];
export const WORKER_NAMES = ["Bob", "Hans", "Zeke", "Gertrude", "Wise Old Man", "Doric", "Duke Horacio", "Aggie", "Father Aereck", "Cook"];

// ── Slayer tasks ───────────────────────────────────────────────────

/**
 * The masters, their assignment tables, the monsters and the amounts all
 * come from config/osrs.json (scripts/fetch-osrs.mjs pulls them from the
 * wiki). What is left here is the reward shop: the same prices as the game.
 */

/** The Nth task in a row pays a multiple: the 10th 5×, the 50th 15×, the 100th 25×. */
export const SLAYER_STREAK_BONUS = [
  { every: 10, multiplier: 5 },
  { every: 50, multiplier: 15 },
  { every: 100, multiplier: 25 },
];
export const SLAYER_SKIP_COST = 30;
/** 100 points buys 10,000 Slayer experience. */
export const SLAYER_XP_COST = 100;
export const SLAYER_XP_BOUGHT = 10000;
/** The Slayer helmet (Malevolent masquerade), 400 points. */
export const SLAYER_HELMET_COST = 400;

// ── Drops ─────────────────────────────────────────────────────────
// Real drop tables from the wiki (config/drops.json), rolled once per kill.
// A notable drop is announced in the thread and logged. The expanded tables
// carry dozens of rows between 1/128 and 1/1,000 (herbs, gems, seeds), which
// at 1/128 came to a notable drop every other check-in in the year simulation;
// 1/1,024 keeps it to the rare drop table and the real uniques.
export const NOTABLE_RARITY_DENOMINATOR = 1024;  // a drop at 1/1,024 or rarer
export const NOTABLE_VALUE = 50_000;             // ...or one worth this much gp
export const RARE_TOASTS_PER_POST = 3;            // channel toasts one check-in or pick may post
export const LOOT_CARD_CELLS = 13;               // plus one "+N more" cell = two rows of seven
export const BANK_VIEW_ROWS = 15;
/** The game's reading of the wiki's named rarity bands (only a handful of rows use them). */
export const NAMED_RARITY: Record<string, number> = { Common: 1 / 16, Uncommon: 1 / 64, Rare: 1 / 256, "Very rare": 1 / 2048 };

// ── Spoils ────────────────────────────────────────────────────────
// Every check-in ends with a pick of up to three: the player's own roll (a
// jar or a chest), today's featured container, and a sure thing. The loot
// inside a container is the wiki's (config/spoils.json, fetch-osrs.mjs
// --spoils). Which tier a container sits on, and how often a tier comes up,
// are the game's own, like the session length.

export type SpoilsTierKey = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

export const SPOILS_TIERS: { key: SpoilsTierKey; name: string; weight: number }[] = [
  { key: "common", name: "Common", weight: 600 },
  { key: "uncommon", name: "Uncommon", weight: 270 },
  { key: "rare", name: "Rare", weight: 100 },
  { key: "very_rare", name: "Very rare", weight: 25 },
  { key: "legendary", name: "Legendary", weight: 5 },
];

/** `page` is the wiki page the loot table is read from; `icon` the item whose sprite stands for it. */
export const SPOILS_CONTAINERS: { key: string; name: string; page: string; icon: string; tier: SpoilsTierKey }[] = [
  { key: "baby_impling_jar", name: "Baby impling jar", page: "Baby impling jar", icon: "Baby impling jar", tier: "common" },
  { key: "young_impling_jar", name: "Young impling jar", page: "Young impling jar", icon: "Young impling jar", tier: "common" },
  { key: "gourmet_impling_jar", name: "Gourmet impling jar", page: "Gourmet impling jar", icon: "Gourmet impling jar", tier: "common" },
  { key: "casket", name: "Casket", page: "Casket", icon: "Casket", tier: "common" },
  { key: "earth_impling_jar", name: "Earth impling jar", page: "Earth impling jar", icon: "Earth impling jar", tier: "common" },
  { key: "essence_impling_jar", name: "Essence impling jar", page: "Essence impling jar", icon: "Essence impling jar", tier: "uncommon" },
  { key: "eclectic_impling_jar", name: "Eclectic impling jar", page: "Eclectic impling jar", icon: "Eclectic impling jar", tier: "uncommon" },
  { key: "nature_impling_jar", name: "Nature impling jar", page: "Nature impling jar", icon: "Nature impling jar", tier: "uncommon" },
  { key: "muddy_key", name: "Muddy chest", page: "Muddy chest", icon: "Muddy key", tier: "rare" },
  { key: "magpie_impling_jar", name: "Magpie impling jar", page: "Magpie impling jar", icon: "Magpie impling jar", tier: "rare" },
  { key: "crystal_key", name: "Crystal chest", page: "Crystal chest", icon: "Crystal key", tier: "rare" },
  { key: "grubby_key", name: "Grubby chest", page: "Grubby chest", icon: "Grubby key", tier: "very_rare" },
  { key: "ninja_impling_jar", name: "Ninja impling jar", page: "Ninja impling jar", icon: "Ninja impling jar", tier: "very_rare" },
  { key: "enhanced_crystal_key", name: "Elven crystal chest", page: "Elven crystal chest", icon: "Enhanced crystal key", tier: "very_rare" },
  { key: "brimstone_key", name: "Brimstone chest", page: "Brimstone chest", icon: "Brimstone key", tier: "legendary" },
  { key: "larrans_key", name: "Larran's big chest", page: "Larran's big chest", icon: "Larran's key", tier: "legendary" },
  { key: "dragon_impling_jar", name: "Dragon impling jar", page: "Dragon impling jar", icon: "Dragon impling jar", tier: "legendary" },
];

/** This many full-value check-ins without a rare container on offer, and the next one is rare or better. */
export const SPOILS_PITY = 8;
/** The week's chest: the second check-in rolls its tier this many times and keeps the best. */
export const SPOILS_WEEK_CHEST_ROLLS = 2;
/** A Form streak this long adds one more roll to the week's chest. */
export const SPOILS_FORM_WEEKS_BONUS = 4;
/** Past the second check-in of the week the roll stops here, and today's container is not on offer. */
export const SPOILS_SLIM_CAP: SpoilsTierKey = "uncommon";
/** Today's featured container is drawn from these tiers. */
export const SPOILS_FEATURED_TIERS: SpoilsTierKey[] = ["uncommon", "rare"];
/** The Book of knowledge (Surprise Exam): fifteen times the level of the skill it is read into. */
export const BOOK_XP_PER_LEVEL = 15;
/** A supply crate for the camp: this much of one resource, by the tier of the roll beside it. */
export const SUPPLY_CRATE: Record<SpoilsTierKey, number> = { common: 60, uncommon: 100, rare: 160, very_rare: 250, legendary: 400 };
/** Clue bottles, nests and geodes: the clue tier a sure-thing clue comes at, by the tier of the roll beside it. */
export const SPOILS_CLUE_TIER: Record<SpoilsTierKey, string> = { common: "easy", uncommon: "easy", rare: "medium", very_rare: "hard", legendary: "elite" };

// ── The Grand Exchange ────────────────────────────────────────────
// The bank is spendable. Prices are the GE's at fetch time (spoils.json).

export interface GeItem {
  key: string;
  /** The wiki's item name, which is also the price lookup. */
  item: string;
  /** How many one purchase is. */
  qty: number;
  kind: "potion" | "food" | "bones";
  blurb: string;
  /** A potion's boost: the wiki's flat part and fraction of the level, to these skills. */
  boost?: { skills: ("attack" | "strength" | "defence")[]; flat: number; fraction: number };
  /** What one of this food heals. */
  heal?: number;
  /** Prayer experience per bone buried. */
  xp?: number;
}

const ALL_MELEE: ("attack" | "strength" | "defence")[] = ["attack", "strength", "defence"];

/** The wiki's numbers: Strength potion +3 and 10%, the supers +5 and 15%; swordfish heals 14, shark 20; big bones 15 XP, dragon bones 72. */
export const GE_ITEMS: GeItem[] = [
  { key: "strength_potion4", item: "Strength potion(4)", qty: 1, kind: "potion", blurb: "Strength +3 and 10% next session", boost: { skills: ["strength"], flat: 3, fraction: 0.1 } },
  { key: "super_strength4", item: "Super strength(4)", qty: 1, kind: "potion", blurb: "Strength +5 and 15% next session", boost: { skills: ["strength"], flat: 5, fraction: 0.15 } },
  { key: "super_combat_potion4", item: "Super combat potion(4)", qty: 1, kind: "potion", blurb: "Attack, Strength and Defence +5 and 15% next session", boost: { skills: ALL_MELEE, flat: 5, fraction: 0.15 } },
  { key: "swordfish", item: "Swordfish", qty: 27, kind: "food", blurb: "An inventory that heals 14 a bite, not 12, next session", heal: 14 },
  { key: "shark", item: "Shark", qty: 27, kind: "food", blurb: "An inventory that heals 20 a bite next session", heal: 20 },
  { key: "big_bones", item: "Big bones", qty: 25, kind: "bones", blurb: "15 Prayer XP each, more at the Chapel's altar", xp: 15 },
  { key: "dragon_bones", item: "Dragon bones", qty: 10, kind: "bones", blurb: "72 Prayer XP each, more at the Chapel's altar", xp: 72 },
];

/** A potion drains a level a minute and has four doses, sipped evenly across the session. */
export const POTION_DOSES = 4;
/** A game tick is 0.6 seconds. */
export const TICK_SECONDS = 0.6;

// ── Achievement Diary ─────────────────────────────────────────────
// Four tiers of tasks, each paying the diary's own antique lamp
// (2,500 / 7,500 / 15,000 / 50,000). The checks live in diary.ts.

export type DiaryStat =
  | "checkins"
  | "kills"
  | "tasks"
  | "bank"
  | "combat"
  | "total"
  | "spoils"
  | "containers"
  | "form"
  | "verified"
  | "caskets"
  | "spent";

export interface DiaryTier {
  key: "easy" | "medium" | "hard" | "elite";
  name: string;
  lamp: number;
  tasks: { stat: DiaryStat; goal: number; label: string }[];
}

export const DIARY: DiaryTier[] = [
  {
    key: "easy", name: "Easy", lamp: ANTIQUE_LAMP.easy,
    tasks: [
      { stat: "checkins", goal: 5, label: "Check in 5 times" },
      { stat: "kills", goal: 100, label: "Kill 100 monsters" },
      { stat: "tasks", goal: 1, label: "Finish a Slayer task" },
      { stat: "spoils", goal: 3, label: "Open 3 spoils" },
      { stat: "bank", goal: 10_000, label: "Bank 10k gp of loot" },
      { stat: "combat", goal: 10, label: "Reach combat level 10" },
    ],
  },
  {
    key: "medium", name: "Medium", lamp: ANTIQUE_LAMP.medium,
    tasks: [
      { stat: "checkins", goal: 25, label: "Check in 25 times" },
      { stat: "kills", goal: 1_000, label: "Kill 1,000 monsters" },
      { stat: "tasks", goal: 5, label: "Finish 5 Slayer tasks" },
      { stat: "containers", goal: 5, label: "Open 5 different containers" },
      { stat: "bank", goal: 100_000, label: "Bank 100k gp of loot" },
      { stat: "combat", goal: 30, label: "Reach combat level 30" },
      { stat: "form", goal: 4, label: "Hold a 4-week Form streak" },
      { stat: "verified", goal: 3, label: "Verify 3 check-ins" },
    ],
  },
  {
    key: "hard", name: "Hard", lamp: ANTIQUE_LAMP.hard,
    tasks: [
      { stat: "checkins", goal: 60, label: "Check in 60 times" },
      { stat: "kills", goal: 5_000, label: "Kill 5,000 monsters" },
      { stat: "tasks", goal: 15, label: "Finish 15 Slayer tasks" },
      { stat: "containers", goal: 10, label: "Open 10 different containers" },
      { stat: "bank", goal: 500_000, label: "Bank 500k gp of loot" },
      { stat: "combat", goal: 50, label: "Reach combat level 50" },
      { stat: "form", goal: 10, label: "Hold a 10-week Form streak" },
      { stat: "caskets", goal: 1, label: "Open a clue casket" },
    ],
  },
  {
    key: "elite", name: "Elite", lamp: ANTIQUE_LAMP.elite,
    tasks: [
      { stat: "checkins", goal: 100, label: "Check in 100 times" },
      { stat: "kills", goal: 15_000, label: "Kill 15,000 monsters" },
      { stat: "tasks", goal: 30, label: "Finish 30 Slayer tasks" },
      { stat: "containers", goal: 15, label: "Open 15 different containers" },
      { stat: "bank", goal: 2_000_000, label: "Bank 2m gp of loot" },
      { stat: "combat", goal: 70, label: "Reach combat level 70" },
      { stat: "form", goal: 20, label: "Hold a 20-week Form streak" },
      { stat: "spent", goal: 250_000, label: "Spend 250k gp at the Grand Exchange" },
    ],
  },
];

// ── Quest of the week ─────────────────────────────────────────────
/** One quest a week for 51 weeks, easiest first; week 52 has none. Names are wiki page names. */
export const QUEST_CALENDAR: { week: number; quest: string }[] = [
  { week: 1, quest: "Cook's Assistant" },
  { week: 2, quest: "Sheep Shearer" },
  { week: 3, quest: "Rune Mysteries" },
  { week: 4, quest: "Imp Catcher" },
  { week: 5, quest: "Witch's Potion" },
  { week: 6, quest: "Doric's Quest" },
  { week: 7, quest: "Ernest the Chicken" },
  { week: 8, quest: "The Restless Ghost" },
  { week: 9, quest: "Goblin Diplomacy" },
  { week: 10, quest: "Pirate's Treasure" },
  { week: 11, quest: "Prince Ali Rescue" },
  { week: 12, quest: "Black Knights' Fortress" },
  { week: 13, quest: "The Knight's Sword" },
  { week: 14, quest: "Shield of Arrav" },
  { week: 15, quest: "Vampyre Slayer" },
  { week: 16, quest: "Demon Slayer" },
  { week: 17, quest: "Romeo & Juliet" },
  { week: 18, quest: "Druidic Ritual" },
  { week: 19, quest: "Witch's House" },
  { week: 20, quest: "Fishing Contest" },
  { week: 21, quest: "Priest in Peril" },
  { week: 22, quest: "Nature Spirit" },
  { week: 23, quest: "Waterfall Quest" },
  { week: 24, quest: "Tree Gnome Village" },
  { week: 25, quest: "Fight Arena" },
  { week: 26, quest: "Lost City" },
  { week: 27, quest: "Plague City" },
  { week: 28, quest: "Biohazard" },
  { week: 29, quest: "Death Plateau" },
  { week: 30, quest: "Troll Stronghold" },
  { week: 31, quest: "Merlin's Crystal" },
  { week: 32, quest: "Holy Grail" },
  { week: 33, quest: "Animal Magnetism" },
  { week: 34, quest: "The Grand Tree" },
  { week: 35, quest: "Horror from the Deep" },
  { week: 36, quest: "The Fremennik Trials" },
  { week: 37, quest: "Monkey Madness I" },
  { week: 38, quest: "Underground Pass" },
  { week: 39, quest: "Regicide" },
  { week: 40, quest: "Desert Treasure I" },
  { week: 41, quest: "Legends' Quest" },
  { week: 42, quest: "Heroes' Quest" },
  { week: 43, quest: "Recipe for Disaster" },
  { week: 44, quest: "Lunar Diplomacy" },
  { week: 45, quest: "Dream Mentor" },
  { week: 46, quest: "Grim Tales" },
  { week: 47, quest: "Swan Song" },
  { week: 48, quest: "Monkey Madness II" },
  { week: 49, quest: "Song of the Elves" },
  { week: 50, quest: "Dragon Slayer I" },
  { week: 51, quest: "Dragon Slayer II" },
];
/**
 * A quest mini-fight per check-in: three quarters of a session's swings
 * against the current enemy's real stats. Each enemy's pool is its hitpoints × how many the quest
 * kills, shared by the whole party. The pace check in test-xp.mjs pins this:
 * every quest but the Grandmasters must fall to a party of four at two a
 * week; the Grandmasters (Monkey Madness II, Song of the Elves, Dragon Slayer
 * II) want six.
 */
export const QUEST_FIGHT_ATTACKS = 450;
export const QUEST_PROOF_SUPPLIES = 2;       // a check-in with a note or photo carries two supplies
export const QUEST_LAMP: Record<string, number> = { Novice: ANTIQUE_LAMP.easy, Intermediate: ANTIQUE_LAMP.medium, Experienced: ANTIQUE_LAMP.hard, Master: ANTIQUE_LAMP.hard, Grandmaster: ANTIQUE_LAMP.hard, Special: ANTIQUE_LAMP.hard };
export const CHAMPIONS_GUILD_QP = 32;

// ── Gear ──────────────────────────────────────────────────────────
// What the Slayer monsters really drop that can be worn. An item with `stats`
// counts in the session (bonuses from config/gear.json, the wiki's); the rest
// are looks, worn over the armour, and trophies. Requirements are the game's.
// Owned means it is in the bank, or (for clue uniques) in the collection log.

export type GearSlot = "weapon" | "head" | "cape" | "neck" | "body" | "legs" | "shield" | "gloves" | "boots" | "ring" | "trophy";
export const GEAR_SLOTS: GearSlot[] = ["weapon", "head", "cape", "neck", "body", "legs", "shield", "gloves", "boots", "ring", "trophy"];

export interface GearItem {
  /** The wiki's item name; the key is itemKey(item). */
  item: string;
  slot: GearSlot;
  /** Counts in the session. Without it the item is a look. */
  stats?: boolean;
  req?: Partial<Record<"attack" | "strength" | "defence" | "slayer", number>>;
  /** Owned through the collection log (`clue:<item>`) rather than the bank. */
  clue?: boolean;
}

export const GEAR: GearItem[] = [
  // Weapons, with the game's requirements.
  { item: "Brine sabre", slot: "weapon", stats: true, req: { attack: 40 } },
  { item: "Leaf-bladed sword", slot: "weapon", stats: true, req: { attack: 50, slayer: 55 } },
  { item: "Granite maul", slot: "weapon", stats: true, req: { attack: 50, strength: 50 } },
  { item: "Granite longsword", slot: "weapon", stats: true, req: { attack: 50, strength: 50 } },
  { item: "Dragon dagger", slot: "weapon", stats: true, req: { attack: 60 } },
  { item: "Dragon mace", slot: "weapon", stats: true, req: { attack: 60 } },
  { item: "Leaf-bladed battleaxe", slot: "weapon", stats: true, req: { attack: 65, slayer: 55 } },
  { item: "Abyssal whip", slot: "weapon", stats: true, req: { attack: 70 } },
  { item: "Abyssal dagger", slot: "weapon", stats: true, req: { attack: 70 } },
  // The boss of the week's own weapon.
  { item: "Hill giant club", slot: "weapon", stats: true, req: { attack: 40 } },
  // Boots: the one slot the armour sets leave empty.
  { item: "Bronze boots", slot: "boots", stats: true },
  { item: "Iron boots", slot: "boots", stats: true },
  { item: "Steel boots", slot: "boots", stats: true, req: { defence: 5 } },
  { item: "Black boots", slot: "boots", stats: true, req: { defence: 10 } },
  { item: "Mithril boots", slot: "boots", stats: true, req: { defence: 20 } },
  { item: "Adamant boots", slot: "boots", stats: true, req: { defence: 30 } },
  { item: "Rune boots", slot: "boots", stats: true, req: { defence: 40 } },
  { item: "Granite boots", slot: "boots", stats: true, req: { defence: 50, strength: 50 } },
  // The black mask: the Slayer helmet's bonus, from a drop.
  { item: "Black mask (10)", slot: "head", stats: true, req: { defence: 10 } },
  // Looks from the task monsters.
  { item: "Mystic hat (light)", slot: "head" },
  { item: "Mystic robe top (light)", slot: "body" },
  { item: "Mystic robe bottom (light)", slot: "legs" },
  { item: "Mystic gloves (light)", slot: "gloves" },
  { item: "Mystic boots (light)", slot: "boots" },
  { item: "Mystic robe top (dark)", slot: "body" },
  { item: "Mystic robe bottom (dark)", slot: "legs" },
  { item: "Mystic gloves (dark)", slot: "gloves" },
  { item: "Black robe", slot: "body" },
  { item: "Red d'hide body", slot: "body" },
  { item: "Dragon chainbody", slot: "body" },
  { item: "Dragon platelegs", slot: "legs" },
  { item: "Dragon plateskirt", slot: "legs" },
  { item: "Granite legs", slot: "legs" },
  { item: "Rune platelegs", slot: "legs" },
  { item: "Granite helm", slot: "head" },
  { item: "Dragon med helm", slot: "head" },
  { item: "Rune full helm", slot: "head" },
  { item: "Red gloves", slot: "gloves" },
  { item: "Purple gloves", slot: "gloves" },
  { item: "Teal gloves", slot: "gloves" },
  { item: "Yellow gloves", slot: "gloves" },
  { item: "Black d'hide vambraces", slot: "gloves" },
  { item: "Red d'hide vambraces", slot: "gloves" },
  { item: "Blue d'hide vambraces", slot: "gloves" },
  { item: "Flippers", slot: "boots" },
  { item: "Red cape", slot: "cape" },
  { item: "Rune kiteshield", slot: "shield" },
  { item: "Occult necklace", slot: "neck" },
  { item: "Dark bow", slot: "weapon" },
  { item: "Dust battlestaff", slot: "weapon" },
  { item: "Mist battlestaff", slot: "weapon" },
  { item: "Dragon spear", slot: "weapon" },
  // Trophies.
  { item: "Cockatrice head", slot: "trophy" },
  { item: "Basilisk head", slot: "trophy" },
  { item: "Kurask head", slot: "trophy" },
  { item: "Abyssal head", slot: "trophy" },
  { item: "Draconic visage", slot: "trophy" },
  { item: "Scurrius' spine", slot: "trophy" },
  { item: "Bryophyta's essence", slot: "trophy" },
  { item: "Scurry", slot: "trophy" },
  { item: "Goblin champion scroll", slot: "trophy" },
  { item: "Skeleton champion scroll", slot: "trophy" },
  { item: "Zombie champion scroll", slot: "trophy" },
  { item: "Giant champion scroll", slot: "trophy" },
  { item: "Hobgoblin champion scroll", slot: "trophy" },
  { item: "Ghoul champion scroll", slot: "trophy" },
  { item: "Lesser demon champion scroll", slot: "trophy" },
  // The clue uniques, worn at last.
  { item: "Highwayman mask", slot: "head", clue: true },
  { item: "Black cavalier", slot: "head", clue: true },
  { item: "Cat mask", slot: "head", clue: true },
  { item: "Robin hood hat", slot: "head", clue: true },
  { item: "Rune helm (h1)", slot: "head", clue: true },
  { item: "Dragon full helm ornament", slot: "head", clue: true },
  { item: "Third-age full helm", slot: "head", clue: true },
  { item: "Bob shirt (red)", slot: "body", clue: true },
  { item: "Bob shirt (blue)", slot: "body", clue: true },
  { item: "Bob shirt (green)", slot: "body", clue: true },
  { item: "Rune (g) set", slot: "body", clue: true },
  { item: "Rune (t) set", slot: "body", clue: true },
  { item: "Team cape", slot: "cape", clue: true },
  { item: "Zamorak cloak", slot: "cape", clue: true },
  { item: "Saradomin cloak", slot: "cape", clue: true },
  { item: "Third-age cloak", slot: "cape", clue: true },
  { item: "Ranger boots", slot: "boots", clue: true },
  { item: "Wizard boots", slot: "boots", clue: true },
  { item: "Wooden shield (g)", slot: "shield", clue: true },
  { item: "Gilded scimitar", slot: "weapon", clue: true },
  { item: "Third-age amulet", slot: "neck", clue: true },
  { item: "Ring of coins", slot: "ring", clue: true },
];

/**
 * The drop tables, adapted: a wearable drop falls at this many times the
 * wiki's rate (a player here gets two sessions a week, not two hours a
 * night), and the one item a player is chasing at this many times that.
 * At 2× the year simulation gave a two-a-week player two or three pieces in
 * a year; 4× gives a wardrobe worth having.
 */
export const GEAR_RATE_MULTIPLIER = 4;
export const WISHLIST_RATE_MULTIPLIER = 2;

// ── Slayer choices ────────────────────────────────────────────────
/** Blocking a task costs 100 points, as in the game. One slot, and one more for every 50 quest points the group holds, up to six. */
export const SLAYER_BLOCK_COST = 100;
export const SLAYER_BLOCK_QP_PER_SLOT = 50;
export const SLAYER_BLOCK_MAX = 6;

// ── Managing Miscellania ──────────────────────────────────────────
// The wiki's kingdom at a tenth of its size: the coffer pays 10% of what it
// holds each day up to the cap, approval falls 2.5% a day to a floor of 25%,
// and ten subjects split across the jobs bring in a share of the real daily
// maxima (61 herbs, 440 tuna and 132 swordfish, 546 coal, 892 maple logs,
// 1,250 flax — each at the real 75,000 a day).

export const KINGDOM_SCALE = 10;
export const KINGDOM_SUBJECTS = 10;
export const KINGDOM_DAILY_RATE = 0.1;
export const KINGDOM_DAILY_CAP = 75_000 / KINGDOM_SCALE;
export const KINGDOM_COFFER_MAX = 7_500_000 / KINGDOM_SCALE;
export const KINGDOM_APPROVAL_DECAY = 2.5;
export const KINGDOM_APPROVAL_FLOOR = 25;
/** A full-value check-in is a day's good works: this much approval, scaled by the check-in's weight. */
export const KINGDOM_CHECKIN_APPROVAL = 10;
/** A kingdom nobody has looked at for this long stops working, as in the game. */
export const KINGDOM_IDLE_DAYS = 30;

export type KingdomJob = "herbs" | "fishing" | "mining" | "wood" | "flax";
export const KINGDOM_JOBS: { key: KingdomJob; name: string; yields: { item: string; max: number; weight?: number }[] }[] = [
  {
    key: "herbs", name: "Herbs",
    // 61 a day between them; the wiki lists dwarf weed and lantadyme as the uncommon ones.
    yields: [
      { item: "Grimy tarromin", max: 61, weight: 2 },
      { item: "Grimy harralander", max: 61, weight: 2 },
      { item: "Grimy ranarr weed", max: 61, weight: 2 },
      { item: "Grimy irit leaf", max: 61, weight: 2 },
      { item: "Grimy avantoe", max: 61, weight: 2 },
      { item: "Grimy kwuarm", max: 61, weight: 2 },
      { item: "Grimy cadantine", max: 61, weight: 2 },
      { item: "Grimy lantadyme", max: 61, weight: 1 },
      { item: "Grimy dwarf weed", max: 61, weight: 1 },
    ],
  },
  { key: "fishing", name: "Fishing", yields: [{ item: "Raw tuna", max: 440 }, { item: "Raw swordfish", max: 132 }] },
  { key: "mining", name: "Mining", yields: [{ item: "Coal", max: 546 }] },
  { key: "wood", name: "Wood", yields: [{ item: "Maple logs", max: 892 }] },
  { key: "flax", name: "Flax", yields: [{ item: "Flax", max: 1250 }] },
];

// ── Farming ───────────────────────────────────────────────────────
// Levels, experience and growth times are the wiki's. Three patches, one run
// a day; nothing dies.

export type PatchKey = "allotment" | "herb" | "tree";
export const PATCHES: { key: PatchKey; name: string; seeds: number }[] = [
  { key: "allotment", name: "Allotment", seeds: 3 },
  { key: "herb", name: "Herb patch", seeds: 1 },
  { key: "tree", name: "Tree patch", seeds: 1 },
];

export interface Crop {
  seed: string;
  /** What is harvested; a tree is only checked. */
  produce: string | null;
  patch: PatchKey;
  level: number;
  plantXp: number;
  /** Per item harvested, or for checking a tree's health. */
  harvestXp: number;
  minutes: number;
}

export const CROPS: Crop[] = [
  { seed: "Potato seed", produce: "Potato", patch: "allotment", level: 1, plantXp: 8, harvestXp: 9, minutes: 40 },
  { seed: "Onion seed", produce: "Onion", patch: "allotment", level: 5, plantXp: 9.5, harvestXp: 10.5, minutes: 40 },
  { seed: "Cabbage seed", produce: "Cabbage", patch: "allotment", level: 7, plantXp: 10, harvestXp: 11.5, minutes: 40 },
  { seed: "Tomato seed", produce: "Tomato", patch: "allotment", level: 12, plantXp: 12.5, harvestXp: 14, minutes: 40 },
  { seed: "Sweetcorn seed", produce: "Sweetcorn", patch: "allotment", level: 20, plantXp: 17, harvestXp: 19, minutes: 60 },
  { seed: "Strawberry seed", produce: "Strawberry", patch: "allotment", level: 31, plantXp: 26, harvestXp: 29, minutes: 60 },
  { seed: "Watermelon seed", produce: "Watermelon", patch: "allotment", level: 47, plantXp: 48.5, harvestXp: 54.5, minutes: 80 },
  { seed: "Snape grass seed", produce: "Snape grass", patch: "allotment", level: 61, plantXp: 82, harvestXp: 82, minutes: 70 },
  { seed: "Marrentill seed", produce: "Grimy marrentill", patch: "herb", level: 14, plantXp: 13.5, harvestXp: 15, minutes: 80 },
  { seed: "Tarromin seed", produce: "Grimy tarromin", patch: "herb", level: 19, plantXp: 16, harvestXp: 18, minutes: 80 },
  { seed: "Harralander seed", produce: "Grimy harralander", patch: "herb", level: 26, plantXp: 21.5, harvestXp: 24, minutes: 80 },
  { seed: "Ranarr seed", produce: "Grimy ranarr weed", patch: "herb", level: 32, plantXp: 27, harvestXp: 30.5, minutes: 80 },
  { seed: "Toadflax seed", produce: "Grimy toadflax", patch: "herb", level: 38, plantXp: 34, harvestXp: 38.5, minutes: 80 },
  { seed: "Irit seed", produce: "Grimy irit leaf", patch: "herb", level: 44, plantXp: 43, harvestXp: 48.5, minutes: 80 },
  { seed: "Avantoe seed", produce: "Grimy avantoe", patch: "herb", level: 50, plantXp: 54.5, harvestXp: 61.5, minutes: 80 },
  { seed: "Kwuarm seed", produce: "Grimy kwuarm", patch: "herb", level: 56, plantXp: 69, harvestXp: 78, minutes: 80 },
  { seed: "Snapdragon seed", produce: "Grimy snapdragon", patch: "herb", level: 62, plantXp: 87.5, harvestXp: 98.5, minutes: 80 },
  { seed: "Cadantine seed", produce: "Grimy cadantine", patch: "herb", level: 67, plantXp: 106.5, harvestXp: 120, minutes: 80 },
  { seed: "Lantadyme seed", produce: "Grimy lantadyme", patch: "herb", level: 73, plantXp: 134.5, harvestXp: 151.5, minutes: 80 },
  { seed: "Dwarf weed seed", produce: "Grimy dwarf weed", patch: "herb", level: 79, plantXp: 170.5, harvestXp: 192, minutes: 80 },
  { seed: "Torstol seed", produce: "Grimy torstol", patch: "herb", level: 85, plantXp: 199.5, harvestXp: 224.5, minutes: 80 },
  { seed: "Willow seed", produce: null, patch: "tree", level: 30, plantXp: 25, harvestXp: 1456.5, minutes: 280 },
  { seed: "Maple seed", produce: null, patch: "tree", level: 45, plantXp: 45, harvestXp: 3403.4, minutes: 320 },
  { seed: "Yew seed", produce: null, patch: "tree", level: 60, plantXp: 81, harvestXp: 7069.9, minutes: 400 },
  { seed: "Magic seed", produce: null, patch: "tree", level: 75, plantXp: 145.5, harvestXp: 13768.3, minutes: 480 },
];

/** What a patch gives back: a herb seed 4 to 9 leaves, an allotment 6 to 14. The game's own range, standing in for the wiki's harvest lives. */
export const HARVEST_RANGE: Record<PatchKey, [number, number]> = { allotment: [6, 14], herb: [4, 9], tree: [0, 0] };
/** The seed anyone can always plant: Draynor's potato seeds cost next to nothing. */
export const FREE_SEED = "Potato seed";

// ── Tears of Guthix ───────────────────────────────────────────────
// Once a week. A tear is worth 60 experience in the lowest skill, less below
// level 30 (10 at level 1), as in the game; the time in the cave, and so the
// tears, grow with quest points — here the group's.
export const TEAR_XP_MAX = 60;
export const TEAR_XP_MIN = 10;
export const TEAR_FULL_LEVEL = 30;
/** Tears caught per quest point: between these, seeded on the player and the week. */
export const TEARS_PER_QP: [number, number] = [0.6, 0.9];
/** Even a party with no quest points catches a few. */
export const TEARS_MIN = 5;

/** Everything bought, grown or gathered that needs a GE price in config/spoils.json. */
export const PRICED_ITEMS: string[] = [
  ...new Set([
    ...GE_ITEMS.map((item) => item.item),
    ...KINGDOM_JOBS.flatMap((job) => job.yields.map((y) => y.item)),
    ...CROPS.flatMap((crop) => [crop.seed, ...(crop.produce ? [crop.produce] : [])]),
  ]),
];

// ── The boss of the week ──────────────────────────────────────────
// The game's early group bosses, one a week in rotation, from the first week:
// every check-in takes a swing at it after the session, the damage is the
// group's, and every kill rolls the boss's real drop table for whoever
// landed it. Stats and tables are the wiki's (config/bosses.json).

/** `chest` is the lair chest opened after each kill, whose table holds the boss's unique. */
export const GROUP_BOSSES: { key: string; page: string; chest?: string; name: string; emoji: string }[] = [
  { key: "scurrius", page: "Scurrius", name: "Scurrius", emoji: "🐀" },
  { key: "obor", page: "Obor", chest: "Chest (Obor's lair)", name: "Obor", emoji: "👹" },
  { key: "bryophyta", page: "Bryophyta", chest: "Chest (Bryophyta's lair)", name: "Bryophyta", emoji: "🌿" },
];
/** Swings at the boss per full-value check-in, after the session. */
export const BOSS_FIGHT_ATTACKS = 200;
/** The boss's pool: this many average full fights a head. Two a week from most of the roster clears it. */
export const BOSS_FIGHTS_PER_HEAD = 1.6;
/** When the boss falls, everyone who fought that week gets this many more rolls of its table. */
export const BOSS_CHEST_KILLS = 1;
