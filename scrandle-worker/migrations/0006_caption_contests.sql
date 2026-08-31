-- The caption contest: one photograph, everybody writes a line, then everybody
-- ranks the lines. It is the first format here where players make something
-- rather than judge something, and the first whose contestants are not
-- photographs at all — which is why it gets its own tables rather than a flag
-- on `rounds`.
--
-- `rounds` was close enough to be tempting. It is not: a round entry is a
-- dish_id, its scoring writes back an Elo, and its one card carries five
-- photographs. Here a single photograph is the *prompt*, the entries are text
-- written by people, and nothing gets a rating at the end. Widening `rounds`
-- to cover both would have meant nullable dish ids, nullable Elo columns and
-- a discriminator on every query the ranking round already makes.

CREATE TABLE contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_id INTEGER NOT NULL REFERENCES dishes (id),
  -- 'writing' while captions are being collected, 'voting' once they are on
  -- the board, 'closed' after the result. Two live phases rather than one is
  -- the whole shape of this format.
  status TEXT NOT NULL DEFAULT 'writing',
  -- Two messages, because the voting card cannot be written until the writing
  -- is over. Editing the first one into a ballot would bury it under a day of
  -- channel traffic, so voting gets a post of its own and the first is edited
  -- to point at it.
  submit_message_id TEXT,
  vote_message_id TEXT,
  created_at INTEGER NOT NULL,
  writing_closes_at INTEGER NOT NULL,
  -- Not known until writing actually closes, so it is set then rather than at
  -- creation — a contest that never reached a vote should not carry a
  -- deadline for one.
  voting_closes_at INTEGER,
  closed_at INTEGER
);

CREATE INDEX idx_contests_status ON contests (status, writing_closes_at);
CREATE INDEX idx_contests_submit_message ON contests (submit_message_id);
CREATE INDEX idx_contests_vote_message ON contests (vote_message_id);

CREATE TABLE contest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests (id),
  -- NULL means the bot's own caption — the name the classifier wrote when the
  -- photograph was labelled, entered anonymously alongside the human ones.
  -- SQLite treats NULLs as distinct in a UNIQUE index, so this does not stop a
  -- second bot entry; nothing inserts one, and the alternative is a sentinel
  -- id that would have to be excluded from every player join.
  author_discord_id TEXT,
  text TEXT NOT NULL,
  -- The number on the card and on the button. Assigned when voting opens, so
  -- it is null for the whole writing phase: the order is shuffled at that
  -- point and must not be guessable from the order people submitted in.
  slot INTEGER,
  -- Filled at close. Borda points, and firsts as the tiebreak.
  points INTEGER,
  firsts INTEGER,
  submitted_at INTEGER NOT NULL,
  -- One caption each. Writing again replaces it rather than adding a second.
  UNIQUE (contest_id, author_discord_id)
);

CREATE INDEX idx_contest_entries_contest ON contest_entries (contest_id, slot);

CREATE TABLE contest_votes (
  contest_id INTEGER NOT NULL REFERENCES contests (id),
  voter_discord_id TEXT NOT NULL,
  entry_id INTEGER NOT NULL REFERENCES contest_entries (id),
  -- 1, 2, 3 — best first. Capped in the application rather than here, because
  -- the cap is a rule about the game and this is a rule about the shape.
  rank INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  -- One caption per position, and no caption twice on one ballot. Same pair of
  -- constraints the ranking round uses, for the same reason.
  PRIMARY KEY (contest_id, voter_discord_id, rank),
  UNIQUE (contest_id, voter_discord_id, entry_id)
);

CREATE INDEX idx_contest_votes_contest ON contest_votes (contest_id);
