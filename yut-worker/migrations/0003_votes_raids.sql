-- Group decisions and the opt-in hard mode. Votes are buttons on a bot post,
-- one changeable ballot per player, tally hidden until close. A raid is a
-- week with a boss: check-ins damage it, misses heal it (capped, unnamed).

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                        -- build | relic | raid | finale
  status TEXT NOT NULL DEFAULT 'open',       -- open | passed | failed | expired
  title TEXT NOT NULL,
  message_id TEXT,
  quorum INTEGER NOT NULL,                   -- frozen at open
  roster INTEGER NOT NULL,                   -- active count at open
  opened_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  closed_at INTEGER,
  winning_option INTEGER,
  payload TEXT                               -- JSON, kind-specific (e.g. the boss)
);
CREATE INDEX idx_votes_open ON votes (status, closes_at);

CREATE TABLE vote_options (
  vote_id INTEGER NOT NULL REFERENCES votes (id),
  idx INTEGER NOT NULL,
  label TEXT NOT NULL,
  payload TEXT,                              -- JSON: what applying this option does
  PRIMARY KEY (vote_id, idx)
);

CREATE TABLE vote_ballots (
  vote_id INTEGER NOT NULL REFERENCES votes (id),
  player_id TEXT NOT NULL,
  option_idx INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  PRIMARY KEY (vote_id, player_id)
);

CREATE TABLE relics (
  key TEXT PRIMARY KEY,
  act INTEGER NOT NULL,
  granted_at INTEGER NOT NULL
);

CREATE TABLE raids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id INTEGER,
  boss TEXT NOT NULL,
  start_day TEXT NOT NULL,
  end_day TEXT NOT NULL,                     -- last day of the raid, inclusive
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | active | won | lost
  hp_max INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  roster TEXT NOT NULL,                      -- JSON array of player ids, frozen at vote close
  message_id TEXT,
  result_message_id TEXT
);
CREATE INDEX idx_raids_status ON raids (status);

CREATE TABLE raid_days (
  raid_id INTEGER NOT NULL REFERENCES raids (id),
  day TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  misses INTEGER NOT NULL DEFAULT 0,
  heal INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (raid_id, day)
);
