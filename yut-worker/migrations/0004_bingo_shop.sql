-- Bingo and the shop. A 5×5 grid per act, the same 25 tasks for everyone,
-- every cell claimed by the game from check-in data; points are personal and
-- spent in the shop on cosmetics, small lamps and crates for the town.

CREATE TABLE bingo_claims (
  act INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  idx INTEGER NOT NULL,                      -- 0-24, row-major
  claimed_day TEXT NOT NULL,
  PRIMARY KEY (act, player_id, idx)
);

-- Lines and blackouts paid, so they are paid once.
CREATE TABLE bingo_awards (
  act INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  award TEXT NOT NULL,                       -- line:<n> | blackout
  points INTEGER NOT NULL,
  awarded_day TEXT NOT NULL,
  PRIMARY KEY (act, player_id, award)
);

CREATE TABLE shop_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  item TEXT NOT NULL,
  choice TEXT,
  points INTEGER NOT NULL,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_purchases_player ON shop_purchases (player_id);
