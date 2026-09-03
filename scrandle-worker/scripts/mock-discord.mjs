// Minimal stand-in for the Discord REST endpoints the worker calls.
// Records every request so the simulation can assert on what was sent.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const sent = [];
let nextId = 1000;

// Port is overridable so two worktrees can run the harness at once — several
// checkouts of this repo on one machine is the normal case, and a hardcoded
// port means the second one silently talks to the first one's mock.
const PORT = Number(process.env.MOCK_DISCORD_PORT ?? 9911);

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    sent.push({ method: req.method, url: req.url, body: body.slice(0, 4000) });
    writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));

    // POST /channels/{id}/messages/{id}/threads — the 9am batch opens one for
    // its cards and one for its results. Threads get ids of their own so a
    // simulation can tell a post into one from a post to the channel.
    if (req.method === "POST" && /\/threads$/.test(req.url)) {
      const id = `thread_${++nextId}`;
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id, type: 11, name: JSON.parse(body || "{}").name ?? "" }));
      return;
    }
    if (req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST" && /\/messages$/.test(req.url)) {
      const id = String(++nextId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id, channel_id: "x", content: "", timestamp: new Date(0).toISOString(), attachments: [], author: { id: "bot", username: "bot" } }));
      return;
    }
    if (req.method === "PATCH") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "edited" }));
      return;
    }
    // GET /channels/{id}/messages — no new photos during the simulation.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("[]");
  });
}).listen(PORT, () => console.log(`mock discord on :${PORT}`));
