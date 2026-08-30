export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;

  // Plain vars (wrangler.toml)
  DISCORD_CHANNEL_ID: string;
  DISCORD_GUILD_ID: string;
  TASTER_ROLE_ID: string;
  IMAGE_BASE_URL: string;
  R2_PUBLIC_BASE: string;
  /** Fallback vote window. Ignored while POST_HOURS_UTC is set. */
  VOTE_WINDOW_HOURS: string;
  /** Comma-separated UTC hours to post on. Empty means any hour. */
  POST_HOURS_UTC: string;
  STANDINGS_WEEKDAY: string;
  STANDINGS_HOUR_UTC: string;
  /** Weekdays for the place round, comma-separated, 0 = Sunday. Empty/-1 off. */
  PLACE_WEEKDAY: string;
  PLACE_HOUR_UTC: string;
  /** Flat window for the place round — it does not close on a posting hour. */
  PLACE_WINDOW_HOURS: string;
  /** How many photographs the weekly place round puts on one card. */
  PLACE_BALLOT_SIZE: string;
  /** Weekdays for the person bonus, comma-separated, 0 = Sunday. Empty/-1 off. */
  PERSON_WEEKDAY: string;
  PERSON_HOUR_UTC: string;
  /** Minute of the hour the person bonus fires on; the cron must tick on it. */
  PERSON_MINUTE: string;
  /** Flat window for the person bonus — it does not close on a posting hour. */
  PERSON_WINDOW_HOURS: string;

  // Secrets (wrangler secret put)
  DISCORD_BOT_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_LOG_WEBHOOK_URL?: string;
  SCRANDLE_IMAGE_SECRET: string;
  BACKFILL_SECRET: string;
  ANTHROPIC_API_KEY: string;

  /** Local testing only — points the Discord client at a mock. */
  DISCORD_API_BASE?: string;
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
  category: string | null;
  name: string | null;
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

/**
 * A ranking round: one card, several photographs, each voter putting them in
 * their own order. Separate from `Matchup` for the reasons in migration 0005.
 */
export interface Round {
  id: number;
  category: string;
  status: "open" | "closed";
  message_id: string | null;
  created_at: number;
  closes_at: number;
  closed_at: number | null;
}

/** A photograph in a ranking round, and how it did once the round closed. */
export interface RoundEntry {
  round_id: number;
  dish_id: number;
  /** The number on the card and on the button. 1-based. */
  slot: number;
  elo_before: number | null;
  elo_after: number | null;
  wins: number | null;
  firsts: number | null;
}

/**
 * A round entry joined to its photograph — what the card, the draw and the
 * close path all want. The entry's own columns are null until the round
 * closes; after that they are the record of what it did, which is what a
 * repair reads rather than scoring the round a second time.
 */
export type RoundDish = Dish & Omit<RoundEntry, "round_id" | "dish_id">;

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
  guild_id?: string;
  channel_id?: string;
  data?: { custom_id?: string };
  member?: { user: { id: string; username: string } };
  user?: { id: string; username: string };
}
