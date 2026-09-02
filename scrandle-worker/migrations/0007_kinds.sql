-- A themed ranking round wants five of the *same thing* — five pastas, five
-- steaks, five beers — and `category` is too coarse to find them. It answers
-- what a photograph may play against, which is all a pair needs; a card of
-- five wants one level finer, or it asks people to rank a lasagne against a
-- cheeseboard and gets back which meal they would rather be eating.
--
-- Nullable for the same reason `category` is: the classifier fills it in a
-- later pass. It is also nullable *forever* for the categories that have no
-- kinds — a pet or a receipt is only ever a caption prompt, and inventing
-- buckets for them would be labelling nothing anybody will draw on.
--
-- Every dish already in the catalog has a category and no kind, so the
-- classifier's pending query has to take "labelled, but not to this depth" as
-- work. See classify.ts.

ALTER TABLE dishes ADD COLUMN kind TEXT;

-- The themed draw groups by kind inside a category and orders by play count,
-- which is exactly this index.
CREATE INDEX idx_dishes_kind ON dishes (category, kind, matches_played);
