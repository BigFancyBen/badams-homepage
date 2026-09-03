import type { CombatStyle } from "./config.ts";

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;

  // Plain vars (wrangler.toml)
  DISCORD_APPLICATION_ID: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_GUILD_ID: string;
  DISCORD_CHANNEL_ID: string;
  IMAGE_BASE_URL: string;
  R2_PUBLIC_BASE: string;
  /** The hour the game day turns over. */
  ROLLOVER_HOUR_UTC: string;
  /** The morning post. -1 disables. */
  DAILY_POST_HOUR_UTC: string;
  LAST_CALL_WEEKDAY: string;
  LAST_CALL_HOUR_UTC: string;
  /** The Monday the campaign starts, YYYY-MM-DD. */
  CAMPAIGN_START: string;
  TOWN_TICK_ENABLED: string;
  /** Test only: a command name the Worker holds back past the ack budget. */
  SLOW_COMMAND?: string;

  // Secrets (wrangler secret put)
  DISCORD_BOT_TOKEN: string;
  YUT_IMAGE_SECRET: string;
  ADMIN_SECRET: string;
  DISCORD_LOG_WEBHOOK_URL?: string;

  /** Local testing only — points the Discord client at a mock. */
  DISCORD_API_BASE?: string;
}

export type PlayerStatus = "active" | "paused" | "retired";

export interface Player {
  discord_id: string;
  username: string;
  status: PlayerStatus;
  joined_at: number;
  joined_day: string;
  paused_until: string | null;
  last_active_day: string | null;
  combat_style: CombatStyle;
  form_weeks: number;
  best_form_weeks: number;
  rings: number;
  ring_progress: number;
  graduated_at: number | null;
  recovery_started_day: string | null;
  recovery_count: number;
  event_dry_streak: number;
  title: string | null;
  cosmetics: string;
  bingo_points: number;
  slayer_points: number;
  slayer_streak: number;
  tasks_done: number;
  ping_opt_in: number;
}

export interface Checkin {
  id: number;
  player_id: string;
  day: string;
  week: string;
  ordinal: number;
  weight: number;
  note: string | null;
  attachment_r2_key: string | null;
  attachment_url: string | null;
  attachment_kind: "image" | "video" | null;
  hp_xp: number;
  combat_xp: number;
  combat_style: CombatStyle;
  delivered: string | null;
  /** JSON: the session (monster, kills, damage, maxHit, hitChance, attacks, weapon, armour). */
  session: string | null;
  verified_count: number;
  verified_at: number | null;
  message_id: string | null;
  hour_utc: number;
  created_at: number;
}

export interface Lamp {
  id: number;
  player_id: string;
  xp: number;
  source: string;
  granted_day: string;
  spent_skill: string | null;
  spent_at: number | null;
}

export interface Clue {
  id: number;
  player_id: string;
  tier: string;
  steps: string;
  done: string;
  started_day: string;
  completed_day: string | null;
  loot: string | null;
}

export interface PendingClaim {
  id: number;
  player_id: string;
  kind: string;
  payload: string | null;
  granted_day: string;
  claimed_at: number | null;
}

// ── Discord ────────────────────────────────────────────────────────

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
  width?: number;
  height?: number;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  attachments: DiscordAttachment[];
  author: { id: string; username: string; bot?: boolean };
}

export interface DiscordRole {
  id: string;
  name: string;
}

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  /** "Working on it" — the reply comes later through the webhook token. */
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  /** Rewrites the message the button is on. Works on ephemerals too. */
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

/** Message flag 64 = ephemeral: only the person who clicked sees it. */
export const EPHEMERAL = 64;

export interface InteractionComponent {
  type: number;
  custom_id?: string;
  value?: string;
  components?: InteractionComponent[];
}

export interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: InteractionOption[];
}

export interface Interaction {
  type: number;
  id: string;
  token: string;
  application_id: string;
  guild_id?: string;
  channel_id?: string;
  data?: {
    /** Slash command name, on type 2. */
    name?: string;
    options?: InteractionOption[];
    resolved?: {
      attachments?: Record<string, DiscordAttachment>;
      users?: Record<string, { id: string; username: string }>;
    };
    custom_id?: string;
    components?: InteractionComponent[];
  };
  message?: { id: string; flags?: number };
  member?: { user: { id: string; username: string; global_name?: string } };
  user?: { id: string; username: string; global_name?: string };
}

export interface DiscordUser {
  id: string;
  username: string;
}

/** A button. Style 1 primary, 2 secondary, 3 success, 4 danger. */
export interface Button {
  label: string;
  custom_id: string;
  style?: 1 | 2 | 3 | 4;
  emoji?: string;
  disabled?: boolean;
}

export function buttonRow(buttons: Button[]) {
  return {
    type: 1,
    components: buttons.slice(0, 5).map((button) => ({
      type: 2,
      style: button.style ?? 2,
      label: button.label,
      custom_id: button.custom_id,
      ...(button.emoji ? { emoji: { name: button.emoji } } : {}),
      ...(button.disabled ? { disabled: true } : {}),
    })),
  };
}

/** Up to 25 buttons, five to a row. */
export function buttonRows(buttons: Button[]) {
  const rows = [];
  for (let i = 0; i < buttons.length && rows.length < 5; i += 5) {
    rows.push(buttonRow(buttons.slice(i, i + 5)));
  }
  return rows;
}
