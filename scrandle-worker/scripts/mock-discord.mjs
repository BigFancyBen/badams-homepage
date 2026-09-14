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

// Every Nth card the worker posts comes back the way Discord's media proxy
// sometimes hands one back for real: proxied, and 0 by 0. 0 (the default)
// never does. Point IMAGE_BASE_URL at this mock as well so the cards render
// (see below), or no card is ever posted and there is nothing to fumble.
const CARD_FLAKE = Number(process.env.MOCK_CARD_FLAKE ?? 0);
let cardsPosted = 0;

// A 1×1 PNG — enough to satisfy the Worker's "is this an image" check.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Discord's reply to a post or an edit echoes the embeds with the image
 * resolved: a proxy URL and the fetched copy's size. `loaded` false is the
 * 0-by-0 answer the client draws as nothing.
 */
function resolvedEmbeds(embeds, loaded) {
  return (embeds ?? []).map((embed) =>
    embed.image
      ? {
          ...embed,
          image: {
            url: embed.image.url,
            proxy_url: `https://media.test.local/${encodeURIComponent(embed.image.url)}`,
            width: loaded ? 1200 : 0,
            height: loaded ? 630 : 0,
          },
        }
      : embed
  );
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    sent.push({ method: req.method, url: req.url, body: body.slice(0, 4000) });
    writeFileSync("mock-discord-log.json", JSON.stringify(sent, null, 2));

    // The render endpoints, when IMAGE_BASE_URL points here. The real ones
    // are on Vercel and want real photographs; a seeded dish has none.
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
      const { embeds } = JSON.parse(body || "{}");
      let loaded = true;
      if (embeds?.some((embed) => embed.image)) {
        cardsPosted++;
        loaded = !(CARD_FLAKE > 0 && cardsPosted % CARD_FLAKE === 0);
        if (!loaded) console.log(`card on message ${id} answered 0×0`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id,
          channel_id: "x",
          content: "",
          timestamp: new Date(0).toISOString(),
          attachments: [],
          author: { id: "bot", username: "bot" },
          embeds: resolvedEmbeds(embeds, loaded),
        })
      );
      return;
    }
    if (req.method === "PATCH") {
      const { embeds } = JSON.parse(body || "{}");
      if (embeds?.some((embed) => embed.image)) {
        console.log(`card replaced on ${req.url.split("/").pop()}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "edited", embeds: resolvedEmbeds(embeds, true) }));
      return;
    }
    // GET /channels/{id}/messages — no new photos during the simulation.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("[]");
  });
}).listen(PORT, () => console.log(`mock discord on :${PORT}`));
