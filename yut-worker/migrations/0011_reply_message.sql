-- A running reply that went out as a follow-up message. A button answered
-- past Discord's three seconds is only acknowledged, and the answer is posted
-- as a follow-up under the same token; that token's "@original" is then the
-- message the button sat on (the morning post, for a Yes). The next click has
-- to edit the follow-up by its own id, so the id is kept here.
ALTER TABLE ephemeral_replies ADD COLUMN message_id TEXT;
