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

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
