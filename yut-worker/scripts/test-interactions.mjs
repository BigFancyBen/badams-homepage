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
  const query = new URLSearchParams(params);
  return (await fetch(`${url}/admin/${path}?${query}`, { headers: { authorization: `Bearer ${ADMIN}` } })).json();
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
const pick = (customId, values, member) => post({ ...base(), type: 3, data: { custom_id: customId, values }, member });
const submit = (customId, fields, member, resolved) =>
  post({ ...base(), type: 5, data: { custom_id: customId, components: fields.map((component) => ({ type: 18, component })), resolved }, member });
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
check("the receipt carries the menu", JSON.stringify(joined.body).includes('"custom_id":"sheet"') && JSON.stringify(joined.body).includes('"custom_id":"hub'), joined);
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
// /lamp is the Lamp button in disguise. With a running reply on file for bob
// it used to answer with a running-reply edit (type 6), which Discord only
// accepts from a button — a slash command shows "didn't respond in time".
const lampCommand = await command("lamp", [], bob);
check(
  "/lamp after a button answers fresh, never with a button-only ack",
  lampCommand.body?.type === 4 && /lamp/i.test(content(lampCommand)),
  lampCommand
);

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
// A note after a Yes is added to the check-in too, and leaves the proof post as the one Verify edits.
const bare = await command("checkin", [], alice);
check("a bare /checkin after a Yes says what it can still take", bare.body?.type === 4 && /already in for today\. A note or a photo/.test(content(bare)), bare);
const lateNote = await command("checkin", [{ name: "note", type: 3, value: "squats, added later" }], alice);
const lateNoteToken = `tok${seq}`;
check("a note after a Yes is deferred", lateNote.body?.type === 5, lateNote);
const lateNoteEdit = await waitFor(
  () => mockLog().find((e) => e.method === "PATCH" && e.url.includes(`/${lateNoteToken}/`) && /Note added\./.test(e.body)),
  40
);
check("the note is added", Boolean(lateNoteEdit), lateNoteEdit);
const lateNotePost = posts(CHANNEL).find((e) => /\*\*alice\*\* added a note/.test(e.body));
check("and reaches the channel, quoted, with no Verify button", /> squats, added later/.test(lateNotePost?.body ?? "") && !/vf:/.test(lateNotePost?.body ?? ""), lateNotePost);
const aliceNoted = (await sql(`SELECT note, message_id FROM checkins WHERE player_id = '${alice.user.id}'`))[0];
check("the note is on the check-in and the proof post is still Verify's", aliceNoted?.note === "squats, added later" && aliceNoted?.message_id === aliceRow?.message_id, aliceNoted);
const secondNote = await command("checkin", [{ name: "note", type: 3, value: "one more" }], alice);
check("a second note is refused", /already has a note/.test(content(secondNote)), secondNote);
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
// A player's own business is a count in the channel; the detail is theirs alone.
check(
  "the evening reminder counts players with things waiting and names nobody's lamp",
  Boolean(reminderPost) && /players? ha(s|ve) things waiting/.test(reminderPost?.body ?? "") && !/carol/.test(reminderPost?.body ?? "") && !/lamp/.test(reminderPost?.body ?? ""),
  { reminded, body: reminderPost?.body }
);
const carolTodo = await click("todo", { user: { id: carol, username: "carol" } });
check(
  "My to-do tells carol, privately, about the lamp and when it rubs itself",
  carolTodo.body?.data?.flags === 64 && /For you\*\* \(only you see this\)/.test(content(carolTodo)) && /1 lamp to rub \(`\/lamp`\) — one rubs itself in 2 days/.test(content(carolTodo)),
  carolTodo
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

// 22. Spoils: every check-in ends with a pick of three.
const ivy = { user: { id: `ivy_${stamp}`, username: "ivy" } };
const ivyJoin = await click(`join:${day}`, ivy);
const ivySpoils = (await sql(`SELECT id, options, picked FROM spoils WHERE player_id = '${ivy.user.id}'`))[0];
const ivyOptions = JSON.parse(ivySpoils?.options ?? "[]");
check("a check-in draws three spoils: the roll, today's container, a sure thing",
  ivyOptions.length === 3 && ivyOptions[0].slot === "roll" && ivyOptions[1].slot === "featured" && ivyOptions[2].kind !== "container" && ivySpoils.picked === null,
  ivySpoils);
check("the receipt offers the pick, above the hub",
  /Spoils\*\* — pick one/.test(content(ivyJoin)) && JSON.stringify(ivyJoin.body).includes(`sp:${ivySpoils?.id}:0`) && JSON.stringify(ivyJoin.body).includes(`sp:${ivySpoils?.id}:2`),
  ivyJoin);
check("the receipt says what is next", /Next: the week's chest at your second check-in/.test(content(ivyJoin)) && /Easy diary \d\/6/.test(content(ivyJoin)), content(ivyJoin));
check("a receipt never has more than five rows of buttons", (ivyJoin.body?.data?.components ?? []).length <= 5, ivyJoin.body?.data?.components?.length);
const notMine = await click(`sp:${ivySpoils.id}:0`, bob);
check("somebody else's spoils are refused", /not yours/.test(content(notMine)), notMine);
const bankBefore = (await sql(`SELECT COALESCE(SUM(value), 0) AS v, COUNT(*) AS n FROM bank WHERE player_id = '${ivy.user.id}'`))[0];
const picked = await click(`sp:${ivySpoils.id}:0`, ivy);
check("picking the roll opens the container and banks it", /banked\./.test(content(picked)), picked);
const ivyRow = (await sql(`SELECT picked, container, result, auto FROM spoils WHERE id = ${ivySpoils.id}`))[0];
const ivyResult = JSON.parse(ivyRow?.result ?? "{}");
const bankAfter = (await sql(`SELECT COALESCE(SUM(value), 0) AS v FROM bank WHERE player_id = '${ivy.user.id}'`))[0];
check("the row records the pick, the container and what came out",
  ivyRow?.picked === 0 && ivyRow?.container === ivyOptions[0].key && ivyRow?.auto === 0 && Array.isArray(ivyResult.s) && ivyResult.s.length > 0,
  ivyRow);
check("the bank grew by exactly the loot's worth", Math.abs(bankAfter.v - bankBefore.v - ivyResult.t) < 0.5, { before: bankBefore.v, after: bankAfter.v, loot: ivyResult.t });
const spoilsLine = await waitFor(() => [...posts(CHANNEL), ...mockLog().filter((e) => e.method === "POST" && /\/messages$/.test(e.url))].find((e) => /ivy\*\* opened a/.test(e.body)));
check("the pick is announced", Boolean(spoilsLine), spoilsLine);
const twice = await click(`sp:${ivySpoils.id}:1`, ivy);
check("a second pick is refused", /already opened/.test(content(twice)), twice);
const bankTwice = (await sql(`SELECT COALESCE(SUM(value), 0) AS v FROM bank WHERE player_id = '${ivy.user.id}'`))[0];
check("and banks nothing", bankTwice.v === bankAfter.v, { bankTwice, bankAfter });
const spoilsCmd = await command("spoils", [], ivy);
check("/spoils shows nothing waiting, today's container and the collection",
  /nothing waiting/.test(content(spoilsCmd)) && /Today's container: \*\*/.test(content(spoilsCmd)) && /containers 1\/17/.test(content(spoilsCmd)),
  spoilsCmd);

// 23. The Grand Exchange: the bank is spendable.
const broke = await command("ge", [], ivy);
check("/ge shows the menu and the balance", /Grand Exchange\*\* — .* to spend/.test(content(broke)) && /Super combat potion\(4\)/.test(content(broke)), broke);
await admin("bank-deposit", { player: ivy.user.id, gp: "20000" });
const balanceBefore = (await admin("ge-as", { player: ivy.user.id })).balance;
const potion = await click("ge:strength_potion4", ivy);
const afterPotion = (await sql(`SELECT gp_spent, loadout FROM players WHERE discord_id = '${ivy.user.id}'`))[0];
check("a potion is packed and paid for", /packed for your next session/.test(content(potion)) && JSON.parse(afterPotion.loadout).potion === "strength_potion4" && afterPotion.gp_spent > 0, { potion: content(potion), afterPotion });
const balanceAfter = (await admin("ge-as", { player: ivy.user.id })).balance;
check("the balance fell by the price", balanceBefore - balanceAfter === afterPotion.gp_spent, { balanceBefore, balanceAfter, spent: afterPotion.gp_spent });
const second = await click("ge:super_strength4", ivy);
const afterSecond = (await sql(`SELECT gp_spent FROM players WHERE discord_id = '${ivy.user.id}'`))[0];
check("a second potion is refused and costs nothing", /already have/.test(content(second)) && afterSecond.gp_spent === afterPotion.gp_spent, { second: content(second), afterSecond });
// bob has only what his kills dropped (and, rarely, a boss roll): sharks are out of reach unless he got lucky.
const bobBalance = (await admin("ge-as", { player: bob.user.id })).balance;
const tooDear = await click("ge:shark", { user: { id: bob.user.id, username: "bob" } });
check("what cannot be afforded is refused", bobBalance >= 25000 || /costs .* you have/.test(content(tooDear)), { bobBalance, tooDear });
const prayerBefore = (await sql(`SELECT COALESCE(SUM(xp), 0) AS xp FROM skill_xp WHERE player_id = '${ivy.user.id}' AND skill = 'prayer'`))[0].xp;
const bones = await click("ge:big_bones", ivy);
const prayerAfter = (await sql(`SELECT COALESCE(SUM(xp), 0) AS xp FROM skill_xp WHERE player_id = '${ivy.user.id}' AND skill = 'prayer'`))[0].xp;
// 375 XP, or that times the Chapel's altar when the local database has a town in it.
check("bones are buried for Prayer: 25 big bones is 375 XP", /buried/.test(content(bones)) && [375, 937, 1125, 1312].includes(prayerAfter - prayerBefore), { bones: content(bones), prayerBefore, prayerAfter });
const bankCmd = await command("bank", [], ivy);
check("/bank says what is unspent", /of it is unspent/.test(content(bankCmd)), bankCmd);

// 24. The next check-in drinks the potion, and opens spoils nobody picked.
const jack = `jack_${stamp}`;
await admin("seed", { players: jack, day, [`name_${jack}`]: "jack" });
await admin("checkin-as", { player: jack, day });
const nextDay = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const ivyNext = await admin("checkin-as", { player: ivy.user.id, day: nextDay });
check("the packed potion is used on the next session", (ivyNext.outcome?.receipt ?? []).some((line) => /Strength potion\(4\): Strength \+\d+ across the session/.test(line)), (ivyNext.outcome?.receipt ?? []).slice(0, 4));
const ivyLoadout = (await sql(`SELECT loadout FROM players WHERE discord_id = '${ivy.user.id}'`))[0];
check("and it is gone afterwards", ivyLoadout.loadout === "{}", ivyLoadout);
// Run on a Sunday, tomorrow is a new game week and the check-in is its first, not its second.
const nextDayIsMonday = new Date(`${nextDay}T00:00:00Z`).getUTCDay() === 1;
check(
  "the second check-in of the week is the week's chest",
  nextDayIsMonday ? ivyNext.outcome?.ordinal === 1 : (ivyNext.outcome?.spoils?.lines ?? []).some((line) => /The week's chest/.test(line)),
  ivyNext.outcome?.spoils
);
const jackNext = await admin("checkin-as", { player: jack, day: nextDay });
const jackRows = await sql(`SELECT day, picked, auto FROM spoils WHERE player_id = '${jack}' ORDER BY id`);
check("unpicked spoils open themselves at the next check-in",
  jackRows.length === 2 && jackRows[0].picked === 0 && jackRows[0].auto === 1 && jackRows[1].picked === null &&
    (jackNext.outcome?.essentials ?? []).some((line) => /opened themselves/.test(line)),
  { jackRows, essentials: jackNext.outcome?.essentials });

// 25. The diary: read off what the check-ins produced, as text when the card cannot render.
const diaryStats = await admin("diary", { player: ivy.user.id });
check("the diary counts check-ins, kills and spoils", diaryStats.stats?.checkins === 2 && diaryStats.stats?.kills > 0 && diaryStats.stats?.spoils === 1 && diaryStats.stats?.containers === 1 && diaryStats.stats?.spent > 0, diaryStats.stats);
check("and shows every tier with the open one's tasks", /Easy\*\* [▰▱]{8} \d\/6/.test(diaryStats.text ?? "") && /Elite/.test(diaryStats.text ?? "") && /Check in 5 times \(2\/5\)/.test(diaryStats.text ?? ""), diaryStats.text);
const diaryCmd = await command("diary", [], ivy);
check("/diary defers for its card", diaryCmd.body?.type === 5, diaryCmd);

// 26. The evening reminder names spoils nobody has picked.
const spoilsReminder = await admin("tick", { reminders: "1" });
const spoilsReminderPost = [...posts(CHANNEL)].reverse().find((e) => /Evening reminders/.test(e.body));
check("the evening reminder keeps unpicked spoils out of the channel", /things waiting/.test(spoilsReminderPost?.body ?? "") && !/spoils/i.test(spoilsReminderPost?.body ?? ""), { spoilsReminder, body: spoilsReminderPost?.body?.slice(0, 400) });
const jackTodo = await admin("todo", { player: jack, day: nextDay });
check("and the player's own list has them", (jackTodo.items ?? []).some((item) => /Spoils to pick/.test(item)), jackTodo);

// 27. Gear: owned pieces are worn, chased and shown off.
await admin("bank-item", { player: ivy.user.id, item: "bronze_boots" });
await admin("bank-item", { player: ivy.user.id, item: "abyssal_whip" });
await admin("bank-item", { player: ivy.user.id, item: "mystic_hat_light" });
const gearCmd = await command("gear", [{ name: "view", type: 1 }], ivy);
check("/gear shows the wardrobe and offers what is owned", /wardrobe \d+\/\d+/.test(content(gearCmd)) && JSON.stringify(gearCmd.body).includes('"custom_id":"gear:w"') && JSON.stringify(gearCmd.body).includes('"value":"bronze_boots"') && JSON.stringify(gearCmd.body).includes("gear:show"), gearCmd);
const wearBoots = await click("gear:w:bronze_boots", ivy);
check("boots are worn and count", /Wearing Bronze boots \(defence \+2\)/.test(content(wearBoots)), wearBoots);
const wearWhip = await command("gear", [{ name: "wear", type: 1, options: [{ name: "item", type: 3, value: "whip" }] }], ivy);
check("a whip at low Attack is worn for the look", /Wearing Abyssal whip for the look; it needs 70 Attack/.test(content(wearWhip)), wearWhip);
await click("gear:w:mystic_hat_light", ivy);
const wornRow = JSON.parse((await sql(`SELECT gear FROM players WHERE discord_id = '${ivy.user.id}'`))[0].gear);
check("what is worn is kept by slot", wornRow.boots === "bronze_boots" && wornRow.weapon === "abyssal_whip" && wornRow.head === "mystic_hat_light", wornRow);
const notOwned = await command("gear", [{ name: "wear", type: 1, options: [{ name: "item", type: 3, value: "granite maul" }] }], ivy);
check("something not owned is refused, with where it drops", /do not own Granite maul: Gargoyle 1\/64/.test(content(notOwned)), notOwned);
const chase = await command("gear", [{ name: "chase", type: 1, options: [{ name: "item", type: 3, value: "leaf-bladed sword" }] }], ivy);
const wish = (await sql(`SELECT wishlist FROM players WHERE discord_id = '${ivy.user.id}'`))[0].wishlist;
check("chasing an item records it and says where it drops, at the chased rate", wish === "leaf_bladed_sword" && /Chasing \*\*Leaf-bladed sword\*\*: Kurask 1\/48/.test(content(chase)), { wish, chase: content(chase) });
const catalogue = await command("gear", [{ name: "catalogue", type: 1, options: [{ name: "slot", type: 3, value: "boots" }] }], ivy);
check("the catalogue lists a slot with sources", /✅ Bronze boots/.test(content(catalogue)) && /▫️ Rune boots \(defence \+13, strength \+2; needs 40 Defence\) — Nechryael/.test(content(catalogue)), catalogue);
const takeOff = await click("gear:w:bronze_boots", ivy);
check("pressing a worn piece takes it off", /Took off Bronze boots/.test(content(takeOff)), takeOff);
const shown = await click("gear:show", ivy);
const gearPost = await waitFor(() => posts(CHANNEL).find((e) => /ivy\*\*'s gear/.test(e.body)), 60);
check("Show off posts the gear to the channel", shown.body?.type === 5 && Boolean(gearPost), { shown, gearPost });
const ivyGearNext = await admin("checkin-as", { player: ivy.user.id, day: new Date(Date.parse(`${day}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10) });
check("a check-in with a look worn still fights with the scimitar", /scimitar/.test(ivyGearNext.outcome?.session ?? ""), ivyGearNext.outcome?.session);

// 28. Slayer choices.
const master = await command("task", [{ name: "master", type: 1, options: [{ name: "name", type: 3, value: "turael" }] }], ivy);
check("/task master picks a master the player qualifies for", /Turael assigns your tasks from now on/.test(content(master)), master);
const tooHigh = await command("task", [{ name: "master", type: 1, options: [{ name: "name", type: 3, value: "duradel" }] }], ivy);
check("and refuses one they do not", /Duradel wants combat level 100 and 50 Slayer/.test(content(tooHigh)), tooHigh);
const block = await command("task", [{ name: "block", type: 1 }], ivy);
check("blocking needs the points", /Blocking costs 100 points/.test(content(block)), block);
const taskCmd = await command("task", [{ name: "status", type: 1 }], ivy);
check("/task shows the block list and the master", /Blocked \(0\/[1-6]\): nothing/.test(content(taskCmd)) && /Master: Turael/.test(content(taskCmd)) && JSON.stringify(taskCmd.body).includes("task:block"), taskCmd);

// 29. The farm: one run a day.
const farmCmd = await command("farm", [], ivy);
check("/farm shows three patches", /Allotment\*\*: empty — a run plants potato seeds/.test(content(farmCmd)) && /Herb patch\*\*: empty — no seed you can plant yet/.test(content(farmCmd)) && JSON.stringify(farmCmd.body).includes("farm:run"), farmCmd);
const run1 = await click("farm:run", ivy);
check("the first run plants potatoes", /nothing was ready; planted potato/.test(content(run1)) && /Farming/.test(content(run1)), run1);
const run2 = await click("farm:run", ivy);
check("a second run the same day is refused", /already done/.test(content(run2)), run2);
const tomorrowAt = new Date(Date.now() + 86400000).toISOString();
const run3 = await admin("farm-as", { player: ivy.user.id, at: tomorrowAt, run: "1" });
check("the next day's run harvests and replants", /harvested \d+× Potato \(\d+ gp, banked\); planted potato/.test(run3.content ?? ""), run3);
const farmXp = (await sql(`SELECT xp FROM skill_xp WHERE player_id = '${ivy.user.id}' AND skill = 'farming'`))[0];
check("Farming XP landed", (farmXp?.xp ?? 0) > 60, farmXp);
const potatoes = (await sql(`SELECT qty FROM bank WHERE player_id = '${ivy.user.id}' AND item = 'potato'`))[0];
check("the potatoes are in the bank", (potatoes?.qty ?? 0) >= 6, potatoes);

// 30. Miscellania: fund it, wait a week, collect.
const kingdomCmd = await command("kingdom", [{ name: "status", type: 1 }], ivy);
check("/kingdom shows approval, the coffer and the subjects", /Miscellania\*\* — approval \d+% · coffer 0 gp/.test(content(kingdomCmd)) && /Subjects: Herbs 10/.test(content(kingdomCmd)), kingdomCmd);
await admin("bank-deposit", { player: ivy.user.id, gp: "60000" });
const funded = await click("kd:dep:50000", ivy);
check("funding moves coins from the bank's balance to the coffer", /Put 50k gp in the coffer/.test(content(funded)) && /coffer 50k gp \(pays 5\.0k gp a day/.test(content(funded)), funded);
const weekOn = new Date(Date.parse(`${day}T00:00:00Z`) + 9 * 86400000).toISOString().slice(0, 10);
const waiting = await admin("kingdom-as", { player: ivy.user.id, day: weekOn });
check("a week on, the subjects have gathered herbs and been paid", /Waiting.*Grimy/.test(waiting.content ?? "") && waiting.kingdom?.coffer < 50000 && waiting.kingdom?.approval < 100, waiting);
const collected = await admin("kingdom-as", { player: ivy.user.id, day: weekOn, collect: "1" });
const herbsBanked = (await sql(`SELECT COALESCE(SUM(qty), 0) AS n FROM bank WHERE player_id = '${ivy.user.id}' AND item LIKE 'grimy_%'`))[0];
check("collecting banks the haul", /Collected .*Grimy/.test(collected.content ?? "") && herbsBanked.n > 0, { collected: collected.content, herbsBanked });
const again2 = await admin("kingdom-as", { player: ivy.user.id, day: weekOn, collect: "1" });
check("and there is nothing to collect twice", /Nothing to collect yet/.test(again2.content ?? ""), again2.content);
const assign = await command("kingdom", [{ name: "assign", type: 1, options: [{ name: "wood", type: 4, value: 6 }, { name: "mining", type: 4, value: 4 }] }], ivy);
check("/kingdom assign splits the subjects", /Subjects reassigned: Mining 4 · Wood 6/.test(content(assign)), assign);
const overAssign = await command("kingdom", [{ name: "assign", type: 1, options: [{ name: "wood", type: 4, value: 8 }, { name: "mining", type: 4, value: 4 }] }], ivy);
check("and refuses more than ten", /You have 10 subjects; that is 12/.test(content(overAssign)), overAssign);

// 31. Tears of Guthix: once a week.
const tears1 = await command("tears", [], ivy);
check("/tears pays the lowest skill", /Tears of Guthix\*\*: \d+ tears caught/.test(content(tears1)) && /your lowest skill/.test(content(tears1)), tears1);
const tears2 = await command("tears", [], ivy);
check("and only once a week", /heard your story this week/.test(content(tears2)), tears2);

// 32. The boss of the week: every check-in takes a swing, and the group brings it down.
// The Monday three weeks on, so a week of fights stays inside one game week.
// (Six weeks, so the players above have dropped off the active roster and the bar is sized for these three.)
const threeWeeksOn = new Date(Date.parse(day + "T00:00:00Z") + 42 * 86400000);
const bossWeekDay = new Date(threeWeeksOn.getTime() - ((threeWeeksOn.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
const fighters = ["kay", "lee", "moe"].map((n) => `${n}_${stamp}`);
await admin("seed", { players: fighters.join(","), day: bossWeekDay, ...Object.fromEntries(fighters.map((id) => [`name_${id}`, id.split("_")[0]])) });
const firstSwing = await admin("checkin-as", { player: fighters[0], day: bossWeekDay });
const bossRow = (await admin("boss", { day: bossWeekDay })).week;
check("the first check-in of the week opens the boss", bossRow?.status === "open" && bossRow.hp > 0 && bossRow.damage > 0 && bossRow.damage < bossRow.hp, bossRow);
check("the receipt says what the swing did", (firstSwing.outcome?.receipt ?? []).some((line) => /kay hit \*\*(Scurrius|Obor|Bryophyta)\*\* for \d+ — [\d,]+ of [\d,]+ left\./.test(line)), firstSwing.outcome?.receipt);
const hitRow = (await sql(`SELECT damage, kills FROM boss_hits WHERE player_id = '${fighters[0]}'`))[0];
check("the swing is on the record", hitRow?.damage === bossRow.damage && [0, 1].includes(hitRow?.kills), hitRow);
// Everybody turns up until it falls: day by day, never twice a day.
let fallen = null;
for (let d = 0; d < 7 && !fallen; d++) {
  const fightDay = new Date(Date.parse(`${bossWeekDay}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
  for (const id of fighters) {
    if (d === 0 && id === fighters[0]) continue;
    const out = await admin("checkin-as", { player: id, day: fightDay });
    if ((out.outcome?.channelLines ?? []).some((line) => /is down/.test(line))) fallen = out.outcome.channelLines.find((line) => /is down/.test(line));
    if (fallen) break;
  }
}
const bossAfter = (await admin("boss", { day: bossWeekDay })).week;
check("the group brings the boss down inside the week", Boolean(fallen) && bossAfter?.status === "done", { fallen, bossAfter });
check("everyone who fought shares the spoils, by name", fighters.every((id) => (fallen ?? "").includes(`**${id.split("_")[0]}**`)) && /landed the last blow/.test(fallen ?? ""), fallen);
const bossCmd = await admin("boss", { day: bossWeekDay });
check("/boss shows who did what", /Down since/.test(bossCmd.content ?? "") && /1\. \*\*/.test(bossCmd.content ?? "") && /Next week:/.test(bossCmd.content ?? ""), bossCmd.content);

// 33. Private to-do lists ride on the buttons a player already presses.
const nia = { user: { id: `nia_${stamp}`, username: "nia" } };
await click(`join:${day}`, nia);
const niaTodo = await command("todo", [], nia);
check("/todo is private and lists what is waiting",
  niaTodo.body?.data?.flags === 64 && /Spoils to pick/.test(content(niaTodo)) && /have not planted it/.test(content(niaTodo)) && /have not funded it/.test(content(niaTodo)) && /Tears of Guthix this week/.test(content(niaTodo)) && /not chasing anything/.test(content(niaTodo)),
  niaTodo);
const oli = { user: { id: `oli_${stamp}`, username: "oli" } };
await command("join", [], oli);
const oliRest = await click(`no:${day}`, oli);
check("a rest-day answer carries the list too", /Rest day noted/.test(content(oliRest)) && /For you\*\* \(only you see this\)/.test(content(oliRest)) && /0 of 2 check-ins this week/.test(content(oliRest)), oliRest);
check("nothing private reaches the channel", !posts(CHANNEL).some((e) => /For you|have not planted|have not funded/.test(e.body)));
const morning = [...posts(CHANNEL)].reverse().find((e) => /Did you work out/.test(e.body));
check("the morning post carries the My to-do button and the boss", /"custom_id":"todo"/.test(morning?.body ?? "") && /(Scurrius|Obor|Bryophyta)/.test(morning?.body ?? ""), morning?.body?.slice(0, 600));

// 34. A button answered late is only acknowledged, and its answer is a follow-up. The next click must
// edit that follow-up by id: the token's "@original" is the message the button sat on (the morning post
// for a Yes), and editing it put a player's spoils on the morning post instead of on their receipt.
const pat = { user: { id: `pat_${stamp}`, username: "pat" } };
await admin("seed", { players: pat.user.id, day, [`name_${pat.user.id}`]: "pat" });
await admin("checkin-as", { player: pat.user.id, day });
const lateButton = await click("boss", pat); // held back by SLOW_COMMAND
check("a slow button is acknowledged, not answered", lateButton.body?.type === 6, lateButton);
const lateFollowUp = await waitFor(() => mockLog().find((e) => e.method === "POST" && /\/webhooks\/app_yut\/tok\d+$/.test(e.url) && /Boss of the week/.test(e.body)), 40);
check("its answer arrives as a follow-up", Boolean(lateFollowUp), lateFollowUp);
const patRow = await waitFor(async () => null, 1).then(async () => (await sql(`SELECT message_id FROM ephemeral_replies WHERE user_discord_id = '${pat.user.id}'`))[0]);
check("the follow-up's id is remembered as the running reply", /^\d+$/.test(patRow?.message_id ?? ""), patRow);
const editsBefore = mockLog().filter((e) => e.method === "PATCH" && /\/webhooks\//.test(e.url)).length;
await click("farm", pat);
const edits = mockLog().filter((e) => e.method === "PATCH" && /\/webhooks\//.test(e.url));
const lastEdit = edits[edits.length - 1];
check("the next click edits the follow-up, never the message the button was on",
  edits.length === editsBefore + 1 && new RegExp(`/messages/${patRow?.message_id}$`).test(lastEdit?.url ?? "") && !/@original/.test(lastEdit?.url ?? "") && /farm/.test(lastEdit?.body ?? ""),
  { url: lastEdit?.url, body: lastEdit?.body?.slice(0, 120) });

// 35. Nothing needs a slash command: the menu reaches everything, dropdowns stand in for a
// command's options, and a form stands in for /checkin's note and photo.
const ids = (r) => [...JSON.stringify(r.body).matchAll(/"custom_id":"([^"]+)"/g)].map((m) => m[1]);
const menu = await click("hub", ivy);
const menuIds = ids(menu);
check("the menu fits Discord's five rows", menu.body?.data?.components?.length === 5, menu.body?.data?.components?.length);
const wanted = ["sheet", "gear", "bank", "log", "diary", "task", "boss", "quest", "raid", "bingo", "farm", "kd", "tears", "ge", "shop", "town", "vote", "standings", "relics", "help", "hub:more"];
check("the menu has a button for every place a command goes", wanted.every((id) => menuIds.includes(id)), wanted.filter((id) => !menuIds.includes(id)));
const settings = await click("hub:more", ivy);
const settingsIds = ids(settings);
check(
  "More holds style, pings, Rings, an expedition and retiring",
  ["style:accurate", "style:controlled", "rings", "exp", "leave", "hub"].every((id) => settingsIds.includes(id)) && settingsIds.some((id) => id.startsWith("ping:")),
  settingsIds
);
const staleMenu = await click("hub", { user: { id: dave, username: "dave" } });
check("the menu opens for a stale player, and says what it takes", /Most of this needs a check-in/.test(content(staleMenu)) && ids(staleMenu).includes("sheet"), staleMenu);

const bankView = await click("bank", ivy);
check("a view carries a way back to the menu", ids(bankView).includes("hub"), bankView);
const tearsButton = await click("tears", ivy);
check("the Tears button is /tears", /heard your story this week|Tears of Guthix/.test(content(tearsButton)), tearsButton);
const raidButton = await click("raid", ivy);
check("the Raid button is /raid status", /raid/i.test(content(raidButton)) && ids(raidButton).some((id) => id === "raid:propose" || id === "vote"), raidButton);
const relicsButton = await click("relics", ivy);
check("the Relics button is /relics", /relic/i.test(content(relicsButton)), relicsButton);
const ringsButton = await click("rings", ivy);
check("the Rings button is /freeze", /Rings of Life: \d+ of \d+/.test(content(ringsButton)), ringsButton);
const questLogButton = await click("quest:log", ivy);
check("the quest log is a button on the quest", /Quest log/.test(content(questLogButton)) && ids(questLogButton).includes("quest"), questLogButton);
const table = await click("standings", ivy);
check("standings come with a dropdown of players", /Combat \d+/.test(content(table)) && ids(table).includes("sheet:of"), table);
const theirSheet = await pick("sheet:of", [bob.user.id], ivy);
check("picking a player defers for their sheet", theirSheet.body?.type === 5, theirSheet);

const masterPick = await pick("task:master", ["best"], ivy);
check("the master dropdown is /task master, and the task view follows", /Back to the highest master/.test(content(masterPick)) && ids(masterPick).includes("task:unblock"), masterPick);
const split = await pick("kd:split", ["wood", "mining"], ivy);
check("the split dropdown shares the ten out evenly", /Subjects reassigned: Mining 5 · Wood 5/.test(content(split)), split);
const moved = await pick("kd:add", ["wood"], ivy);
check("and one subject can be moved at a time", /Subjects reassigned: Mining 4 · Wood 6/.test(content(moved)), moved);
check("the kingdom offers a withdrawal", ids(moved).some((id) => /^kd:dep:-\d+$/.test(id)), ids(moved));
const boots = await pick("gear:cat", ["boots"], ivy);
const chaseSelect = boots.body?.data?.components?.map((row) => row.components[0]).find((c) => c.custom_id === "gear:c");
check("the catalogue dropdown lists a slot with something to chase", /\*\*Boots\*\*/.test(content(boots)) && chaseSelect?.options?.length > 0, boots);
const chased = await pick("gear:c", [chaseSelect?.options?.[0]?.value ?? ""], ivy);
check("picking one chases it", new RegExp(`Chasing ${chaseSelect?.options?.[0]?.label}`).test(content(chased)), chased);
const worn = await pick("gear:w", ["bronze_boots"], ivy);
check("the wardrobe dropdown wears a piece", /(Wearing|Took off) Bronze boots/.test(content(worn)), worn);

// The check-in form.
const quin = { user: { id: `quin_${stamp}`, username: "quin" } };
await command("join", [], quin);
const form = await click(`cin:${day}`, quin);
const formFields = JSON.stringify(form.body?.data?.components ?? []);
check("Yes with a note or photo opens a form", form.body?.type === 9 && /"custom_id":"note"/.test(formFields) && /"type":19/.test(formFields), form);
const oldForm = await click("cin:2001-01-01", quin);
check("yesterday's form button is refused", /yesterday's question/.test(content(oldForm)), oldForm);
const filed = await submit(`cin:${day}`, [{ type: 4, custom_id: "note", value: "leg day, by button" }, { type: 19, custom_id: "photo", values: [] }], quin);
check("the form checks in", /Checked in\.\*\* 1st this week/.test(content(filed)), filed);
await waitFor(() => posts(CHANNEL).find((e) => /leg day, by button/.test(e.body)), 40);
check("and its note reaches the channel", posts(CHANNEL).some((e) => /leg day, by button/.test(e.body)));
check("the receipt offers a photo afterwards", ids(filed).includes(`cin:${day}`), ids(filed));
const formProof = await submit(
  `cin:${day}`,
  [{ type: 4, custom_id: "note", value: "" }, { type: 19, custom_id: "photo", values: ["att9"] }],
  quin,
  { attachments: { att9: { id: "att9", filename: "gym.png", content_type: "image/png", size: 1000, url: "http://127.0.0.1:1/gym.png" } } }
);
check("a photo sent on the form after a Yes defers to attach it", formProof.body?.type === 5, formProof);

// Leaving the game, for a while or for good, asks first.
const away = await pick("exp", ["2"], quin);
check("an expedition is confirmed before it starts", /Go on expedition for 2 weeks\?/.test(content(away)) && ids(away).includes("exp:2:yes"), away);
check("nothing happened yet", (await sql(`SELECT status FROM players WHERE discord_id = '${quin.user.id}'`))[0]?.status === "active");
const gone = await click("exp:2:yes", quin);
check("confirming starts it", /On expedition until/.test(content(gone)) && (await sql(`SELECT status FROM players WHERE discord_id = '${quin.user.id}'`))[0]?.status === "paused", gone);
const retire = await click("leave", quin);
check("retiring is confirmed too", /Retire from the campaign\?/.test(content(retire)) && ids(retire).includes("leave:yes"), retire);
const retired = await click("leave:yes", quin);
check("and then it happens", /Retired/.test(content(retired)), retired);

const morningNow = [...posts(CHANNEL)].reverse().find((e) => /Did you work out/.test(e.body));
check("the morning post leads into the menu and the form", /"custom_id":"hub"/.test(morningNow?.body ?? "") && /"custom_id":"cin:/.test(morningNow?.body ?? ""), morningNow?.body?.slice(-700));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
