import { BANK_VIEW_ROWS, NOTABLE_RARITY_DENOMINATOR, NOTABLE_VALUE } from "./config.ts";
import { bankFor, bankValue, logEntries } from "./db.ts";
import { escapeMarkdown } from "./discord.ts";
import { gpShort, itemName } from "./loot.ts";
import type { Env, Player } from "./types.ts";

/** `/bank`: the richest stacks, the total, and how many notable drops are in the log. */
export async function bankView(env: Env, player: Player): Promise<{ content: string }> {
  const rows = await bankFor(env, player.discord_id, BANK_VIEW_ROWS);
  const total = await bankValue(env, player.discord_id);
  const notable = (await logEntries(env, player.discord_id)).filter((entry) => entry.startsWith("drop:")).length;
  const lines = [`💰 **${escapeMarkdown(player.username)}'s bank** — worth ${gpShort(total)}`];
  if (rows.length === 0) {
    lines.push("Empty. Every kill of every check-in drops what the wiki says it drops; it all lands here.");
  } else {
    for (const row of rows) {
      lines.push(`${row.qty.toLocaleString("en-US")}× ${itemName(row.item)} (${gpShort(row.value)})`);
    }
    lines.push(
      `${notable === 0 ? "No notable drops yet" : `${notable} notable drop${notable === 1 ? "" : "s"} in the log`} — ` +
        `a notable drop is 1/${NOTABLE_RARITY_DENOMINATOR.toLocaleString("en-US")} or rarer, or worth ${gpShort(NOTABLE_VALUE)}.`
    );
  }
  return { content: lines.join("\n") };
}
