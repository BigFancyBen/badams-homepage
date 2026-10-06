import { FRESH_WINDOW_DAYS } from "./config.ts";
import { countCheckinsBetween, getCheckinFor, isFresh, openClue, unspentLamps } from "./db.ts";
import { farmStatus } from "./farm.ts";
import { loadKingdom, pendingStacks } from "./kingdom.ts";
import { daysBetween, gameWeek } from "./schedule.ts";
import { waitingSpoils } from "./spoils.ts";
import { buttonRow, type Button, type Env, type Player } from "./types.ts";
import { ballotsFor, openVotes } from "./votes.ts";

/**
 * The menu. It leads with what keeps a player playing — today's check-in and
 * farm run, the week's Tears and votes — as buttons that are green while the
 * thing is still to do and greyed out once it is done (or locked, until a
 * check-in opens it). Everything else is one press deeper, behind You,
 * Adventure, Town & trade and Settings, so nobody has to type a command and
 * nobody is handed twenty buttons at once.
 */

/** Where a player's day and week stand: the things only they can do, and whether each is done. */
export interface PlayerStatus {
  fresh: boolean;
  checkedIn: boolean;
  /** Check-ins this game week, today's included. */
  weekCount: number;
  /** Days of the game week after today. */
  daysLeft: number;
  farm: "done" | "ready" | "growing";
  tearsDone: boolean;
  /** Items waiting in Miscellania. */
  kingdomItems: number;
  /** Open votes the player has not cast, by title. */
  votes: string[];
}

export async function playerStatus(env: Env, player: Player, day: string, now: number): Promise<PlayerStatus> {
  const id = player.discord_id;
  const week = gameWeek(day);
  const [checkin, weekCount, farm, kingdomItems, votes] = await Promise.all([
    getCheckinFor(env, id, day),
    countCheckinsBetween(env, id, week, day),
    farmStatus(env, player, day, now).catch(() => "growing" as const),
    loadKingdom(env, id, day)
      .then((kingdom) => pendingStacks(kingdom, `${id}:${kingdom.collected_day ?? "first"}`).reduce((sum, stack) => sum + stack.qty, 0))
      .catch(() => 0),
    openVotes(env)
      .then(async (open) => {
        if (open.length === 0) return [];
        const ballots = await ballotsFor(env, open.map((vote) => vote.id));
        return open.filter((vote) => !ballots.some((ballot) => ballot.vote_id === vote.id && ballot.player_id === id)).map((vote) => vote.title);
      })
      .catch(() => [] as string[]),
  ]);
  return {
    // A check-in today makes the player fresh, whatever the row handed in says.
    fresh: Boolean(checkin) || isFresh(player, day),
    checkedIn: Boolean(checkin),
    weekCount,
    daysLeft: 6 - daysBetween(week, day),
    farm,
    tearsDone: player.tears_week === week,
    kingdomItems,
    votes,
  };
}

function weekWords(status: PlayerStatus): string {
  if (status.weekCount >= 2) return `${status.weekCount} this week, your two are in`;
  const left = status.daysLeft > 0 ? `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left` : "the week closes at 3am";
  return `${status.weekCount} of 2 this week, ${left}`;
}

/** The day and the week as a checklist: what is open in bold, what is done struck through. */
export function nextLines(status: PlayerStatus): string[] {
  const done = (what: string, note = "") => `✅ ~~${what}~~${note ? ` — ${note}` : ""}`;
  const locked = status.fresh ? "" : " (opens with a check-in)";
  const lines = ["**Today**"];
  lines.push(
    status.checkedIn ? done("Check in", weekWords(status)) : `💪 **Check in** when you have worked out — ${weekWords(status)}`
  );
  lines.push(
    status.farm === "done"
      ? done("Farm run")
      : status.farm === "ready"
        ? `🌱 **Farm run** — ready now${locked}`
        : "🌱 Farm run — nothing has grown yet"
  );
  lines.push("**This week**");
  lines.push(status.tearsDone ? done("Tears of Guthix") : `💧 **Tears of Guthix** — XP in your lowest skill, once a week${locked}`);
  if (status.kingdomItems > 0) lines.push(`👑 **Miscellania** — ${status.kingdomItems.toLocaleString("en-US")} items to collect${locked}`);
  if (status.votes.length > 0) lines.push(`🗳️ **Vote** — ${status.votes.join("; ")}`);
  return lines;
}

/**
 * The same checklist as buttons. Done is greyed out; so are the farm and the
 * Tears for a player with no check-in in the last four days, since pressing
 * them would only say so.
 */
export function coreButtons(status: PlayerStatus, day: string): Button[] {
  const buttons: Button[] = [
    status.checkedIn
      ? { label: `Checked in (${Math.min(status.weekCount, 2)}/2)`, custom_id: "ci:done", emoji: "✅", disabled: true }
      : { label: "Check in", custom_id: `ci:${day}`, style: 3, emoji: "💪" },
    status.farm === "done"
      ? { label: "Farm done", custom_id: "farm:done", emoji: "✅", disabled: true }
      : status.farm === "ready"
        ? { label: "Farm run", custom_id: "farm:run", style: 3, emoji: "🌱", disabled: !status.fresh }
        : { label: "Farm (growing)", custom_id: "farm", emoji: "🌱" },
    status.tearsDone
      ? { label: "Tears done", custom_id: "tears:done", emoji: "✅", disabled: true }
      : { label: "Tears of Guthix", custom_id: "tears", style: 3, emoji: "💧", disabled: !status.fresh },
  ];
  if (status.kingdomItems > 0) buttons.push({ label: "Collect kingdom", custom_id: "kd:collect", style: 3, emoji: "👑", disabled: !status.fresh });
  if (status.votes.length > 0) buttons.push({ label: "Vote", custom_id: "vote", style: 3, emoji: "🗳️" });
  return buttons;
}

/**
 * What is waiting on the player, as buttons: lamps, a pick, a clue, proof for
 * today's check-in.
 */
export async function waitingButtons(env: Env, player: Player, day: string): Promise<Button[]> {
  const [lamps, clue, waiting, checkin] = await Promise.all([
    unspentLamps(env, player.discord_id),
    openClue(env, player.discord_id),
    waitingSpoils(env, player.discord_id),
    getCheckinFor(env, player.discord_id, day),
  ]);
  const buttons: Button[] = [];
  if (lamps.length > 0) buttons.push({ label: `Lamp (${lamps.length})`, custom_id: "lamp", style: 3, emoji: "🧞" });
  if (waiting.length > 0) buttons.push({ label: "Spoils", custom_id: "spoils", style: 3, emoji: "🎁" });
  if (clue) buttons.push({ label: "Clue", custom_id: "clue", emoji: "📜" });
  if (checkin && (!checkin.attachment_r2_key || !checkin.note)) {
    const label = checkin.attachment_r2_key ? "Add a note" : checkin.note ? "Add a photo" : "Add a note or photo";
    buttons.push({ label, custom_id: `cin:${day}`, emoji: checkin.attachment_r2_key ? "📝" : "📸" });
  }
  return buttons;
}

export const MENU_BUTTON: Button = { label: "Menu", custom_id: "hub", style: 2, emoji: "🏠" };

/** The way into everything that is not a daily or a weekly: one button a section. */
const SECTIONS: Button[] = [
  { label: "You", custom_id: "hub:me", emoji: "🧍" },
  { label: "Adventure", custom_id: "hub:adv", emoji: "⚔️" },
  { label: "Town & trade", custom_id: "hub:town", emoji: "🏘️" },
  { label: "Settings", custom_id: "hub:more", emoji: "⚙️" },
  { label: "Help", custom_id: "help", emoji: "❓" },
];

/** The sections themselves. Every command has a button in one of them (Settings is its own view). */
export const SUBMENUS: Record<string, { title: string; blurb: string; rows: Button[][] }> = {
  me: {
    title: "🧍 **You**",
    blurb: "Your sheet, what you wear, what you own and what you have done.",
    rows: [
      [
        { label: "Sheet", custom_id: "sheet", emoji: "📋" },
        { label: "Gear", custom_id: "gear", emoji: "🛡️" },
        { label: "Bank", custom_id: "bank", emoji: "💰" },
        { label: "Log", custom_id: "log", emoji: "📗" },
        { label: "Diary", custom_id: "diary", emoji: "📘" },
      ],
      [{ label: "My to-do", custom_id: "todo", emoji: "📋" }],
    ],
  },
  adv: {
    title: "⚔️ **Adventure**",
    blurb: "What your check-ins are fighting: your Slayer task, the week's boss and quest, raids and bingo.",
    rows: [
      [
        { label: "Task", custom_id: "task", emoji: "🗡️" },
        { label: "Boss", custom_id: "boss", emoji: "🐀" },
        { label: "Quest", custom_id: "quest", emoji: "🗺️" },
        { label: "Raid", custom_id: "raid", emoji: "🐉" },
        { label: "Bingo", custom_id: "bingo", emoji: "🎯" },
      ],
      [
        { label: "Clue", custom_id: "clue", emoji: "📜" },
        { label: "Spoils", custom_id: "spoils", emoji: "🎁" },
      ],
    ],
  },
  town: {
    title: "🏘️ **Town & trade**",
    blurb: "The group's town and its votes, and the places your bank gets spent.",
    rows: [
      [
        { label: "Town", custom_id: "town", emoji: "🏘️" },
        { label: "Votes", custom_id: "vote", emoji: "🗳️" },
        { label: "Standings", custom_id: "standings", emoji: "🏆" },
        { label: "Relics", custom_id: "relics", emoji: "🔮" },
      ],
      [
        { label: "Farm", custom_id: "farm", emoji: "🌱" },
        { label: "Kingdom", custom_id: "kd", emoji: "👑" },
        { label: "Exchange", custom_id: "ge", emoji: "⚖️" },
        { label: "Shop", custom_id: "shop", emoji: "🛒" },
      ],
    ],
  },
};

/** A section of the menu, with the way back on its last row. */
export function submenu(key: string): { content: string; components: unknown[] } | null {
  const section = SUBMENUS[key];
  if (!section) return null;
  const rows = section.rows.map((row, i) => (i === section.rows.length - 1 ? [...row, MENU_BUTTON] : row));
  return { content: `${section.title}\n${section.blurb}`, components: rows.map(buttonRow) };
}

/**
 * The menu as rows: what is waiting, the day's and week's checklist, then the
 * sections. `rows` is how many the message has room for (a receipt spends
 * some on the pick and the quiz); the sections are the last to go.
 */
export async function hubRows(
  env: Env,
  player: Player,
  day: string,
  rows = 5,
  without: string[] = [],
  status?: PlayerStatus
): Promise<unknown[]> {
  const waiting = (await waitingButtons(env, player, day)).filter((button) => !without.includes(button.custom_id));
  const core = coreButtons(status ?? (await playerStatus(env, player, day, Date.now())), day);
  const all = [...(waiting.length > 0 ? [waiting] : []), core, SECTIONS].map(buttonRow);
  return all.slice(Math.max(0, all.length - Math.max(1, rows)));
}

/** "Most of this needs a check-in in the last four days." */
export const STALE_LINE = `Most of this needs a check-in in the last ${FRESH_WINDOW_DAYS} days. Looking is free.`;
