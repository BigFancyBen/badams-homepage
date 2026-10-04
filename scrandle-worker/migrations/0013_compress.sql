-- The bucket held every photograph exactly as the phone made it — about four
-- megabytes each — and nothing here ever shows one at that size. The cards
-- crop to a few hundred pixels, the site's game to 960, and the original is
-- still on Discord, one jump link away, for anyone who wants it. A thousand
-- photographs was already close to half of R2's free ten gigabytes.
--
-- So the bucket keeps a web-sized copy instead, written over the original
-- under the same key (see src/compress.ts). `compressed_at` is when that
-- happened; null is a photograph still stored as it arrived, which is what
-- the compress pass looks for. It is set as well on a photograph that turned
-- out not to be worth shrinking, so that one leaves the queue too.
--
-- The counter is the classifier's, for the same reason: a photograph that
-- cannot be shrunk fails identically every time, and without it the pass
-- would spend a slot on it every tick for good.

ALTER TABLE dishes ADD COLUMN compressed_at INTEGER;
ALTER TABLE dishes ADD COLUMN compress_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_dishes_uncompressed ON dishes (compressed_at, compress_attempts);
