import choices from "../config/choices.json" with { type: "json" };
import { EXPEDITION_MAX_WEEKS, EXPEDITION_MIN_WEEKS, MAX_NOTE_LENGTH } from "./config.ts";

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
    description: "Log today's exercise. Any exercise counts.",
    options: [
      { type: 3, name: "note", description: "One line, optional", max_length: MAX_NOTE_LENGTH },
      { type: 11, name: "photo", description: "Proof. Unlocks peer verification" },
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
  { name: "town", description: "The camp's stores" },
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
