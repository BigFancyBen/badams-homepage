#!/usr/bin/env node
/**
 * Exercises POST /interactions against a locally running `wrangler dev`.
 *
 * Discord signs every interaction with Ed25519 over (timestamp + body), so
 * testing this path needs a real keypair — generate one, put the public half
 * in .dev.vars as DISCORD_PUBLIC_KEY, and sign requests with the private half.
 *
 *   node scripts/test-interactions.mjs [--url http://localhost:8787]
 *
 * Expects .test-key.pem (private key) beside wrangler.toml.
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

// 3. A vote from the public matchup message opens the voter's own ballot.
//    Type 4 = a new message, ephemeral, so only they see it.
const vote = await post({
  type: 3,
  id: "i1",
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { custom_id: `v:${matchupId}:a` },
  member: { user: { id: "user_tester", username: "tester" } },
});
const buttons = (r) => r.body?.data?.components?.[0]?.components ?? [];
const ticked = (r) => buttons(r).filter((b) => b.label?.startsWith("✓"));

check("vote → new ephemeral message", vote.body?.type === 4, vote);
check("ephemeral flag set", (vote.body?.data?.flags & 64) === 64, vote.body?.data?.flags);
check("ballot carries both buttons", buttons(vote).length === 2, buttons(vote));
check("exactly one button ticked", ticked(vote).length === 1, buttons(vote));
check("the tick is on the side voted", ticked(vote)[0]?.label === "✓ 1", buttons(vote));
check("picked button is green (style 3)", buttons(vote)[0]?.style === 3, buttons(vote));
check("other button stays grey (style 2)", buttons(vote)[1]?.style === 2, buttons(vote));
check(
  "ballot buttons route back to the ballot",
  buttons(vote).every((b) => b.custom_id?.startsWith("e:")),
  buttons(vote)
);

// 4. Switching from inside the ballot edits that same card (type 7) rather
//    than sending another one, and moves the tick.
const change = await post({
  type: 3,
  id: "i2",
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { custom_id: `e:${matchupId}:b` },
  member: { user: { id: "user_tester", username: "tester" } },
});
check("switch → edits the ballot in place", change.body?.type === 7, change);
check("tick moved to the other side", ticked(change)[0]?.label === "✓ 2", buttons(change));
check("still exactly one ticked", ticked(change).length === 1, buttons(change));
check("green moved too", buttons(change)[1]?.style === 3 && buttons(change)[0]?.style === 2, buttons(change));

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

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
