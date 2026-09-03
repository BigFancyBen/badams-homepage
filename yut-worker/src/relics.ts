import { RELICS, type RelicKey } from "./config.ts";
import type { Env } from "./types.ts";

/**
 * Relics: the group's picks, one per act from Act 3, held by everyone. The
 * only place consensus buys power, and the power always points at the gym.
 */
export async function getRelics(env: Env): Promise<Set<RelicKey>> {
  try {
    const { results } = await env.DB.prepare("SELECT key FROM relics").all<{ key: RelicKey }>();
    return new Set(results.map((row) => row.key));
  } catch {
    // Before the migration lands, nobody holds anything.
    return new Set();
  }
}

export async function grantRelic(env: Env, key: RelicKey, act: number, now: number): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO relics (key, act, granted_at) VALUES (?, ?, ?) ON CONFLICT (key) DO NOTHING"
  )
    .bind(key, act, now)
    .run();
}

export function relicName(key: string): string {
  return RELICS.find((relic) => relic.key === key)?.name ?? key;
}

/** Three relics nobody holds yet, for a vote. */
export function drawRelics(rng: () => number, held: Set<RelicKey>): RelicKey[] {
  const pool = RELICS.map((relic) => relic.key).filter((key) => !held.has(key));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
