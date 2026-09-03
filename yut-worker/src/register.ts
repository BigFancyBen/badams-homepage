import choices from "../config/choices.json" with { type: "json" };
import { BUILDINGS, EXPEDITION_MAX_WEEKS, EXPEDITION_MIN_WEEKS, MAX_NOTE_LENGTH } from "./config.ts";

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
