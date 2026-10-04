import { ALTAR_MULTIPLIER, GE_ITEMS, SKILL_LABEL, type GeItem } from "./config.ts";
import { addXpStatement, bankValue, getSkills, logEventStatement } from "./db.ts";
import { gpShort } from "./loot.ts";
import { GE_PRICES } from "./spoils.ts";
import { effectiveLevel, getBuildings } from "./town.ts";
import { buttonRows, type Button, type Env, type Player } from "./types.ts";
import { levelForXp } from "./xp.ts";

/**
 * The Grand Exchange. The bank is spendable: its worth, less what has been
 * spent, is the balance, and it buys what gold buys in Old School — a potion
 * or better food for the next session, bones for Prayer. Prices are the GE's
 * at fetch time (config/spoils.json); the boosts, heals and bone XP are the
 * wiki's (config.ts).
 *
 * A potion and an inventory of food are packed, one of each, and the next
 * check-in uses them up.
 */

export interface Loadout {
  potion?: string;
  food?: string;
}

export interface Line {
  content: string;
  components?: unknown[];
}

export function loadoutOf(player: Player): Loadout {
  try {
    return JSON.parse(player.loadout || "{}") as Loadout;
  } catch {
    return {};
  }
}

export function geItem(key: string | undefined): GeItem | undefined {
  return GE_ITEMS.find((item) => item.key === key);
}

/** What one purchase costs: the unit price times the lot. */
export function gePrice(item: GeItem): number {
  return (GE_PRICES[item.key] ?? 0) * item.qty;
}

export async function geBalance(env: Env, player: Player): Promise<number> {
  return Math.max(0, Math.floor((await bankValue(env, player.discord_id)) - (player.gp_spent ?? 0)));
}

function lotName(item: GeItem): string {
  return item.qty > 1 ? `${item.qty} × ${item.item}` : item.item;
}

/** "Packed: Super strength(4), 27 × Shark." or null with nothing packed. */
export function loadoutLine(loadout: Loadout): string | null {
  const packed = [geItem(loadout.potion), geItem(loadout.food)].filter((item): item is GeItem => Boolean(item));
  if (packed.length === 0) return null;
  return `Packed for your next session: ${packed.map(lotName).join(", ")}.`;
}

export async function geMenu(env: Env, player: Player, lead?: string): Promise<Line> {
  const balance = await geBalance(env, player);
  const loadout = loadoutOf(player);
  const lines = [
    ...(lead ? [lead] : []),
    `⚖️ **Grand Exchange** — ${gpShort(balance)} to spend (your bank's worth, less ${gpShort(player.gp_spent ?? 0)} spent).`,
  ];
  for (const item of GE_ITEMS) lines.push(`**${lotName(item)}** — ${gpShort(gePrice(item))}. ${item.blurb}.`);
  lines.push(loadoutLine(loadout) ?? "Nothing packed. A potion and an inventory of food each last one session.");
  const buttons: Button[] = GE_ITEMS.map((item) => {
    const held = (item.kind === "potion" && loadout.potion) || (item.kind === "food" && loadout.food);
    const affordable = balance >= gePrice(item) && !held;
    return {
      label: `${item.item.replace(/\(4\)$/, "")} (${gpShort(gePrice(item))})`.slice(0, 80),
      custom_id: `ge:${item.key}`,
      style: affordable ? 1 : 2,
      disabled: !affordable,
    };
  });
  return { content: lines.join("\n"), components: buttonRows(buttons) };
}

/** One purchase. The balance is re-read here, so a double click cannot overspend. */
export async function geBuy(env: Env, player: Player, key: string, day: string, now: number): Promise<Line> {
  const item = geItem(key);
  if (!item) return { content: "The Grand Exchange does not sell that." };
  const price = gePrice(item);
  const balance = await geBalance(env, player);
  if (price <= 0) return { content: "No price for that today." };
  if (balance < price) {
    return geMenu(env, player, `${lotName(item)} costs ${gpShort(price)}; you have ${gpShort(balance)}.`);
  }

  const loadout = loadoutOf(player);
  const statements: D1PreparedStatement[] = [];
  let line: string;
  if (item.kind === "potion" || item.kind === "food") {
    if (loadout[item.kind]) {
      return geMenu(env, player, `You already have ${geItem(loadout[item.kind])?.item ?? "one"} packed; it is used up at your next check-in.`);
    }
    loadout[item.kind] = item.key;
    line = `Bought ${lotName(item)}: packed for your next session.`;
  } else {
    // Bones are buried on the spot, at the Chapel's altar if the town has one.
    const altar = ALTAR_MULTIPLIER[Math.min(ALTAR_MULTIPLIER.length - 1, Math.floor(effectiveLevel((await getBuildings(env)).get("chapel"))))] ?? 1;
    const xp = Math.floor(item.qty * (item.xp ?? 0) * altar);
    const before = levelForXp((await getSkills(env, player.discord_id)).prayer ?? 0);
    statements.push(addXpStatement(env, player.discord_id, "prayer", xp));
    const after = levelForXp(((await getSkills(env, player.discord_id)).prayer ?? 0) + xp);
    line =
      `Bought and buried ${lotName(item)}${altar > 1 ? ` at the altar (${altar}×)` : ""}: +${xp.toLocaleString("en-US")} ${SKILL_LABEL.prayer}` +
      (after > before ? ` — **${SKILL_LABEL.prayer} ${after}!**` : ".");
  }

  // The spend and the goods land together; gp_spent only ever grows by a price the balance covered.
  statements.push(
    env.DB.prepare("UPDATE players SET gp_spent = gp_spent + ?, loadout = ? WHERE discord_id = ?").bind(
      price,
      JSON.stringify(loadout),
      player.discord_id
    ),
    env.DB.prepare("INSERT INTO ge_purchases (player_id, item, qty, gp, day, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      player.discord_id,
      item.key,
      item.qty,
      price,
      day,
      now
    ),
    logEventStatement(env, player.discord_id, day, null, "ge", { item: item.key, gp: price }, now)
  );
  await env.DB.batch(statements);
  return geMenu(
    env,
    { ...player, gp_spent: (player.gp_spent ?? 0) + price, loadout: JSON.stringify(loadout) },
    `${line} (−${gpShort(price)})`
  );
}
