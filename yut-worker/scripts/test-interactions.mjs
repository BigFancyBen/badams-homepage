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
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${JSON.stringify(detail ?? null).slice(0, 600)}`}`);
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

// The mock's log, and the posts that landed in one channel (the thread is a channel too).
// The mock keeps its log in memory across runs, so start it clean.
const MOCK = process.env.MOCK_DISCORD_URL ?? "http://127.0.0.1:9912";
await fetch(`${MOCK}/__mock/reset`).catch(() => null);
const mockLog = () => {
  try {
    return JSON.parse(readFileSync("mock-discord-log.json", "utf-8"));
  } catch {
    return [];
  }
};
const posts = (channel) => mockLog().filter((e) => e.method === "POST" && e.url === `/channels/${channel}/messages`);
const waitFor = async (predicate, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    const hit = predicate();
    if (hit) return hit;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

// The morning post and its thread, forced so the harness has a thread to post into.
await admin("tick", { post: "1" });
const threadId = (await sql(`SELECT value FROM state WHERE key = 'daily_thread:${day}'`))?.[0]?.value;
check("the morning post starts a thread", typeof threadId === "string" && threadId.startsWith("thread_"), threadId);

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
check("the receipt points at the thread", content(joined).includes(`<#${threadId}>`), joined);
const aliceThread = await waitFor(() => posts(threadId).find((e) => /alice\*\* checked in/.test(e.body)));
check("the check-in line lands in the thread", Boolean(aliceThread) && /⚔️ \d+ [A-Za-z' ]+ slain/.test(aliceThread?.body ?? ""), aliceThread);
check("a plain check-in says nothing in the channel", !posts(CHANNEL).some((e) => /alice\*\* checked in/.test(e.body)), posts(CHANNEL).map((e) => e.body.slice(0, 80)));

// 5. A second check-in the same day is refused.
const again = await click(`ci:${day}`, alice);
check("second check-in refused", /Already in for today/.test(content(again)), again);

// 6. Yesterday's button.
const stale = await click(`ci:2020-01-01`, alice);
check("yesterday's button refused", /yesterday's question/.test(content(stale)), stale);

// 7. /checkin as a slash command for a new player, with a note.
await command("join", [], bob);
const bobCheckin = await command("checkin", [{ name: "note", type: 3, value: "Deadlifts, felt strong today and hit a PR" }], bob);
check("/checkin accepted", /Checked in\.\*\* 1st this week/.test(content(bobCheckin)), bobCheckin);
check("the first check-in's receipt keeps the Turael assignment", /Turael assigns you \d+ [a-z ]+\./.test(content(bobCheckin)), bobCheckin);
check("the receipt no longer carries the session line", !/max hit \d+, \d+% to hit/.test(content(bobCheckin)), bobCheckin);
const bobNote = await waitFor(() => posts(CHANNEL).find((e) => /\*\*bob\*\* checked in\./.test(e.body)));
check("a note goes to the channel, quoted, with no Verify button", Boolean(bobNote) && /> Deadlifts/.test(bobNote?.body ?? "") && !/vf:/.test(bobNote?.body ?? ""), bobNote);
const bobThread = await waitFor(() => posts(threadId).find((e) => /bob\*\* checked in \(1st this week/.test(e.body)));
check("and the session goes to the thread", Boolean(bobThread) && /⚔️ \d+ [A-Za-z' ]+ slain/.test(bobThread?.body ?? ""), bobThread);
const task = await command("task", [{ name: "status", type: 1 }], bob);
check("/task shows the task", /Task: .* \d+\/\d+ for Turael/.test(content(task)), task);

// 8. XP landed the way the game pays it: 4/3 per damage to each of the
// three on controlled and to Hitpoints (which starts at 10), plus Slayer for
// the kills and Prayer for the bones, and Woodcutting for the haul.
const xp = await sql(`SELECT skill, xp FROM skill_xp WHERE player_id = '${bob.user.id}' ORDER BY skill`);
const by = Object.fromEntries((xp ?? []).map((r) => [r.skill, r.xp]));
// A random event (the Drill Demon) can add a lamp's worth to one of the three.
const three = [by.attack ?? 0, by.strength ?? 0, by.defence ?? 0];
check("controlled pays Attack, Strength and Defence alike, and Hitpoints from 1,154", Math.min(...three) > 0 && Math.max(...three) - Math.min(...three) <= 100 && by.hitpoints > 1154, by);
check("kills on task paid Slayer", (by.slayer ?? 0) > 0, by);
check("the haul paid Woodcutting", by.woodcutting > 0, by);
const session = (await sql(`SELECT session FROM checkins WHERE player_id = '${bob.user.id}'`))[0];
check("the check-in kept its session", /"monster"/.test(session?.session ?? "") && /"kills"/.test(session?.session ?? ""), session);
// The morning post's roll call records the Yes. It lands after the response
// (ctx.waitUntil), so give it a moment.
let answer;
for (let attempt = 0; attempt < 10; attempt++) {
  answer = (await sql(`SELECT answer FROM day_answers WHERE player_id = '${bob.user.id}' AND day = '${day}'`))[0];
  if (answer) break;
  await new Promise((resolve) => setTimeout(resolve, 300));
}
check("a Yes is recorded as an answer", answer?.answer === "yes", answer);
// And a No is a rest day, refused after a Yes.
const noAfterYes = await click(`no:${day}`, bob);
check("No after Yes is refused", /already said yes/.test(content(noAfterYes)), noAfterYes);

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
const carolPost = mockLog().find((e) => e.id === carolCheckin?.message_id);
check("the photo post is in the channel with a Verify button", carolPost?.channel === CHANNEL && /vf:/.test(carolPost?.body ?? "") && /carol\*\* checked in\./.test(carolPost?.body ?? ""), carolPost);
const selfVerify = await click(`vf:${carolCheckin.id}`, { user: { id: carol, username: "carol" } });
check("self-verify refused", /your own/.test(content(selfVerify)), selfVerify);
const verifyA = await click(`vf:${carolCheckin.id}`, alice);
check("alice verifies", /Verified/.test(content(verifyA)), verifyA);
const verifiedEdit = await waitFor(() =>
  mockLog().find((e) => e.method === "PATCH" && e.url === `/channels/${CHANNEL}/messages/${carolCheckin.message_id}` && /verified by alice/.test(e.body))
);
check("verified by … is appended without losing the line", Boolean(verifiedEdit) && /carol\*\* checked in/.test(verifiedEdit?.body ?? ""), verifiedEdit);
const verifyAgain = await click(`vf:${carolCheckin.id}`, alice);
check("verifying twice refused", /already verified/.test(content(verifyAgain)), verifyAgain);
const verifyB = await click(`vf:${carolCheckin.id}`, bob);
check("bob verifies too", /Verified \(2\)/.test(content(verifyB)), verifyB);
const verified = (await sql(`SELECT verified_count FROM checkins WHERE id = ${carolCheckin.id}`))[0];
check("verified_count = 2", verified?.verified_count === 2, verified);
const carolSlayer = (await sql(`SELECT xp FROM skill_xp WHERE player_id = '${carol}' AND skill = 'slayer'`))[0];
check("carol got Slayer for the proof", (carolSlayer?.xp ?? 0) >= 500, carolSlayer);

// 11b. A rest day: a new player says No.
const frank = { user: { id: `frank_${stamp}`, username: "frank" } };
await command("join", [], frank);
const restDay = await click(`no:${day}`, frank);
check("No is a rest day, nothing lost", /Rest day noted/.test(content(restDay)), restDay);
const frankAnswer = (await sql(`SELECT answer FROM day_answers WHERE player_id = '${frank.user.id}' AND day = '${day}'`))[0];
check("the No is recorded", frankAnswer?.answer === "no", frankAnswer);
const frankCheckins = await sql(`SELECT COUNT(*) AS n FROM checkins WHERE player_id = '${frank.user.id}'`);
check("a No is not a check-in", frankCheckins[0]?.n === 0, frankCheckins);

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
// /help is held back by SLOW_COMMAND in wrangler.test.toml: the Worker must
// acknowledge inside Discord's window and fill the placeholder afterwards.
const help = await command("help", [], bob);
check("a slow command is acknowledged with a deferred placeholder", help.body?.type === 5, help);
let lateHelp = null;
for (let i = 0; i < 40 && !lateHelp; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const log = JSON.parse(readFileSync("mock-discord-log.json", "utf-8"));
    lateHelp = log.find(
      (e) => e.method === "PATCH" && /@original/.test(e.url) && /two a week/i.test(e.body) && /Slayer task/.test(e.body)
    );
  } catch {}
}
check("the slow answer arrives through the webhook token", Boolean(lateHelp), lateHelp);
// 16. A repeated slash command must answer fresh: the running-reply edit
// (type 6) is only legal for buttons, and Discord shows "didn't respond in
// time" when a command gets it.
const rejoin = await command("join", [], bob);
check(
  "a repeated slash command answers fresh, never with a button-only ack",
  rejoin.body?.type === 4 && /already in/.test(content(rejoin)),
  rejoin
);
// 17. A photo added after a Yes while the bot is locked out of the channel
// (launch night: a 403 on the channel line threw before the placeholder was
// filled, and Discord sat on "thinking" for fifteen minutes). The proof must
// attach and the placeholder must be filled either way.
await fetch(`${MOCK}/__mock/channel-post-status?code=403`);
const proof = await command("checkin", [{ name: "photo", type: 11, value: "att_proof" }], bob, {
  attachments: {
    att_proof: { id: "att_proof", filename: "proof.png", content_type: "image/png", size: 68, url: `${MOCK}/cdn/proof.png` },
  },
});
const proofToken = `tok${seq}`;
check("a photo after a Yes is deferred", proof.body?.type === 5, proof);
let proofEdit = null;
for (let i = 0; i < 40 && !proofEdit; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const log = JSON.parse(readFileSync("mock-discord-log.json", "utf-8"));
    proofEdit = log.find((e) => e.method === "PATCH" && e.url.includes(`/${proofToken}/`) && /Proof attached/.test(e.body));
  } catch {}
}
await fetch(`${MOCK}/__mock/channel-post-status?code=200`);
check(
  "the placeholder is filled even when the channel line fails",
  Boolean(proofEdit) && /could not be posted/.test(proofEdit?.body ?? ""),
  proofEdit
);
const bobProof = (await sql(`SELECT attachment_kind FROM checkins WHERE player_id = '${bob.user.id}'`))[0];
check("the proof is on the check-in regardless", bobProof?.attachment_kind === "image", bobProof);
// And with the channel back, the proof post is the message Verify will edit.
const proofOk = await command("checkin", [{ name: "photo", type: 11, value: "att_ok" }], alice, {
  attachments: {
    att_ok: { id: "att_ok", filename: "ok.png", content_type: "image/png", size: 68, url: `${MOCK}/cdn/ok.png` },
  },
});
const proofOkToken = `tok${seq}`;
check("a photo after a Yes is deferred", proofOk.body?.type === 5, proofOk);
const proofOkEdit = await waitFor(
  () => mockLog().find((e) => e.method === "PATCH" && e.url.includes(`/${proofOkToken}/`) && /Proof attached\. Friends/.test(e.body)),
  40
);
check("the proof post goes out when the channel is open", Boolean(proofOkEdit), proofOkEdit);
const aliceRow = (await sql(`SELECT message_id, attachment_url, attachment_r2_key, attachment_kind FROM checkins WHERE player_id = '${alice.user.id}'`))[0];
const alicePost = mockLog().find((e) => e.id === aliceRow?.message_id);
check("message_id points at the proof post", Boolean(alicePost) && alicePost.channel === CHANNEL && /added proof/.test(alicePost.body), { aliceRow, alicePost });
check("the photo is re-uploaded to Discord as a real attachment, not linked", alicePost?.multipart === true && /name="files\[0\]"/.test(alicePost?.body ?? "") && !/image":\{"url"/.test(alicePost?.body ?? ""), alicePost);
check("the check-in keeps Discord's attachment as its proof", /^discord:/.test(aliceRow?.attachment_r2_key ?? "") && /\/cdn\/att_/.test(aliceRow?.attachment_url ?? "") && aliceRow?.attachment_kind === "image", aliceRow);
const standings = await command("standings", [], bob);
check("/standings lists the roster", /alice|bob/.test(content(standings)), standings);
// The kills' drops went to the bank and onto the check-in row. (A Turael task can be ghosts or
// spiders, which drop nothing the game keeps, so look across this run's players, not one.)
const runBank = await sql(`SELECT COUNT(*) AS n, COALESCE(SUM(value), 0) AS v, MIN(qty) AS minq FROM bank WHERE player_id LIKE '%_${stamp}'`);
check("the sessions' drops are banked", (runBank?.[0]?.n ?? 0) > 0 && runBank[0].v > 0 && runBank[0].minq > 0, runBank);
const bobLoot = (await sql(`SELECT loot FROM checkins WHERE player_id = '${bob.user.id}'`))[0];
check("the check-in row keeps its loot", /"s":\[/.test(bobLoot?.loot ?? "") && /"t":/.test(bobLoot?.loot ?? ""), bobLoot);
const richest = (await sql(`SELECT player_id FROM bank WHERE player_id LIKE '%_${stamp}' ORDER BY value DESC LIMIT 1`))[0];
const richName = richest ? (await sql(`SELECT username FROM players WHERE discord_id = '${richest.player_id}'`))[0]?.username : null;
const bank = await command("bank", [], richest ? { user: { id: richest.player_id, username: richName ?? "rich" } } : bob);
check("/bank shows the stacks and the total", /bank\*\* — worth/.test(content(bank)) && /×/.test(content(bank)) && /notable drop/.test(content(bank)), bank);
const emptyBank = await command("bank", [], frank);
check("/bank on an empty bank says so", /worth 0 gp/.test(content(emptyBank)) && /Empty/.test(content(emptyBank)), emptyBank);
// The quest of the week answers whatever the calendar says for today (before the campaign starts, that is "no quest").
const questStatus = await command("quest", [{ name: "status", type: 1 }], bob);
check("/quest status answers", /No quest this week|📜 \*\*/.test(content(questStatus)), questStatus);
const questLogReply = await command("quest", [{ name: "log", type: 1 }], bob);
check("/quest log answers with the quest points", /Quest log\*\* — \d+ quest point/.test(content(questLogReply)), questLogReply);

// 18. Interactions from inside the day's thread are served; a thread of another channel is not.
const fromThread = await post({ ...base(), channel_id: threadId, channel: { id: threadId, type: 11, parent_id: CHANNEL }, type: 3, data: { custom_id: "lamp" }, member: bob });
check("a button pressed inside the thread is served", !/only runs in its own channel/.test(content(fromThread)), fromThread);
const foreignThread = await post({ ...base(), channel_id: "thread_x", channel: { id: "thread_x", type: 11, parent_id: "999" }, type: 3, data: { custom_id: "lamp" }, member: bob });
check("a thread of another channel is refused", /only runs in its own channel/.test(content(foreignThread)), foreignThread);

// 19. The thread refusing a post: the line falls back to the channel as a reply to the morning post.
await fetch(`${MOCK}/__mock/thread-post-status?code=404`);
const gina = `gina_${stamp}`;
await admin("seed", { players: gina, day, [`name_${gina}`]: "gina" });
await admin("checkin-as", { player: gina, day, post: "1" });
const ginaLine = await waitFor(() => posts(CHANNEL).find((e) => /gina\*\* checked in/.test(e.body)));
await fetch(`${MOCK}/__mock/thread-post-status?code=200`);
check("a thread post that fails lands in the channel as a reply", Boolean(ginaLine) && /message_reference/.test(ginaLine?.body ?? ""), ginaLine);

// 20. No thread at all: the morning post still goes out and check-ins go to the channel.
await fetch(`${MOCK}/__mock/thread-create-status?code=403`);
await admin("tick", { post: "1" });
const noThread = (await sql(`SELECT value FROM state WHERE key = 'daily_thread:${day}'`))?.[0]?.value;
await fetch(`${MOCK}/__mock/thread-create-status?code=200`);
check("a thread that could not be made is recorded as none", noThread === "", noThread);
const hank = `hank_${stamp}`;
await admin("seed", { players: hank, day, [`name_${hank}`]: "hank" });
await admin("checkin-as", { player: hank, day, post: "1" });
const hankLine = await waitFor(() => posts(CHANNEL).find((e) => /hank\*\* checked in/.test(e.body)));
check("with no thread the line goes to the channel", Boolean(hankLine), hankLine);
await admin("tick", { post: "1" });

// 21. The evening reminders name a player whose lamp is about to rub itself.
const staleLampDay = new Date(Date.parse(`${day}T00:00:00Z`) - 13 * 86400000).toISOString().slice(0, 10);
await admin("grant-lamp", { player: carol, day: staleLampDay });
const reminded = await admin("tick", { reminders: "1" });
const reminderPost = [...posts(CHANNEL)].reverse().find((e) => /Evening reminders/.test(e.body));
check(
  "the evening reminder names carol's lamp and when it rubs itself",
  Boolean(reminderPost) && /carol\*\* — .*lamp/.test(reminderPost?.body ?? "") && /rubs itself in 2 days/.test(reminderPost?.body ?? ""),
  { reminded, body: reminderPost?.body }
);
// erin's last check-in was three days ago: erin is @mentioned as going stale; dave (four days) is
// already stale and is not. (Players from earlier runs share the local database, so the list may be longer.)
const reminderPayload = (() => {
  try {
    return JSON.parse(reminderPost?.body ?? "{}");
  } catch {
    return {};
  }
})();
check(
  "the player on their third day is @mentioned, and only them",
  (reminderPayload.content ?? "").includes(`<@${erin}>`) &&
    !(reminderPayload.content ?? "").includes(`<@${dave}>`) &&
    (reminderPayload.allowed_mentions?.users ?? []).includes(erin) &&
    !(reminderPayload.allowed_mentions?.users ?? []).includes(dave) &&
    reminderPayload.allowed_mentions?.parse?.length === 0,
  reminderPayload
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
