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
import { openVotes } from "./votes.ts";

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
  }

  return { header, lines, imageUrl };
}

export function digestPayload(
  parts: DigestParts,
  today: string,
  roleId: string | null,
  activeCount: number,
  rollCall: string | null = null
) {
  return {
    content: roleId && activeCount > 0 ? `<@&${roleId}>` : "",
    embeds: [
      {
        color: ACCENT,
        description: [parts.header, QUESTION, ...parts.lines, ...(rollCall ? ["", rollCall] : [])].join("\n"),
        ...(parts.imageUrl ? { image: { url: parts.imageUrl } } : {}),
      },
    ],
    components: [
      buttonRow([
        { label: "Yes", custom_id: `ci:${today}`, style: 3, emoji: "💪" },
        { label: "No, rest day", custom_id: `no:${today}`, style: 2, emoji: "😴" },
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
  await editMessage(env, messageId, digestPayload(parts, today, roleId, roster.length, rollCall));
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
