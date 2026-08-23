# scrandle-worker

The whole game. One Cloudflare Worker, one hourly cron, no frontend.

- `scheduled()` — ingest new photos, close what is due, post what is due, post weekly standings
- `fetch()` — `POST /interactions` for button clicks, plus `/backfill` and `/health`

Rendering lives in the Next app (`app/api/scrandle/*`) because Workers Free
allows 10ms of CPU per invocation, which cannot rasterize an image. The Worker
builds a signed URL, Discord's proxy fetches the PNG.

## Setup

Windows PowerShell 5.1 has no `&&` operator, so run these one at a time.
`wrangler` is a local devDependency — call it through `npx`, not globally.

If PowerShell refuses with *"npm.ps1 cannot be loaded because running scripts
is disabled"*, use the `.cmd` shims (`npm.cmd`, `npx.cmd`), or run
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once, or
just use Git Bash instead.

```bash
npm install
```
```bash
npx wrangler login
```
```bash
npx wrangler d1 create scrandle
```

Paste the printed `database_id` into `wrangler.toml`, then:

```bash
npx wrangler r2 bucket create scrandle-images
```
```bash
npm run migrate
```

Enable public access on the R2 bucket and put its `https://pub-xxxx.r2.dev`
address in `R2_PUBLIC_BASE`. Fill in `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`,
and optionally `TASTER_ROLE_ID` in `wrangler.toml`.

### Secrets

Never in `wrangler.toml`. Cloudflare stores these encrypted and injects them at
runtime — they are not in the bundle and not in git.

```bash
npx wrangler secret put DISCORD_BOT_TOKEN
```
```bash
npx wrangler secret put DISCORD_PUBLIC_KEY
```
```bash
npx wrangler secret put SCRANDLE_IMAGE_SECRET
```
```bash
npx wrangler secret put BACKFILL_SECRET
```
```bash
npx wrangler secret put DISCORD_LOG_WEBHOOK_URL
```

`SCRANDLE_IMAGE_SECRET` must match the value set in the Vercel project — it
signs the render URLs so the endpoints cannot be used as an open image proxy.

For local `npx wrangler dev`, copy `.dev.vars.example` to `.dev.vars` and fill
it in. That file is gitignored.

### Discord

The bot needs **MESSAGE CONTENT INTENT** enabled, or attachments come back
empty even over REST. Invite it with View Channel, Read Message History, Send
Messages, and Embed Links.

After the first deploy:

```bash
npm run deploy
```

paste `https://<your-worker>.workers.dev/interactions` into the Developer
Portal's Interactions Endpoint URL field. Discord verifies it with a
deliberately bad signature and expects a 401, which `verify.ts` handles.

### Order matters

Do Vercel before Cloudflare, and backfill before the cron is allowed to post.

**1. Render endpoints first.** The Worker puts `https://benadams.dev/api/scrandle/...`
into the Discord embed and Discord's proxy fetches it at post time — then
caches it against that URL. If the endpoint is returning 503 because
`SCRANDLE_IMAGE_SECRET` is not set yet, that matchup's card can stay broken
even after you fix it, because the URL never changes. So: merge, set the env
var on Vercel, **redeploy** (env changes only reach functions on a new
deploy), and confirm a signed URL renders in a browser:

```bash
node ../scripts/scrandle-sign.mjs standings/1 "{\"t\":\"test\",\"rows\":[]}" --base https://benadams.dev
```

**2. Backfill before the first matchup.** The hourly cron starts firing the
moment you deploy, and with two dishes in the catalog it will happily post a
matchup to a channel full of people. Deploy the first time with
`POST_HOURS_UTC = ""` and no cron hour it can match — or simply an hour that is
a long way off — run the backfill, check the catalog looks right, then set the
real hours and redeploy.

### Backfill

Run once by hand to pull in the channel's history:

```bash
curl "https://<your-worker>.workers.dev/backfill?secret=<BACKFILL_SECRET>&pages=5"
```

## Running it locally

No Cloudflare account needed — `--local` runs against a local D1 and a local
R2. Everything goes through npm scripts, which work the same in PowerShell,
cmd, and bash:

```bash
npm run migrate:local
```
```bash
npm run dev:local
```

Both generate `wrangler.test.toml` first (gitignored, placeholders only) —
wrangler will not resolve a D1 binding with an empty `database_id`, even in
local mode where the id means nothing.

`npm run db:local -- --command="SELECT * FROM dishes"` queries the local
database. Add `--test-scheduled` to `dev:local` to expose the cron tick at
`GET /__scheduled`, which runs ingest, close, and post exactly as the hourly
trigger would.

### Verifying the bot without posting anything

Put a real `DISCORD_BOT_TOKEN` in `.dev.vars`, start `npm run dev:local`, then:

```bash
curl "http://localhost:8787/backfill?secret=dev-only-backfill-secret&pages=1"
```

That returns a JSON report — `scanned`, `stored`, `duplicates`,
`skippedFormat`, `failed` — or a readable error naming the channel if the bot
cannot see it. It proves the token, the intent, channel access, image
downloads, R2 writes, and sha256 dedupe all work, with no Cloudflare or Vercel
account involved.

**Use `/backfill`, not `/__scheduled`, for this.** With a real token the
scheduled route will post a genuine matchup to the live channel as soon as the
clock hits a named hour, because `last_matchup_slot` starts empty. Backfill
only reads and stores.

### Testing interactions

`POST /interactions` needs a real Ed25519 keypair, because every interaction is
signed and the Worker rejects anything that fails verification. Generate one:

```bash
node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');require('node:fs').writeFileSync('.test-key.pem',privateKey.export({type:'pkcs8',format:'pem'}));console.log(publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex'))"
```

Put the printed hex in `.dev.vars` as `DISCORD_PUBLIC_KEY`, then run the suite
against an open matchup:

```bash
npm run test:interactions -- 1
```

It checks that a bad signature is rejected with 401, PING answers PONG, a vote
records, changing a pick upserts rather than duplicates, another guild is
turned away, and an unknown `custom_id` is ignored.

### Testing matchmaking

Pair selection is the hardest part to reason about, and a single round tells
you almost nothing. `simulate-matchups.mjs` drives many rounds through the
real worker code and asserts the invariants that only show up over time.

It needs Discord calls to succeed, so point the worker at the bundled mock by
adding `DISCORD_API_BASE=http://127.0.0.1:9911` to `.dev.vars`. That variable
exists only for this — leave it unset everywhere else and the client talks to
the real Discord.

In three terminals:

```bash
npm run mock:discord
```
```bash
npm run dev:local
```
```bash
npm run test:matchups 25
```

It drives each round through `/admin/post-matchup` and `/admin/close-matchup`
rather than the cron, so it needs `BACKFILL_SECRET` in `.dev.vars` (the value
from `.dev.vars.example` is what it assumes). Forcing is deliberate: the cron
only posts on a named hour, so a cron-driven run posts nothing at all unless
you happen to start it at 15:00 or 03:00 UTC. The posting schedule has its own
suite — `npm run test:schedule` — and this one is about the draw.

It wipes and reseeds the local catalog with 12 dishes, plays the given number
of rounds, and checks that no pair repeats inside the 20-matchup recency
window, that play stays spread rather than favouring a few dishes, that Elo
stays zero-sum across the catalog, and that the wide-gap rule actually fires.

A 25-round run should show every dish played 4–5 times, gaps mostly in single
digits, and a deliberate mismatch on every fifth matchup.

### Forcing a post by hand

There is no way to fire a cron on demand, so three admin routes stand in. All
take `?secret=<BACKFILL_SECRET>`.

```bash
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>"
```

Posts an ordinary matchup now, ignoring the schedule. Refuses while one is
open. Add `&overlap=1` to post a bonus one alongside the open matchup instead
of refusing — it draws around whatever is already live, so no photograph
appears in two matchups at once, and it does not claim the hour's slot.

```bash
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&place=1"
```

Posts the place-vs-place bonus on demand — the same thing the Wednesday cron
does. Always overlaps, always gets the 24-hour window.

```bash
curl "https://<your-worker>.workers.dev/admin/close-matchup?secret=<BACKFILL_SECRET>"
```

Closes everything open right now, ignoring `closes_at`.

## Behaviour notes

- **Only JPEG and PNG are ingested.** satori rasterizes those two; a WebP or
  GIF would ingest fine and then fail to render mid-matchup. Skips are counted
  and reported to the logs webhook.
- **Matchups never ping the role.** A ping would correlate with new dishes
  entering the pool, which tells people which photo is the new one. The weekly
  standings post is the only thing that pings.
- **Sides are randomized** for the same reason — position 1 is not always the
  newer dish.
- **Votes are ephemeral.** Nobody sees who voted or the running tally until
  close, which is why this uses buttons rather than a native Discord poll.
- **The cursor advances only after a batch commits**, so a failed tick replays
  cleanly on the next hour. Cron does not retry.
- **A matchup closes when the next one is due**, not a fixed span after it went
  up. `POST_HOURS_UTC` is the schedule and `closes_at` is derived from it, so a
  matchup posted off-schedule — a forced `/admin/post-matchup`, or a slot
  missed because a tick failed — still hands its slot back at the right hour.
  Measuring the window from post time instead lets an off-hour post stay open
  across the next named hour, and since an open matchup blocks posting, that
  cycle is silently skipped. `VOTE_WINDOW_HOURS` is only the fallback for when
  no hours are configured.
- **One post per named hour**, enforced by comparing slot keys rather than
  elapsed time. An elapsed-time floor has the same cycle-skipping failure: set
  near the cadence, it blocks the scheduled post whenever the previous one was
  early.
- **Cron hours are UTC and ignore DST.** `POST_HOURS_UTC = "15,3"` is 9am/9pm
  Mountain under MDT and 8am/8pm under MST — shift to `"16,4"` in November.
  `PLACE_HOUR_UTC` is the same story and needs shifting with it.
- **One matchup at a time**, with a single exception. Posting refuses while
  anything is open, even when forced, because two live matchups split the
  vote. The exception is a bonus: `?overlap=1` on `/admin/post-matchup`, and
  the weekly place matchup, which are meant to run beside the ordinary one.
  Closing already handles more than one being open, and a vote carries its
  matchup id on the button, so nothing else needs to know.
- **Places only play on their own day.** The classifier labels rooms, views
  and landscapes `place`, and the everyday draw filters them out — they are
  drawn only by the weekly bonus, which pairs place against place. That bonus
  overlaps whatever is open, gets a flat `PLACE_WINDOW_HOURS` window instead
  of closing on a posting hour, and keeps its own slot key so posting one
  never consumes a food slot. `PLACE_WEEKDAY = "-1"` turns it off.
- **Places do not count toward chef standings.** They earn an Elo like any
  other photo, but averaging a holiday snap into someone's cooking record
  would rate them on the wrong thing.

## Worth verifying before scaling the per-tick cap

`MAX_IMAGES_PER_TICK` is 15, sized against the 50-subrequest limit on Workers
Free. Confirm whether D1 and R2 binding calls also count against that limit —
if they do, the effective ceiling is lower than it looks.
