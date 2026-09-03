#!/usr/bin/env node
/**
 * Exercises POST /interactions against a locally running `wrangler dev`.
 *
 * Discord signs every interaction with Ed25519 over (timestamp + body), so
 * this needs a real keypair: `--keygen` writes .test-key.pem and prints the
 * public half to put in .dev.vars as DISCORD_PUBLIC_KEY.
 *
 *   node scripts/test-interactions.mjs --keygen
 *   npm run dev:local            (with the mock running, and .dev.vars pointed at it)
 *   node scripts/test-interactions.mjs [--url http://localhost:8788]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey, generateKeyPairSync, sign as edSign } from "node:crypto";

if (process.argv.includes("--keygen")) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(".test-key.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
  const raw = publicKey.export({ type: "spki", format: "der" });
  console.log(`DISCORD_PUBLIC_KEY=${raw.subarray(raw.length - 32).toString("hex")}`);
  process.exit(0);
}

const url = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:8788";
const ADMIN = process.env.ADMIN_SECRET ?? "dev-only-admin-secret";
const GUILD = "108689961535934464";
const CHANNEL = "1544450389628297216";

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
  // Type 6 is the running reply being edited in place through the mock: the
  // words went out as a PATCH to the webhook, so read them back from its log.
  if (parsed?.type === 6) {
    try {
      const log = JSON.parse(readFileSync("mock-discord-log.json", "utf-8"));
      const edit = [...log].reverse().find((e) => e.method === "PATCH" && /@original/.test(e.url));
      if (edit) parsed = { type: 6, data: JSON.parse(edit.body) };
    } catch {}
  }
  return { status: response.status, body: parsed };
}

async function admin(path, params = {}) {
  const query = new URLSearchParams({ secret: ADMIN, ...params });
  return (await fetch(`${url}/admin/${path}?${query}`)).json();
}

async function sql(q) {
  return (await admin("sql", { q })).results;
}

let failures = 0;
function check(name, condition, detail) {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail).slice(0, 600)}`}`);
}

const content = (r) => r.body?.data?.content ?? "";
const stamp = Date.now();
const alice = { user: { id: `alice_${stamp}`, username: "alice" } };
const bob = { user: { id: `bob_${stamp}`, username: "bob" } };
let seq = 0;
const base = () => ({ id: `i${++seq}`, token: `tok${seq}`, application_id: "app_yut", guild_id: GUILD, channel_id: CHANNEL });
const click = (customId, member, message) => post({ ...base(), type: 3, data: { custom_id: customId }, member, ...(message ? { message } : {}) });
const command = (name, options, member, resolved) => post({ ...base(), type: 2, data: { name, options, resolved }, member });

const health = await fetch(`${url}/health`).then((r) => r.text()).catch(() => null);
if (health !== "ok") {
  console.error(`No worker at ${url}. Run npm run dev:local first.`);
  process.exit(1);
}

// The game day, as the worker sees it.
const today = (await admin("tick", { at: new Date().toISOString() })).report ? null : null;
const rows = await sql("SELECT value FROM state WHERE key = 'last_daily_day'");
const day = rows?.[0]?.value;
check("the tick has resolved a day", typeof day === "string", rows);

// 1. Signatures and PING.
const bad = await post({ type: 1 }, { corrupt: true });
check("bad signature → 401", bad.status === 401, bad);
const ping = await post({ type: 1 });
check("PING → PONG", ping.status === 200 && ping.body?.type === 1, ping);

// 2. Another server, even with a valid signature.
const foreign = await post({ ...base(), type: 3, guild_id: "999", data: { custom_id: `ci:${day}` }, member: alice });
check("foreign guild refused", /only runs in its own channel/.test(content(foreign)), foreign);

// 3. A non-player pressing Check In is offered Join.
const stranger = await click(`ci:${day}`, alice);
check("non-player gets a Join button", /not in the campaign/.test(content(stranger)) && JSON.stringify(stranger.body).includes(`join:${day}`), stranger);

// 4. Joining from that button also checks in.
const joined = await click(`join:${day}`, alice);
check("join + check-in in one press", /Checked in\.\*\* 1st this week, full value/.test(content(joined)), joined);
check("the receipt carries the hub", JSON.stringify(joined.body).includes("sheet:"), joined);

// 5. A second check-in the same day is refused.
const again = await click(`ci:${day}`, alice);
check("second check-in refused", /Already in for today/.test(content(again)), again);

// 6. Yesterday's button.
const stale = await click(`ci:2020-01-01`, alice);
check("yesterday's button refused", /yesterday's button/.test(content(stale)), stale);

// 7. /checkin as a slash command for a new player, with a note.
await command("join", [], bob);
const bobCheckin = await command("checkin", [{ name: "note", type: 3, value: "Deadlifts, felt strong today and hit a PR" }], bob);
check("/checkin accepted", /Checked in\.\*\* 1st this week/.test(content(bobCheckin)), bobCheckin);
// The first check-in lands at Hitpoints 18 (double XP for new joiners), so
// Mazchna is the master, not Turael.
check("the first check-in gets a Slayer task", /(Turael|Mazchna) assigns you: \d+ [a-z ]+, due \d{4}-\d{2}-\d{2}/.test(content(bobCheckin)), bobCheckin);
const task = await command("task", [{ name: "status", type: 1 }], bob);
check("/task shows the task", /Slayer task: .* 1\/\d for (Turael|Mazchna)/.test(content(task)), task);

// 8. XP landed: one check-in = 200 HP (×2 bootstrap) and 66/66/66 controlled.
const xp = await sql(`SELECT skill, xp FROM skill_xp WHERE player_id = '${bob.user.id}' ORDER BY skill`);
const by = Object.fromEntries((xp ?? []).map((r) => [r.skill, r.xp]));
check("bootstrap Hitpoints 4000, controlled 666 each", by.hitpoints === 4000 && by.attack === 666 && by.strength === 666 && by.defence === 666, by);
check("the haul paid Woodcutting", by.woodcutting > 0, by);

// 9. The camp got the haul.
const stores = await sql("SELECT resource, amount FROM town_resources WHERE resource IN ('coins','logs')");
check("the camp holds coins and logs", stores.every((r) => r.amount > 0), stores);

// 10. Style change, then a lamp menu (may or may not have a lamp).
const style = await click("style:aggressive", bob);
check("combat style set", /Aggressive/.test(content(style)), style);
const lamp = await click("lamp", bob);
check("lamp menu answers", /lamp/i.test(content(lamp)), lamp);

// 11. Verification: a photo check-in by alice tomorrow is not possible today, so seed one via admin for a third player.
const carol = `carol_${stamp}`;
await admin("seed", { players: carol, day, [`name_${carol}`]: "carol" });
const seeded = await admin("checkin-as", { player: carol, day, photo: "1", post: "1" });
check("seeded photo check-in", seeded.ok === true, seeded);
// The channel line goes out after the response, in ctx.waitUntil; give it a moment.
let carolCheckin;
for (let attempt = 0; attempt < 10; attempt++) {
  carolCheckin = (await sql(`SELECT id, message_id FROM checkins WHERE player_id = '${carol}'`))[0];
  if (carolCheckin?.message_id) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}
check("the seeded check-in got a channel line", Boolean(carolCheckin?.message_id), carolCheckin);
const selfVerify = await click(`vf:${carolCheckin.id}`, { user: { id: carol, username: "carol" } });
check("self-verify refused", /your own/.test(content(selfVerify)), selfVerify);
const verifyA = await click(`vf:${carolCheckin.id}`, alice);
check("alice verifies", /Verified/.test(content(verifyA)), verifyA);
const verifyAgain = await click(`vf:${carolCheckin.id}`, alice);
check("verifying twice refused", /already verified/.test(content(verifyAgain)), verifyAgain);
const verifyB = await click(`vf:${carolCheckin.id}`, bob);
check("bob verifies too", /Verified \(2\)/.test(content(verifyB)), verifyB);
const verified = (await sql(`SELECT verified_count FROM checkins WHERE id = ${carolCheckin.id}`))[0];
check("verified_count = 2", verified?.verified_count === 2, verified);
const carolSlayer = (await sql(`SELECT xp FROM skill_xp WHERE player_id = '${carol}' AND skill = 'slayer'`))[0];
check("carol got Slayer for the proof", (carolSlayer?.xp ?? 0) >= 1000, carolSlayer);

// 12. Freshness: a player whose last check-in is four days old cannot act.
const dave = `dave_${stamp}`;
await admin("seed", { players: dave, day, [`name_${dave}`]: "dave" });
const oldDay = new Date(Date.parse(`${day}T00:00:00Z`) - 4 * 86400000).toISOString().slice(0, 10);
await admin("checkin-as", { player: dave, day: oldDay });
const daveStale = await click("lamp", { user: { id: dave, username: "dave" } });
check("four days old is stale", /Check in to play/.test(content(daveStale)), daveStale);
const erin = `erin_${stamp}`;
await admin("seed", { players: erin, day, [`name_${erin}`]: "erin" });
const recentDay = new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
await admin("checkin-as", { player: erin, day: recentDay });
const erinFresh = await click("lamp", { user: { id: erin, username: "erin" } });
check("three days old is fresh", !/Check in to play/.test(content(erinFresh)), erinFresh);

// 13. /sheet defers.
const sheet = await command("sheet", [], bob);
check("/sheet answers with a deferred placeholder", sheet.body?.type === 5, sheet);

// 14. Unknown button.
const junk = await click("something:else", bob);
check("unknown custom_id refused", /not one of mine/.test(content(junk)), junk);

// 15. /help and /standings.
const help = await command("help", [], bob);
check("/help", /two a week/i.test(content(help)), help);
const standings = await command("standings", [], bob);
check("/standings lists the roster", /alice|bob/.test(content(standings)), standings);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
