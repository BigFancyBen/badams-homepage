-- Scrandle: one pair at a time, voted on in Discord.

CREATE TABLE dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_message_id TEXT NOT NULL UNIQUE,
  attachment_id TEXT NOT NULL,
  poster_discord_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  caption TEXT,
  posted_at INTEGER NOT NULL,
  ingested_at INTEGER NOT NULL,
  elo REAL NOT NULL DEFAULT 1500,
  matches_played INTEGER NOT NULL DEFAULT 0,
  first_matchup_id INTEGER
);

CREATE INDEX idx_dishes_unplayed ON dishes (first_matchup_id, matches_played);
CREATE INDEX idx_dishes_elo ON dishes (elo);
CREATE INDEX idx_dishes_poster ON dishes (poster_discord_id);

CREATE TABLE matchups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_a_id INTEGER NOT NULL REFERENCES dishes (id),
  dish_b_id INTEGER NOT NULL REFERENCES dishes (id),
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  message_id TEXT,
  created_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  closed_at INTEGER,
  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,
  elo_a_before REAL,
  elo_b_before REAL,
  elo_a_after REAL,
  elo_b_after REAL
);

CREATE INDEX idx_matchups_status ON matchups (status, closes_at);
CREATE INDEX idx_matchups_pairs ON matchups (dish_a_id, dish_b_id);

-- One vote per person per matchup, enforced here rather than in application code.
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchup_id INTEGER NOT NULL REFERENCES matchups (id),
  voter_discord_id TEXT NOT NULL,
  picked_dish_id INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  UNIQUE (matchup_id, voter_discord_id)
);

CREATE INDEX idx_votes_matchup ON votes (matchup_id);
CREATE INDEX idx_votes_voter ON votes (voter_discord_id);

CREATE TABLE players (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  first_seen INTEGER NOT NULL
);

-- keys: last_message_id, last_matchup_at, last_standings_at, standings_snapshot
CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
