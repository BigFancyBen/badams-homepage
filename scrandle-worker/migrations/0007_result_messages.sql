-- The result of a round now goes out as its own message rather than as an edit
-- to the card people voted on.
--
-- A vote window is a day long, so by the time a round shuts, the card it went
-- out on is a day of channel traffic above the fold. Editing the result onto
-- it meant the reveal happened silently: Discord shows nothing for an edit, and
-- only the people who thought to scroll back ever saw who won. The result post
-- replies to the card, so the jump back up comes for free, and the card is
-- edited down to a pointer at the result.
--
-- Which means the message carrying the result is no longer the message the
-- round was posted as, and card repair has to know the difference — it edits
-- whichever one is currently showing the card. Null on every round that closed
-- before this, and the repair falls back to `message_id` for those.

ALTER TABLE matchups ADD COLUMN result_message_id TEXT;
ALTER TABLE rounds ADD COLUMN result_message_id TEXT;
ALTER TABLE contests ADD COLUMN result_message_id TEXT;

-- Repair by message link is the path that needs these: what somebody pastes is
-- whichever message looks wrong to them, which after a close is the result.
CREATE INDEX idx_matchups_result_message ON matchups (result_message_id);
CREATE INDEX idx_rounds_result_message ON rounds (result_message_id);
