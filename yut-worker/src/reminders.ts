import { FRESH_WINDOW_DAYS, LAMP_AUTO_RUB_DAYS, LAMP_REMINDER_DAYS, SHOP, SLAYER_SKIP_COST } from "./config.ts";
import { openClaimCounts, unspentLampCounts } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { daysBetween } from "./schedule.ts";
import type { Env, Player } from "./types.ts";
import { ballotsFor, openVotes } from "./votes.ts";

/**
 * The evening reminders: what a player is sitting on that only they can
 * act on — lamps that will rub themselves, Slayer points that buy a skip,
 * bingo points that buy something, votes not cast, rewards waiting on the
 * next check-in — and who is about to go stale. Roster members only. The
 * nudges name people; the stale warning is the one place the bot @mentions
 * a player, because tomorrow the game stops listening to them. Three GROUP
 * BY queries however big the roster is.
 */

export interface Nudge {
  playerId: string;
  name: string;
  bits: string[];
}

export interface Reminders {
  nudges: Nudge[];
  /** Players whose last check-in was three days ago: tomorrow is day four, and stale. */
  goingStale: Player[];
}

/** The first shop item everyone can use: the small lamp. */
const SHOP_FLOOR =
  SHOP.find((item) => item.key === "small_lamp")?.points ?? Math.min(...SHOP.map((item) => item.points));

/** Roster members on their last fresh day. */
export function goingStale(roster: Player[], today: string): Player[] {
  return roster.filter(
    (p) => p.last_active_day !== null && daysBetween(p.last_active_day, today) === FRESH_WINDOW_DAYS - 1
  );
}

export async function composeReminders(env: Env, today: string, roster: Player[]): Promise<Reminders> {
  return { nudges: await composeNudges(env, today, roster), goingStale: goingStale(roster, today) };
}

async function composeNudges(env: Env, today: string, roster: Player[]): Promise<Nudge[]> {
  if (roster.length === 0) return [];
  const ids = new Set(roster.map((p) => p.discord_id));
  const bits = new Map<string, string[]>();
  const add = (id: string, bit: string) => {
    if (!ids.has(id)) return;
    bits.set(id, [...(bits.get(id) ?? []), bit]);
  };

  for (const row of await unspentLampCounts(env)) {
    const rubsIn = LAMP_AUTO_RUB_DAYS + 1 - daysBetween(row.oldest, today);
    let bit = `${row.n} lamp${row.n === 1 ? "" : "s"} to rub`;
    if (rubsIn <= LAMP_REMINDER_DAYS) {
      bit += ` (one rubs itself ${rubsIn <= 1 ? "tomorrow" : `in ${rubsIn} days`})`;
    }
    add(row.player_id, bit);
  }

  for (const player of roster) {
    if (player.slayer_points >= SLAYER_SKIP_COST) {
      add(player.discord_id, `${player.slayer_points} Slayer points (\`/task\`)`);
    }
    if (player.bingo_points >= SHOP_FLOOR) {
      add(player.discord_id, `${player.bingo_points} bingo points to spend (\`/shop\`)`);
    }
  }

  const votes = await openVotes(env);
  if (votes.length > 0) {
    const ballots = await ballotsFor(env, votes.map((v) => v.id));
    for (const player of roster) {
      const missing = votes.filter(
        (v) => !ballots.some((b) => b.vote_id === v.id && b.player_id === player.discord_id)
      );
      if (missing.length > 0) {
        add(
          player.discord_id,
          `hasn't voted (${missing.map((v) => `${v.title} closes <t:${Math.floor(v.closes_at / 1000)}:R>`).join("; ")})`
        );
      }
    }
  }

  for (const row of await openClaimCounts(env)) {
    add(row.player_id, `${row.n === 1 ? "a reward" : `${row.n} rewards`} waiting on a check-in`);
  }

  return roster
    .filter((p) => bits.has(p.discord_id))
    .map((p) => ({ playerId: p.discord_id, name: p.username, bits: bits.get(p.discord_id) ?? [] }));
}

/** The message, or null when there is nobody to remind and nobody going stale. */
export function reminderMessage(
  reminders: Reminders
): { content: string; allowed_mentions: { parse: never[]; users: string[]; replied_user: false } } | null {
  const { nudges, goingStale: stale } = reminders;
  if (nudges.length === 0 && stale.length === 0) return null;
  const lines = ["🔔 **Evening reminders**", ...nudges.map((n) => `• **${escapeMarkdown(n.name)}** — ${n.bits.join(" · ")}`)];
  if (stale.length > 0) {
    if (nudges.length > 0) lines.push("");
    lines.push(
      `⚠️ ${stale.map((p) => `<@${p.discord_id}>`).join(", ")} — three days without a workout. ` +
        `Tomorrow makes four, and the game stops listening until you check in.`
    );
  }
  return {
    content: lines.join("\n").slice(0, 1900),
    // The only message that mentions anyone by id: the players going stale.
    allowed_mentions: { parse: [], users: stale.map((p) => p.discord_id), replied_user: false },
  };
}
