// Minimal stand-in for the Discord REST endpoints the worker calls.
// Records every request so the harness can assert on what was sent.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const sent = [];
let nextId = 1000;

// A 1×1 PNG, for attachment mirroring.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// Port is overridable so two worktrees can run the harness at once. 9912
// rather than scrandle's 9911, for the same reason.
const PORT = Number(process.env.MOCK_DISCORD_PORT ?? 9912);

const messages = new Map();

// GET /__mock/channel-post-status?code=403 makes every channel post fail the
// way a channel the bot cannot see does; ?code=200 restores it. The thread
// toggles do the same for creating a thread and for posting into one.
let channelPostStatus = 200;
let threadCreateStatus = 200;
let threadPostStatus = 200;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    sent.push({ method: req.method, url: req.url, body: body.slice(0, 4000) });
    writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));

    const json = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (req.method === "GET" && /\/cdn\//.test(req.url)) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(PNG);
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/__mock/channel-post-status")) {
      channelPostStatus = Number(new URL(req.url, "http://mock").searchParams.get("code") ?? 200);
      json(200, { channelPostStatus });
      return;
    }
    // GET /__mock/reset forgets the log, so a second harness run against the
    // same mock cannot match the first run's requests.
    if (req.method === "GET" && req.url.startsWith("/__mock/reset")) {
      sent.length = 0;
      writeFileSync("mock-discord-log.json", "[]");
      json(200, { reset: true });
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/__mock/thread-create-status")) {
      threadCreateStatus = Number(new URL(req.url, "http://mock").searchParams.get("code") ?? 200);
      json(200, { threadCreateStatus });
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/__mock/thread-post-status")) {
      threadPostStatus = Number(new URL(req.url, "http://mock").searchParams.get("code") ?? 200);
      json(200, { threadPostStatus });
      return;
    }
    // Starting a thread on a message: the thread is a channel named thread_N.
    if (req.method === "POST" && /\/channels\/[^/]+\/messages\/[^/]+\/threads$/.test(req.url)) {
      if (threadCreateStatus !== 200) {
        json(threadCreateStatus, { message: "Missing Permissions", code: 50013 });
        return;
      }
      const parent = req.url.split("/")[2];
      const id = `thread_${++nextId}`;
      let name = "";
      try {
        name = JSON.parse(body).name ?? "";
      } catch {}
      json(200, { id, type: 11, parent_id: parent, name });
      return;
    }
    if (req.method === "POST" && /\/channels\/[^/]+\/messages$/.test(req.url)) {
      const channel = req.url.split("/")[2];
      if (channel.startsWith("thread_") ? threadPostStatus !== 200 : channelPostStatus !== 200) {
        json(channel.startsWith("thread_") ? threadPostStatus : channelPostStatus, { message: "Missing Access", code: 50001 });
        return;
      }
      const id = String(++nextId);
      let content = "";
      let attachments = [];
      // A multipart post carries payload_json plus files[N]; the mock reads
      // the JSON part and answers with an attachment per file, like Discord.
      const multipart = body.match(/name="payload_json"\r?\n\r?\n([\s\S]*?)\r?\n--/);
      try {
        const payload = JSON.parse(multipart ? multipart[1] : body);
        content = payload.content ?? "";
        if (multipart) {
          attachments = (payload.attachments ?? [{ filename: "file" }]).map((a, i) => ({
            id: `att_${id}_${i}`,
            filename: a.filename ?? "file",
            size: 1,
            content_type: "image/png",
            url: `http://127.0.0.1:${PORT}/cdn/att_${id}_${i}.png`,
          }));
        }
      } catch {}
      messages.set(id, content);
      // The log entry learns where the message landed and what id it got, so
      // the harness can tell a thread line from a channel post.
      Object.assign(sent[sent.length - 1], { id, channel, multipart: Boolean(multipart) });
      writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));
      json(200, { id, channel_id: channel, content, timestamp: new Date(0).toISOString(), attachments, author: { id: "bot", username: "bot" } });
      return;
    }
    if (req.method === "GET" && /\/channels\/[^/]+\/messages\/\d+$/.test(req.url)) {
      const id = req.url.split("/").pop();
      json(200, { id, content: messages.get(id) ?? "" });
      return;
    }
    if (req.method === "PATCH") {
      const id = req.url.split("/").pop();
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed.content === "string" && messages.has(id)) messages.set(id, parsed.content);
      } catch {}
      json(200, { id: id ?? "edited" });
      return;
    }
    if (req.method === "POST" && /\/webhooks\//.test(req.url)) {
      json(200, { id: String(++nextId) });
      return;
    }
    if (req.method === "PUT" && /\/commands$/.test(req.url)) {
      json(200, []);
      return;
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST" && /\/roles$/.test(req.url)) {
      json(200, { id: "role_players", name: "Yut Hut Players" });
      return;
    }
    if (req.method === "GET" && /\/roles$/.test(req.url)) {
      json(200, []);
      return;
    }
    json(200, []);
  });
}).listen(PORT, () => console.log(`mock discord on :${PORT}`));
