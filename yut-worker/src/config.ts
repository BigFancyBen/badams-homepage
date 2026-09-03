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
  | "fishing";

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
];

export const SKILL_LABEL: Record<SkillKey, string> = Object.fromEntries(
  choices.skills.map((s) => [s.value, s.name])
) as Record<SkillKey, string>;

export function isSkill(key: string): key is SkillKey {
  return (SKILLS as string[]).includes(key);
}

/**
 * RuneScape's experience table, exactly — level 99 is 13,034,431 XP and every
 * unlock sits at its RuneScape level. Awards are sized so a check-in is worth
 * about two thousand, which puts a two-a-week player at Dragon (Hitpoints
 * 60, 273,742 XP) by the finale. 99 is unreachable by design.
 */
export const XP_DIVISOR = 1;
export const LEVEL_CAP = 99;

/** Hitpoints per check-in, before the weight. */
export const HP_XP = 2000;
/** Combat XP per check-in, before the weight, split by combat style. */
export const COMBAT_XP = 2000;

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

/** Where a check-in's combat XP goes. Controlled splits it three ways. */
export const STYLE_SPLIT: Record<CombatStyle, Partial<Record<SkillKey, number>>> = {
  accurate: { attack: 1 },
  aggressive: { strength: 1 },
  defensive: { defence: 1 },
  controlled: { attack: 1 / 3, strength: 1 / 3, defence: 1 / 3 },
};

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
export const VERIFIED_AUTHOR_SLAYER = 1000;
/** Combat XP multiplier once a check-in is verified. */
export const VERIFIED_MULTIPLIER = 1.5;
/** Slayer for pressing Verify, paid on the verifier's own next check-in. */
export const VERIFIER_SLAYER = 250;
/** Extra Slayer to the author for each verification past the first, up to this many. */
export const EXTRA_VERIFICATION_SLAYER = 100;
export const MAX_COUNTED_VERIFICATIONS = 3;
/** How long the Verify button stays live. */
export const VERIFY_WINDOW_HOURS = 72;
/** How long a verifier's pending Slayer waits for their own check-in. */
export const VERIFIER_PAY_WINDOW_DAYS = 7;
/** How many verifications one person can be paid for in a day. */
export const VERIFIER_DAILY_CAP = 3;

/** Prayer for a Form week, and the bonus for three or more that week. */
export const PRAYER_FORM_WEEK = 1500;
export const PRAYER_THREE_PLUS_BONUS = 1000;

/** Gathering XP per resource delivered, and the cap per check-in. */
export const GATHER_XP_PER_UNIT = 2;
export const GATHER_XP_CAP = 1500;

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

/** Weeks 1-2: every check-in is worth double Hitpoints. */
export const BOOTSTRAP_WEEKS = 2;
export const BOOTSTRAP_HP_MULTIPLIER = 2;
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
export const RECOVERY_LAMP_XP = 5000;

// ── Lamps ──────────────────────────────────────────────────────────

/** A genie lamp is 100 × the chosen skill's level, clamped. */
export const LAMP_PER_LEVEL = 100;
export const LAMP_MIN = 1000;
export const LAMP_MAX = 6000;
/** Unrubbed lamps go into Hitpoints after this long. */
export const LAMP_AUTO_RUB_DAYS = 14;

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

export const EVIL_CHICKEN_DEFENCE = 1500;
export const SANDWICH_LADY_HP = 1500;
export const OLD_MAN_RESOURCE = 150;
export const DRUNKEN_DWARF_COINS = 200;
export const QUIZ_RIGHT_XP = 2000;
export const QUIZ_WRONG_COINS = 50;
export const FORESTER_REPAIR = 30;
export const BEEKEEPER_HOURS = 24;
export const BEEKEEPER_BONUS = 0.25;
export const DRILL_DEMON_DAYS = 3;
export const DRILL_DEMON_LAMP = 4000;

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

export interface Tier {
  key: string;
  name: string;
  /** Hitpoints level the tier starts at. */
  hp: number;
  title?: string;
  haul: number;
}

export const TIERS: Tier[] = [
  { key: "bronze", name: "Bronze", hp: 1, title: "Recruit", haul: 1 },
  { key: "iron", name: "Iron", hp: 2, haul: 1 },
  { key: "steel", name: "Steel", hp: 5, haul: 1 },
  { key: "black", name: "Black", hp: 10, haul: 1 },
  { key: "mithril", name: "Mithril", hp: 20, title: "Regular", haul: 1 },
  { key: "adamant", name: "Adamant", hp: 30, title: "Veteran", haul: 1 },
  { key: "rune", name: "Rune", hp: 40, title: "Champion", haul: 1 },
  { key: "rune_t", name: "Rune (t)", hp: 45, haul: 1.25 },
  { key: "rune_g", name: "Rune (g)", hp: 50, title: "Elite", haul: 1.25 },
  { key: "rune_or", name: "Rune (or)", hp: 55, haul: 1.5 },
  { key: "dragon", name: "Dragon", hp: 60, title: "Dragon Slayer", haul: 2 },
];

/** Worker slots = 1 + floor(HP / this). */
export const WORKER_SLOT_PER_HP = 15;

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

// ── Rivalries ──────────────────────────────────────────────────────

export const RIVALRY_FROM_WEEK = 3;
export const RIVALRY_MIN_ROSTER = 4;
export const RIVALRY_RECENCY_WEEKS = 3;
export const RIVALRY_LAMP_PER_HP = 100;
export const RIVALRY_LAMP_MIN = 1500;
export const RIVALRY_LAMP_MAX = 4000;
/** A tie only counts as a shared win at or above this many units. */
export const RIVALRY_TIE_FLOOR = 2.0;
export const DUELLIST_WINS = 3;

// ── Clue scrolls ───────────────────────────────────────────────────

export const CLUE_CHANCE = 12;

export interface ClueTier {
  key: string;
  name: string;
  /** Hitpoints level the tier starts at. */
  hp: number;
  steps: number;
  xp: number;
  coins: number;
  /** One in this many caskets holds a unique. */
  uniqueChance: number;
  uniques: string[];
  verifiedSteps: number;
}

export const CLUE_TIERS: ClueTier[] = [
  { key: "easy", name: "Easy", hp: 1, steps: 2, xp: 1500, coins: 100, uniqueChance: 3, verifiedSteps: 0,
    uniques: ["Bob shirt (red)", "Bob shirt (blue)", "Bob shirt (green)", "Highwayman mask", "Team cape", "Wooden shield (g)"] },
  { key: "medium", name: "Medium", hp: 20, steps: 3, xp: 3000, coins: 200, uniqueChance: 4, verifiedSteps: 0,
    uniques: ["Ranger boots", "Wizard boots", "Black cavalier", "Cat mask", "Amulet of glory (t)", "Rune helm (h1)"] },
  { key: "hard", name: "Hard", hp: 40, steps: 4, xp: 4500, coins: 400, uniqueChance: 5, verifiedSteps: 1,
    uniques: ["Robin hood hat", "Rune (g) set", "Rune (t) set", "Zamorak cloak", "Saradomin cloak"] },
  { key: "elite", name: "Elite", hp: 55, steps: 5, xp: 6000, coins: 700, uniqueChance: 6, verifiedSteps: 1,
    uniques: ["Dragon full helm ornament", "Gilded scimitar", "Third-age amulet", "Ring of coins"] },
  { key: "master", name: "Master", hp: 60, steps: 6, xp: 8000, coins: 1000, uniqueChance: 8, verifiedSteps: 2,
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
  | "after_rivalry_loss"
  | "full_sack";

/**
 * `from` is the act a step becomes drawable in. The three that need workers
 * or raids sit at 99 until those ship — a step nobody can complete would
 * make a trail that never opens.
 */
export const CLUE_STEPS: { key: ClueStepKey; label: string; verified: boolean; from?: number }[] = [
  { key: "verified_photo", label: "a check-in with a verified photo", verified: true },
  { key: "verified_video", label: "a check-in with a verified video", verified: true },
  { key: "weekend", label: "a weekend check-in", verified: false },
  { key: "monday", label: "a Monday check-in", verified: false },
  { key: "early", label: "a check-in before 8am", verified: false },
  { key: "late", label: "a check-in after 8pm", verified: false },
  { key: "two_in_a_row", label: "two days in a row", verified: false },
  { key: "with_two_others", label: "a check-in on the same day as two others", verified: false },
  { key: "deliver_200", label: "deliver 200+ resources in one check-in", verified: false, from: 99 },
  { key: "long_note", label: "a check-in with a note of 20+ words", verified: false },
  { key: "verify_someone", label: "verify somebody else's check-in", verified: false },
  { key: "raid_checkin", label: "a check-in during a raid week", verified: false, from: 99 },
  { key: "after_rivalry_loss", label: "a check-in the day after losing a rivalry", verified: false },
  { key: "full_sack", label: "a check-in while holding a full sack", verified: false, from: 99 },
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
export const FOUNDING_LAMP_XP = 5000;
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
  { key: "small_lamp", name: "Small lamp (2,000 XP)", points: 15 },
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
  { key: "chapel", name: "Chapel", cost: { logs: 200, coins: 300 }, from: 2, effect: "Prayer +500 per Form week per level", maxLevel: 3 },
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
export const CHAPEL_PRAYER_PER_LEVEL = 500;
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
export const RAID_HP_UNITS_PER_HEAD = 2.4;
export const RAID_DAMAGE_BASE = 100;
export const RAID_DAMAGE_PER_HP = 2;
export const RAID_HEAL_PER_MISS = 20;
export const RAID_HEAL_CAP_PER_DAY = 80;
export const RAID_SUCCESS_LAMP_PER_HP = 100;
export const RAID_SUCCESS_LAMP_MIN = 2000;
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
