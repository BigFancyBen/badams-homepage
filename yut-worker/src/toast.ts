import { cardText, renderCard, retryField, signedUrl } from "./cards.ts";
import { RARE_TOASTS_PER_POST } from "./config.ts";
import { ACCENT, allowedMentions, escapeMarkdown, logToDiscord, postMessage } from "./discord.ts";
import { gpShort, oneIn } from "./loot.ts";
import type { Env } from "./types.ts";

/**
 * A rare drop is the channel's business. Everything else a check-in produces
 * goes to the day's thread; a drop that is rare by the wiki's rate, worth a
 * lot, or new for somebody's wardrobe gets a post of its own in the channel,
 * with the item drawn large, so the others can see it and say so.
 */

export interface RareDrop {
  key: string;
  item: string;
  qty: number;
  /** The stack's worth in coins; 0 when it has no price. */
  value: number;
  /** The wiki's rate per roll, when the drop came off a table. */
  rate?: number;
  /** Where it came from, as it reads after "from": "the abyssal demons", "Obor", "a hard casket". */
  source: string;
  /** Whose it is, when it is not the player the toast is posted for (a share of the boss's chest). */
  who?: string;
}

/** The card's frame: the spoils' top three tiers, read off the rate. */
export function dropTier(rate: number | undefined): "rare" | "very_rare" | "legendary" {
  if (rate !== undefined && rate <= 1 / 5000) return "legendary";
  if (rate !== undefined && rate <= 1 / 1000) return "very_rare";
  return "rare";
}

/** The line over the card, and the whole toast when the card does not render. */
export function toastLine(username: string, drop: RareDrop): string {
  const facts = [drop.rate !== undefined && drop.rate < 1 ? oneIn(drop.rate) : "", drop.value > 0 ? gpShort(drop.value) : ""].filter(Boolean);
  return (
    `🎉 **${escapeMarkdown(drop.who ?? username)}** got a rare drop: **${drop.item}**${drop.qty > 1 ? ` ×${drop.qty.toLocaleString("en-US")}` : ""}` +
    ` from ${drop.source}${facts.length > 0 ? ` (${facts.join(", ")})` : ""}!`
  );
}

/**
 * Posts each drop to the channel. `stamp` names the cards in R2, so a retried
 * post draws nothing twice. Errors are logged; the drop is banked either way.
 */
export async function toastRareDrops(env: Env, username: string, drops: RareDrop[], day: string, stamp: string): Promise<void> {
  // One item is one toast, however many ways it was rare.
  const seen = new Set<string>();
  const unique = drops.filter((drop) => {
    const id = `${drop.who ?? ""}:${drop.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const drop of unique.slice(0, RARE_TOASTS_PER_POST)) {
    try {
      const name = `${stamp}-${drop.key}`.replace(/[^a-z0-9_-]/gi, "_");
      const url = await renderCard(env, `drops/${name}.png`, (attempt) =>
        signedUrl(env, `drop/${name}`, {
          n: cardText(drop.who ?? username),
          item: cardText(drop.item),
          k: drop.key,
          ...(drop.qty > 1 ? { q: drop.qty } : {}),
          src: cardText(drop.source),
          ...(drop.rate !== undefined && drop.rate < 1 ? { rate: oneIn(drop.rate) } : {}),
          ...(drop.value > 0 ? { v: Math.round(drop.value) } : {}),
          tier: dropTier(drop.rate),
          d: day,
          ...retryField(attempt),
        })
      );
      await postMessage(env, {
        content: toastLine(username, drop),
        embeds: url ? [{ color: ACCENT, image: { url } }] : [],
        allowed_mentions: allowedMentions(),
      });
    } catch (error) {
      await logToDiscord(env, `Rare drop toast failed: ${String(error)}`);
    }
  }
}
