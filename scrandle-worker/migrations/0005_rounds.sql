-- Ranking rounds: one card, up to five photographs, ordered best-first by each
-- voter instead of a single pick between two.
--
-- Deliberately its own tables rather than a widening of `matchups`. A pair is
-- a ranking of two and could in principle be the n=2 case of this, but
-- `matchups` is what the everyday game, the standings, the simulation harness
-- and every admin route read, and generalising it would have meant rewriting
-- all of them at once on a bot that is running. The two paths meet in exactly
-- four places: the live-photograph exclusion, the close tick, the cron, and
-- card repair.

CREATE TABLE rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  message_id TEXT,
  created_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE INDEX idx_rounds_status ON rounds (status, closes_at);
CREATE INDEX idx_rounds_message ON rounds (message_id);

-- `slot` is the number printed on the card and carried on the button, 1-based.
-- It is half the primary key because a click arrives as a slot and nothing
-- else — the dish id is never exposed to Discord.
CREATE TABLE round_entries (
  round_id INTEGER NOT NULL REFERENCES rounds (id),
  dish_id INTEGER NOT NULL REFERENCES dishes (id),
  slot INTEGER NOT NULL,
  elo_before REAL,
  elo_after REAL,
  -- Written at close: head-to-head comparisons won across every ballot, and
  -- how many voters put it top. Together they order the result card.
  wins INTEGER,
  firsts INTEGER,
  PRIMARY KEY (round_id, slot),
  UNIQUE (round_id, dish_id)
);

-- One row per photograph per voter, `rank` 1 being their favourite. Somebody
-- who ranks two and stops has two rows, and that is a complete ballot as far
-- as scoring is concerned: everything they ranked beat everything they did not.
--
-- The (round, voter, rank) key is what stops a double-click landing twice, and
-- the (round, voter, dish) one is what stops the same photograph appearing at
-- two different ranks.
CREATE TABLE round_votes (
  round_id INTEGER NOT NULL REFERENCES rounds (id),
  voter_discord_id TEXT NOT NULL,
  dish_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, voter_discord_id, rank),
  UNIQUE (round_id, voter_discord_id, dish_id)
);

CREATE INDEX idx_round_votes_round ON round_votes (round_id);
