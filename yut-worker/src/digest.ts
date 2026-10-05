import { ACTS, ACT_WEEKS, CAMPAIGN_EVENTS } from "./config.ts";
import {
  activeRoster,
  allCheckinsBetween,
  answersOn,
  checkinsOn,
  getPlayers,
  getState,
  verifierNames,
} from "./db.ts";
import { ACCENT, allowedMentions, editMessage, escapeMarkdown } from "./discord.ts";
import { WEEKDAY_NAMES, actForWeek, addDays, campaignWeek, daysBetween, gameWeek, shortDate, weekdayOf } from "./schedule.ts";
import { getStores, getTown, ledgerOn, storesLine } from "./town.ts";
import { buttonRow, type Env } from "./types.ts";
import { summaryLines, type WeekSummary } from "./weekly.ts";
import { raidLine } from "./raids.ts";
import { championsGuildLine, questIntro, questLine } from "./quests.ts";
import { openVotes } from "./votes.ts";
import { featuredFor, tierName } from "./spoils.ts";
import { bossFor, bossLine, bossWeek } from "./bosses.ts";
import { cardText, viewCard, type PanelSection } from "./cards.ts";
import { logToDiscord } from "./discord.ts";
import { questFor, questRow } from "./quests.ts";

/**
 * The morning post. One message a day, and the only scheduled one most days:
 * the question ("did you work out in the last 24 hours?") with a Yes and a
 * No, yesterday named, the week so far, the camp, and a roll call that the
 * post edits into itself as answers come in. Non-players do not appear
 * anywhere in it.
 */

export const QUESTION = "**Did you work out in the last 24 hours?**";

export interface DigestParts {
  header: string;
  lines: string[];
  imageUrl: string | null;
  /** The day's card, plain enough for a picture: "Act 1 - Week 3 - Day 21 - Lumbridge". */
  cardSub?: string;
}

const CARD_ROSTER = 14;

/**
 * The day's card: the question and the group's shared bars. On Thursday and
 * Sunday, the middle and the end of the week, it also carries the roll call:
 * two slots a player for the week's two check-ins. It is drawn again whenever
 * a check-in changes it, and kept under what is on it.
 */
const ROLL_CALL_DAYS: Record<number, string> = { 3: "Midweek", 6: "Week's end" };
export async function dailyCardUrl(env: Env, today: string, sub: string): Promise<string | null> {
  try {
    const roster = await activeRoster(env, today);
    if (roster.length === 0) return null;
    const counts = new Map<string, number>();
    for (const c of await allCheckinsBetween(env, gameWeek(today), today)) counts.set(c.player_id, (counts.get(c.player_id) ?? 0) + 1);
    const players = [...roster]
      .sort((a, b) => (counts.get(b.discord_id) ?? 0) - (counts.get(a.discord_id) ?? 0) || a.username.localeCompare(b.username))
      .map((p) => ({ n: cardText(p.username) || "someone", c: counts.get(p.discord_id) ?? 0 }));
    const rollCall = ROLL_CALL_DAYS[daysBetween(gameWeek(today), today)];

    const sections: PanelSection[] = [];
    const inForm = players.filter((p) => p.c >= 2).length;
    sections.push({ s: "bar", l: "In form", h: inForm, g: players.length, r: `${inForm} of ${players.length}`, c: "good" });
    const week = campaignWeek(today, env.CAMPAIGN_START);
    const boss = bossFor(week);
    if (boss) {
      const fight = await bossWeek(env, gameWeek(today));
      const left = fight ? Math.max(0, fight.hp - fight.damage) : 0;
      sections.push(
        fight
          ? { s: "bar", l: boss.name, h: left, g: fight.hp, r: fight.status === "done" ? "Defeated" : `${left.toLocaleString("en-US")} / ${fight.hp.toLocaleString("en-US")}`, c: "bad" }
          : { s: "bar", l: boss.name, h: 1, g: 1, r: "Unfought", c: "bad" }
      );
    }
    const quest = questFor(week);
    const row = quest ? await questRow(env, gameWeek(today)) : null;
    if (quest && row) {
      const name = cardText(quest.name);
      if (row.status === "done") sections.push({ s: "bar", l: name, h: 1, g: 1, r: "Complete", c: "good" });
      else if (row.supplies < row.supplies_needed) sections.push({ s: "bar", l: name, h: row.supplies, g: row.supplies_needed, r: `Supplies ${row.supplies} / ${row.supplies_needed}`, c: "warn" });
      else if (row.hp_total > 0) sections.push({ s: "bar", l: name, h: Math.min(row.damage, row.hp_total), g: row.hp_total, r: `Fight ${Math.min(row.damage, row.hp_total).toLocaleString("en-US")} / ${row.hp_total.toLocaleString("en-US")}`, c: "warn" });
    }

    const featured = week > 0 ? featuredFor(today) : null;
    const card = viewCard(env, `daily/${today}`, {
      t: "Did you work out?",
      sub,
      ...(featured ? { big: featured.key } : {}),
      players: rollCall ? players.slice(0, CARD_ROSTER) : [],
      ...(rollCall ? { rc: rollCall } : {}),
      ...(rollCall && players.length > CARD_ROSTER ? { more: players.length - CARD_ROSTER } : {}),
      sections,
      d: today,
    });
    return (await card.cached()) ?? (await card.render());
  } catch (error) {
    await logToDiscord(env, `Daily card failed: ${String(error)}`).catch(() => undefined);
    return null;
  }
}

export async function composeDigest(env: Env, today: string): Promise<DigestParts> {
  const yesterday = addDays(today, -1);
  const week = campaignWeek(today, env.CAMPAIGN_START);
  const act = actForWeek(week, ACT_WEEKS, ACTS.length);
  const actName = ACTS[act - 1]?.name ?? "";
  const dayNumber = Math.max(1, daysBetween(gameWeek(env.CAMPAIGN_START), today) + 1);
  const town = await getTown(env);

  const header =
    week > 0
      ? `**Act ${act} · Week ${week} · Day ${dayNumber}** — ${actName}`
      : `**Pre-season** — ${shortDate(today)}`;

  const lines: string[] = [];
  const roster = await activeRoster(env, today);
  const byId = new Map((await getPlayers(env)).map((p) => [p.discord_id, p]));
  const name = (id: string) => escapeMarkdown(byId.get(id)?.username ?? "someone");

  // Yesterday, named. Misses as a count.
  const yesterdays = await checkinsOn(env, yesterday);
  if (yesterdays.length > 0) {
    const parts: string[] = [];
    for (const checkin of yesterdays) {
      const verified = checkin.verified_count > 0 ? ` (verified by ${(await verifierNames(env, checkin.id)).map(escapeMarkdown).join(", ")})` : "";
      parts.push(`${name(checkin.player_id)}${verified}`);
    }
    lines.push(`Yesterday: ${parts.join(", ")}. ${yesterdays.length} of ${roster.length}.`);
  } else {
    lines.push(`Yesterday: nobody. 0 of ${roster.length}.`);
  }

  // The week so far, as counts.
  const thisWeek = gameWeek(today);
  const weekCheckins = await allCheckinsBetween(env, thisWeek, today);
  const counts = new Map<string, number>();
  for (const c of weekCheckins) counts.set(c.player_id, (counts.get(c.player_id) ?? 0) + 1);
  const inForm = roster.filter((p) => (counts.get(p.discord_id) ?? 0) >= 2).length;
  const oneToGo = roster.filter((p) => (counts.get(p.discord_id) ?? 0) === 1).length;
  if (daysBetween(thisWeek, today) > 0) {
    lines.push(
      `Week so far: ${inForm} in form` + (oneToGo > 0 ? `, ${oneToGo} with one to go` : "") + "."
    );
  }

  // The camp.
  const stores = await getStores(env);
  const ledger = await ledgerOn(env, yesterday);
  const gained: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const line of ledger) {
    if (line.kind === "quiet_day") lost[line.resource] = (lost[line.resource] ?? 0) + Math.abs(line.amount);
    else if (line.amount > 0) gained[line.resource] = (gained[line.resource] ?? 0) + line.amount;
  }
  const gainedText = Object.entries(gained)
    .map(([r, n]) => `+${Math.floor(n)} ${r}`)
    .join(", ");
  const lostText = Object.entries(lost)
    .map(([r, n]) => `−${Math.floor(n)} ${r}`)
    .join(", ");
  const townName = town.level > 0 ? "Town" : "Camp";
  lines.push(
    `${townName}: ${storesLine(stores)}` +
      (gainedText ? ` (${gainedText} yesterday` + (lostText ? `; quiet day: ${lostText})` : ")") : lostText ? ` (quiet day: ${lostText})` : "")
  );

  const raid = await raidLine(env);
  if (raid) lines.push(raid);
  // The quest of the week: introduced on Monday (below), a progress line the rest of the week.
  if (thisWeek !== today) {
    const quest = await questLine(env, today);
    if (quest) lines.push(quest);
  }
  // The boss of the week: the group's shared fight.
  try {
    const boss = await bossLine(env, today);
    if (boss) lines.push(boss);
  } catch {
    // The post goes out without it.
  }
  // Today's featured container: on offer in every full-value check-in's spoils.
  if (week > 0) {
    const featured = featuredFor(today);
    lines.push(`🎁 Today's spoils: **${featured.name}** (${tierName(featured.tier).toLowerCase()}) is on the table for every full-value check-in.`);
  }
  const votes = await openVotes(env);
  if (votes.length > 0) {
    lines.push(
      `Votes open: ${votes.map((v) => `${v.title} (closes <t:${Math.floor(v.closes_at / 1000)}:R>)`).join(" · ")}. \`/vote\`.`
    );
  }


  // Monday: the week's resolution, and the campaign beat if there is one.
  let imageUrl: string | null = null;
  if (thisWeek === today) {
    const raw = await getState(env, `week_summary:${addDays(today, -7)}`);
    if (raw) {
      const summary = JSON.parse(raw) as WeekSummary;
      lines.push(...summaryLines(summary));
      imageUrl = summary.standingsUrl;
    }
    const beat = CAMPAIGN_EVENTS.find((event) => event.week === week);
    if (beat) lines.push(`📯 ${beat.post}`);
    // The Champions' Guild is earned at 32 quest points, as in the game.
    if (beat?.key === "champions_guild") lines.push(await championsGuildLine(env));
    const intro = questIntro(env, today);
    if (intro) lines.push(intro);
  }

  const cardSub = week > 0 ? `Act ${act} - Week ${week} - Day ${dayNumber} - ${actName}` : `Pre-season - ${shortDate(today)}`;
  return { header, lines, imageUrl, cardSub };
}

export function digestPayload(
  parts: DigestParts,
  today: string,
  roleId: string | null,
  activeCount: number,
  rollCall: string | null = null,
  /** The day's card. Monday's standings, when there are any, follow it in an embed of their own. */
  cardUrl: string | null = null
) {
  const lead = cardUrl ?? parts.imageUrl;
  return {
    content: roleId && activeCount > 0 ? `<@&${roleId}>` : "",
    embeds: [
      {
        color: ACCENT,
        description: [parts.header, QUESTION, ...parts.lines, ...(rollCall ? ["", rollCall] : [])].join("\n"),
        ...(lead ? { image: { url: lead } } : {}),
      },
      ...(cardUrl && parts.imageUrl ? [{ color: ACCENT, image: { url: parts.imageUrl } }] : []),
    ],
    components: [
      buttonRow([
        { label: "Yes", custom_id: `ci:${today}`, style: 3, emoji: "💪" },
        { label: "Yes, with a note or photo", custom_id: `cin:${today}`, style: 3, emoji: "📸" },
        { label: "No, rest day", custom_id: `no:${today}`, style: 2, emoji: "😴" },
      ]),
      buttonRow([
        { label: "Menu", custom_id: "hub", style: 1, emoji: "🏠" },
        { label: "My to-do", custom_id: "todo", style: 2, emoji: "📋" },
        { label: "Join the campaign", custom_id: `join:${today}`, style: 2 },
      ]),
    ],
    allowed_mentions: allowedMentions(roleId),
  };
}

/** "Check-ins · Wed 3 Sep" — the name of the day's thread. */
export function threadName(day: string): string {
  return `Check-ins · ${WEEKDAY_NAMES[weekdayOf(day)].slice(0, 3)} ${shortDate(day)}`;
}

/**
 * The day's check-in thread, or null when there is none: creating it failed,
 * or the post predates threads. Callers fall back to the channel.
 */
export async function dailyThread(env: Env, day: string): Promise<string | null> {
  const id = await getState(env, `daily_thread:${day}`);
  return id ? id : null;
}

/** "✅ Ben, Tom · 😴 Alex · 2 still to answer" — roster members only. */
export async function composeRollCall(env: Env, today: string): Promise<string | null> {
  const roster = await activeRoster(env, today);
  if (roster.length === 0) return null;
  const byId = new Map(roster.map((p) => [p.discord_id, p]));
  const yes = (await checkinsOn(env, today)).map((c) => c.player_id).filter((id) => byId.has(id));
  const yesSet = new Set(yes);
  const no = (await answersOn(env, today))
    .filter((a) => a.answer === "no" && byId.has(a.player_id) && !yesSet.has(a.player_id))
    .map((a) => a.player_id);
  const waiting = roster.length - yesSet.size - no.length;
  const name = (id: string) => escapeMarkdown(byId.get(id)?.username ?? "someone");
  const bits: string[] = [];
  if (yes.length > 0) bits.push(`✅ ${yes.map(name).join(", ")}`);
  if (no.length > 0) bits.push(`😴 ${no.map(name).join(", ")}`);
  bits.push(waiting > 0 ? `${waiting} still to answer` : "everyone has answered");
  return bits.join(" · ");
}

/**
 * Edits today's post so the roll call is current. Silent — an edit pings
 * nobody — so a Yes or a No costs the channel nothing.
 */
export async function refreshDailyPost(env: Env, today: string, roleId: string | null): Promise<void> {
  const messageId = await getState(env, `daily_post:${today}`);
  const raw = await getState(env, `daily_parts:${today}`);
  if (!messageId || !raw) return;
  const parts = JSON.parse(raw) as DigestParts;
  const roster = await activeRoster(env, today);
  const rollCall = await composeRollCall(env, today);
  const cardUrl = parts.cardSub ? await dailyCardUrl(env, today, parts.cardSub) : null;
  await editMessage(env, messageId, digestPayload(parts, today, roleId, roster.length, rollCall, cardUrl));
}

/** Yesterday's post, cut down to its header, its first line and the final roll call, with no buttons. */
export function trimmedDigestPayload(parts: DigestParts, rollCall: string | null = null) {
  return {
    embeds: [
      {
        color: ACCENT,
        description: [parts.header, parts.lines[0] ?? "", ...(rollCall ? [rollCall] : [])].join("\n"),
      },
    ],
    components: [],
  };
}

/** Sunday's one line. Nobody named. */
export async function composeLastCall(env: Env, today: string): Promise<string> {
  const roster = await activeRoster(env, today);
  const thisWeek = gameWeek(today);
  const weekCheckins = await allCheckinsBetween(env, thisWeek, today);
  const counts = new Map<string, number>();
  for (const c of weekCheckins) counts.set(c.player_id, (counts.get(c.player_id) ?? 0) + 1);
  const inForm = roster.filter((p) => (counts.get(p.discord_id) ?? 0) >= 2).length;
  const oneShort = roster.filter((p) => (counts.get(p.discord_id) ?? 0) === 1);
  const withRing = oneShort.filter((p) => p.rings > 0).length;
  let line = `⏳ Week closes at 3am. ${inForm} of ${roster.length} in form.`;
  if (oneShort.length > 0) {
    line +=
      ` ${oneShort.length === 1 ? "One player is" : `${oneShort.length} players are`} one short` +
      (withRing > 0 ? ` and ${withRing === oneShort.length ? (withRing === 1 ? "holds" : "hold") : `${withRing} of them hold`} a Ring.` : ".");
  }
  return line;
}
