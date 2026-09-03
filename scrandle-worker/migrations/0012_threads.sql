-- The 9am batch now lives in threads rather than on the channel floor.
--
-- Five matchups at 9am is five cards in the channel, and a day later it is
-- five results on top of them: ten bot posts a day in a channel that exists
-- for people to post their dinner in. So the batch goes out as one message
-- that opens a thread, with the five cards inside it, and the results the
-- next morning do the same — one message, one thread, five reveals. The
-- channel sees two posts a day, and each of them is a door.
--
-- Which means a card and its result are no longer in the channel the config
-- names, and every edit and every jump link has to know where they actually
-- are. `thread_id` is where the card went, `result_thread_id` where the result
-- did. Both null for a matchup posted straight to the channel — every bonus,
-- the placement slot's pair, and everything that went out before this.
--
-- The results thread is found through these rather than kept in `state`: the
-- first matchup of a batch to close opens it and writes the id here, and the
-- rest of the batch reads it back from a sibling row. See resultThreadFor.

ALTER TABLE matchups ADD COLUMN thread_id TEXT;
ALTER TABLE matchups ADD COLUMN result_thread_id TEXT;

CREATE INDEX idx_matchups_thread ON matchups (thread_id);
