-- The bank: what a player's kills have dropped, rolled against the monster's
-- real drop table (config/drops.json). Never touches town_resources.
--
-- value is the stack's GE worth at drop time, accumulated, so SUM(value) is
-- the bank's worth and value / qty the average price paid; a later price
-- refresh never rewrites history.
CREATE TABLE bank (
  player_id TEXT NOT NULL REFERENCES players (discord_id),
  item TEXT NOT NULL,                 -- item key, e.g. death_rune
  qty INTEGER NOT NULL DEFAULT 0,
  value INTEGER NOT NULL DEFAULT 0,
  first_day TEXT NOT NULL,
  last_day TEXT NOT NULL,
  PRIMARY KEY (player_id, item)
);
CREATE INDEX idx_bank_value ON bank (player_id, value);

-- The session's drops, so a card or a log can be rebuilt without re-rolling:
-- JSON {"s": [[key, qty, value], ...], "t": total}.
ALTER TABLE checkins ADD COLUMN loot TEXT;
