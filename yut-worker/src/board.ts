import { DRILL_DEMON_LAMP } from "./config.ts";
import {
  activeRoster,
  checkinsBetween,
  getAllSkills,
  getState,
  openBounties,
  setState,
} from "./db.ts";
import { ACCENT, allowedMentions, editMessage, escapeMarkdown, pinMessage, postMessage } from "./discord.ts";
import { addDays, shortDate } from "./schedule.ts";
import { formBar } from "./sheet.ts";
import { getStores, getTown, storesLine } from "./town.ts";
import { buttonRow, type Env } from "./types.ts";
import { levelForXp, tierForHp } from "./xp.ts";

/**
 * One pinned message, edited every daily tick. Edits are silent, so this
 * costs the channel nothing; the roster, the camp, the bounties and the two
 * buttons that bring people in.
 */
export async function composeBoard(env: Env, today: string): Promise<string> {
  const roster = await activeRoster(env, today);
  const skills = await getAllSkills(env);
  const town = await getTown(env);
  const lines: string[] = [`**Yut Hut — ${town.level > 0 ? "the town" : "the camp"}**`];

  if (roster.length === 0) {
    lines.push("Nobody has joined yet. Press Join to be the first.");
  } else {
    const rows: { name: string; hp: number; hpXp: number; tier: string; dots: string; fw: number; title: string | null }[] = [];
    for (const player of roster) {
      const hpXp = skills.get(player.discord_id)?.hitpoints ?? 0;
      const hp = levelForXp(hpXp);
      const recent = await checkinsBetween(env, player.discord_id, addDays(today, -6), today);
      const days = new Set(recent.map((c) => c.day));
      let dots = "";
      for (let i = 6; i >= 0; i--) dots += days.has(addDays(today, -i)) ? "x" : ".";
      rows.push({ name: player.username, hp, hpXp, tier: tierForHp(hp).name, dots, fw: player.form_weeks, title: player.title });
    }
    rows.sort((a, b) => b.hpXp - a.hpXp);
    for (const row of rows) {
      lines.push(
        `${formBar(row.dots)} **${escapeMarkdown(row.name)}** · ${row.tier} · HP ${row.hp} · Form weeks ${row.fw}${row.title ? ` · ${row.title}` : ""}`
      );
    }
  }

  lines.push("");
  lines.push(`${town.level > 0 ? "Town" : "Camp"}: ${storesLine(await getStores(env))}`);
  for (const bounty of await openBounties(env)) {
    const holder = roster.find((p) => p.discord_id === bounty.player_id);
    if (holder) lines.push(`Bounty: ${escapeMarkdown(holder.username)}, ${DRILL_DEMON_LAMP} XP by ${shortDate(bounty.expires_day)}.`);
  }
  lines.push("");
  lines.push("Two a week is the whole game. `/help` for the rules.");
  return lines.join("\n");
}

export function boardPayload(description: string) {
  return {
    embeds: [{ color: ACCENT, description }],
    components: [
      buttonRow([
        { label: "Join the campaign", custom_id: "join", style: 3 },
        { label: "Ping me", custom_id: "ping:on", style: 2, emoji: "🔔" },
        { label: "Stop pinging me", custom_id: "ping:off", style: 2 },
      ]),
    ],
    allowed_mentions: allowedMentions(),
  };
}

/** Creates the board if there is none, otherwise edits it in place. */
export async function refreshBoard(env: Env, today: string): Promise<void> {
  const description = await composeBoard(env, today);
  const existing = await getState(env, "board_message_id");
  if (existing) {
    try {
      await editMessage(env, existing, boardPayload(description));
      return;
    } catch {
      // Deleted, most likely. Fall through and make another.
    }
  }
  const message = await postMessage(env, boardPayload(description));
  await setState(env, "board_message_id", message.id);
  try {
    await pinMessage(env, message.id);
  } catch {
    // No Manage Messages; the board still works unpinned.
  }
}
