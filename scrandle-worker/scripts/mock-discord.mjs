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

// A 1×1 PNG — enough to satisfy the Worker's "is this an image" check.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// 600 bytes that start like a JPEG — enough to pass for the smaller copy the
// compress route hands back.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(596)]);

/**
 * Discord's reply to a post or an edit echoes the embeds with the image
 * resolved: a proxy URL and a size. The size is whatever the proxy has
 * managed by the time the reply goes out, which is often 0 by 0 for a card
 * that then loads fine — the worker does not read it.
 */
function resolvedEmbeds(embeds) {
  return (embeds ?? []).map((embed) =>
    embed.image
      ? {
          ...embed,
          image: {
            url: embed.image.url,
            proxy_url: `https://media.test.local/${encodeURIComponent(embed.image.url)}`,
            width: 0,
            height: 0,
          },
        }
      : embed
  );
}

/**
 * The JSON half of a request. A post that uploads a card is multipart, with
 * the message itself in a part called payload_json and the card in files[n];
 * everything else is plain JSON.
 */
function payloadOf(req, body) {
  if (!body) return {};
  const type = req.headers["content-type"] ?? "";
  if (!type.startsWith("multipart/form-data")) return JSON.parse(body);
  const boundary = type.split("boundary=")[1]?.replace(/"/g, "");
  const part = body
    .split(`--${boundary}`)
    .find((p) => p.includes('name="payload_json"'));
  if (!part) return {};
  // Headers end at the first blank line; the part ends with its own CRLF.
  return JSON.parse(part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""));
}

/** Filenames uploaded with a multipart request, in the order they were sent. */
function uploadsOf(body) {
  return [...body.matchAll(/name="files\[\d+\]"; filename="([^"]+)"/g)].map(
    (m) => m[1]
  );
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = payloadOf(req, body);
    sent.push({
      method: req.method,
      url: req.url,
      body: JSON.stringify(payload).slice(0, 4000),
      uploads: uploadsOf(body),
    });
    writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));

    // The render endpoints, when IMAGE_BASE_URL points here. The real ones
    // are on Vercel and want real photographs; a seeded dish has none.
    // The compress route answers with a JPEG and the Worker checks that it
    // did. MOCK_COMPRESS_STATUS makes it fail instead: 502 is "this photograph
    // cannot be shrunk", anything else is the site being down.
    if (req.method === "GET" && req.url.startsWith("/api/scrandle/compress")) {
      const status = Number(process.env.MOCK_COMPRESS_STATUS ?? 200);
      res.writeHead(status, { "Content-Type": status === 200 ? "image/jpeg" : "text/plain" });
      res.end(status === 200 ? JPEG : "no");
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/api/scrandle/")) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(PNG);
      return;
    }

    // POST /channels/{id}/messages/{id}/threads — the 9am batch opens one for
    // its cards and one for its results. Threads get ids of their own so a
    // simulation can tell a post into one from a post to the channel.
    if (req.method === "POST" && /\/threads$/.test(req.url)) {
      const id = `thread_${++nextId}`;
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id, type: 11, name: payload.name ?? "" }));
      return;
    }
    if (req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST" && /\/messages$/.test(req.url)) {
      const id = String(++nextId);
      const { embeds } = payload;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id,
          channel_id: "x",
          content: "",
          timestamp: new Date(0).toISOString(),
          attachments: [],
          author: { id: "bot", username: "bot" },
          embeds: resolvedEmbeds(embeds),
        })
      );
      return;
    }
    if (req.method === "PATCH") {
      const { embeds } = payload;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "edited", embeds: resolvedEmbeds(embeds) }));
      return;
    }
    // GET /channels/{id}/messages — no new photos during the simulation.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("[]");
  });
}).listen(PORT, () => console.log(`mock discord on :${PORT}`));
