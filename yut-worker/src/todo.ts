import { LAMP_AUTO_RUB_DAYS, LAMP_REMINDER_DAYS, SHOP, SLAYER_BLOCK_COST, SLAYER_SKIP_COST } from "./config.ts";
import { levelsOf } from "./combat.ts";
import { countCheckinsBetween, getSkills, isFresh, openClaims, unspentLamps } from "./db.ts";
import { cropFor, isGrown, type PatchRow } from "./farm.ts";
import { geItem, loadoutOf } from "./ge.ts";
import { GEAR_DEFS, gearDef, meetsReq, ownedGear, wornOf } from "./gear.ts";
import { dailyWage, loadKingdom, pendingStacks } from "./kingdom.ts";
import { daysBetween, gameWeek } from "./schedule.ts";
import { waitingSpoils } from "./spoils.ts";
import type { Env, Player } from "./types.ts";
import { ballotsFor, openVotes } from "./votes.ts";
import { levelForXp } from "./xp.ts";

/**
 * A player's own to-do list: everything waiting on them, and the systems
 * they have not tried yet. It is only ever shown to the player — on the
 * reply to the morning question, on the hub, on the receipt, and behind the
 * morning post's "My to-do" button — because the channel does not need to
 * read it. Discord only lets a bot speak privately in answer to something
 * the person pressed, so the list rides on the buttons they already press.
 */

const SHOP_FLOOR = SHOP.find((item) => item.key === "small_lamp")?.points ?? Math.min(...SHOP.map((item) => item.points));

export interface TodoOptions {
  /** On a check-in's receipt: the spoils, the lamps and the week's count are already on it. */
  afterCheckin?: boolean;
}

export async function personalTodo(env: Env, player: Player, day: string, now: number, options: TodoOptions = {}): Promise<string[]> {
  const items: string[] = [];
  const id = player.discord_id;
  const fresh = isFresh(player, day);
  const week = gameWeek(day);

  if (!options.afterCheckin) {
    const done = await countCheckinsBetween(env, id, week, day);
    const daysLeft = 6 - daysBetween(week, day);
    if (done < 2) items.push(`${done} of 2 check-ins this week${daysLeft > 0 ? `, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ", and it closes at 3am"}.`);

    const lamps = await unspentLamps(env, id);
    if (lamps.length > 0) {
      const rubsIn = LAMP_AUTO_RUB_DAYS + 1 - daysBetween(lamps[0].granted_day, day);
      items.push(
        `${lamps.length} lamp${lamps.length === 1 ? "" : "s"} to rub (\`/lamp\`)` +
          (rubsIn <= LAMP_REMINDER_DAYS ? ` — one rubs itself ${rubsIn <= 1 ? "tomorrow" : `in ${rubsIn} days`}` : "") +
          "."
      );
    }
    if ((await waitingSpoils(env, id)).length > 0) items.push("Spoils to pick (`/spoils`). They open themselves at your next check-in.");
    const claims = await openClaims(env, id);
    if (claims.length > 0) items.push(`${claims.length === 1 ? "A reward is" : `${claims.length} rewards are`} waiting on your next check-in.`);
  }

  // The farm: crops ready, or never started.
  const { results: patches } = await env.DB.prepare("SELECT * FROM farm_patches WHERE player_id = ?").bind(id).all<PatchRow>();
  if (player.farm_day !== day) {
    const ready = patches.filter((row) => isGrown(row, now)).map((row) => (cropFor(row.seed)?.seed ?? row.seed).replace(/ seed$/, "").toLowerCase());
    if (ready.length > 0) items.push(`Crops ready: ${ready.join(", ")} (\`/farm\`).`);
    else if (patches.length === 0 && !player.farm_day) items.push("You have a farm and have not planted it: `/farm`. Potato seeds are free; one run a day.");
  }

  // The kingdom: a haul waiting, an empty coffer, approval slipping.
  try {
    const kingdom = await loadKingdom(env, id, day);
    const stacks = pendingStacks(kingdom, `${id}:${kingdom.collected_day ?? "first"}`);
    const count = stacks.reduce((sum, stack) => sum + stack.qty, 0);
    if (count > 0) items.push(`Miscellania has ${count.toLocaleString("en-US")} items to collect (\`/kingdom\`).`);
    if (dailyWage(kingdom.coffer) === 0) {
      items.push(
        kingdom.collected_day || count > 0
          ? "Miscellania's coffer is empty; nobody is working (`/kingdom`)."
          : "You have a kingdom and have not funded it: `/kingdom`. Ten subjects gather herbs, fish, coal or logs while you are away."
      );
    } else if (kingdom.approval < 60) {
      items.push(`Miscellania's approval is ${Math.round(kingdom.approval)}%: a check-in lifts it 10%.`);
    }
  } catch {
    // The list goes out without it.
  }

  if (player.tears_week !== week) items.push("Tears of Guthix this week: XP in your lowest skill (`/tears`).");

  // Gear: something owned that would count if it were worn, and the chase.
  try {
    const owned = await ownedGear(env, player);
    const worn = wornOf(player);
    const levels = levelsOf(await getSkills(env, id), levelForXp);
    const idle = GEAR_DEFS.filter((def) => def.stats && owned.has(def.key) && meetsReq(def, levels) && !worn[def.slot]);
    if (idle.length > 0) items.push(`You own ${idle.map((def) => def.item).join(", ")} and are not wearing ${idle.length === 1 ? "it" : "them"} (\`/gear\`).`);
    const chase = gearDef(player.wishlist);
    if (!chase) items.push("You are not chasing anything: `/gear chase` doubles one item's drop rate.");
    else if (owned.has(chase.key)) items.push(`You have the ${chase.item} you were chasing: \`/gear chase\` picks the next.`);
  } catch {
    // Same.
  }

  const loadout = loadoutOf(player);
  const packed = [geItem(loadout.potion), geItem(loadout.food)].filter(Boolean).map((item) => item!.item);
  if (packed.length > 0) items.push(`Packed for your next session: ${packed.join(", ")}.`);

  if (player.slayer_points >= SLAYER_SKIP_COST) {
    items.push(`${player.slayer_points} Slayer points (\`/task\`: skip ${SLAYER_SKIP_COST}, block ${SLAYER_BLOCK_COST}).`);
  }
  if (player.bingo_points >= SHOP_FLOOR) items.push(`${player.bingo_points} bingo points to spend (\`/shop\`).`);

  const votes = await openVotes(env);
  if (votes.length > 0) {
    const ballots = await ballotsFor(env, votes.map((vote) => vote.id));
    const missing = votes.filter((vote) => !ballots.some((ballot) => ballot.vote_id === vote.id && ballot.player_id === id));
    if (missing.length > 0) items.push(`You have not voted: ${missing.map((vote) => vote.title).join("; ")} (\`/vote\`).`);
  }

  if (!fresh && items.length > 0) items.push("Most of this needs a check-in in the last four days.");
  return items;
}

/** The list as the player reads it; null when there is nothing on it. */
export function todoBlock(items: string[]): string | null {
  if (items.length === 0) return null;
  return ["📋 **For you** (only you see this)", ...items.map((item) => `• ${item}`)].join("\n");
}
