-- The boss of the week: an early group boss every campaign week, from the
-- first. Every check-in takes a swing at it; the damage is the group's, and
-- each kill rolls the boss's real drop table for whoever landed it. When the
-- week's kill count is reached, everyone who fought shares the spoils.
CREATE TABLE boss_weeks (
  week TEXT PRIMARY KEY,                       -- the Monday, as everywhere else
  boss TEXT NOT NULL,                          -- key into config/bosses.json
  roster INTEGER NOT NULL,                     -- active roster when it opened
  hp INTEGER NOT NULL,                         -- one kill's hitpoints
  kills_needed INTEGER NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,           -- the group's, all week
  status TEXT NOT NULL DEFAULT 'open',         -- open | done
  completed_day TEXT
);

-- One row per check-in that fought the boss: a retried check-in is a no-op,
-- and /boss can say who did what.
CREATE TABLE boss_hits (
  checkin_id INTEGER PRIMARY KEY,
  week TEXT NOT NULL,
  player_id TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL
);
CREATE INDEX idx_boss_hits_week ON boss_hits (week);
