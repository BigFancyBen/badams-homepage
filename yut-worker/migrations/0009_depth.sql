-- Gear, Slayer choices, the kingdom, the farm and Tears of Guthix.

-- What is worn, JSON {slot: item key}. An item counts only while it is owned
-- (in the bank, or in the collection log for a clue unique) and its
-- requirements are met; a look is worn over the armour.
ALTER TABLE players ADD COLUMN gear TEXT NOT NULL DEFAULT '{}';
-- The one item the player is chasing: its drop rate is doubled.
ALTER TABLE players ADD COLUMN wishlist TEXT;

-- The Slayer master asked for (NULL = the highest the player qualifies for),
-- and the monsters blocked, JSON ["Banshee", ...].
ALTER TABLE players ADD COLUMN slayer_master TEXT;
ALTER TABLE players ADD COLUMN slayer_blocks TEXT NOT NULL DEFAULT '[]';

-- The last game day a farm run was done, and the last game week the Tears of
-- Guthix were visited.
ALTER TABLE players ADD COLUMN farm_day TEXT;
ALTER TABLE players ADD COLUMN tears_week TEXT;

-- Managing Miscellania: one kingdom a player. The days between visits are
-- worked through when the kingdom is next looked at, so nothing here needs
-- the cron.
CREATE TABLE kingdoms (
  player_id TEXT PRIMARY KEY REFERENCES players (discord_id),
  coffer INTEGER NOT NULL DEFAULT 0,
  approval REAL NOT NULL DEFAULT 100,
  workers TEXT NOT NULL DEFAULT '{}',          -- JSON {job: subjects}
  pending TEXT NOT NULL DEFAULT '{}',          -- JSON {job: days' worth gathered, as a fraction of a full day}
  last_day TEXT NOT NULL,                      -- the last game day worked through
  visited_day TEXT NOT NULL,                   -- the last game day the player looked in
  collected_day TEXT
);

-- The farm: one row a patch.
CREATE TABLE farm_patches (
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  patch TEXT NOT NULL,                         -- allotment | herb | tree
  seed TEXT NOT NULL,                          -- item key of the seed
  planted_at INTEGER NOT NULL,
  planted_day TEXT NOT NULL,
  PRIMARY KEY (player_id, patch)
);
