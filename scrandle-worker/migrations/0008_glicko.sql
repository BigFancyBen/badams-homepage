-- Ratings gain a deviation, and K stops being a constant.
--
-- The everyday pool is 577 photographs and about 6.7 of them go on the board a
-- day counting the weekly five, so a sweep takes roughly three months and a
-- photograph gets about four outings a year. At a fixed K of 24 a photograph
-- that truly belongs 300 points above the opening rating gains about eight
-- points the first time it wins, which is thirty-five games to get where it
-- belongs — the better part of a decade at that rate. Plain Elo at this
-- throughput does not converge slowly; it does not converge.
--
-- Glicko fixes the part that is actually wrong, which is that K encodes a
-- fixed confidence. `rd` is how unsure we are of a photograph's rating, in
-- rating points. It starts wide, so the first few results move a photograph a
-- long way, and narrows as results come in, so an established rating stops
-- being shoved around. See src/elo.ts for the arithmetic and the constants.
--
-- Backfilled by play count rather than set flat, because the two ends of the
-- catalog are in genuinely different states: something that has never played
-- is unrated and should move freely, while the handful with a dozen games
-- behind them are the only ratings here worth protecting. The steps follow
-- what the Glicko update would actually have produced over that many games,
-- rounded — a CASE rather than the formula because SQLite's math functions are
-- a compile-time option and this has to run wherever the migration does.
ALTER TABLE dishes ADD COLUMN rd REAL NOT NULL DEFAULT 250;

UPDATE dishes SET rd = CASE
  WHEN matches_played = 0 THEN 250
  WHEN matches_played = 1 THEN 204
  WHEN matches_played = 2 THEN 177
  WHEN matches_played = 3 THEN 158
  WHEN matches_played = 4 THEN 144
  WHEN matches_played <= 6 THEN 125
  WHEN matches_played <= 9 THEN 108
  WHEN matches_played <= 14 THEN 90
  WHEN matches_played <= 24 THEN 75
  ELSE 60
END;

-- Recorded alongside the ratings they belong to, for the same reason those are
-- recorded: a result card reads what the round did rather than scoring it
-- again, and a deviation without the rating beside it says nothing.
ALTER TABLE matchups ADD COLUMN rd_a_before REAL;
ALTER TABLE matchups ADD COLUMN rd_b_before REAL;
ALTER TABLE matchups ADD COLUMN rd_a_after REAL;
ALTER TABLE matchups ADD COLUMN rd_b_after REAL;

ALTER TABLE round_entries ADD COLUMN rd_before REAL;
ALTER TABLE round_entries ADD COLUMN rd_after REAL;

-- Which matchups are bonuses, said outright.
--
-- The one-at-a-time rule needs to know, and until now it worked it out from
-- the category: the everyday draw is food and nothing else, so a matchup
-- holding anything else could only have come from a bonus. The placement slot
-- breaks that — it draws food, and falls back to a pair when the week has too
-- few new photographs to fill a card. Such a pair would have stood in front of
-- the next everyday matchup and skipped it, which is the exact cycle-skipping
-- the rule exists to prevent.
--
-- Backfilled from the category so the inference this replaces still holds for
-- everything already in the table.
ALTER TABLE matchups ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0;

UPDATE matchups SET bonus = 1 WHERE dish_a_id IN (
  SELECT id FROM dishes WHERE category IS NOT NULL AND category != 'food'
);

-- The placement draw: recent food nobody has voted on yet. The existing
-- category index leads with first_matchup_id and cannot serve the date range.
CREATE INDEX idx_dishes_placement ON dishes (category, matches_played, posted_at);
