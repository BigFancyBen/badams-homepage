-- Yut Hut: the roster, the check-ins, and everything a check-in can produce.
-- The town, votes, raids and acts arrive in their own migrations. One number
-- per file, forever — scrandle's duplicate 0007 pair is the cautionary tale.

-- Who is playing. Only rows here count for anything; the channel's observers
-- have no row and are never named. `status` is what /join, /leave and
-- /expedition set. "Active" (the roster the group formulas use) and "fresh"
-- (checked in within four days, the key to every action) are both derived
-- from last_active_day rather than stored, so they can never go stale.
CREATE TABLE players (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',        -- active | paused | retired
  joined_at INTEGER NOT NULL,
  joined_day TEXT NOT NULL,                     -- game day of /join, for the per-player phases
  paused_until TEXT,                            -- game day an expedition returns on
  last_active_day TEXT,                         -- last game day with a check-in
  combat_style TEXT NOT NULL DEFAULT 'controlled',
  form_weeks INTEGER NOT NULL DEFAULT 0,        -- consecutive game weeks with 2+ check-ins
  best_form_weeks INTEGER NOT NULL DEFAULT 0,
  rings INTEGER NOT NULL DEFAULT 0,             -- Rings of Life held
  ring_progress INTEGER NOT NULL DEFAULT 0,     -- form weeks towards the next ring
  graduated_at INTEGER,
  recovery_started_day TEXT,                    -- The Restless Lifter, if open
  recovery_count INTEGER NOT NULL DEFAULT 0,
  event_dry_streak INTEGER NOT NULL DEFAULT 0,  -- check-ins since the last random event (pity)
  title TEXT,
  cosmetics TEXT NOT NULL DEFAULT '{}',         -- JSON: equipped slots
  bingo_points INTEGER NOT NULL DEFAULT 0,
  slayer_points INTEGER NOT NULL DEFAULT 0,
  slayer_streak INTEGER NOT NULL DEFAULT 0,     -- tasks completed in a row
  tasks_done INTEGER NOT NULL DEFAULT 0,
  ping_opt_in INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_players_status ON players (status);

-- Rows rather than columns: the skill list is config, and adding one is an
-- insert rather than a migration.
CREATE TABLE skill_xp (
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  skill TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, skill)
);

-- One per player per game day, enforced here rather than in code. `week` is
-- the Monday that starts the game week and `ordinal` is which check-in of
-- that week this was, which is what the weight was computed from.
CREATE TABLE checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  day TEXT NOT NULL,
  week TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  weight REAL NOT NULL,
  note TEXT,
  attachment_r2_key TEXT,
  attachment_url TEXT,
  attachment_kind TEXT,                         -- image | video
  hp_xp INTEGER NOT NULL DEFAULT 0,
  combat_xp INTEGER NOT NULL DEFAULT 0,         -- before verification
  combat_style TEXT NOT NULL,
  delivered TEXT,                               -- JSON: what the haul and sacks put in the town
  verified_count INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  message_id TEXT,                              -- the public check-in line
  hour_utc INTEGER NOT NULL,                    -- for the "before 8am" style cells
  created_at INTEGER NOT NULL,
  UNIQUE (player_id, day)
);
CREATE INDEX idx_checkins_player_day ON checkins (player_id, day);
CREATE INDEX idx_checkins_day ON checkins (day);
CREATE INDEX idx_checkins_message ON checkins (message_id);

-- Who pressed Verify on which check-in. `paid_checkin_id` is set once the
-- verifier's own next check-in has paid their Slayer for it.
CREATE TABLE verifications (
  checkin_id INTEGER NOT NULL REFERENCES checkins (id),
  verifier_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_checkin_id INTEGER,
  PRIMARY KEY (checkin_id, verifier_id)
);
CREATE INDEX idx_verifications_verifier ON verifications (verifier_id, paid_checkin_id);

-- Everything a check-in rolled or paid, as a ledger. What the receipt and the
-- morning digest read.
CREATE TABLE events_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  day TEXT NOT NULL,
  checkin_id INTEGER,
  event_key TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_day ON events_log (day);
CREATE INDEX idx_events_player ON events_log (player_id, day);

-- Genie lamps and everything shaped like one. Unspent until spent_at is set;
-- the daily tick rubs anything older than fourteen days into Hitpoints.
CREATE TABLE lamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  xp INTEGER NOT NULL,
  source TEXT NOT NULL,                         -- genie | casket | raid | founding | shop | quest | slayer
  granted_day TEXT NOT NULL,
  spent_skill TEXT,
  spent_at INTEGER
);
CREATE INDEX idx_lamps_unspent ON lamps (player_id, spent_at);

-- Slayer tasks: every player always holds one. "Slay N <monster>" for a
-- master picked by Hitpoints level; every check-in is a kill; the deadline
-- expires the task and resets the streak, nothing more.
CREATE TABLE slayer_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  master TEXT NOT NULL,
  monster TEXT NOT NULL,
  kills_needed INTEGER NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0,
  assigned_day TEXT NOT NULL,
  due_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',        -- active | done | expired | skipped
  points_awarded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tasks_active ON slayer_tasks (player_id, status);

-- One row per player per game week, written at the Monday resolution.
CREATE TABLE week_log (
  player_id TEXT NOT NULL,
  week TEXT NOT NULL,
  checkins INTEGER NOT NULL,
  outcome TEXT NOT NULL,                        -- form | held | broke | paused | idle
  form_weeks_after INTEGER NOT NULL,
  prayer_xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, week)
);

-- Clue scrolls: one held at a time, steps completed by later check-ins.
CREATE TABLE clues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  steps TEXT NOT NULL,                          -- JSON array of step keys
  done TEXT NOT NULL DEFAULT '[]',              -- JSON array of completed step indices; any order
  started_day TEXT NOT NULL,
  completed_day TEXT,
  loot TEXT                                     -- JSON, once the casket is opened
);
CREATE UNIQUE INDEX idx_clues_one_open ON clues (player_id) WHERE completed_day IS NULL;

-- Unique drops, per player. The count on the sheet is rows here.
CREATE TABLE collection_log (
  player_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  first_seen_day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (player_id, entry_key)
);

-- Rewards credited to a player while they were away, surfaced on their next
-- check-in receipt. Nothing in the game waits for anybody to be online.
CREATE TABLE pending_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT,
  granted_day TEXT NOT NULL,
  claimed_at INTEGER
);
CREATE INDEX idx_claims_open ON pending_claims (player_id, claimed_at);

-- The address of the last ephemeral reply per person per scope, so the next
-- click edits it instead of stacking another. See scrandle's 0009 and 0010.
CREATE TABLE ephemeral_replies (
  scope TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (scope, user_discord_id)
);
CREATE INDEX idx_ephemeral_replies_age ON ephemeral_replies (created_at);

-- Cursors and slot keys. Every scheduled thing writes its slot here before it
-- posts, which is what makes a retried tick a no-op.
CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
