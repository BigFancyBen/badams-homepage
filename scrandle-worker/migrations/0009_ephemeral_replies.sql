-- Where each person's private reply is, so the next click can edit it.
--
-- Ranking five photographs is five clicks, and each one used to answer with a
-- new ephemeral message. The card scrolled away above a stack of five
-- near-identical "Your order:" lines, four of them already wrong, and the only
-- way to clear them was to dismiss each one by hand.
--
-- Discord will let a bot edit an ephemeral message, but only through the token
-- of the interaction that created it, and only for fifteen minutes. So the
-- token has to be kept somewhere the next click can find it — keyed by the
-- message the buttons are on and the person who clicked, which is exactly the
-- scope of "the reply I am already showing you".
--
-- Not keyed by round or contest id on purpose: the key is the message the
-- buttons live on, so this works for every kind of button the bot posts
-- without knowing what any of them are about.
CREATE TABLE ephemeral_replies (
  message_id TEXT NOT NULL,
  user_discord_id TEXT NOT NULL,
  -- Both halves of the address. The application id travels on every
  -- interaction, so storing it beside the token costs nothing and saves
  -- threading a config var through to reach an endpoint that needs both.
  application_id TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_discord_id)
);

-- Rows are worthless fifteen minutes after they are written and the hourly
-- tick sweeps them. Ordered by age so that sweep is an index scan.
CREATE INDEX idx_ephemeral_replies_age ON ephemeral_replies (created_at);
