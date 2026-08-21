-- Food should compete with food and drinks with drinks, so every dish needs a
-- category. Each also gets a short name, both to make results readable and to
-- give the channel something to argue about.
--
-- Nullable because classification happens after ingest, in its own pass —
-- calling a vision model inline would push ingest over the subrequest budget.

ALTER TABLE dishes ADD COLUMN category TEXT;
ALTER TABLE dishes ADD COLUMN name TEXT;

-- Matchmaking filters on category and skips anything unclassified.
CREATE INDEX idx_dishes_category ON dishes (category, first_matchup_id, matches_played);
