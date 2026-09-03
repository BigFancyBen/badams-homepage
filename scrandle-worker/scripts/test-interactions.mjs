#!/usr/bin/env node
/**
 * Exercises POST /interactions against a locally running `wrangler dev`.
 *
 * Discord signs every interaction with Ed25519 over (timestamp + body), so
 * testing this path needs a real keypair — generate one, put the public half
 * in .dev.vars as DISCORD_PUBLIC_KEY, and sign requests with the private half.
 *
 *   node scripts/test-interactions.mjs [matchupId] [roundId] [contestId] [--url ...]
 *
 * Expects .test-key.pem (private key) beside wrangler.toml. The round and
 * contest ids are optional — pass a round that is genuinely open to exercise
 * the ranking buttons, and a contest that is still collecting captions to
 * exercise the modal and the ballot behind it.
 */
import { readFileSync } from "node:fs";
import { createPrivateKey, sign as edSign } from "node:crypto";

const url =
  process.argv.includes("--url")
    ? process.argv[process.argv.indexOf("--url") + 1]
    : "http://localhost:8787";

const GUILD = "108689961535934464";
const CHANNEL = "1290910290086592563";

const privateKey = createPrivateKey(readFileSync(".test-key.pem", "utf-8"));

async function post(payload, { corrupt = false } = {}) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  let signature = edSign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
  if (corrupt) signature = signature.replace(/^./, (c) => (c === "a" ? "b" : "a"));

  const response = await fetch(`${url}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    },
    body,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

let failures = 0;
function check(name, condition, detail) {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failures++;
  console.log(`${mark}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail)}`}`);
}

const matchupId = Number(process.argv[2]) || 1;

// 1. A bad signature must be rejected. Discord probes with one deliberately
//    when you save the endpoint URL, and expects a 401.
const bad = await post({ type: 1 }, { corrupt: true });
check("bad signature → 401", bad.status === 401, bad);

// 2. PING → PONG
const ping = await post({ type: 1 });
check("PING → PONG", ping.status === 200 && ping.body?.type === 1, ping);

// 3. A vote from the configured guild is recorded.
const vote = await post({
  type: 3,
  id: "i1",
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { custom_id: `v:${matchupId}:a` },
  member: { user: { id: "user_tester", username: "tester" } },
});
check(
  "vote accepted",
  vote.status === 200 &&
    (vote.body?.data?.content ?? "").includes(`#${matchupId} → 1`),
  vote
);

// 4. Changing a pick is the same upsert, not a duplicate row.
const change = await post({
  type: 3,
  id: "i2",
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { custom_id: `v:${matchupId}:b` },
  member: { user: { id: "user_tester", username: "tester" } },
});
check(
  "vote changed",
  change.status === 200 &&
    (change.body?.data?.content ?? "").includes(`#${matchupId} → 2`),
  change
);

// 5. Another server must not be able to vote, even with a valid signature.
//    The signature proves the request came from Discord, not from here.
const foreign = await post({
  type: 3,
  id: "i3",
  guild_id: "999999999999999999",
  channel_id: CHANNEL,
  data: { custom_id: `v:${matchupId}:a` },
  member: { user: { id: "user_intruder", username: "intruder" } },
});
check(
  "foreign guild rejected",
  /only runs in its own channel/.test(foreign.body?.data?.content ?? ""),
  foreign
);

// 5b. The 9am batch's cards live in a thread under the channel, so a click on
//     one arrives with the thread's id as channel_id — an id the config has
//     never heard of — and the parent in the channel object. That is let in.
const fromThread = await post({
  type: 3,
  id: "i3b",
  guild_id: GUILD,
  channel_id: "thread_123456789",
  channel: { id: "thread_123456789", parent_id: CHANNEL },
  data: { custom_id: `v:${matchupId}:a` },
  member: { user: { id: "user_tester", username: "tester" } },
});
check(
  "a vote from the batch's thread is accepted",
  fromThread.status === 200 &&
    (fromThread.body?.data?.content ?? "").includes(`#${matchupId} → 1`),
  fromThread
);

// 5c. A thread under some other channel is not the game's, whatever it says.
const strayThread = await post({
  type: 3,
  id: "i3c",
  guild_id: GUILD,
  channel_id: "thread_987654321",
  channel: { id: "thread_987654321", parent_id: "111111111111111111" },
  data: { custom_id: `v:${matchupId}:a` },
  member: { user: { id: "user_tester", username: "tester" } },
});
check(
  "a thread under another channel is turned away",
  /only runs in its own channel/.test(strayThread.body?.data?.content ?? ""),
  strayThread
);

// 6. A button that is not ours.
const junk = await post({
  type: 3,
  id: "i4",
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { custom_id: "something:else" },
  member: { user: { id: "user_tester", username: "tester" } },
});
check("unknown custom_id rejected", /not one of mine/.test(junk.body?.data?.content ?? ""), junk);

// ── one reply across the whole board ───────────────────────────────
// Editing is a real call to Discord, so every check that turns on it needs the
// mock running and DISCORD_API_BASE in .dev.vars pointed at it. Without that
// the worker correctly falls back to a fresh message every time, which is the
// right behaviour and not what these checks are about.
const mockPort = Number(process.env.MOCK_DISCORD_PORT ?? 9911);
const mockUp = await fetch(`http://127.0.0.1:${mockPort}/`)
  .then(() => true)
  .catch(() => false);

if (mockUp) {
  // A voter nobody has used, so a re-run inside the fifteen minutes a token
  // lives for does not find the last run's reply and open at an edit. A vote
  // reply is keyed by the person and the board, and there is no card in that
  // key to vary instead — which is exactly what the second check is about.
  const voter = { user: { id: `user_voter_${Date.now()}`, username: "voter" } };

  const voteFrom = (messageId, side, seq, member = voter) =>
    post({
      type: 3,
      id: `bd${seq}`,
      token: `board_token_${seq}`,
      application_id: "app_scrandle",
      guild_id: GUILD,
      channel_id: CHANNEL,
      message: { id: messageId },
      data: { custom_id: `v:${matchupId}:${side}` },
      member,
    });

  const firstVote = await voteFrom("card_one", "a", 1);
  check(
    "the first vote sends a reply",
    firstVote.body?.type === 4 &&
      (firstVote.body?.data?.content ?? "").includes(`#${matchupId} → 1`),
    firstVote
  );

  // The 9am batch is five matchups on five messages. This vote arrives from a
  // different card and must still edit the first one's reply — keyed by the
  // message, it would open a second, and the stack is back with vote lines in
  // it.
  const secondVote = await voteFrom("card_two", "b", 2);
  check(
    "a vote from another card edits it rather than sending another",
    secondVote.body?.type === 6,
    secondVote
  );

  // The board is shared; the reply is not.
  const other = { user: { id: `user_voter_two_${Date.now()}`, username: "voter two" } };
  const theirVote = await voteFrom("card_two", "a", 3, other);
  check("somebody else voting gets their own reply", theirVote.body?.type === 4, theirVote);
} else {
  console.log(
    `SKIP  one reply across the board (start the mock: MOCK_DISCORD_PORT=${mockPort} npm run mock:discord)`
  );
}

// ── ranking rounds ─────────────────────────────────────────────────
// Only run when a round id is given, because every one of these needs a round
// that is genuinely open — there is nothing here that can conjure one.
const roundId = Number(process.argv[3]);

if (Number.isInteger(roundId) && roundId > 0) {
  const ranker = { user: { id: "user_ranker", username: "ranker" } };
  const click = (customId, member = ranker) =>
    post({
      type: 3,
      id: `r${customId}`,
      guild_id: GUILD,
      channel_id: CHANNEL,
      data: { custom_id: customId },
      member,
    });

  // Start from a clean ballot, so a re-run does not trip over the last one.
  await click(`bx:${roundId}`);

  const first = await click(`b:${roundId}:3`);
  check(
    "first click opens a ballot",
    /Your order: #3\./.test(first.body?.data?.content ?? ""),
    first
  );

  const second = await click(`b:${roundId}:1`);
  check(
    "the second click lands after the first",
    /Your order: #3 › #1\./.test(second.body?.data?.content ?? ""),
    second
  );

  // Clicking the same photograph twice must not put it in twice, and must not
  // silently reorder the ballot either.
  const repeat = await click(`b:${roundId}:3`);
  check(
    "ranking the same one twice is refused, and says so",
    /already ranked #3/.test(repeat.body?.data?.content ?? "") &&
      /Your order: #3 › #1\./.test(repeat.body?.data?.content ?? ""),
    repeat
  );

  const missing = await click(`b:${roundId}:9`);
  check(
    "a slot that is not in the round is turned away",
    /not in this round/.test(missing.body?.data?.content ?? ""),
    missing
  );

  const cleared = await click(`bx:${roundId}`);
  check("start over clears it", /Cleared/.test(cleared.body?.data?.content ?? ""), cleared);

  const afterClear = await click(`b:${roundId}:2`);
  check(
    "and the next click starts a fresh ballot",
    /Your order: #2\./.test(afterClear.body?.data?.content ?? ""),
    afterClear
  );

  const gone = await click(`b:999999:1`);
  check("an unknown round is turned away", /round is gone/.test(gone.body?.data?.content ?? ""), gone);

  // ── one running reply, not one per click ─────────────────────────
  // Five clicks on one card used to leave five ephemeral messages stacked
  // under it. Now the first click sends one and the rest edit it, which means
  // the reply to every click after the first is DEFERRED_UPDATE_MESSAGE —
  // "nothing to say about the message you clicked" — with the text going out
  // as an edit. A ranking round is scoped to its card, so these also check
  // that another card is another conversation.
  if (mockUp) {
    // A card id nothing else has used, so a re-run inside the fifteen minutes
    // a token lives for does not find the last run's reply and start at an
    // edit. Everything here is keyed by (message, person).
    const card = `card_${Date.now()}`;
    const editor = { user: { id: "user_editor", username: "editor" } };

    const onCard = (customId, seq, member = editor, messageId = card) =>
      post({
        type: 3,
        id: `e${seq}`,
        token: `token_${seq}`,
        application_id: "app_scrandle",
        guild_id: GUILD,
        channel_id: CHANNEL,
        message: { id: messageId },
        data: { custom_id: customId },
        member,
      });

    const opened = await onCard(`bx:${roundId}`, 1);
    check(
      "the first click on a card sends a reply",
      opened.body?.type === 4 && /Cleared/.test(opened.body?.data?.content ?? ""),
      opened
    );

    const secondClick = await onCard(`b:${roundId}:1`, 2);
    check(
      "the second click edits it rather than sending another",
      secondClick.body?.type === 6,
      secondClick
    );

    const thirdClick = await onCard(`b:${roundId}:2`, 3);
    check("and so does the third", thirdClick.body?.type === 6, thirdClick);

    // The reply belongs to one person, not to the card. Somebody else's first
    // click must not land as an edit of a message they cannot see.
    const other = { user: { id: "user_editor_two", username: "editor two" } };
    const theirs = await onCard(`b:${roundId}:1`, 4, other);
    check(
      "somebody else on the same card gets their own reply",
      theirs.body?.type === 4,
      theirs
    );

    // And it belongs to one card. A click on the next round is a new
    // conversation, not more of the last one.
    const elsewhere = await onCard(`b:${roundId}:3`, 5, editor, `${card}_b`);
    check(
      "the same person on another card gets a new reply",
      elsewhere.body?.type === 4,
      elsewhere
    );
  } else {
    console.log(
      `SKIP  editing one reply per card (start the mock: MOCK_DISCORD_PORT=${mockPort} npm run mock:discord)`
    );
  }
} else {
  console.log("SKIP  ranking rounds (pass an open round id as the second argument)");
}

// ── caption contests ───────────────────────────────────────────────
// Pass a contest id that is still collecting captions. The block writes two
// captions through the modal, then moves the contest to its vote through the
// admin route and exercises the ballot — which is the real transition, not a
// second fixture standing in for it.
const contestId = Number(process.argv[4]);

if (Number.isInteger(contestId) && contestId > 0) {
  const secret = process.env.BACKFILL_SECRET ?? "dev-only-backfill-secret";

  const writer = { user: { id: "user_writer", username: "writer" } };
  const second = { user: { id: "user_second", username: "second" } };

  const click = (customId, member = writer) =>
    post({
      type: 3,
      id: `c${customId}`,
      guild_id: GUILD,
      channel_id: CHANNEL,
      data: { custom_id: customId },
      member,
    });

  /** A modal coming back, in the action-row shape Discord sends today. */
  const submit = (customId, value, member = writer) =>
    post({
      type: 5,
      id: `s${customId}`,
      guild_id: GUILD,
      channel_id: CHANNEL,
      data: {
        custom_id: customId,
        components: [
          {
            type: 1,
            components: [{ type: 4, custom_id: "caption", value }],
          },
        ],
      },
      member,
    });

  const opened = await click(`cw:${contestId}`);
  check(
    "the write button opens a modal",
    opened.body?.type === 9 && opened.body?.data?.custom_id === `cm:${contestId}`,
    opened
  );

  const wrote = await submit(`cm:${contestId}`, "a genuinely baffling photograph");
  check(
    "a caption is recorded",
    /In\. Yours reads/.test(wrote.body?.data?.content ?? ""),
    wrote
  );

  // Writing again is editing, not entering twice. If it were an insert the
  // second one would fail the unique index and lose the caption silently.
  const rewrote = await submit(`cm:${contestId}`, "second thoughts, sharper");
  check(
    "writing again replaces rather than duplicates",
    /Changed it to/.test(rewrote.body?.data?.content ?? ""),
    rewrote
  );

  // Whitespace is collapsed, not just trimmed: a caption goes into a numbered
  // list, where a line break would split one person's entry across two lines
  // and make it look like two.
  const messy = await submit(`cm:${contestId}`, "  line one\n\nline two   ");
  check(
    "newlines are collapsed into one line",
    (messy.body?.data?.content ?? "").includes("line one line two"),
    messy
  );

  const empty = await submit(`cm:${contestId}`, "     ");
  check(
    "an empty caption is turned away",
    /That was empty/.test(empty.body?.data?.content ?? ""),
    empty
  );

  // The reopened modal is prefilled, so a second click reads as an edit rather
  // than looking like it lost the first one.
  const reopened = await click(`cw:${contestId}`);
  const field = reopened.body?.data?.components?.[0]?.components?.[0];
  check(
    "reopening it prefills what they already wrote",
    field?.value === "line one line two",
    reopened
  );

  // A second person, so the vote has something to be about.
  await submit(`cm:${contestId}`, "the other one", second);

  const gone = await click("cw:999999");
  check("an unknown contest is turned away", /contest is gone/.test(gone.body?.data?.content ?? ""), gone);

  // ── move it to the vote ──────────────────────────────────────────
  const openVote = await fetch(
    `${url}/admin/open-vote?secret=${encodeURIComponent(secret)}`
  );
  const openBody = await openVote.json();
  check("the vote opens for the ballot checks", openBody.opened === 1, openBody);

  const stale = await submit(`cm:${contestId}`, "too late");
  check(
    "writing is refused once the vote is open",
    /Writing on that one has closed/.test(stale.body?.data?.content ?? ""),
    stale
  );

  const first = await click(`c:${contestId}:2`);
  check(
    "a caption can be ranked",
    /Your order: #2\./.test(first.body?.data?.content ?? ""),
    first
  );

  const again = await click(`c:${contestId}:2`);
  check(
    "ranking the same one twice is refused",
    /already ranked #2/.test(again.body?.data?.content ?? ""),
    again
  );

  await click(`c:${contestId}:1`);
  const third = await click(`c:${contestId}:3`);
  check(
    "three picks fills the ballot and says so",
    /That is the lot/.test(third.body?.data?.content ?? ""),
    third
  );

  // The cap is the one thing this format has that the ranking round does not.
  const fourth = await click(`c:${contestId}:1`);
  const capped = await click(`c:${contestId}:2`);
  check(
    "a fourth pick is refused",
    /already picked 3/.test(fourth.body?.data?.content ?? "") ||
      /already ranked/.test(fourth.body?.data?.content ?? ""),
    fourth
  );
  check(
    "and the ballot is unchanged by it",
    /#2 › #1 › #3/.test(capped.body?.data?.content ?? ""),
    capped
  );

  const missing = await click(`c:${contestId}:99`);
  check(
    "a slot that is not in the contest is turned away",
    /not in this contest/.test(missing.body?.data?.content ?? ""),
    missing
  );

  const cleared = await click(`cx:${contestId}`);
  check("start over clears it", /Cleared/.test(cleared.body?.data?.content ?? ""), cleared);
} else {
  console.log("SKIP  caption contest (pass a writing-phase contest id as the third argument)");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
