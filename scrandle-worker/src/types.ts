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
  /**
   * The weekly themed food round: five of one kind of plate, ranked. Same
   * shape as the place round — weekdays, an hour, a flat window and a card
   * size — and disabled the same way, with -1 or an empty list.
   */
  FOOD_ROUND_WEEKDAY: string;
  FOOD_ROUND_HOUR_UTC: string;
  FOOD_ROUND_WINDOW_HOURS: string;
  FOOD_ROUND_BALLOT_SIZE: string;
  /** The same round for drink — five beers, five cocktails, five coffees. */
  DRINK_ROUND_WEEKDAY: string;
  DRINK_ROUND_HOUR_UTC: string;
  DRINK_ROUND_WINDOW_HOURS: string;
  DRINK_ROUND_BALLOT_SIZE: string;
  /** Weekdays for the person bonus, comma-separated, 0 = Sunday. Empty/-1 off. */
  PERSON_WEEKDAY: string;
  PERSON_HOUR_UTC: string;
  /** Minute of the hour the person bonus fires on; the cron must tick on it. */
  PERSON_MINUTE: string;
  /** Flat window for the person bonus — it does not close on a posting hour. */
  PERSON_WINDOW_HOURS: string;
  /**
   * Weekdays for the drink slot. "auto" (or empty) derives them from the size
   * of the drink catalog; an explicit comma-separated list overrides that, and
   * -1 turns the slot off.
   */
  DRINK_WEEKDAY: string;
  DRINK_HOUR_UTC: string;
  /** Flat window for the drink slot — it does not close on a posting hour. */
  DRINK_WINDOW_HOURS: string;
  /** Weekdays the caption contest opens on, comma-separated. Empty/-1 off. */
  CAPTION_WEEKDAY: string;
  CAPTION_HOUR_UTC: string;
  /** How long captions are collected for before the vote opens. */
  CAPTION_WRITING_HOURS: string;
  /** How long the vote runs once the captions are on the board. */
  CAPTION_VOTING_HOURS: string;

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
  /**
   * What it is, one level below the category — "pasta", "steak", "beer". Null
   * until the classifier's kind pass reaches it, and null forever for the
   * categories that have none. See kinds.ts.
   */
  kind: string | null;
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

/**
 * A caption contest. Two live phases rather than one: `writing` while captions
 * are collected, `voting` once they are on the board. See migration 0006 for
 * why it is not a `Round`.
 */
export interface Contest {
  id: number;
  dish_id: number;
  status: "writing" | "voting" | "closed";
  submit_message_id: string | null;
  vote_message_id: string | null;
  created_at: number;
  writing_closes_at: number;
  voting_closes_at: number | null;
  closed_at: number | null;
}

/** One caption. `author_discord_id` null means the bot wrote it. */
export interface ContestEntry {
  id: number;
  contest_id: number;
  author_discord_id: string | null;
  text: string;
  /** Null until voting opens — the order is shuffled at that point. */
  slot: number | null;
  points: number | null;
  firsts: number | null;
  submitted_at: number;
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
  /** Somebody submitted a modal — the caption contest's writing phase. */
  MODAL_SUBMIT: 5,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_UPDATE_MESSAGE: 6,
  /** Opens a text box over the channel. The only way to collect free text. */
  MODAL: 9,
} as const;

/** Message flag 64 = ephemeral: only the person who clicked sees it. */
export const EPHEMERAL = 64;

/**
 * A node in a modal's component tree. Discord has shipped two shapes for this
 * — a text input inside an action row, and one inside a Label — so the value
 * is read by walking rather than by index. Both nest through `components`.
 */
export interface InteractionComponent {
  type: number;
  custom_id?: string;
  value?: string;
  components?: InteractionComponent[];
}

export interface Interaction {
  type: number;
  id: string;
  guild_id?: string;
  channel_id?: string;
  data?: { custom_id?: string; components?: InteractionComponent[] };
  member?: { user: { id: string; username: string } };
  user?: { id: string; username: string };
}
