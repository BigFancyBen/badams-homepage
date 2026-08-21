-- A single Discord message can carry up to ten attachments, and people post
-- three photos of one meal constantly. UNIQUE(discord_message_id) meant only
-- the first survived and the rest were dropped without a trace.
--
-- SQLite cannot drop an inline UNIQUE, so the table gets rebuilt.

CREATE TABLE dishes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_message_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  poster_discord_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  caption TEXT,
  posted_at INTEGER NOT NULL,
  ingested_at INTEGER NOT NULL,
  elo REAL NOT NULL DEFAULT 1500,
  matches_played INTEGER NOT NULL DEFAULT 0,
  first_matchup_id INTEGER,
  UNIQUE (discord_message_id, attachment_id)
);

INSERT INTO dishes_new
  SELECT id, discord_message_id, attachment_id, poster_discord_id, r2_key,
         sha256, caption, posted_at, ingested_at, elo, matches_played,
         first_matchup_id
  FROM dishes;

DROP TABLE dishes;
ALTER TABLE dishes_new RENAME TO dishes;

CREATE INDEX idx_dishes_unplayed ON dishes (first_matchup_id, matches_played);
CREATE INDEX idx_dishes_elo ON dishes (elo);
CREATE INDEX idx_dishes_poster ON dishes (poster_discord_id);
-- Ingest checks this before downloading anything, so it wants its own index.
CREATE INDEX idx_dishes_message ON dishes (discord_message_id);
