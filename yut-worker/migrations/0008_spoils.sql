-- Spoils: every check-in ends with a pick of up to three (the player's own
-- roll, today's featured container, a sure thing). One row per check-in; the
-- options are drawn from a seed, so a retried check-in offers the same three.
-- A row with picked NULL is waiting on the player; the next check-in opens it
-- for them.
CREATE TABLE spoils (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  checkin_id INTEGER NOT NULL UNIQUE,
  day TEXT NOT NULL,
  options TEXT NOT NULL,                -- JSON: [{kind, ...}]
  picked INTEGER,                       -- index into options
  container TEXT,                       -- the jar or chest opened, when the pick was one
  result TEXT,                          -- JSON: what came out
  opened_day TEXT,
  opened_at INTEGER,
  auto INTEGER NOT NULL DEFAULT 0       -- 1 when the next check-in opened it
);
CREATE INDEX idx_spoils_player ON spoils (player_id, picked);

-- Full-value check-ins since a rare container was last on offer: the pity counter.
ALTER TABLE players ADD COLUMN spoils_dry INTEGER NOT NULL DEFAULT 0;

-- The Grand Exchange: the bank's worth less this is what a player can spend.
ALTER TABLE players ADD COLUMN gp_spent INTEGER NOT NULL DEFAULT 0;
-- What is packed for the next session, JSON: {"potion": key, "food": key}.
ALTER TABLE players ADD COLUMN loadout TEXT NOT NULL DEFAULT '{}';

CREATE TABLE ge_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  item TEXT NOT NULL,
  qty INTEGER NOT NULL,
  gp INTEGER NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ge_player ON ge_purchases (player_id);

-- The Achievement Diary: a row when a tier is completed and its lamp paid.
CREATE TABLE diary (
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  tier TEXT NOT NULL,
  completed_day TEXT NOT NULL,
  PRIMARY KEY (player_id, tier)
);
