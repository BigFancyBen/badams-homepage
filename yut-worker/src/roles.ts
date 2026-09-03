import { getState, setState } from "./db.ts";
import { addMemberRole, createRole, listRoles, removeMemberRole } from "./discord.ts";
import type { Env } from "./types.ts";

/**
 * The one mention the bot ever makes: a role players opt into, pinged on the
 * morning post and the Sunday last call and nowhere else. Created on first
 * use and remembered in `state`; if somebody deletes it the next use makes
 * another.
 */
export const PLAYERS_ROLE_NAME = "Yut Hut Players";

export async function playersRoleId(env: Env): Promise<string | null> {
  return getState(env, "players_role_id");
}

export async function ensurePlayersRole(env: Env): Promise<string | null> {
  const known = await playersRoleId(env);
  if (known) return known;
  try {
    const roles = await listRoles(env);
    const existing = roles.find((role) => role.name === PLAYERS_ROLE_NAME);
    const role = existing ?? (await createRole(env, PLAYERS_ROLE_NAME));
    await setState(env, "players_role_id", role.id);
    return role.id;
  } catch {
    // Missing Manage Roles, or the mock. The game runs without pings.
    return null;
  }
}

export async function setPing(env: Env, userId: string, on: boolean): Promise<boolean> {
  const roleId = await ensurePlayersRole(env);
  if (!roleId) return false;
  try {
    if (on) await addMemberRole(env, userId, roleId);
    else await removeMemberRole(env, userId, roleId);
    return true;
  } catch {
    return false;
  }
}
