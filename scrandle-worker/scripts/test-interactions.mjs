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
  vote.status === 200 && /Voted 1\./.test(vote.body?.data?.content ?? ""),
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
check("vote changed", change.status === 200, change);

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
