-- The camp's stores exist from day one — check-ins haul coins and logs into
-- them, and the Mysterious Old Man drops crates — so the resource table ships
-- before workers and buildings do. Those tables are here too, empty until
-- Founding I turns the camp into a town.

CREATE TABLE town (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'the camp',
  level INTEGER NOT NULL DEFAULT 0,          -- Town Hall level = foundings so far
  last_tick_at INTEGER,
  last_daily_day TEXT,
  beekeeper_until INTEGER,                   -- ms; +25% worker output while set
  besieged_until TEXT
);
INSERT INTO town (id) VALUES (1);

CREATE TABLE town_resources (
  resource TEXT PRIMARY KEY,
  amount REAL NOT NULL DEFAULT 0
);
INSERT INTO town_resources (resource, amount) VALUES
  ('coins', 0), ('ore', 0), ('logs', 0), ('fish', 0), ('bars', 0);

-- Owned by a player; gathers hourly into the owner's sack; delivered on the
-- owner's check-in. owner_id NULL once a quitter's worker goes to the town.
CREATE TABLE workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                        -- miner | woodcutter | fisher | merchant
  tier TEXT NOT NULL DEFAULT 'bronze',
  owner_id TEXT,
  original_owner_id TEXT NOT NULL,
  sack REAL NOT NULL DEFAULT 0,
  sack_updated_at INTEGER,
  fed INTEGER NOT NULL DEFAULT 1,
  name TEXT,
  recruited_at INTEGER NOT NULL,
  town_owned_since INTEGER
);
CREATE INDEX idx_workers_owner ON workers (owner_id);

CREATE TABLE buildings (
  key TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 0,
  condition INTEGER NOT NULL DEFAULT 100,
  built_at INTEGER
);

-- A line item per day: what went in, what the quiet-day rule took.
CREATE TABLE town_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- haul | crate | quiet_day | upkeep | build | repair | recruit | casket | quiz
  resource TEXT NOT NULL,
  amount REAL NOT NULL,
  player_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ledger_day ON town_ledger (day);
