// Minimal stand-in for the Discord REST endpoints the worker calls.
// Records every request so the simulation can assert on what was sent.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const sent = [];
let nextId = 1000;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    sent.push({ method: req.method, url: req.url, body: body.slice(0, 4000) });
    writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));

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
}).listen(9911, () => console.log("mock discord on :9911"));
