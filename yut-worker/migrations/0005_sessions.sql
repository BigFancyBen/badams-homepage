-- The session model: every check-in is one training session against the
-- player's Slayer task (combat.ts), and what happened in it is kept on the
-- check-in for the loot card and the record. The daily prompt's answers
-- ("did you work out in the last 24 hours?") are kept too, so the morning
-- post can show who has answered and a No is never mistaken for silence.

ALTER TABLE checkins ADD COLUMN session TEXT;   -- JSON: monster, kills, damage, maxHit, hitChance, weapon

CREATE TABLE day_answers (
  player_id TEXT NOT NULL,
  day TEXT NOT NULL,
  answer TEXT NOT NULL,                          -- yes | no
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, day)
);
