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
    if (req.method === "POST" && /\/channels\/[^/]+\/messages$/.test(req.url)) {
      const id = String(++nextId);
      let content = "";
      try {
        content = JSON.parse(body).content ?? "";
      } catch {}
      messages.set(id, content);
      json(200, { id, channel_id: "x", content, timestamp: new Date(0).toISOString(), attachments: [], author: { id: "bot", username: "bot" } });
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
