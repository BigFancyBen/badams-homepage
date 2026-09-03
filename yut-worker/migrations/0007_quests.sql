-- Quest of the Week: one cooperative Old School quest per campaign week, from
-- the calendar in config.ts and the wiki's data in config/quests.json. The
-- first check-in of the week opens the row; every check-in after it carries
-- a supply and, once the party has gathered enough, a mini-fight against the
-- quest's enemies in order. Unfinished on Monday costs nothing.
CREATE TABLE quests (
  week TEXT PRIMARY KEY,                       -- the Monday, as everywhere else
  campaign_week INTEGER NOT NULL,
  quest TEXT NOT NULL,                         -- the wiki page name, e.g. "Cook's Assistant"
  roster INTEGER NOT NULL,                     -- active roster when it started; sizes the pools
  started_at INTEGER,
  supplies INTEGER NOT NULL DEFAULT 0,         -- gather progress
  supplies_needed INTEGER NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,           -- total across every enemy; the current one is derived
  hp_total INTEGER NOT NULL,                   -- the sum of the pools
  status TEXT NOT NULL DEFAULT 'open',         -- open | done | unfinished
  completed_at INTEGER,
  completed_day TEXT,
  qp INTEGER NOT NULL DEFAULT 0,               -- the quest points, paid to the group when done
  message_id TEXT
);

-- One row per check-in that touched the quest: a retried check-in is a
-- no-op, and /quest can say who did what.
CREATE TABLE quest_hits (
  checkin_id INTEGER PRIMARY KEY,
  week TEXT NOT NULL,
  player_id TEXT NOT NULL,
  supplies INTEGER NOT NULL DEFAULT 0,
  damage INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL
);
CREATE INDEX idx_quest_hits_week ON quest_hits (week);
