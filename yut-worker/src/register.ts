import choices from "../config/choices.json" with { type: "json" };
import { BUILDINGS, EXPEDITION_MAX_WEEKS, EXPEDITION_MIN_WEEKS, GEAR_SLOTS, KINGDOM_JOBS, KINGDOM_SUBJECTS, MAX_NOTE_LENGTH } from "./config.ts";
import { MASTERS } from "./combat.ts";

const BUILDING_CHOICES = BUILDINGS.filter((b) => b.key !== "town_hall").map((b) => ({ name: b.name, value: b.key }));

/**
 * The slash commands, as Discord wants them. Registered per guild with a PUT,
 * which replaces the whole list — so this file is the list. Run
 * `npm run register` after editing it, or hit /admin/register-commands.
 *
 * Option types: 1 subcommand, 3 string, 4 integer, 5 boolean, 6 user,
 * 11 attachment.
 */
export const COMMANDS = [
  {
    name: "checkin",
    description: "Check in with a note or a photo. The morning post's Yes button does it without either.",
    options: [
      { type: 3, name: "note", description: "One line, optional", max_length: MAX_NOTE_LENGTH },
      { type: 11, name: "photo", description: "Proof. Unlocks peer verification; can be added after a Yes" },
    ],
  },
  { name: "play", description: "The hub: lamps, clues, the camp, your sheet" },
  {
    name: "sheet",
    description: "Your stats sheet",
    options: [
      { type: 6, name: "player", description: "Somebody else's" },
      { type: 5, name: "public", description: "Post it to the channel" },
    ],
  },
  {
    name: "join",
    description: "Join the campaign",
    options: [
      {
        type: 3,
        name: "ping",
        description: "Ping me on the morning post and Sunday's last call",
        choices: [
          { name: "on", value: "on" },
          { name: "off", value: "off" },
        ],
      },
    ],
  },
  { name: "leave", description: "Retire from the campaign. Your sheet is kept" },
  {
    name: "expedition",
    description: "Pause without breaking your streak",
    options: [
      {
        type: 4,
        name: "weeks",
        description: `${EXPEDITION_MIN_WEEKS}-${EXPEDITION_MAX_WEEKS}`,
        required: true,
        min_value: EXPEDITION_MIN_WEEKS,
        max_value: EXPEDITION_MAX_WEEKS,
      },
    ],
  },
  {
    name: "pings",
    description: "Whether the morning post and last call ping you",
    options: [
      {
        type: 3,
        name: "mode",
        description: "on or off",
        required: true,
        choices: [
          { name: "on", value: "on" },
          { name: "off", value: "off" },
        ],
      },
    ],
  },
  {
    name: "style",
    description: "Where your check-ins' combat XP goes",
    options: [
      { type: 3, name: "style", description: "Combat style", required: true, choices: choices.styles },
    ],
  },
  { name: "lamp", description: "Rub a lamp" },
  { name: "clue", description: "Your clue scroll" },
  { name: "log", description: "Your collection log" },
  { name: "bank", description: "Your bank: what your kills have dropped, by value" },
  { name: "spoils", description: "Your check-in's pick of three, today's container, and the jars and chests you have opened" },
  { name: "ge", description: "The Grand Exchange: spend your bank on potions, food and bones" },
  { name: "diary", description: "Your Achievement Diary: four tiers of tasks, a lamp for each" },
  {
    name: "gear",
    description: "What you wear: gear and looks from Slayer drops and clue caskets",
    options: [
      { type: 1, name: "view", description: "Your gear and wardrobe" },
      {
        type: 1,
        name: "wear",
        description: "Wear something you own, or take it off",
        options: [{ type: 3, name: "item", description: "Its name, or part of it", required: true }],
      },
      {
        type: 1,
        name: "chase",
        description: "Chase one item: its drop rate is doubled for you",
        options: [{ type: 3, name: "item", description: "Its name, or part of it", required: true }],
      },
      {
        type: 1,
        name: "catalogue",
        description: "Everything there is to wear, and where it drops",
        options: [
          {
            type: 3,
            name: "slot",
            description: "One slot, with drop sources",
            choices: GEAR_SLOTS.map((slot) => ({ name: slot, value: slot })),
          },
        ],
      },
      { type: 1, name: "show", description: "Post your gear card to the channel" },
    ],
  },
  { name: "farm", description: "Your farm: three patches, one run a day" },
  {
    name: "kingdom",
    description: "Managing Miscellania: your subjects, the coffer, and what they have gathered",
    options: [
      { type: 1, name: "status", description: "Approval, the coffer, and what is waiting" },
      { type: 1, name: "collect", description: "Bank what your subjects have gathered" },
      {
        type: 1,
        name: "assign",
        description: `Split your ${KINGDOM_SUBJECTS} subjects across the jobs`,
        options: KINGDOM_JOBS.map((job) => ({ type: 4, name: job.key, description: `Subjects on ${job.name.toLowerCase()}`, min_value: 0, max_value: KINGDOM_SUBJECTS })),
      },
      {
        type: 1,
        name: "fund",
        description: "Put coins from your bank in the coffer",
        options: [{ type: 4, name: "gp", description: "How many coins", required: true, min_value: 1 }],
      },
      {
        type: 1,
        name: "withdraw",
        description: "Take coins back out of the coffer",
        options: [{ type: 4, name: "gp", description: "How many coins", required: true, min_value: 1 }],
      },
    ],
  },
  { name: "tears", description: "Tears of Guthix: once a week, XP in your lowest skill" },
  { name: "boss", description: "The boss of the week: the group's shared fight" },
  { name: "todo", description: "What is waiting on you. Only you see it" },
  {
    name: "quest",
    description: "The quest of the week",
    options: [
      { type: 1, name: "status", description: "This week's quest and how far the party has got" },
      { type: 1, name: "log", description: "Every quest so far and the group's quest points" },
    ],
  },
  { name: "town", description: "The town: stores, buildings, your workers" },
  {
    name: "recruit",
    description: "Recruit a worker (fresh players only)",
    options: [
      {
        type: 3,
        name: "kind",
        description: "What it gathers",
        choices: [
          { name: "Miner (ore)", value: "miner" },
          { name: "Woodcutter (logs)", value: "woodcutter" },
          { name: "Fisher (fish)", value: "fisher" },
          { name: "Merchant (coins)", value: "merchant" },
        ],
      },
    ],
  },
  { name: "upgrade", description: "Upgrade one of your workers" },
  {
    name: "build",
    description: "Build or raise a building with the town's stores",
    options: [{ type: 3, name: "building", description: "Which", choices: BUILDING_CHOICES }],
  },
  {
    name: "repair",
    description: "Repair a building with logs",
    options: [{ type: 3, name: "building", description: "Which", choices: BUILDING_CHOICES }],
  },
  { name: "vote", description: "Open votes" },
  { name: "bingo", description: "Your bingo card for this act" },
  {
    name: "task",
    description: "Your Slayer task",
    options: [
      { type: 1, name: "status", description: "Your task and your Slayer points" },
      { type: 1, name: "skip", description: "Skip the task for 30 Slayer points" },
      { type: 1, name: "xp", description: "10,000 Slayer XP for 100 Slayer points" },
      { type: 1, name: "helmet", description: "The Slayer helmet (+16% on task) and the title Slayer Master, 400 points" },
      { type: 1, name: "block", description: "Block the current task for good, 100 Slayer points" },
      { type: 1, name: "unblock", description: "Clear your block list" },
      {
        type: 1,
        name: "master",
        description: "Choose which Slayer master assigns your tasks",
        options: [
          {
            type: 3,
            name: "name",
            description: "Any master you qualify for",
            required: true,
            choices: [{ name: "The best I qualify for", value: "best" }, ...MASTERS.map((master) => ({ name: `${master.name} (combat ${master.combat})`, value: master.key }))],
          },
        ],
      },
    ],
  },
  { name: "shop", description: "Spend bingo points" },
  { name: "relics", description: "The relics the group holds" },
  {
    name: "raid",
    description: "Raid weeks",
    options: [
      { type: 1, name: "status", description: "The current raid, or why none can start" },
      { type: 1, name: "propose", description: "Open a raid vote" },
      { type: 1, name: "sitout", description: "How to sit a raid out" },
    ],
  },
  { name: "freeze", description: "Your Rings of Life and how they work" },
  { name: "standings", description: "The roster by Hitpoints" },
  { name: "help", description: "Rules and commands" },
  {
    name: "admin",
    description: "Admin",
    default_member_permissions: "8",
    options: [
      { type: 1, name: "post-daily", description: "Post today's morning message now" },
      { type: 1, name: "resolve-day", description: "Run the daily resolution now" },
      { type: 1, name: "resolve-week", description: "Run last week's resolution now" },
      {
        type: 1,
        name: "grant",
        description: "Grant XP",
        options: [
          { type: 6, name: "player", description: "Who", required: true },
          { type: 3, name: "skill", description: "Skill", required: true, choices: choices.skills },
          { type: 4, name: "xp", description: "How much", required: true, min_value: 1 },
        ],
      },
      { type: 1, name: "roster", description: "Everybody, with status" },
    ],
  },
];
