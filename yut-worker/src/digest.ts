import { ACTS, ACT_WEEKS, CAMPAIGN_EVENTS, DRILL_DEMON_LAMP } from "./config.ts";
import {
  activeRoster,
  allCheckinsBetween,
  checkinsOn,
  getPlayers,
  getState,
  openBounties,
  rivalriesInWeek,
  verifierNames,
} from "./db.ts";
import { ACCENT, allowedMentions, escapeMarkdown } from "./discord.ts";
import { actForWeek, addDays, campaignWeek, daysBetween, gameWeek, shortDate } from "./schedule.ts";
import { getStores, getTown, ledgerOn, storesLine } from "./town.ts";
import { buttonRow, type Env } from "./types.ts";
import { summaryLines, type WeekSummary } from "./weekly.ts";

/**
 * The morning post. One message a day, and the only scheduled one most days:
 * yesterday named, misses counted, the week so far, the camp, and the two
 * buttons. Non-players do not appear anywhere in it.
 */

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

  // Bounties, named — a bounty is a promise to somebody, not a miss.
  for (const bounty of await openBounties(env)) {
    lines.push(
      `Bounty: the Drill Demon owes ${name(bounty.player_id)} ${DRILL_DEMON_LAMP} XP if they are back by ${shortDate(bounty.expires_day)}.`
    );
  }

  // Rivalries, leaders only.
  const rivalries = await rivalriesInWeek(env, thisWeek);
  if (rivalries.length > 0 && daysBetween(thisWeek, today) > 0) {
    const units = new Map<string, number>();
    for (const c of weekCheckins) units.set(c.player_id, (units.get(c.player_id) ?? 0) + c.weight);
    const mean = roster.length
      ? roster.reduce((sum, p) => sum + (units.get(p.discord_id) ?? 0), 0) / roster.length
      : 0;
    const bits = rivalries.map((r) => {
      const a = units.get(r.player_a) ?? 0;
      if (!r.player_b) {
        return a >= Math.max(2, mean) ? `${name(r.player_a)} (vs town) on pace` : `${name(r.player_a)} (vs town) behind`;
      }
      const b = units.get(r.player_b) ?? 0;
      if (a === b) return a === 0 ? `${name(r.player_a)}–${name(r.player_b)} not started` : "a dead heat";
      const leader = a > b ? r.player_a : r.player_b;
      const gap = Math.abs(a - b);
      return `${name(leader)} leads${gap >= 1 ? ` by ${gap.toFixed(1)}` : ""}`;
    });
    lines.push(`Rivalries: ${bits.join(" · ")}.`);
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
  activeCount: number
) {
  return {
    content: roleId && activeCount > 0 ? `<@&${roleId}>` : "",
    embeds: [
      {
        color: ACCENT,
        description: [parts.header, ...parts.lines].join("\n"),
        ...(parts.imageUrl ? { image: { url: parts.imageUrl } } : {}),
      },
    ],
    components: [
      buttonRow([
        { label: "Check In", custom_id: `ci:${today}`, style: 3, emoji: "💪" },
        { label: "Join the campaign", custom_id: `join:${today}`, style: 2 },
      ]),
    ],
    allowed_mentions: allowedMentions(roleId),
  };
}

/** Yesterday's post, cut down to its first two lines with no buttons. */
export function trimmedDigestPayload(parts: DigestParts) {
  return {
    embeds: [
      {
        color: ACCENT,
        description: [parts.header, parts.lines[0] ?? ""].join("\n"),
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
