import {
  BUILD_VOTE_OPTIONS,
  VOTE_HOURS,
  VOTE_MIN_QUORUM,
  type BuildingKey,
  type RelicKey,
} from "./config.ts";
import { activeRoster, getPlayers, retryWrite } from "./db.ts";
import { ACCENT, allowedMentions, editMessage, escapeMarkdown, postMessage } from "./discord.ts";
import { grantRelic, relicName } from "./relics.ts";
import { build, buildOptions, canAfford, costLine, getBuildings, getStores, getTown } from "./town.ts";
import { buttonRows, type Button, type Env } from "./types.ts";

/**
 * Group decisions. A vote is a bot post with one button per option; one
 * changeable ballot per player; the tally is hidden until close. Only roster
 * members may vote. Ties go to whoever was voted for first. Nobody voting
 * means the kind's default — build votes carry over, relic votes take the
 * first option, raid votes fail.
 */

export type VoteKind = "build" | "relic" | "raid" | "finale";

export interface VoteRow {
  id: number;
  kind: VoteKind;
  status: "open" | "passed" | "failed" | "expired";
  title: string;
  message_id: string | null;
  quorum: number;
  roster: number;
  opened_at: number;
  closes_at: number;
  closed_at: number | null;
  winning_option: number | null;
  payload: string | null;
}

export interface VoteOption {
  vote_id: number;
  idx: number;
  label: string;
  payload: string | null;
}

export async function openVotes(env: Env, kind?: VoteKind): Promise<VoteRow[]> {
  try {
    const query = kind
      ? env.DB.prepare("SELECT * FROM votes WHERE status = 'open' AND kind = ? ORDER BY id").bind(kind)
      : env.DB.prepare("SELECT * FROM votes WHERE status = 'open' ORDER BY id");
    const { results } = await query.all<VoteRow>();
    return results;
  } catch {
    return [];
  }
}

export async function getVote(env: Env, id: number): Promise<VoteRow | null> {
  return env.DB.prepare("SELECT * FROM votes WHERE id = ?").bind(id).first<VoteRow>();
}

export async function getOptions(env: Env, voteId: number): Promise<VoteOption[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM vote_options WHERE vote_id = ? ORDER BY idx"
  )
    .bind(voteId)
    .all<VoteOption>();
  return results;
}

export async function getBallot(env: Env, voteId: number, playerId: string): Promise<number | null> {
  const row = await env.DB.prepare(
    "SELECT option_idx FROM vote_ballots WHERE vote_id = ? AND player_id = ?"
  )
    .bind(voteId, playerId)
    .first<{ option_idx: number }>();
  return row?.option_idx ?? null;
}

/** Every ballot on these votes, for the reminders' "hasn't voted". */
export async function ballotsFor(
  env: Env,
  voteIds: number[]
): Promise<{ vote_id: number; player_id: string }[]> {
  if (voteIds.length === 0) return [];
  const marks = voteIds.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT vote_id, player_id FROM vote_ballots WHERE vote_id IN (${marks})`
  )
    .bind(...voteIds)
    .all<{ vote_id: number; player_id: string }>();
  return results;
}

export async function castBallot(
  env: Env,
  voteId: number,
  playerId: string,
  idx: number,
  now: number
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO vote_ballots (vote_id, player_id, option_idx, voted_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (vote_id, player_id) DO UPDATE SET option_idx = excluded.option_idx, voted_at = excluded.voted_at"
    )
      .bind(voteId, playerId, idx, now)
      .run()
  );
}

export function voteButtons(voteId: number, options: { idx: number; label: string }[], extra: Button[] = []) {
  const buttons: Button[] = options.map((option) => ({
    label: option.label.slice(0, 80),
    custom_id: `vote:${voteId}:${option.idx}`,
    style: 1,
  }));
  return buttonRows([...buttons, ...extra]);
}

function votePayload(
  vote: { id: number; title: string; kind: VoteKind; quorum: number; closes_at: number },
  options: { idx: number; label: string; payload?: string | null }[],
  lines: string[],
  extra: Button[] = []
) {
  const closes = Math.floor(vote.closes_at / 1000);
  return {
    embeds: [
      {
        color: ACCENT,
        title: vote.title,
        description: [...lines, "", `Closes <t:${closes}:R>. ${vote.quorum} ballots needed. One vote each; change it any time until then.`].join("\n"),
      },
    ],
    components: voteButtons(vote.id, options, extra),
    allowed_mentions: allowedMentions(),
  };
}

/** Posts a vote and records it. */
export async function openVote(
  env: Env,
  kind: VoteKind,
  title: string,
  options: { label: string; payload?: unknown; line?: string }[],
  now: number,
  activeCount: number,
  payload?: unknown,
  extra: Button[] = []
): Promise<VoteRow> {
  const quorum = Math.max(VOTE_MIN_QUORUM, Math.ceil(activeCount / 2));
  const closesAt = now + (VOTE_HOURS[kind] ?? 48) * 60 * 60 * 1000;
  const inserted = await env.DB.prepare(
    "INSERT INTO votes (kind, title, quorum, roster, opened_at, closes_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(kind, title, quorum, activeCount, now, closesAt, payload === undefined ? null : JSON.stringify(payload))
    .run();
  const id = Number(inserted.meta.last_row_id);
  await env.DB.batch(
    options.map((option, idx) =>
      env.DB.prepare("INSERT INTO vote_options (vote_id, idx, label, payload) VALUES (?, ?, ?, ?)").bind(
        id,
        idx,
        option.label,
        option.payload === undefined ? null : JSON.stringify(option.payload)
      )
    )
  );
  const lines = options.map((option, idx) => `**${idx + 1}. ${option.label}**${option.line ? ` — ${option.line}` : ""}`);
  const message = await postMessage(
    env,
    votePayload({ id, title, kind, quorum, closes_at: closesAt }, options.map((o, idx) => ({ idx, label: `${idx + 1}` })), lines, extra)
  );
  await env.DB.prepare("UPDATE votes SET message_id = ? WHERE id = ?").bind(message.id, id).run();
  return (await getVote(env, id))!;
}

interface Tally {
  counts: Map<number, number>;
  total: number;
  winner: number | null;
}

async function tally(env: Env, voteId: number): Promise<Tally> {
  const { results } = await env.DB.prepare(
    "SELECT option_idx, COUNT(*) AS n, MIN(voted_at) AS first FROM vote_ballots WHERE vote_id = ? GROUP BY option_idx"
  )
    .bind(voteId)
    .all<{ option_idx: number; n: number; first: number }>();
  const counts = new Map(results.map((row) => [row.option_idx, row.n]));
  const total = results.reduce((sum, row) => sum + row.n, 0);
  let winner: number | null = null;
  let best = -1;
  let bestFirst = Infinity;
  for (const row of results) {
    if (row.n > best || (row.n === best && row.first < bestFirst)) {
      best = row.n;
      bestFirst = row.first;
      winner = row.option_idx;
    }
  }
  return { counts, total, winner };
}

/**
 * Closes whatever is due and applies the result. Returns one line per closed
 * vote for the tick report.
 */
export async function closeDueVotes(
  env: Env,
  now: number,
  day: string,
  act: number,
  applyRaid: (vote: VoteRow, passed: boolean, yesVoters: string[]) => Promise<string>
): Promise<string[]> {
  const lines: string[] = [];
  for (const vote of await openVotes(env)) {
    if (vote.closes_at > now) continue;
    const result = await tally(env, vote.id);
    const options = await getOptions(env, vote.id);
    let status: VoteRow["status"];
    let outcome = "";

    if (vote.kind === "raid") {
      const { results } = await env.DB.prepare(
        "SELECT player_id FROM vote_ballots WHERE vote_id = ? AND option_idx = 0"
      )
        .bind(vote.id)
        .all<{ player_id: string }>();
      const yes = results.map((r) => r.player_id);
      const passed = yes.length >= Math.max(3, Math.ceil(vote.roster * 0.6));
      status = passed ? "passed" : "failed";
      outcome = await applyRaid(vote, passed, yes);
    } else if (result.total < vote.quorum || result.winner === null) {
      if (vote.kind === "relic" || vote.kind === "finale") {
        // The default: the first option.
        status = "passed";
        outcome = await applyOption(env, vote, options[0], day, act, now);
        result.winner = 0;
      } else {
        status = "expired";
        outcome = `Not enough ballots (${result.total} of ${vote.quorum}). It carries over.`;
      }
    } else {
      status = "passed";
      const option = options.find((o) => o.idx === result.winner)!;
      outcome = await applyOption(env, vote, option, day, act, now);
    }

    await env.DB.prepare(
      "UPDATE votes SET status = ?, closed_at = ?, winning_option = ? WHERE id = ?"
    )
      .bind(status, now, result.winner, vote.id)
      .run();

    const tallyLine = options
      .map((o) => `${o.idx + 1}: ${result.counts.get(o.idx) ?? 0}`)
      .join(" · ");
    if (vote.message_id) {
      try {
        await editMessage(env, vote.message_id, {
          embeds: [
            {
              color: ACCENT,
              title: vote.title,
              description: `Closed. ${outcome}\nBallots — ${tallyLine}.`,
            },
          ],
          components: [],
        });
      } catch {
        // The post is gone; the result stands.
      }
    }
    lines.push(`${vote.title}: ${outcome}`);
  }
  return lines;
}

async function applyOption(
  env: Env,
  vote: VoteRow,
  option: VoteOption,
  day: string,
  act: number,
  now: number
): Promise<string> {
  const payload = option.payload ? JSON.parse(option.payload) : {};
  if (vote.kind === "build" || vote.kind === "finale") {
    const result = await build(env, payload.key as BuildingKey, day, null, now, act);
    return result.ok ? `${option.label} — built.` : `${option.label} — ${result.reason}`;
  }
  if (vote.kind === "relic") {
    await grantRelic(env, payload.key as RelicKey, act, now);
    return `${relicName(payload.key)} is everyone's.`;
  }
  return option.label;
}

/**
 * The Monday build vote: up to four affordable builds or upgrades, cheapest
 * first. Nothing affordable, or one already open, means no vote this week.
 */
export async function openBuildVote(env: Env, day: string, now: number, act: number): Promise<VoteRow | null> {
  if ((await openVotes(env, "build")).length > 0) return null;
  const town = await getTown(env);
  if (town.level < 1) return null;
  const stores = await getStores(env);
  const options = buildOptions(await getBuildings(env), town, act)
    .filter((option) => canAfford(stores, option.cost))
    .sort((a, b) => costTotal(a.cost) - costTotal(b.cost))
    .slice(0, BUILD_VOTE_OPTIONS);
  if (options.length === 0) return null;
  const roster = await activeRoster(env, day);
  return openVote(
    env,
    "build",
    "Build vote",
    options.map((option) => ({
      label: `${option.name} L${option.nextLevel}`,
      payload: { key: option.key },
      line: `${option.effect}. Costs ${costLine(option.cost)}.`,
    })),
    now,
    roster.length
  );
}

function costTotal(cost: Partial<Record<string, number>>): number {
  return Object.values(cost).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

/** A relic pick: three nobody holds, the group picks one, everyone gets it. */
export async function openRelicVote(
  env: Env,
  day: string,
  now: number,
  relics: RelicKey[]
): Promise<VoteRow | null> {
  if (relics.length === 0) return null;
  if ((await openVotes(env, "relic")).length > 0) return null;
  const roster = await activeRoster(env, day);
  const { RELICS } = await import("./config.ts");
  return openVote(
    env,
    "relic",
    "Relic pick",
    relics.map((key) => {
      const relic = RELICS.find((r) => r.key === key)!;
      return { label: relic.name, payload: { key }, line: relic.effect };
    }),
    now,
    roster.length
  );
}

/** The open votes, for /vote. */
export async function voteSummary(env: Env, playerId: string): Promise<{ lines: string[]; components: unknown[] }> {
  const votes = await openVotes(env);
  if (votes.length === 0) return { lines: ["No votes open."], components: [] };
  const lines: string[] = [];
  const components: unknown[] = [];
  const names = new Map((await getPlayers(env)).map((p) => [p.discord_id, p.username]));
  void names;
  for (const vote of votes) {
    const options = await getOptions(env, vote.id);
    const mine = await getBallot(env, vote.id, playerId);
    lines.push(
      `**${vote.title}** — closes <t:${Math.floor(vote.closes_at / 1000)}:R>.` +
        (mine !== null ? ` You picked ${options.find((o) => o.idx === mine)?.label ?? mine + 1}.` : " You have not voted.")
    );
    for (const option of options) lines.push(`  ${option.idx + 1}. ${escapeMarkdown(option.label)}`);
    components.push(...voteButtons(vote.id, options.map((o) => ({ idx: o.idx, label: `${vote.title.split(" ")[0]} ${o.idx + 1}` }))));
  }
  return { lines, components: components.slice(0, 5) };
}
