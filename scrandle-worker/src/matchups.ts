import {
  allowedMentions,
  editMessage,
  logToDiscord,
  postMessage,
} from "./discord";
import {
  chefStandings,
  getDish,
  getDueMatchups,
  getMatchup,
  getMatchupByMessage,
  getOpenStandardMatchup,
  getOpenMatchups,
  getState,
  playerName,
  setState,
  tallyVotes,
} from "./db";
import { updateElo } from "./elo";
import {
  cardKey,
  matchupImageUrl,
  renderCard,
  resultImageUrl,
  standingsImageUrl,
} from "./images";
import { pickPair } from "./matchmaking";
import { nextPostTime, parsePostHours, postSlotKey } from "./schedule";
import type { Dish, Env, Matchup } from "./types";

const HOUR = 60 * 60 * 1000;
const ACCENT = 0x81a1c1;
const WIN = 0xa3be8c;

/**
 * Jump link to the message a dish came from, so people can read the original
 * context. Note this also reveals the poster — anyone who clicks sees who
 * cooked it.
 */
function sourceLink(env: Env, dish: Dish, label: string): string {
  return `[${label}](https://discord.com/channels/${env.DISCORD_GUILD_ID}/${env.DISCORD_CHANNEL_ID}/${dish.discord_message_id})`;
}

function voteButtons(matchupId: number) {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: "1", custom_id: `v:${matchupId}:a` },
        { type: 2, style: 2, label: "2", custom_id: `v:${matchupId}:b` },
      ],
    },
  ];
}

/**
 * Creates the row, renders the card against its id, posts it, and records the
 * message. Shared by the everyday matchup and the Wednesday place bonus.
 */
async function createAndPost(
  env: Env,
  pair: { a: Dish; b: Dish },
  now: number,
  closesAt: number,
  preamble = ""
): Promise<void> {
  const inserted = await env.DB.prepare(
    "INSERT INTO matchups (dish_a_id, dish_b_id, created_at, closes_at) " +
      "VALUES (?, ?, ?, ?) RETURNING id"
  )
    .bind(pair.a.id, pair.b.id, now, closesAt)
    .first<{ id: number }>();

  if (!inserted) throw new Error("Failed to create matchup row");
  const matchupId = inserted.id;

  const image = await renderCard(env, cardKey("matchup", matchupId), (attempt) =>
    matchupImageUrl(env, matchupId, pair.a, pair.b, attempt)
  );

  // Posting an embed whose image never arrived leaves a card that is broken
  // for good, so a matchup that cannot be illustrated goes out as links and
  // buttons instead. The round still runs, and the card can be added after.
  if (!image) {
    await logToDiscord(
      env,
      `Matchup #${matchupId} posted without a card — the render never came back. ` +
        `Retry it with /admin/repair-card?matchup=${matchupId}.`
    );
  }

  // The row has to exist before the post so its id can go in the image URL,
  // which means a failed post would otherwise strand an open matchup that
  // nobody can vote on and that blocks every future one until it expires.
  try {
    // Just the two jump links — no preamble. The card already carries the
    // question and the matchup number. The place bonus is the exception: it
    // runs beside an ordinary matchup, so it has to say which one it is.
    const links = `${sourceLink(env, pair.a, "#1")} · ${sourceLink(env, pair.b, "#2")}`;
    const message = await postMessage(env, {
      content: preamble ? `${preamble}
${links}` : links,
      embeds: image ? [{ color: ACCENT, image: { url: image } }] : [],
      components: voteButtons(matchupId),
      allowed_mentions: allowedMentions(env),
    });

    await env.DB.prepare("UPDATE matchups SET message_id = ? WHERE id = ?")
      .bind(message.id, matchupId)
      .run();
  } catch (error) {
    await env.DB.prepare("DELETE FROM matchups WHERE id = ?").bind(matchupId).run();
    throw error;
  }
}

/**
 * Posts at most one matchup per tick, and only when nothing is still open.
 * Deliberately does not ping the Tasters role: a ping tied to a matchup would
 * correlate with new dishes entering the pool, which is a tell.
 */
export async function postMatchupIfDue(
  env: Env,
  now: number,
  { force = false, overlap = false }: { force?: boolean; overlap?: boolean } = {}
): Promise<boolean> {
  // Never post over an everyday matchup that is still open, even when forced —
  // two live everyday matchups split the vote. `overlap` is the single
  // deliberate exception: an admin-triggered bonus running beside the scheduled
  // one. The close path already iterates every open matchup and votes are keyed
  // to a matchup id on the button, so the only cost is the split attention.
  //
  // A bonus deliberately does not count here. It is posted to run alongside the
  // everyday matchup, and its window is a flat 24 hours rather than the next
  // posting hour — so blocking on it skipped every ordinary slot for the whole
  // day after each bonus, in both directions of a rule meant to apply in one.
  //
  // Excluding live photographs is now unconditional. It used to be done only on
  // the overlap path, which was safe only because returning early was the sole
  // other way past this point. Now that a bonus can be open here, the draw has
  // to skip what the bonus is holding. Nothing pairs the two today — the pools
  // are disjoint categories — but that is a property of the current pools, not
  // a rule anything enforces, and it costs one read an hour to not rely on it.
  const liveDishIds: number[] = [];
  for (const live of await getOpenMatchups(env)) {
    liveDishIds.push(live.dish_a_id, live.dish_b_id);
  }

  if (!overlap && (await getOpenStandardMatchup(env))) return false;

  const hours = parsePostHours(env.POST_HOURS_UTC);

  if (!force) {
    // Post on named hours rather than "N hours since the last one". Elapsed
    // time drifts: one late post pushes every post after it, and within days
    // the matchup is landing at an arbitrary hour. Fixed hours stay put.
    if (hours.length > 0 && !hours.includes(new Date(now).getUTCHours())) {
      return false;
    }

    // One post per named hour, so a retry inside the same hour cannot
    // double-post. Deliberately not an elapsed-time floor — see postSlotKey.
    if ((await getState(env, "last_matchup_slot")) === postSlotKey(now)) {
      return false;
    }
  }

  const pair = await pickPair(env, { exclude: liveDishIds });
  if (!pair) return false;

  // Closes when the next matchup is due, not a fixed span from right now. A
  // forced post at an odd hour therefore gets a short window rather than one
  // that runs past the next scheduled slot and blocks it.
  const closesAt = nextPostTime(
    hours,
    now,
    Number(env.VOTE_WINDOW_HOURS || "24") * HOUR
  );

  await createAndPost(env, pair, now, closesAt);

  // A bonus matchup does not claim the hour's slot. Marking it would make an
  // overlapping post fired during a named hour swallow that hour's scheduled
  // matchup, which is the exact cycle-skipping this flag exists to avoid.
  if (!overlap) await setState(env, "last_matchup_slot", postSlotKey(now));

  return true;
}

/** Weekdays a bonus runs on: comma-separated, 0 = Sunday. Junk is dropped. */
function parseWeekdays(raw: string | undefined): number[] {
  const days = (raw || "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(days)];
}

interface BonusSchedule {
  /** The category it draws from — places, people. Its own day, its own pool. */
  category: "place" | "person";
  /** Weekdays it fires on, 0 = Sunday. Empty disables it. */
  weekdays: number[];
  hourUtc: number;
  /** Minute of the hour it fires on. The cron has to tick on this minute too. */
  minute: number;
  windowHours: number;
  /** State key for the once-per-slot guard. Each bonus keeps its own. */
  slotState: string;
  /** The line above the two jump links, saying which bonus this is. */
  preamble: string;
}

/**
 * A weekly bonus matchup: a category of its own, on a day of its own. Three
 * things make it separate from the everyday matchup rather than a flag on it.
 *
 * It runs *beside* whatever ordinary matchup is open — that is what makes it a
 * bonus — so it deliberately skips the one-at-a-time rule, drawing on the same
 * exception the admin overlap flag uses.
 *
 * It gets a flat window instead of closing on the next posting hour. It is not
 * part of the food cadence and must not hand its slot to it: closing on the
 * schedule would end it the same evening.
 *
 * And it keeps its own slot key, so posting one never marks the food slot as
 * used. Its category is drawn only here — the everyday matchup filters it out.
 */
async function postBonusMatchupIfDue(
  env: Env,
  now: number,
  schedule: BonusSchedule,
  force: boolean
): Promise<boolean> {
  if (!force) {
    if (schedule.weekdays.length === 0) return false;

    const date = new Date(now);
    if (!schedule.weekdays.includes(date.getUTCDay())) return false;
    if (date.getUTCHours() !== schedule.hourUtc) return false;
    // A bonus can want an off-the-hour minute (the person matchup fires at
    // :11), which only lands if the cron ticks on that minute — see the second
    // cron entry in wrangler.toml.
    if (date.getUTCMinutes() !== schedule.minute) return false;

    // One per named slot, so an hourly retry cannot double-post. Same
    // reasoning as last_matchup_slot, on a key of its own.
    if ((await getState(env, schedule.slotState)) === postSlotKey(now)) {
      return false;
    }
  }

  // Whatever is live keeps its photographs to itself.
  const liveDishIds: number[] = [];
  for (const live of await getOpenMatchups(env)) {
    liveDishIds.push(live.dish_a_id, live.dish_b_id);
  }

  const pair = await pickPair(env, {
    exclude: liveDishIds,
    categories: [schedule.category],
  });
  // Fewer than two in the catalog, both already live, or — since a matchup
  // never pits one person against himself — only one person's photographs.
  if (!pair) return false;

  await createAndPost(
    env,
    pair,
    now,
    now + schedule.windowHours * HOUR,
    schedule.preamble
  );

  await setState(env, schedule.slotState, postSlotKey(now));

  return true;
}

/**
 * The place bonus: places rather than plates. Runs on every weekday listed in
 * PLACE_WEEKDAY (Monday and Wednesday by default), at noon Mountain.
 */
export function postPlaceMatchupIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  return postBonusMatchupIfDue(
    env,
    now,
    {
      category: "place",
      weekdays: parseWeekdays(env.PLACE_WEEKDAY),
      hourUtc: Number(env.PLACE_HOUR_UTC || "18"),
      minute: 0,
      windowHours: Number(env.PLACE_WINDOW_HOURS || "24"),
      slotState: "last_place_slot",
      preamble: "Bonus round — place vs place.",
    },
    force
  );
}

/**
 * The person bonus: people rather than plates, on Tuesday at 11:11am Mountain.
 * The odd minute is deliberate; the second cron entry exists so a tick lands on
 * it. Same machinery as the place bonus, a different pool and a different day.
 */
export function postPersonMatchupIfDue(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  return postBonusMatchupIfDue(
    env,
    now,
    {
      category: "person",
      weekdays: parseWeekdays(env.PERSON_WEEKDAY),
      hourUtc: Number(env.PERSON_HOUR_UTC || "17"),
      minute: Number(env.PERSON_MINUTE || "11"),
      windowHours: Number(env.PERSON_WINDOW_HOURS || "24"),
      slotState: "last_person_slot",
      preamble: "Bonus round — person vs person.",
    },
    force
  );
}

async function closeOne(env: Env, matchup: Matchup, now: number): Promise<void> {
  const [dishA, dishB] = await Promise.all([
    getDish(env, matchup.dish_a_id),
    getDish(env, matchup.dish_b_id),
  ]);
  if (!dishA || !dishB) throw new Error(`Matchup ${matchup.id} has a missing dish`);

  const votes = await tallyVotes(env, matchup);
  const next = updateElo(dishA.elo, dishB.elo, votes.a, votes.b);

  const closeMatchup = env.DB.prepare(
    "UPDATE matchups SET status = 'closed', closed_at = ?, votes_a = ?, votes_b = ?, " +
      "elo_a_before = ?, elo_b_before = ?, elo_a_after = ?, elo_b_after = ? WHERE id = ?"
  ).bind(now, votes.a, votes.b, dishA.elo, dishB.elo, next.a, next.b, matchup.id);

  // A matchup nobody voted on is not a match played. Counting it would burn
  // both dishes' unplayed status and skew the low-matches_played preference
  // without any rating information to show for it.
  if (votes.a + votes.b === 0) {
    await closeMatchup.run();

    // Still strip the buttons. Leaving them live on a closed matchup means the
    // card looks votable forever, and anyone who clicks gets told voting has
    // closed by a message that gives no sign of it.
    if (matchup.message_id) {
      await editMessage(env, matchup.message_id, {
        content: `**Matchup #${matchup.id} — closed.** Nobody voted.`,
        components: [],
        allowed_mentions: allowedMentions(env),
      });
    }
    return;
  }

  await env.DB.batch([
    closeMatchup,
    env.DB.prepare(
      "UPDATE dishes SET elo = ?, matches_played = matches_played + 1, " +
        "first_matchup_id = COALESCE(first_matchup_id, ?) WHERE id = ?"
    ).bind(next.a, matchup.id, dishA.id),
    env.DB.prepare(
      "UPDATE dishes SET elo = ?, matches_played = matches_played + 1, " +
        "first_matchup_id = COALESCE(first_matchup_id, ?) WHERE id = ?"
    ).bind(next.b, matchup.id, dishB.id),
  ]);

  const [chefA, chefB] = await Promise.all([
    playerName(env, dishA.poster_discord_id),
    playerName(env, dishB.poster_discord_id),
  ]);

  const image = await renderCard(env, cardKey("result", matchup.id), (attempt) =>
    resultImageUrl(
      env,
      matchup.id,
      dishA,
      dishB,
      votes.a,
      votes.b,
      chefA,
      chefB,
      attempt
    )
  );

  if (!image) {
    await logToDiscord(
      env,
      `Matchup #${matchup.id} closed without a result card — the render never ` +
        `came back. Retry it with /admin/repair-card?matchup=${matchup.id}.`
    );
  }

  const total = votes.a + votes.b;

  const winner =
    votes.a === votes.b
      ? "A draw."
      : votes.a > votes.b
        ? `**${chefA}** takes it.`
        : `**${chefB}** takes it.`;

  if (matchup.message_id) {
    await editMessage(env, matchup.message_id, {
      content:
        `**Matchup #${matchup.id} — closed.** ${winner}\n` +
        `${total} ${total === 1 ? "vote" : "votes"}.\n` +
        `${sourceLink(env, dishA, "#1")} · ${sourceLink(env, dishB, "#2")}`,
      embeds: image ? [{ color: WIN, image: { url: image } }] : [],
      components: [],
      allowed_mentions: allowedMentions(env),
    });
  }
}

export async function closeDueMatchups(
  env: Env,
  now: number,
  { force = false }: { force?: boolean } = {}
): Promise<number> {
  // Forcing ignores closes_at and shuts whatever is open — used to exercise
  // the reveal on demand rather than waiting out a vote window.
  const due = force
    ? await getOpenMatchups(env)
    : await getDueMatchups(env, now);

  for (const matchup of due) {
    await closeOne(env, matchup, now);
  }
  return due.length;
}

/** Weekly standings post. The one place a role ping is appropriate. */
export async function postStandingsIfDue(
  env: Env,
  now: number
): Promise<boolean> {
  const weekday = Number(env.STANDINGS_WEEKDAY ?? "-1");
  if (weekday < 0) return false;

  const date = new Date(now);
  if (date.getUTCDay() !== weekday) return false;
  if (date.getUTCHours() < Number(env.STANDINGS_HOUR_UTC || "17")) return false;

  const lastAt = Number(await getState(env, "last_standings_at")) || 0;
  if (now - lastAt < 6 * 24 * HOUR) return false;

  const standings = await chefStandings(env);
  if (standings.length === 0) return false;

  const snapshotRaw = await getState(env, "standings_snapshot");
  const snapshot: Record<string, number> = snapshotRaw
    ? JSON.parse(snapshotRaw)
    : {};

  const rows = standings.map((chef) => {
    const previous = snapshot[chef.discord_id];
    const elo = Math.round(chef.elo);
    return {
      n: chef.username,
      e: elo,
      d: previous === undefined ? 0 : elo - Math.round(previous),
    };
  });

  const stamp = Math.floor(now / 1000);
  const image = await renderCard(env, cardKey("standings", stamp), (attempt) =>
    standingsImageUrl(env, stamp, "Chef standings", rows, attempt)
  );

  // Unlike a matchup, standings with no card are nothing but a ping. Leave the
  // week un-posted and try again on the next tick rather than send that.
  if (!image) {
    await logToDiscord(env, "Standings card never rendered — not posting.");
    return false;
  }

  const ping = env.TASTER_ROLE_ID ? `<@&${env.TASTER_ROLE_ID}> ` : "";
  await postMessage(env, {
    content: `${ping}This week in the kitchen.`,
    embeds: [{ color: ACCENT, image: { url: image } }],
    allowed_mentions: allowedMentions(env),
  });

  const nextSnapshot: Record<string, number> = {};
  for (const chef of standings) nextSnapshot[chef.discord_id] = chef.elo;

  await setState(env, "standings_snapshot", JSON.stringify(nextSnapshot));
  await setState(env, "last_standings_at", String(now));

  return true;
}

/**
 * Re-renders a matchup's card and puts it back on the message. Open matchups
 * get the matchup card, closed ones the result card.
 *
 * Every card now goes out proven, so this is for the ones that went out before
 * that was true — and for the rare round posted with no card at all. The
 * repair has to arrive at a URL Discord has never seen, or its proxy answers
 * from what it cached the first time, which is the whole problem. That is what
 * the stamp in the key is for.
 */
export async function repairCard(
  env: Env,
  target: { matchupId?: number; messageId?: string }
): Promise<{ repaired: boolean; matchup?: number; reason?: string }> {
  const matchup = target.messageId
    ? await getMatchupByMessage(env, target.messageId)
    : await getMatchup(env, target.matchupId ?? 0);
  if (!matchup) return { repaired: false, reason: "no such matchup" };
  if (!matchup.message_id) {
    return { repaired: false, reason: "that matchup was never posted" };
  }

  const matchupId = matchup.id;

  const [dishA, dishB] = await Promise.all([
    getDish(env, matchup.dish_a_id),
    getDish(env, matchup.dish_b_id),
  ]);
  if (!dishA || !dishB) {
    return { repaired: false, reason: "matchup has a missing dish" };
  }

  const open = matchup.status === "open";
  const stamp = Date.now();

  let image: string | null;
  if (open) {
    image = await renderCard(
      env,
      cardKey("matchup", matchupId, stamp),
      (attempt) => matchupImageUrl(env, matchupId, dishA, dishB, attempt)
    );
  } else {
    // Names are read once rather than per attempt — a retry is a re-render,
    // not a re-count.
    const [chefA, chefB] = await Promise.all([
      playerName(env, dishA.poster_discord_id),
      playerName(env, dishB.poster_discord_id),
    ]);
    image = await renderCard(
      env,
      cardKey("result", matchupId, stamp),
      (attempt) =>
        resultImageUrl(
          env,
          matchupId,
          dishA,
          dishB,
          matchup.votes_a,
          matchup.votes_b,
          chefA,
          chefB,
          attempt
        )
    );
  }

  if (!image) {
    return {
      repaired: false,
      matchup: matchupId,
      reason: "the card still will not render",
    };
  }

  // Only the embed. A PATCH leaves out what it does not name, so the text and
  // the vote buttons stay exactly as they are.
  await editMessage(env, matchup.message_id, {
    embeds: [{ color: open ? ACCENT : WIN, image: { url: image } }],
  });

  return { repaired: true, matchup: matchupId };
}
