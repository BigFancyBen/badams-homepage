-- Some images cannot be classified and never will be — a 10752x3656 panorama
-- in the catalog exceeds the vision API's dimension limit and fails every
-- time. Without a counter the classifier retries it on every tick forever,
-- and never reports the catalog as finished.
--
-- Dishes that exhaust their attempts keep category NULL, which already
-- excludes them from matchmaking. That is the right outcome: a dish with no
-- category has nothing it could fairly be matched against.

ALTER TABLE dishes ADD COLUMN classify_attempts INTEGER NOT NULL DEFAULT 0;
