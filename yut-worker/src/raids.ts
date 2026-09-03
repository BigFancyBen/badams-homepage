import {
  BARRACKS_DAMAGE_PER_LEVEL,
  BERSERKER_BONUS,
  BOSSES,
  RAID_COOLDOWN_WEEKS,
  RAID_FAIL_CONDITION_LOSS,
  RAID_FAIL_STORE_LOSS,
  RAID_HEAL_CAP_PER_DAY,
  RAID_HEAL_PER_MISS,
  RAID_HP_UNITS_PER_HEAD,
  RAID_LOCK_AFTER_FAILURES,
  RAID_LOCK_WEEKS,
  RAID_PROPOSAL_COOLDOWN_DAYS,
  RAID_SUCCESS_BARS,
  RAID_SUCCESS_COINS,
  RAID_SUCCESS_LAMP_XP,
  RESOURCES,
  WALLS_HEAL_REDUCTION_PER_LEVEL,
  type RelicKey,
} from "./config.ts";
import {
  activeRoster,
  allCheckinsBetween,
  countCheckinsBetween,
  getPlayers,
  grantClaimStatement,
  logEntry,
  retryWrite,
} from "./db.ts";
import { ACCENT, GREEN, RED, allowedMentions, editMessage, escapeMarkdown, postMessage } from "./discord.ts";
import { addDays, gameWeek } from "./schedule.ts";
import { creditStatements, effectiveLevel, getBuildings, getStores } from "./town.ts";
import type { Env, Player } from "./types.ts";
import { openVote, openVotes, type VoteRow } from "./votes.ts";

/**
 * Raid weeks: the opt-in hard mode. A proposal passes at 60% of the active
 * roster and at least three yes votes; the raid starts the next Monday; the
 * roster is frozen at vote close minus anyone who sat out. Check-ins damage
 * the boss; each day, every roster member under two check-ins in the trailing
 * week heals it, capped at eighty a day and never named. Win and everyone
 * gets a lamp; lose and the town takes one capped hit. Three straight losses
 * lock the mode for a month.
 */

export interface RaidRow {
  id: number;
  vote_id: number | null;
  boss: string;
  start_day: string;
  end_day: string;
  status: "scheduled" | "active" | "won" | "lost";
  hp_max: number;
  hp: number;
  roster: string;
  message_id: string | null;
  result_message_id: string | null;
}

export function bossDef(key: string) {
  return BOSSES.find((boss) => boss.key === key) ?? BOSSES[0];
}

export function raidRoster(raid: RaidRow): string[] {
  try {
    return JSON.parse(raid.roster) as string[];
  } catch {
    return [];
  }
}

export async function currentRaid(env: Env): Promise<RaidRow | null> {
  try {
    return await env.DB.prepare(
      "SELECT * FROM raids WHERE status IN ('scheduled', 'active') ORDER BY id DESC LIMIT 1"
    ).first<RaidRow>();
  } catch {
    return null;
  }
}

export async function activeRaidFor(env: Env, playerId: string): Promise<RaidRow | null> {
  const raid = await currentRaid(env);
  if (!raid || raid.status !== "active") return null;
  return raidRoster(raid).includes(playerId) ? raid : null;
}

async function recentRaids(env: Env, limit = 5): Promise<RaidRow[]> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM raids WHERE status IN ('won', 'lost') ORDER BY id DESC LIMIT ?"
    )
      .bind(limit)
      .all<RaidRow>();
    return results;
  } catch {
    return [];
  }
}

/** Which boss comes next: the first not yet beaten, in order, for this act. */
export async function nextBoss(env: Env, act: number): Promise<(typeof BOSSES)[number] | null> {
  const { results } = await env.DB.prepare("SELECT boss FROM raids WHERE status = 'won'").all<{ boss: string }>();
  const beaten = new Set(results.map((row) => row.boss));
  return BOSSES.find((boss) => boss.from <= act && !beaten.has(boss.key) && (boss.key !== "elvarg" || act >= 4)) ?? null;
}

/**
 * Why a raid cannot be proposed right now, or null if it can.
 */
export async function proposalBlock(env: Env, day: string, act: number): Promise<string | null> {
  if (act < 3) return "Raids arrive in Act 3.";
  if (await currentRaid(env)) return "A raid is already scheduled or running.";
  if ((await openVotes(env, "raid")).length > 0) return "A raid vote is already open.";
  const recent = await recentRaids(env, RAID_LOCK_AFTER_FAILURES);
  if (recent.length >= RAID_LOCK_AFTER_FAILURES && recent.every((raid) => raid.status === "lost")) {
    const lockedUntil = addDays(recent[0].end_day, RAID_LOCK_WEEKS * 7);
    if (day < lockedUntil) return `Three raids lost in a row. The mode is locked until ${lockedUntil}.`;
  }
  if (recent[0] && day < addDays(recent[0].end_day, RAID_COOLDOWN_WEEKS * 7)) {
    return `The last raid ended ${recent[0].end_day}; the next can start two weeks after.`;
  }
  const lastVote = await env.DB.prepare(
    "SELECT closed_at, status FROM votes WHERE kind = 'raid' ORDER BY id DESC LIMIT 1"
  ).first<{ closed_at: number | null; status: string }>();
  if (lastVote?.status === "failed" && lastVote.closed_at && Date.now() - lastVote.closed_at < RAID_PROPOSAL_COOLDOWN_DAYS * 86400000) {
    return "The last proposal failed less than a week ago.";
  }
  if (!(await nextBoss(env, act))) return "Every boss this act has been beaten.";
  return null;
}

/** Opens the raid vote. `byBot` for the campaign's own proposals. */
export async function proposeRaid(
  env: Env,
  day: string,
  now: number,
  act: number,
  proposer: string
): Promise<{ ok: true; vote: VoteRow } | { ok: false; reason: string }> {
  const block = await proposalBlock(env, day, act);
  if (block) return { ok: false, reason: block };
  const boss = (await nextBoss(env, act))!;
  const roster = await activeRoster(env, day);
  const vote = await openVote(
    env,
    "raid",
    `Raid week: ${boss.name}`,
    [
      { label: "Yes, raid", payload: { yes: true }, line: "Everyone who does not sit out is on the roster." },
      { label: "No", payload: { yes: false } },
      { label: "Sit out", payload: { sitout: true }, line: "Counts as a yes for the vote, but you are not on the roster and forfeit the reward." },
    ],
    now,
    roster.length,
    { boss: boss.key, proposer, start: addDays(gameWeek(day), 7) }
  );
  return { ok: true, vote };
}

/**
 * Called by the vote close. Passing schedules the raid for next Monday with
 * the roster frozen now; the sit-outs count toward the yes but not the
 * roster.
 */
export async function applyRaidVote(
  env: Env,
  vote: VoteRow,
  passed: boolean,
  yesVoters: string[],
  day: string,
  _now: number
): Promise<string> {
  const payload = vote.payload ? JSON.parse(vote.payload) : {};
  const boss = bossDef(payload.boss);
  const { results: sitouts } = await env.DB.prepare(
    "SELECT player_id FROM vote_ballots WHERE vote_id = ? AND option_idx = 2"
  )
    .bind(vote.id)
    .all<{ player_id: string }>();
  const sitting = new Set(sitouts.map((row) => row.player_id));
  const yes = yesVoters.length + sitting.size;
  const needed = Math.max(3, Math.ceil(vote.roster * 0.6));
  if (!passed && yes < needed) {
    return `No raid — ${yes} of ${needed} needed.`;
  }
  const active = (await activeRoster(env, day)).filter((player) => !sitting.has(player.discord_id));
  if (active.length < 2) return "No raid — fewer than two on the roster after sit-outs.";
  const meanDamage = await meanSessionDamage(env, active.map((p) => p.discord_id));
  const hpMax = Math.round(active.length * RAID_HP_UNITS_PER_HEAD * meanDamage * boss.hp);
  const start = payload.start ?? addDays(gameWeek(day), 7);
  const end = addDays(start, boss.days - 1);
  await env.DB.prepare(
    "INSERT INTO raids (vote_id, boss, start_day, end_day, status, hp_max, hp, roster) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)"
  )
    .bind(vote.id, boss.key, start, end, hpMax, hpMax, JSON.stringify(active.map((p) => p.discord_id)))
    .run();
  return `Raid on: ${boss.name}, ${hpMax.toLocaleString("en-US")} HP, ${start} to ${end}, ${active.length} on the roster.`;
}

function hpBar(raid: RaidRow): string {
  const frac = Math.max(0, raid.hp / raid.hp_max);
  const filled = Math.round(frac * 20);
  return `${"█".repeat(filled)}${"░".repeat(20 - filled)} ${Math.max(0, raid.hp).toLocaleString("en-US")} / ${raid.hp_max.toLocaleString("en-US")}`;
}

async function raidPayload(env: Env, raid: RaidRow, lead: string) {
  const names = new Map((await getPlayers(env)).map((p) => [p.discord_id, p.username]));
  const roster = raidRoster(raid).map((id) => escapeMarkdown(names.get(id) ?? "?")).join(", ");
  return {
    embeds: [
      {
        color: raid.status === "won" ? GREEN : raid.status === "lost" ? RED : ACCENT,
        title: `⚔️ ${bossDef(raid.boss).name}`,
        description: `${lead}\n${hpBar(raid)}\nRoster: ${roster}\n${raid.start_day} → ${raid.end_day}. Every check-in hits; every day under form heals it a little.`,
      },
    ],
    allowed_mentions: allowedMentions(),
  };
}

/** Starts anything scheduled for today. */
export async function startDueRaids(env: Env, today: string): Promise<number> {
  let started = 0;
  const raid = await currentRaid(env);
  if (raid && raid.status === "scheduled" && raid.start_day <= today) {
    await env.DB.prepare("UPDATE raids SET status = 'active' WHERE id = ?").bind(raid.id).run();
    const message = await postMessage(env, await raidPayload(env, { ...raid, status: "active" }, "The raid begins."));
    await env.DB.prepare("UPDATE raids SET message_id = ? WHERE id = ?").bind(message.id, raid.id).run();
    started++;
  }
  return started;
}

/** Edits the raid card with the current bar. Silent. */
async function refreshRaidCard(env: Env, raid: RaidRow, lead: string): Promise<void> {
  if (!raid.message_id) return;
  try {
    await editMessage(env, raid.message_id, await raidPayload(env, raid, lead));
  } catch {
    // Gone; the result post still goes out.
  }
}

/**
 * A check-in during a raid. Returns the receipt line, or null if this player
 * is not on the roster.
 */
/** A session's damage lands on the boss, with the Barracks and Berserker on top. */
export async function raidHit(
  env: Env,
  player: Player,
  sessionDamage: number,
  day: string,
  now: number,
  relics: Set<RelicKey>
): Promise<{ line: string; damage: number } | null> {
  const raid = await activeRaidFor(env, player.discord_id);
  if (!raid) return null;
  const buildings = await getBuildings(env);
  let damage = sessionDamage;
  damage *= 1 + BARRACKS_DAMAGE_PER_LEVEL * effectiveLevel(buildings.get("barracks"));
  if (relics.has("berserker")) damage *= 1 + BERSERKER_BONUS;
  damage = Math.round(damage);
  const hp = raid.hp - damage;
  await retryWrite(() =>
    env.DB.batch([
      env.DB.prepare("UPDATE raids SET hp = ? WHERE id = ?").bind(hp, raid.id),
      env.DB.prepare(
        "INSERT INTO raid_days (raid_id, day, damage) VALUES (?, ?, ?) ON CONFLICT (raid_id, day) DO UPDATE SET damage = damage + excluded.damage"
      ).bind(raid.id, day, damage),
    ])
  );
  const updated = { ...raid, hp };
  if (hp <= 0) {
    await resolveRaid(env, updated, "won", day, now);
    return { line: `⚔️ ${damage} to ${bossDef(raid.boss).name} — and it falls!`, damage };
  }
  await refreshRaidCard(env, updated, `Day ${Math.min(bossDef(raid.boss).days, daysInto(raid, day))}.`);
  return { line: `⚔️ ${damage} to ${bossDef(raid.boss).name} (${Math.max(0, hp).toLocaleString("en-US")} left).`, damage };
}

/** A fresh roster with no sessions on record is sized as if each did this much. */
const FALLBACK_SESSION_DAMAGE = 500;

/** The roster's mean damage per full-value session, from their last five check-ins each. */
export async function meanSessionDamage(env: Env, ids: string[]): Promise<number> {
  let total = 0;
  let count = 0;
  for (const id of ids) {
    const { results } = await env.DB.prepare(
      "SELECT session, weight FROM checkins WHERE player_id = ? ORDER BY day DESC LIMIT 5"
    )
      .bind(id)
      .all<{ session: string | null; weight: number }>();
    for (const row of results) {
      try {
        const session = JSON.parse(row.session ?? "null") as { damage?: number } | null;
        if (session && typeof session.damage === "number" && row.weight > 0) {
          total += session.damage / row.weight;
          count++;
        }
      } catch {
        // An old row without a session; skip it.
      }
    }
  }
  return count > 0 ? total / count : FALLBACK_SESSION_DAMAGE;
}

function daysInto(raid: RaidRow, day: string): number {
  return Math.max(1, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${raid.start_day}T00:00:00Z`)) / 86400000) + 1);
}

/**
 * The daily raid close for `yesterday`: heals from roster members under
 * form, capped, unnamed; then the resolution if the raid is over.
 */
export async function raidDailyClose(env: Env, yesterday: string, today: string, now: number): Promise<string | null> {
  const raid = await currentRaid(env);
  if (!raid || raid.status !== "active" || raid.start_day > yesterday) return null;
  const boss = bossDef(raid.boss);
  const buildings = await getBuildings(env);
  const players = new Map((await getPlayers(env)).map((p) => [p.discord_id, p]));
  const roster = raidRoster(raid);
  let misses = 0;
  for (const id of roster) {
    const player = players.get(id);
    if (!player) continue;
    if (player.recovery_started_day) continue; // The Restless Lifter: exempt.
    const recent = await countCheckinsBetween(env, id, addDays(yesterday, -6), yesterday);
    if (recent < 2) misses++;
  }
  const perMiss = Math.max(0, RAID_HEAL_PER_MISS - WALLS_HEAL_REDUCTION_PER_LEVEL * effectiveLevel(buildings.get("walls")));
  const heal = Math.round(Math.min(RAID_HEAL_CAP_PER_DAY, misses * perMiss) * boss.healMultiplier);
  const hp = Math.min(raid.hp_max, raid.hp + heal);
  await env.DB.batch([
    env.DB.prepare("UPDATE raids SET hp = ? WHERE id = ?").bind(hp, raid.id),
    env.DB.prepare(
      "INSERT INTO raid_days (raid_id, day, misses, heal) VALUES (?, ?, ?, ?) ON CONFLICT (raid_id, day) DO UPDATE SET misses = excluded.misses, heal = excluded.heal"
    ).bind(raid.id, yesterday, misses, heal),
  ]);
  const updated = { ...raid, hp };
  if (yesterday >= raid.end_day) {
    await resolveRaid(env, updated, hp <= 0 ? "won" : "lost", today, now);
    return `${boss.name}: ${hp <= 0 ? "won" : "lost"} (${misses} under form on the last day healed ${heal}).`;
  }
  await refreshRaidCard(env, updated, `Day ${daysInto(raid, today)}. ${misses > 0 ? `${misses} under form yesterday healed it ${heal}.` : "Nobody under form yesterday."}`);
  return `${boss.name}: ${hp.toLocaleString("en-US")} HP after ${misses} heals.`;
}

async function resolveRaid(env: Env, raid: RaidRow, status: "won" | "lost", day: string, now: number): Promise<void> {
  const boss = bossDef(raid.boss);
  const roster = raidRoster(raid);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE raids SET status = ?, hp = ? WHERE id = ?").bind(status, Math.max(0, raid.hp), raid.id),
  ];
  const names = new Map((await getPlayers(env)).map((p) => [p.discord_id, p.username]));
  let lead: string;

  if (status === "won") {
    const weekCheckins = await allCheckinsBetween(env, raid.start_day, raid.end_day);
    for (const id of roster) {
      const xp = RAID_SUCCESS_LAMP_XP;
      statements.push(grantClaimStatement(env, id, "lamp", { xp, source: "raid", reason: `${boss.name} slain` }, day));
      if (weekCheckins.filter((c) => c.player_id === id).length >= 3) {
        statements.push(grantClaimStatement(env, id, "lamp", { xp, source: "raid", reason: `${boss.name} — three in the week` }, day));
      }
      await logEntry(env, id, `boss:${boss.key}`, day);
      if (weekCheckins.filter((c) => c.player_id === id).length >= 4) await logEntry(env, id, "boss:raid_survivor", day);
    }
    statements.push(
      ...creditStatements(env, "coins", RAID_SUCCESS_COINS, "raid", day, null, now),
      ...creditStatements(env, "bars", RAID_SUCCESS_BARS, "raid", day, null, now)
    );
    lead = `**${boss.name} is dead.** A lamp for everyone on the roster, waiting on your next check-in; ${RAID_SUCCESS_COINS} coins and ${RAID_SUCCESS_BARS} bars to the town.`;
  } else {
    const stores = await getStores(env);
    for (const resource of RESOURCES) {
      const loss = Math.floor(stores[resource] * RAID_FAIL_STORE_LOSS);
      if (loss > 0) statements.push(...creditStatements(env, resource, -loss, "raid_loss", day, null, now));
    }
    statements.push(
      env.DB.prepare("UPDATE buildings SET condition = MAX(0, condition - ?) WHERE level > 0").bind(RAID_FAIL_CONDITION_LOSS)
    );
    lead = `**${boss.name} stands.** The town lost ${Math.round(RAID_FAIL_STORE_LOSS * 100)}% of its stores and every building took ${RAID_FAIL_CONDITION_LOSS} damage. No lamps. Nothing individual.`;
  }
  await env.DB.batch(statements);
  void names;
  await refreshRaidCard(env, { ...raid, status }, lead);
  try {
    const message = await postMessage(env, await raidPayload(env, { ...raid, status }, lead));
    await env.DB.prepare("UPDATE raids SET result_message_id = ? WHERE id = ?").bind(message.id, raid.id).run();
  } catch {
    // The card was edited; the result is on the record.
  }
}

/** For /raid status and the morning post. */
export async function raidLine(env: Env): Promise<string | null> {
  const raid = await currentRaid(env);
  if (!raid) return null;
  const boss = bossDef(raid.boss);
  if (raid.status === "scheduled") return `Raid: ${boss.name} starts ${raid.start_day} (${raid.hp_max.toLocaleString("en-US")} HP).`;
  return `Raid: ${boss.name} ${hpBar(raid)} — ends ${raid.end_day}.`;
}
