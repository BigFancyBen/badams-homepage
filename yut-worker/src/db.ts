import { STARTING_HITPOINTS_XP } from "./config.ts";
import { ACTIVE_WINDOW_DAYS, FRESH_WINDOW_DAYS, type SkillKey } from "./config.ts";
import { addDays } from "./schedule.ts";
import type {
  Checkin,
  Clue,
  Env,
  Lamp,
  PendingClaim,
  Player,
} from "./types.ts";

/**
 * D1 fails transiently, and since September 2025 retries only what it can
 * prove is read-only. Writes are the caller's problem. See scrandle's db.ts
 * for the error list this is built from.
 */
const RETRYABLE = [
  "Network connection lost",
  "storage caused object to be reset",
  "reset because its code was updated",
  "Cannot resolve D1 DB due to transient issue on remote node",
  "Replica disconnected from primary",
];

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE.some((fragment) => message.includes(fragment));
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 100;

/** Only for idempotent statements: upserts, or inserts guarded by ON CONFLICT. */
export async function retryWrite<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= RETRY_ATTEMPTS - 1 || !isRetryable(error)) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_MS * 2 ** attempt)
      );
    }
  }
}

// ── State ──────────────────────────────────────────────────────────

export async function getState(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM state WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setState(env: Env, key: string, value: string): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO state (key, value) VALUES (?, ?) " +
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value"
    )
      .bind(key, value)
      .run()
  );
}

// ── Players ────────────────────────────────────────────────────────

export async function getPlayer(env: Env, id: string): Promise<Player | null> {
  return env.DB.prepare("SELECT * FROM players WHERE discord_id = ?")
    .bind(id)
    .first<Player>();
}

export async function getPlayers(env: Env): Promise<Player[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM players ORDER BY joined_at"
  ).all<Player>();
  return results;
}

/** Joined and not retired or away. Both derived rosters come from this. */
export async function getPlayingPlayers(env: Env): Promise<Player[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM players WHERE status = 'active' ORDER BY joined_at"
  ).all<Player>();
  return results;
}

/**
 * The active roster, A: joined, not retired, not on expedition, and either
 * inside the first three weeks or with a check-in in the last three.
 */
export function isActive(player: Player, day: string): boolean {
  if (player.status !== "active") return false;
  const joinedWindow = addDays(player.joined_day, ACTIVE_WINDOW_DAYS);
  if (day < joinedWindow) return true;
  if (!player.last_active_day) return false;
  return player.last_active_day >= addDays(day, -ACTIVE_WINDOW_DAYS + 1);
}

/** A check-in in the last four days, today included. The key to every action. */
export function isFresh(player: Player, day: string): boolean {
  if (!player.last_active_day) return false;
  return player.last_active_day > addDays(day, -FRESH_WINDOW_DAYS);
}

export async function activeRoster(env: Env, day: string): Promise<Player[]> {
  return (await getPlayingPlayers(env)).filter((player) => isActive(player, day));
}

export async function joinPlayer(
  env: Env,
  id: string,
  username: string,
  now: number,
  day: string
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO players (discord_id, username, status, joined_at, joined_day) " +
        "VALUES (?, ?, 'active', ?, ?) " +
        "ON CONFLICT (discord_id) DO UPDATE SET " +
        "username = excluded.username, status = 'active', paused_until = NULL"
    )
      .bind(id, username, now, day)
      .run()
  );
  // Everybody starts at Hitpoints 10, as in the game.
  await env.DB.prepare("INSERT OR IGNORE INTO skill_xp (player_id, skill, xp) VALUES (?, 'hitpoints', ?)")
    .bind(id, STARTING_HITPOINTS_XP)
    .run();
}

export async function updatePlayer(
  env: Env,
  id: string,
  fields: Partial<Player>
): Promise<void> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => (fields as Record<string, unknown>)[key]);
  await retryWrite(() =>
    env.DB.prepare(`UPDATE players SET ${sets} WHERE discord_id = ?`)
      .bind(...values, id)
      .run()
  );
}

// ── Skills ─────────────────────────────────────────────────────────

export async function getSkills(
  env: Env,
  playerId: string
): Promise<Partial<Record<SkillKey, number>>> {
  const { results } = await env.DB.prepare(
    "SELECT skill, xp FROM skill_xp WHERE player_id = ?"
  )
    .bind(playerId)
    .all<{ skill: SkillKey; xp: number }>();
  const map: Partial<Record<SkillKey, number>> = {};
  for (const row of results) map[row.skill] = row.xp;
  return map;
}

export async function getAllSkills(
  env: Env
): Promise<Map<string, Partial<Record<SkillKey, number>>>> {
  const { results } = await env.DB.prepare(
    "SELECT player_id, skill, xp FROM skill_xp"
  ).all<{ player_id: string; skill: SkillKey; xp: number }>();
  const map = new Map<string, Partial<Record<SkillKey, number>>>();
  for (const row of results) {
    const entry = map.get(row.player_id) ?? {};
    entry[row.skill] = row.xp;
    map.set(row.player_id, entry);
  }
  return map;
}

/** One statement per skill, for a batch. Adds, never sets. */
export function addXpStatement(
  env: Env,
  playerId: string,
  skill: SkillKey,
  xp: number
): D1PreparedStatement {
  return env.DB.prepare(
    "INSERT INTO skill_xp (player_id, skill, xp) VALUES (?, ?, ?) " +
      "ON CONFLICT (player_id, skill) DO UPDATE SET xp = xp + excluded.xp"
  ).bind(playerId, skill, Math.floor(xp));
}

export async function addXp(
  env: Env,
  playerId: string,
  skill: SkillKey,
  xp: number
): Promise<void> {
  if (xp <= 0) return;
  await addXpStatement(env, playerId, skill, xp).run();
}

// ── Check-ins ──────────────────────────────────────────────────────

export async function getCheckin(env: Env, id: number): Promise<Checkin | null> {
  return env.DB.prepare("SELECT * FROM checkins WHERE id = ?").bind(id).first<Checkin>();
}

export async function getCheckinFor(
  env: Env,
  playerId: string,
  day: string
): Promise<Checkin | null> {
  return env.DB.prepare("SELECT * FROM checkins WHERE player_id = ? AND day = ?")
    .bind(playerId, day)
    .first<Checkin>();
}

/** Check-ins by one player between two game days, inclusive. */
export async function checkinsBetween(
  env: Env,
  playerId: string,
  from: string,
  to: string
): Promise<Checkin[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM checkins WHERE player_id = ? AND day >= ? AND day <= ? ORDER BY day"
  )
    .bind(playerId, from, to)
    .all<Checkin>();
  return results;
}

export async function countCheckinsBetween(
  env: Env,
  playerId: string,
  from: string,
  to: string
): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM checkins WHERE player_id = ? AND day >= ? AND day <= ?"
  )
    .bind(playerId, from, to)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countCheckinsTotal(env: Env, playerId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM checkins WHERE player_id = ?"
  )
    .bind(playerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Everybody's check-ins on one game day. */
export async function checkinsOn(env: Env, day: string): Promise<Checkin[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM checkins WHERE day = ? ORDER BY created_at"
  )
    .bind(day)
    .all<Checkin>();
  return results;
}

/** Everybody's check-ins in a game week. */
export async function checkinsInWeek(env: Env, week: string): Promise<Checkin[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM checkins WHERE week = ? ORDER BY day, created_at"
  )
    .bind(week)
    .all<Checkin>();
  return results;
}

/** Check-ins by everyone between two game days, inclusive. */
export async function allCheckinsBetween(
  env: Env,
  from: string,
  to: string
): Promise<Checkin[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM checkins WHERE day >= ? AND day <= ? ORDER BY day"
  )
    .bind(from, to)
    .all<Checkin>();
  return results;
}

/**
 * Inserts the check-in, or does nothing if one is already in for the day —
 * the UNIQUE constraint is the guard. Returns the new id, or null if the day
 * was already taken.
 */
export async function insertCheckin(
  env: Env,
  row: Omit<Checkin, "id" | "verified_count" | "verified_at" | "message_id">
): Promise<number | null> {
  const result = await env.DB.prepare(
    "INSERT INTO checkins (player_id, day, week, ordinal, weight, note, " +
      "attachment_r2_key, attachment_url, attachment_kind, hp_xp, combat_xp, " +
      "combat_style, delivered, session, hour_utc, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (player_id, day) DO NOTHING"
  )
    .bind(
      row.player_id,
      row.day,
      row.week,
      row.ordinal,
      row.weight,
      row.note,
      row.attachment_r2_key,
      row.attachment_url,
      row.attachment_kind,
      row.hp_xp,
      row.combat_xp,
      row.combat_style,
      row.delivered,
      row.session,
      row.hour_utc,
      row.created_at
    )
    .run();
  if (result.meta.changes === 0) return null;
  return Number(result.meta.last_row_id);
}

export async function setCheckinMessage(
  env: Env,
  id: number,
  messageId: string
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare("UPDATE checkins SET message_id = ? WHERE id = ?")
      .bind(messageId, id)
      .run()
  );
}

export async function getCheckinByMessage(
  env: Env,
  messageId: string
): Promise<Checkin | null> {
  return env.DB.prepare("SELECT * FROM checkins WHERE message_id = ?")
    .bind(messageId)
    .first<Checkin>();
}

// ── Verifications ──────────────────────────────────────────────────

/** Returns false if this person already verified this check-in. */
export async function insertVerification(
  env: Env,
  checkinId: number,
  verifierId: string,
  now: number
): Promise<boolean> {
  const result = await env.DB.prepare(
    "INSERT INTO verifications (checkin_id, verifier_id, created_at) VALUES (?, ?, ?) " +
      "ON CONFLICT (checkin_id, verifier_id) DO NOTHING"
  )
    .bind(checkinId, verifierId, now)
    .run();
  return result.meta.changes > 0;
}

export async function bumpVerifiedCount(
  env: Env,
  checkinId: number,
  now: number
): Promise<number> {
  await env.DB.prepare(
    "UPDATE checkins SET verified_count = verified_count + 1, " +
      "verified_at = COALESCE(verified_at, ?) WHERE id = ?"
  )
    .bind(now, checkinId)
    .run();
  const row = await env.DB.prepare(
    "SELECT verified_count FROM checkins WHERE id = ?"
  )
    .bind(checkinId)
    .first<{ verified_count: number }>();
  return row?.verified_count ?? 0;
}

export interface UnpaidVerification {
  checkin_id: number;
  created_at: number;
}

export async function unpaidVerifications(
  env: Env,
  verifierId: string
): Promise<UnpaidVerification[]> {
  const { results } = await env.DB.prepare(
    "SELECT checkin_id, created_at FROM verifications " +
      "WHERE verifier_id = ? AND paid_checkin_id IS NULL ORDER BY created_at"
  )
    .bind(verifierId)
    .all<UnpaidVerification>();
  return results;
}

export async function markVerificationsPaid(
  env: Env,
  verifierId: string,
  checkinIds: number[],
  paidBy: number
): Promise<void> {
  if (checkinIds.length === 0) return;
  const marks = checkinIds.map(() => "?").join(", ");
  await env.DB.prepare(
    `UPDATE verifications SET paid_checkin_id = ? WHERE verifier_id = ? AND checkin_id IN (${marks})`
  )
    .bind(paidBy, verifierId, ...checkinIds)
    .run();
}

export async function verifierNames(env: Env, checkinId: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT p.username AS username FROM verifications v " +
      "JOIN players p ON p.discord_id = v.verifier_id WHERE v.checkin_id = ? ORDER BY v.created_at"
  )
    .bind(checkinId)
    .all<{ username: string }>();
  return results.map((row) => row.username);
}

// ── Events log ─────────────────────────────────────────────────────

export function logEventStatement(
  env: Env,
  playerId: string,
  day: string,
  checkinId: number | null,
  key: string,
  payload: unknown,
  now: number
): D1PreparedStatement {
  return env.DB.prepare(
    "INSERT INTO events_log (player_id, day, checkin_id, event_key, payload, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(playerId, day, checkinId, key, payload === undefined ? null : JSON.stringify(payload), now);
}

export interface EventRow {
  id: number;
  player_id: string;
  day: string;
  checkin_id: number | null;
  event_key: string;
  payload: string | null;
  created_at: number;
}

export async function eventsOn(env: Env, day: string): Promise<EventRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM events_log WHERE day = ? ORDER BY created_at"
  )
    .bind(day)
    .all<EventRow>();
  return results;
}

export async function countEvents(
  env: Env,
  playerId: string,
  key: string
): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM events_log WHERE player_id = ? AND event_key = ?"
  )
    .bind(playerId, key)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ── Lamps ──────────────────────────────────────────────────────────

export function grantLampStatement(
  env: Env,
  playerId: string,
  xp: number,
  source: string,
  day: string
): D1PreparedStatement {
  return env.DB.prepare(
    "INSERT INTO lamps (player_id, xp, source, granted_day) VALUES (?, ?, ?, ?)"
  ).bind(playerId, xp, source, day);
}

export async function unspentLamps(env: Env, playerId: string): Promise<Lamp[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM lamps WHERE player_id = ? AND spent_at IS NULL ORDER BY id"
  )
    .bind(playerId)
    .all<Lamp>();
  return results;
}

export async function getLamp(env: Env, id: number): Promise<Lamp | null> {
  return env.DB.prepare("SELECT * FROM lamps WHERE id = ?").bind(id).first<Lamp>();
}

/** Returns false if it was already spent — a double click, or a race. */
export async function spendLamp(
  env: Env,
  id: number,
  skill: string,
  now: number
): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE lamps SET spent_skill = ?, spent_at = ? WHERE id = ? AND spent_at IS NULL"
  )
    .bind(skill, now, id)
    .run();
  return result.meta.changes > 0;
}

export async function staleLamps(env: Env, beforeDay: string): Promise<Lamp[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM lamps WHERE spent_at IS NULL AND granted_day < ? ORDER BY id"
  )
    .bind(beforeDay)
    .all<Lamp>();
  return results;
}

// ── Week log ───────────────────────────────────────────────────────

export interface WeekLogRow {
  player_id: string;
  week: string;
  checkins: number;
  outcome: string;
  form_weeks_after: number;
  prayer_xp: number;
}

export async function upsertWeekLog(env: Env, row: WeekLogRow): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO week_log (player_id, week, checkins, outcome, form_weeks_after, prayer_xp) " +
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (player_id, week) DO UPDATE SET " +
        "checkins = excluded.checkins, outcome = excluded.outcome, " +
        "form_weeks_after = excluded.form_weeks_after, prayer_xp = excluded.prayer_xp"
    )
      .bind(row.player_id, row.week, row.checkins, row.outcome, row.form_weeks_after, row.prayer_xp)
      .run()
  );
}

export async function weekLogFor(env: Env, playerId: string): Promise<WeekLogRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM week_log WHERE player_id = ? ORDER BY week"
  )
    .bind(playerId)
    .all<WeekLogRow>();
  return results;
}

// ── Clues ──────────────────────────────────────────────────────────

export async function openClue(env: Env, playerId: string): Promise<Clue | null> {
  return env.DB.prepare(
    "SELECT * FROM clues WHERE player_id = ? AND completed_day IS NULL"
  )
    .bind(playerId)
    .first<Clue>();
}

/** Returns false if the player already holds one. */
export async function insertClue(
  env: Env,
  playerId: string,
  tier: string,
  steps: string[],
  day: string
): Promise<boolean> {
  try {
    await env.DB.prepare(
      "INSERT INTO clues (player_id, tier, steps, started_day) VALUES (?, ?, ?, ?)"
    )
      .bind(playerId, tier, JSON.stringify(steps), day)
      .run();
    return true;
  } catch (error) {
    if (String(error).includes("UNIQUE")) return false;
    throw error;
  }
}

export async function markStep(env: Env, id: number, done: number[]): Promise<void> {
  await env.DB.prepare("UPDATE clues SET done = ? WHERE id = ?")
    .bind(JSON.stringify(done), id)
    .run();
}

export async function completeClue(
  env: Env,
  id: number,
  day: string,
  loot: unknown
): Promise<void> {
  await env.DB.prepare(
    "UPDATE clues SET completed_day = ?, loot = ? WHERE id = ?"
  )
    .bind(day, JSON.stringify(loot), id)
    .run();
}

export async function expireOpenClues(env: Env, day: string): Promise<number> {
  const result = await env.DB.prepare(
    "UPDATE clues SET completed_day = ?, loot = '{\"expired\":true}' WHERE completed_day IS NULL"
  )
    .bind(day)
    .run();
  return result.meta.changes;
}

export async function countCaskets(env: Env, playerId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM clues WHERE player_id = ? AND completed_day IS NOT NULL AND loot NOT LIKE '%expired%'"
  )
    .bind(playerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ── Collection log ─────────────────────────────────────────────────

/** Returns true if the entry is new. */
export async function logEntry(
  env: Env,
  playerId: string,
  key: string,
  day: string
): Promise<boolean> {
  const result = await env.DB.prepare(
    "INSERT INTO collection_log (player_id, entry_key, first_seen_day) VALUES (?, ?, ?) " +
      "ON CONFLICT (player_id, entry_key) DO UPDATE SET count = count + 1"
  )
    .bind(playerId, key, day)
    .run();
  // D1 reports changes = 1 for both branches; read back to tell them apart.
  const row = await env.DB.prepare(
    "SELECT count FROM collection_log WHERE player_id = ? AND entry_key = ?"
  )
    .bind(playerId, key)
    .first<{ count: number }>();
  return result.meta.changes > 0 && (row?.count ?? 0) === 1;
}

export async function logEntries(env: Env, playerId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT entry_key FROM collection_log WHERE player_id = ? ORDER BY first_seen_day"
  )
    .bind(playerId)
    .all<{ entry_key: string }>();
  return results.map((row) => row.entry_key);
}

export async function logCount(env: Env, playerId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM collection_log WHERE player_id = ?"
  )
    .bind(playerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// ── Pending claims ─────────────────────────────────────────────────

export function grantClaimStatement(
  env: Env,
  playerId: string,
  kind: string,
  payload: unknown,
  day: string
): D1PreparedStatement {
  return env.DB.prepare(
    "INSERT INTO pending_claims (player_id, kind, payload, granted_day) VALUES (?, ?, ?, ?)"
  ).bind(playerId, kind, JSON.stringify(payload ?? null), day);
}

export async function openClaims(env: Env, playerId: string): Promise<PendingClaim[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM pending_claims WHERE player_id = ? AND claimed_at IS NULL ORDER BY id"
  )
    .bind(playerId)
    .all<PendingClaim>();
  return results;
}

export async function markClaimed(env: Env, ids: number[], now: number): Promise<void> {
  if (ids.length === 0) return;
  const marks = ids.map(() => "?").join(", ");
  await env.DB.prepare(
    `UPDATE pending_claims SET claimed_at = ? WHERE id IN (${marks})`
  )
    .bind(now, ...ids)
    .run();
}

// ── Ephemeral replies ──────────────────────────────────────────────

export interface EphemeralReply {
  application_id: string;
  token: string;
  created_at: number;
}

export async function getEphemeralReply(
  env: Env,
  scope: string,
  userId: string
): Promise<EphemeralReply | null> {
  const row = await env.DB.prepare(
    "SELECT application_id, token, created_at FROM ephemeral_replies " +
      "WHERE scope = ? AND user_discord_id = ?"
  )
    .bind(scope, userId)
    .first<EphemeralReply>();
  return row ?? null;
}

export async function rememberEphemeralReply(
  env: Env,
  scope: string,
  userId: string,
  applicationId: string,
  token: string,
  now: number
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare(
      "INSERT INTO ephemeral_replies " +
        "(scope, user_discord_id, application_id, token, created_at) " +
        "VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT (scope, user_discord_id) DO UPDATE SET " +
        "application_id = excluded.application_id, " +
        "token = excluded.token, created_at = excluded.created_at"
    )
      .bind(scope, userId, applicationId, token, now)
      .run()
  );
}

export async function forgetStaleEphemeralReplies(
  env: Env,
  before: number
): Promise<void> {
  await retryWrite(() =>
    env.DB.prepare("DELETE FROM ephemeral_replies WHERE created_at < ?")
      .bind(before)
      .run()
  );
}

// ── The daily prompt's answers ─────────────────────────────────────

/** Records a Yes or a No to "did you work out in the last 24 hours?". */
export async function recordAnswer(env: Env, playerId: string, day: string, answer: "yes" | "no", now: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO day_answers (player_id, day, answer, created_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (player_id, day) DO UPDATE SET answer = excluded.answer, created_at = excluded.created_at"
  )
    .bind(playerId, day, answer, now)
    .run();
}

export async function answersOn(env: Env, day: string): Promise<{ player_id: string; answer: string }[]> {
  try {
    const { results } = await env.DB.prepare("SELECT player_id, answer FROM day_answers WHERE day = ?")
      .bind(day)
      .all<{ player_id: string; answer: string }>();
    return results;
  } catch {
    return [];
  }
}

/** Adds a photo or video to a check-in made without one. */
export async function attachProof(env: Env, checkinId: number, key: string, url: string, kind: "image" | "video"): Promise<void> {
  await env.DB.prepare("UPDATE checkins SET attachment_r2_key = ?, attachment_url = ?, attachment_kind = ? WHERE id = ?")
    .bind(key, url, kind, checkinId)
    .run();
}
