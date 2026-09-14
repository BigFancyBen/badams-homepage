import { editMessage, logToDiscord } from "./discord";
import { base64UrlFromString, hmacBase64Url } from "./encoding";
import type { Dish, DiscordMessage, Env } from "./types";

/**
 * The render endpoints live in the Next app on Vercel — Workers Free gives
 * 10ms of CPU, which is nowhere near enough to rasterize anything. We hand
 * the render a signed URL and it returns a PNG.
 *
 * The signature stops the endpoint from being an open image proxy.
 */
async function signedUrl(
  env: Env,
  route: string,
  payload: unknown
): Promise<string> {
  const data = base64UrlFromString(JSON.stringify(payload));
  const sig = await hmacBase64Url(env.SCRANDLE_IMAGE_SECRET, data);
  return `${env.IMAGE_BASE_URL}/api/scrandle/${route}?d=${data}&s=${sig}`;
}

export function dishUrl(env: Env, dish: Dish): string {
  return `${env.R2_PUBLIC_BASE}/${dish.r2_key}`;
}

/**
 * The classifier's focal point for a photograph, for the render to centre
 * its crop on. Undefined — and so absent from the payload, since JSON drops
 * it — until the classifier has been round, which leaves every URL minted
 * before this existed byte-identical to what it was.
 */
export function dishFocus(dish: Dish): [number, number] | undefined {
  if (dish.focus_x == null || dish.focus_y == null) return undefined;
  // Two decimals is a hundredth of the frame, which is finer than the
  // classifier can see and keeps the URL short.
  return [
    Math.round(dish.focus_x * 100) / 100,
    Math.round(dish.focus_y * 100) / 100,
  ];
}

/**
 * `attempt` only appears in the payload from the second try onwards, so the
 * ordinary path mints exactly the URL it always did. It exists to make a retry
 * a different URL: a slow or failed render can be cached against the one that
 * produced it, and asking again for the same URL can hand back the same
 * failure.
 */
function retryField(attempt: number): { r?: number } {
  return attempt > 0 ? { r: attempt } : {};
}

export function matchupImageUrl(
  env: Env,
  matchupId: number,
  a: Dish,
  b: Dish,
  attempt = 0
): Promise<string> {
  // The id is in the path so a render is traceable to its matchup.
  return signedUrl(env, `matchup/${matchupId}`, {
    a: dishUrl(env, a),
    b: dishUrl(env, b),
    n: matchupId,
    na: a.name ?? "",
    nb: b.name ?? "",
    fa: dishFocus(a),
    fb: dishFocus(b),
    ...retryField(attempt),
  });
}

export function resultImageUrl(
  env: Env,
  matchupId: number,
  a: Dish,
  b: Dish,
  votesA: number,
  votesB: number,
  chefA: string,
  chefB: string,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `result/${matchupId}`, {
    a: dishUrl(env, a),
    b: dishUrl(env, b),
    va: votesA,
    vb: votesB,
    ca: chefA,
    cb: chefB,
    n: matchupId,
    na: a.name ?? "",
    nb: b.name ?? "",
    fa: dishFocus(a),
    fb: dishFocus(b),
    ...retryField(attempt),
  });
}

/**
 * The ranking card: up to five photographs, numbered to match the buttons.
 * `t` is the classifier's name for each, and may be blank; `f` is its focal
 * point, and may be missing.
 *
 * `h` is the header — "Rank the pasta" on a themed round, "Rank the places" on
 * a mixed one. Optional in the payload rather than required, so the render
 * endpoint can ship before or after this does: an older endpoint ignores it
 * and draws the header it always drew.
 */
export function ballotImageUrl(
  env: Env,
  roundId: number,
  entries: Dish[],
  title: string,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `ballot/${roundId}`, {
    n: roundId,
    h: title,
    items: entries.map((dish) => ({
      u: dishUrl(env, dish),
      t: dish.name ?? "",
      f: dishFocus(dish),
    })),
    ...retryField(attempt),
  });
}

/**
 * The reveal: the same photographs in finishing order, with each one's rating
 * movement. `p` is the position label, `d` the rounded Elo delta, `f` the
 * focal point for the crop.
 */
export function ballotResultImageUrl(
  env: Env,
  roundId: number,
  rows: { u: string; t: string; p: string; d: number; f?: [number, number] }[],
  ballots: number,
  attempt = 0
): Promise<string> {
  return signedUrl(env, `ballot-result/${roundId}`, {
    n: roundId,
    b: ballots,
    items: rows,
    ...retryField(attempt),
  });
}

export function standingsImageUrl(
  env: Env,
  stamp: number,
  title: string,
  rows: { n: string; e: number; d: number }[],
  attempt = 0
): Promise<string> {
  return signedUrl(env, `standings/${stamp}`, {
    t: title,
    rows,
    ...retryField(attempt),
  });
}

/** How many times to ask for a card before posting without one. */
const RENDER_ATTEMPTS = 3;

/**
 * R2 key for a card. `stamp` forces a new key — and so a URL Discord has never
 * seen — when replacing a card that already went out.
 */
export function cardKey(
  kind: "matchup" | "result" | "standings" | "ballot" | "ballot-result",
  id: number,
  stamp?: number
): string {
  return `cards/${kind}-${id}${stamp ? `-${stamp}` : ""}.png`;
}

/**
 * Renders a card, mirrors it into R2, and returns a public URL for the copy.
 * Falls back to the signed render URL if only the mirror failed, and returns
 * null if the card never rendered at all.
 *
 * Discord fetches an embed image once, at post time, and caches what it gets
 * against that URL — so a render that is briefly slow or briefly failing
 * leaves a card that stays broken forever, because the URL never changes.
 * That is not a hypothetical: it is how a place round went out with no image
 * on it, and nothing about the round could be fixed afterwards.
 *
 * Fetching it here first moves that risk somewhere it can be survived. The
 * Worker is not waiting on a deadline the way Discord's proxy is, it can ask
 * again, and what Discord ends up fetching is a static object out of R2 rather
 * than a render it might have to sit through. Two large photographs take
 * seconds to rasterize; nothing downstream has to care any more.
 */
export async function renderCard(
  env: Env,
  key: string,
  mint: (attempt: number) => Promise<string>
): Promise<string | null> {
  for (let attempt = 0; attempt < RENDER_ATTEMPTS; attempt++) {
    const url = await mint(attempt);
    let bytes: ArrayBuffer;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      // A signature failure or a crashed render answers with text, and an
      // embed pointed at text is an embed with nothing in it.
      if (!(response.headers.get("content-type") ?? "").startsWith("image/")) {
        continue;
      }
      bytes = await response.arrayBuffer();
    } catch {
      continue;
    }

    if (bytes.byteLength === 0) continue;

    try {
      await env.BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return `${env.R2_PUBLIC_BASE}/${key}`;
    } catch {
      // The card itself is fine — only the copy failed. The signed URL still
      // renders, and the function behind it is warm from the fetch above.
      return url;
    }
  }

  return null;
}

/**
 * Whether Discord managed to load the card on a message it has just accepted.
 *
 * Discord fetches an embed image through its media proxy while it is creating
 * (or editing) the message, and the message it hands back says how that went:
 * a proxied copy with a width and a height, or a proxied copy that is 0 by 0,
 * which the client draws as nothing at all. Rendering the card first (see
 * renderCard) rules out the render being slow, but not the proxy simply
 * fumbling a perfectly good file — which it does, intermittently, and has for
 * years (discord-api-docs #878 and #6694). On 14 September 2026 matchups #111
 * and #112 went out that way: valid cards in R2, a 0-by-0 answer from
 * Discord, in the middle of a batch whose other three loaded fine.
 *
 * The card is always the first embed. Returns null when the reply says
 * nothing about it — the local mock, or a shape this does not anticipate — so
 * a check that cannot be made is not mistaken for a card that failed.
 */
export function cardLoaded(message: DiscordMessage): boolean | null {
  const image = message.embeds?.[0]?.image;
  if (!image) return null;
  return (image.width ?? 0) > 0 && (image.height ?? 0) > 0;
}

/** How many fresh copies to offer Discord before leaving it to a person. */
const CONFIRM_ATTEMPTS = 2;

/**
 * The embeds a card post goes out with: the card first, then whatever rides
 * along under it (a closed matchup's vote log, a round's ballot log).
 */
export type CardEmbeds = [{ color: number; image: { url: string } }, ...unknown[]];

/**
 * Checks that Discord actually loaded the card on `message`, and if it did
 * not, swaps in a fresh copy until it does or the attempts run out.
 *
 * `rerender` mints the replacement under a stamped key — it has to arrive at
 * a URL Discord has never seen, or the proxy answers with the 0-by-0 it
 * cached the first time. `embeds` is what was posted: a PATCH replaces the
 * embeds it names wholesale, so the log under the card has to be sent again
 * or it would quietly vanish.
 *
 * Never throws. The message is up and the round is live by the time this
 * runs; a card that will not take is a log line and a manual repair, not a
 * reason to unwind the post. Two attempts and not more: each is a render, an
 * R2 write and an edit, and the 9am batch shares one invocation's subrequest
 * budget between five of these.
 */
export async function confirmCard(
  env: Env,
  message: DiscordMessage,
  channelId: string | undefined,
  embeds: CardEmbeds,
  rerender: (stamp: number) => Promise<string | null>,
  label: string,
  repairHint?: string
): Promise<void> {
  // The standings have no row to repair by, so they get no retry line.
  const retry = repairHint
    ? ` Retry it with /admin/repair-card?${repairHint}.`
    : "";
  try {
    let current = message;
    for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
      if (cardLoaded(current) !== false) return;
      const image = await rerender(Date.now());
      if (!image) break;
      const [card, ...rest] = embeds;
      current = await editMessage(
        env,
        message.id,
        { embeds: [{ ...card, image: { url: image } }, ...rest] },
        channelId
      );
    }
    if (cardLoaded(current) !== false) return;
    await logToDiscord(
      env,
      `${label} is up, but Discord never loaded its card — the file is fine, ` +
        `Discord's proxy answered 0×0 for it and for ${CONFIRM_ATTEMPTS} fresh ` +
        `copies.${retry}`
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await logToDiscord(
      env,
      `${label} is up, but checking its card failed: ${reason}.${retry}`
    );
  }
}
