import type {
  ChecklistGroup,
  Constraint,
  Decision,
  Phase,
  SectionLink,
} from "./types";

export const ACCENT = "#81a1c1";
export const ACCENT_WARM = "#d08770";

export const SUMMARY =
  "A Scrandle-style voting game built from food photos posted in a private Discord channel. Roughly 15 players. One Cloudflare Worker polls the channel hourly, ingests new photos, and posts a matchup with two buttons. Votes are private, the result reveals at close, and the chefs find out who won in the channel.";

export const STAT_LINE = [
  { label: "Players", value: "~15" },
  { label: "Catalog", value: "1,001 dishes" },
  { label: "Frontend", value: "None" },
  { label: "Hosting cost", value: "$0" },
];

export const SECTIONS: SectionLink[] = [
  { id: "overview", label: "Overview" },
  { id: "decisions", label: "Settled decisions" },
  { id: "setup", label: "Accounts and setup" },
  { id: "stack", label: "Stack" },
  { id: "constraints", label: "Free-tier limits" },
  { id: "schema", label: "Schema" },
  { id: "phases", label: "Build phases" },
  { id: "versioning", label: "Version announcements" },
  { id: "secrets", label: "Secrets" },
  { id: "questions", label: "Open questions" },
];

export const DECISIONS: Decision[] = [
  {
    id: "in-discord",
    title: "The game lives in Discord, not on a web page",
    body: "No voting page, no OAuth, no session cookies, no frontend. Discord already knows who everyone is and everyone is already in the channel. The web app was v1 for about a day; it turned out every part of it except the leaderboards was friction.",
  },
  {
    id: "buttons-not-polls",
    title: "Buttons, not a native Discord poll",
    body: "Polls are zero code, but they show a live tally and anyone can expand an answer to see who voted. That kills anonymity and invites bandwagoning. Buttons cost about 50 lines more and give both back — each click gets a private ephemeral reply and nobody sees a thing until close.",
  },
  {
    id: "one-pair",
    title: "One pair at a time, not a slate of ten",
    body: "A slate of ten is twenty messages and a chore. One matchup a day is a ritual. It also deletes the entire slate-construction algorithm — pick two dishes inside an Elo band, exclude recent pairs, prefer the least-played.",
  },
  {
    id: "render-elsewhere",
    title: "Render images on Vercel, not in the Worker",
    body: "Workers Free gives 10ms of CPU per invocation, which cannot rasterize anything. The render endpoints live in the Next app as `ImageResponse` routes — satori to SVG, resvg to PNG. The Worker builds a signed URL and Discord fetches the PNG itself.",
  },
  {
    id: "rehost-r2",
    title: "Re-host every image in R2",
    body: "Discord CDN URLs are signed with `?ex=` and `?hm=` and expire in about 24 hours. They are refreshable, so expiry alone is not the argument — durability is. A chef deleting one message would otherwise punch a permanent hole in the back catalog, and the render endpoint wants stable, cacheable URLs.",
  },
  {
    id: "hidden-chefs",
    title: "Chefs hidden during voting, revealed at close",
    body: "Vote on the photos alone. The closed message attributes everything and publishes the self-vote tally. Anonymous voting keeps it honest, and the argument afterwards in the channel is the actual product.",
  },
  {
    id: "no-tells",
    title: "No tells about which dish is new",
    body: "Sides are randomized and matchups never ping the Tasters role, because a ping would correlate with new dishes entering the pool. Only the weekly standings post pings. Small things, but the whole game rests on not knowing whose plate you are looking at.",
  },
];

export const CHECKLIST: ChecklistGroup[] = [
  {
    id: "discord-app",
    title: "Discord application",
    blurb: "One bot, no OAuth client needed.",
    items: [
      {
        id: "app-create",
        text: "Discord Developer Portal, create a New Application.",
      },
      {
        id: "app-bot",
        text: "Under **Bot**, create a bot and copy the token. This is `DISCORD_BOT_TOKEN`.",
      },
      {
        id: "app-intent",
        text: "Under **Bot > Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**. Without it, attachments come back empty even over the REST API. This one bites people who assume the restriction only applies to gateway connections.",
      },
      {
        id: "app-pubkey",
        text: "From **General Information**, copy the Public Key as `DISCORD_PUBLIC_KEY`. It verifies the Ed25519 signature on every button click.",
      },
      {
        id: "app-invite",
        text: "Generate an install URL with the `bot` scope and permissions **View Channel**, **Read Message History**, **Send Messages**, and **Embed Links**. Invite it to the server.",
      },
      {
        id: "app-endpoint",
        text: "After the first deploy, paste `https://<your-worker>.workers.dev/interactions` into **Interactions Endpoint URL**. Discord probes it with a deliberately bad signature and expects a 401 back.",
      },
    ],
  },
  {
    id: "discord-server",
    title: "Discord server setup",
    blurb: "IDs, a role to ping weekly, a place to log failures.",
    items: [
      {
        id: "srv-devmode",
        text: "Turn on **Developer Mode** in Discord settings (Advanced) so you can right-click to copy IDs.",
      },
      {
        id: "srv-channel",
        text: "Copy the food channel ID as `DISCORD_CHANNEL_ID`, and the server ID as `DISCORD_GUILD_ID`.",
      },
      {
        id: "srv-role",
        text: "Create a self-assignable **@Tasters** role, copy its ID as `TASTER_ROLE_ID`. Only the weekly standings post pings it.",
      },
      {
        id: "srv-logs",
        text: "Recommended: a private `#scrandle-logs` channel with a webhook as `DISCORD_LOG_WEBHOOK_URL`. Cron failures are silent otherwise.",
      },
    ],
  },
  {
    id: "cloudflare",
    title: "Cloudflare",
    blurb: "One Worker, one D1 database, one public R2 bucket.",
    items: [
      { id: "cf-account", text: "Create a Cloudflare account, then `wrangler login`." },
      {
        id: "cf-d1",
        text: "`wrangler d1 create scrandle`, paste the `database_id` into `wrangler.toml`, then `npm run migrate`.",
      },
      {
        id: "cf-r2",
        text: "`wrangler r2 bucket create scrandle-images`. Check whether R2 asks for a card during activation — the 10 GB allowance is free either way.",
      },
      {
        id: "cf-r2-public",
        text: "Enable public access on the bucket and put the `https://pub-xxxx.r2.dev` address in `R2_PUBLIC_BASE`. The render endpoint fetches both photos from here.",
      },
      {
        id: "cf-secrets",
        text: "Set the secrets with `wrangler secret put`, then deploy. The free `*.workers.dev` subdomain is enough.",
      },
    ],
  },
  {
    id: "vercel",
    title: "Vercel",
    blurb: "Only one variable — the render routes already exist.",
    items: [
      {
        id: "vercel-secret",
        text: "Add `SCRANDLE_IMAGE_SECRET` to the project environment. It must match the Worker secret exactly, or every image URL comes back 403.",
      },
      {
        id: "vercel-verify",
        text: "Mint a test URL with `node scripts/scrandle-sign.mjs` and open it in a browser before wiring up Discord.",
      },
    ],
  },
];

export const NOTHING_ELSE =
  "No auth provider, no Neon, no Supabase, no Workers Assets, no Hono. The Worker has two routes and hand-rolls them.";

export const STACK = [
  { name: "Cloudflare Workers", detail: "the whole game, one Worker" },
  { name: "D1", detail: "dishes, matchups, votes, players, cursor state" },
  {
    name: "R2",
    detail:
      "images, bound to the Worker so writes are a binding call rather than an S3 client",
  },
  {
    name: "Next.js on Vercel",
    detail: "three ImageResponse routes that render the cards Discord displays",
  },
  {
    name: "Discord HTTP interactions",
    detail: "button clicks POST straight to the Worker, no gateway connection",
  },
  {
    name: "Cron trigger",
    detail: "one, hourly, doing ingest, close, and post in the same tick",
  },
];

export const STACK_NOTE =
  "Workers Free allows 5 cron triggers per account. Using one leaves room.";

export const CONSTRAINTS: Constraint[] = [
  {
    limit: "CPU time",
    value: "10ms per invocation",
    meaning:
      "Per invocation, not per day — rendering rarely does not help. This is why images render on Vercel.",
  },
  {
    limit: "Subrequests",
    value: "50 per invocation",
    meaning:
      "The real ceiling, and D1 and R2 binding calls count towards it — confirmed by a backfill dying on it. Storing one image costs three, so ingest caps at 10 per run.",
  },
  {
    limit: "Simultaneous outgoing connections",
    value: "6",
    meaning: "Batch image downloads 5 at a time, no `Promise.all` over 20.",
  },
  {
    limit: "Interaction response",
    value: "3 seconds",
    meaning: "A vote is one D1 upsert and an ephemeral reply. Nowhere near it.",
  },
  { limit: "D1 writes", value: "100,000 rows/day", meaning: "Not a factor." },
  { limit: "R2", value: "10 GB, 1M writes/mo", meaning: "Years of photos." },
];

export const CRON_MITIGATIONS = [
  "Make the tick idempotent. Advance the stored `last_message_id` cursor only after a successful commit, so a failed run replays cleanly next hour.",
  "Wrap each stage in try/catch and POST any error to the logs webhook. Cron failures do not retry and do not alert.",
];

export const SCHEMA_SQL = `CREATE TABLE dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_message_id TEXT NOT NULL UNIQUE,
  attachment_id TEXT NOT NULL,
  poster_discord_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  caption TEXT,
  posted_at INTEGER NOT NULL,
  ingested_at INTEGER NOT NULL,
  elo REAL NOT NULL DEFAULT 1500,
  matches_played INTEGER NOT NULL DEFAULT 0,
  first_matchup_id INTEGER
);

CREATE TABLE matchups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dish_a_id INTEGER NOT NULL REFERENCES dishes (id),
  dish_b_id INTEGER NOT NULL REFERENCES dishes (id),
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  message_id TEXT,
  created_at INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  closed_at INTEGER,
  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,
  elo_a_before REAL,
  elo_b_before REAL,
  elo_a_after REAL,
  elo_b_after REAL
);

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matchup_id INTEGER NOT NULL REFERENCES matchups (id),
  voter_discord_id TEXT NOT NULL,
  picked_dish_id INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  UNIQUE (matchup_id, voter_discord_id)
);

CREATE TABLE players (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  first_seen INTEGER NOT NULL
);

CREATE TABLE state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: last_message_id, last_matchup_slot, last_standings_at,
--       standings_snapshot, backfill_cursor`;

export const SCHEMA_NOTE =
  "The `UNIQUE` on `votes` gives you one-vote-per-person enforcement in the database rather than in application logic, and the upsert on top of it is what lets people change their pick until close. The `UNIQUE` on `sha256` handles reposts. Query `matchups` directly for pair history rather than keeping a separate table. There is no `drops` table — one pair at a time made it unnecessary.";

export const PHASES: Phase[] = [
  {
    id: "phase-0",
    number: "0",
    title: "Scaffold",
    tagline: "Wrangler, D1, R2, secrets, a cron that fires.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "Worker project with no framework — two routes hand-rolled in `fetch()`, so no Hono. D1 migrations in `migrations/`, R2 bound as `BUCKET`, secrets via `wrangler secret put`.",
      },
    ],
  },
  {
    id: "phase-1",
    number: "1",
    title: "Ingest",
    tagline: "Hourly poll, hash, store the bytes in R2.",
    shipped: true,
    blocks: [
      { kind: "p", text: "Hourly `scheduled()` handler:" },
      {
        kind: "ol",
        items: [
          "Read `last_message_id` from `state`.",
          "`GET /channels/{id}/messages?after={cursor}&limit=100`, reversed to oldest-first.",
          "Filter to attachments with an image content type, skipping bot messages.",
          "Take at most 15. Leftovers wait for next hour, which drains on its own at hourly cadence.",
          "For each, in batches of 5: fetch bytes, hash sha256, skip if the hash exists, `PUT` to R2, insert a `dishes` row.",
          "Advance the cursor only after the batch commits.",
        ],
      },
      {
        kind: "note",
        text: "Only JPEG and PNG are ingested. satori rasterizes those two, so a WebP would ingest cleanly and then fail to render mid-matchup. Skips are counted and reported to the logs webhook rather than swallowed.",
      },
      {
        kind: "p",
        text: "`/backfill?secret=...&pages=5` walks history backwards for the one-time import. Run it by hand.",
      },
    ],
  },
  {
    id: "phase-2",
    number: "2",
    title: "Matchup posting",
    tagline: "Pick two, post one message, two buttons.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "Same hourly tick. Posts only when nothing is open and the current UTC hour is one of `POST_HOURS_UTC`, at most once per hour. A matchup closes when the next one is due rather than a fixed span after it went up, so a post made off-schedule still hands its slot back on time. **Pair selection:**",
      },
      {
        kind: "ol",
        items: [
          "Any dish with `first_matchup_id IS NULL` jumps the queue, oldest first, so new dishes are guaranteed a slot.",
          "Otherwise take the least-played dish, ties broken randomly.",
          "Opponent comes from a 150-point Elo band, excluding any pair seen in the last 20 matchups. Close matchups are tense matchups.",
          "Every fifth matchup is a deliberate wide-gap pair. Upsets make the best results.",
          "Fall back to the nearest rating, then to any dish, rather than skipping a day.",
        ],
      },
      {
        kind: "p",
        text: "The row is inserted first so the matchup id can go in the image URL path — that is what makes Discord's proxy treat each card as a new image instead of serving a stale one.",
      },
      {
        kind: "note",
        text: "Sides are randomized, and the post never pings. A ping would correlate with new dishes entering the pool, and position 1 would otherwise always be the newer plate.",
      },
    ],
  },
  {
    id: "phase-3",
    number: "3",
    title: "Voting",
    tagline: "Ed25519 verify, upsert, ephemeral reply.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "`POST /interactions` is the only route that matters. Verify the `X-Signature-Ed25519` header over `timestamp + body`, answer `PING` with `PONG`, then handle the button.",
      },
      {
        kind: "p",
        text: "`custom_id` carries `v:<matchupId>:<a|b>`. The handler checks the matchup is still open, upserts the vote, and replies with flag 64 so only the voter sees it. Changing your pick is the same upsert.",
      },
      {
        kind: "note",
        text: "Every response is ephemeral. That is the entire reason this uses buttons instead of a native poll — nobody sees who voted, and there is no running tally to bandwagon onto.",
      },
    ],
  },
  {
    id: "phase-4",
    number: "4",
    title: "Close and reveal",
    tagline: "One Elo update per matchup, then edit the message.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "Elo is applied once per matchup rather than once per vote. Sequential per-voter updates are order-dependent and jumpy with a pool this small. Vote share becomes a fractional score: 6 of 8 voters pick A, so A scored 0.75. K=24.",
      },
      {
        kind: "p",
        text: "The original message is then edited in place — result card, chefs named, buttons removed, self-vote tally appended. The reveal happens where the argument will happen.",
      },
    ],
  },
  {
    id: "phase-5",
    number: "5",
    title: "Weekly standings",
    tagline: "Chef ratings, movement since last week.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "A chef rating is the mean Elo of their dishes, so there is no second rating system to maintain. Movement is computed against a snapshot kept in `state`, which avoids a history table.",
      },
      {
        kind: "p",
        text: "Posted on `STANDINGS_WEEKDAY` after `STANDINGS_HOUR_UTC`, at most once every six days. This is the only post that pings @Tasters.",
      },
    ],
  },
  {
    id: "phase-6",
    number: "6",
    title: "Render endpoints",
    tagline: "Three signed ImageResponse routes on Vercel.",
    shipped: true,
    blocks: [
      {
        kind: "p",
        text: "`/api/scrandle/matchup/[id]`, `/result/[id]`, and `/standings/[stamp]`. Each takes `?d=<base64url json>&s=<hmac>` and renders a PNG. Discord's proxy fetches them; the Worker never touches image bytes.",
      },
      {
        kind: "note",
        text: "The HMAC is not decoration. Without it these routes are an open image proxy that will render any URL anyone hands them.",
      },
    ],
  },
  {
    id: "phase-7",
    number: "7",
    title: "Leaderboards on the web",
    tagline: "The one part that genuinely wants HTML.",
    optional: true,
    blocks: [
      {
        kind: "p",
        text: "Dish and chef leaderboards, plus taste compatibility between players — agreement rate between any two voters across shared matchups, which falls out of the raw `votes` table for free. Two people who agree 80% of the time are taste twins, and that is a better social feature than any ranking.",
      },
      {
        kind: "p",
        text: "Read-only, so it needs no auth. It can read D1 over the REST API or run as a second Worker route. Everything else stays in Discord.",
      },
    ],
  },
];

export const VERSIONING_NOTE =
  "Separate from the game loop and trivial. Add a post-deploy step:";

export const VERSIONING_SNIPPET =
  '"deploy": "wrangler deploy && node scripts/announce.mjs"';

export const VERSIONING_TAIL =
  "The script reads the changelog and POSTs to the logs webhook. Ping @Tasters for player-facing changes, stay quiet for bugfixes.";

export const SECRETS = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_PUBLIC_KEY",
  "DISCORD_LOG_WEBHOOK_URL",
  "SCRANDLE_IMAGE_SECRET",
  "BACKFILL_SECRET",
];

export const PLAIN_VARS = [
  "DISCORD_CHANNEL_ID",
  "DISCORD_GUILD_ID",
  "TASTER_ROLE_ID",
  "IMAGE_BASE_URL",
  "R2_PUBLIC_BASE",
  "VOTE_WINDOW_HOURS",
  "POST_HOURS_UTC",
  "STANDINGS_WEEKDAY",
  "STANDINGS_HOUR_UTC",
];

export const OPEN_QUESTIONS = [
  "Vote window: 24 hours or 48? A day keeps it a ritual, two catches people who only check in on weekends.",
  "Should a dish ever retire from the catalog, or does everything stay eligible forever?",
  "Reaction-count threshold for qualifying a backfilled photo, so the channel's existing reactions do the curation.",
];
