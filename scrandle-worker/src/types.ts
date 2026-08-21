export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;

  // Plain vars (wrangler.toml)
  DISCORD_CHANNEL_ID: string;
  DISCORD_GUILD_ID: string;
  TASTER_ROLE_ID: string;
  IMAGE_BASE_URL: string;
  R2_PUBLIC_BASE: string;
  VOTE_WINDOW_HOURS: string;
  MIN_HOURS_BETWEEN_MATCHUPS: string;
  STANDINGS_WEEKDAY: string;
  STANDINGS_HOUR_UTC: string;

  // Secrets (wrangler secret put)
  DISCORD_BOT_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_LOG_WEBHOOK_URL?: string;
  SCRANDLE_IMAGE_SECRET: string;
  BACKFILL_SECRET: string;
}

export interface Dish {
  id: number;
  discord_message_id: string;
  attachment_id: string;
  poster_discord_id: string;
  r2_key: string;
  sha256: string;
  caption: string | null;
  posted_at: number;
  ingested_at: number;
  elo: number;
  matches_played: number;
  first_matchup_id: number | null;
}

export interface Matchup {
  id: number;
  dish_a_id: number;
  dish_b_id: number;
  status: "open" | "closed";
  message_id: string | null;
  created_at: number;
  closes_at: number;
  closed_at: number | null;
  votes_a: number;
  votes_b: number;
  elo_a_before: number | null;
  elo_b_before: number | null;
  elo_a_after: number | null;
  elo_b_after: number | null;
}

// ── Discord ────────────────────────────────────────────────────────

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  content_type?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  attachments: DiscordAttachment[];
  author: { id: string; username: string; bot?: boolean };
}

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_UPDATE_MESSAGE: 6,
} as const;

/** Message flag 64 = ephemeral: only the person who clicked sees it. */
export const EPHEMERAL = 64;

export interface Interaction {
  type: number;
  id: string;
  data?: { custom_id?: string };
  member?: { user: { id: string; username: string } };
  user?: { id: string; username: string };
}
