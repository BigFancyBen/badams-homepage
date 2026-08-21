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
BASE_URL=https://benadams.dev node ../scripts/scrandle-sign.mjs standings/1 '{"t":"test","rows":[]}'
```

**2. Backfill before the first matchup.** The hourly cron starts firing the
moment you deploy, and with two dishes in the catalog it will happily post a
matchup to a channel full of people. Deploy the first time with
`MIN_HOURS_BETWEEN_MATCHUPS = "9999"`, run the backfill, check the catalog
looks right, then set it back to `24` and redeploy.

### Backfill

Run once by hand to pull in the channel's history:

```bash
curl "https://<your-worker>.workers.dev/backfill?secret=<BACKFILL_SECRET>&pages=5"
```

## Running it locally

No Cloudflare account needed — `--local` runs against a local D1 and a local
R2. You need a throwaway config with a placeholder `database_id`, since
wrangler will not resolve an empty one:

```bash
sed 's|database_id = ""|database_id = "00000000-0000-0000-0000-000000000000"|' wrangler.toml > wrangler.test.toml
```
```bash
npx wrangler d1 migrations apply scrandle --local --config wrangler.test.toml
```
```bash
npx wrangler dev --local --config wrangler.test.toml --port 8787 --test-scheduled
```

`--test-scheduled` exposes the cron tick at `GET /__scheduled`, which runs
ingest, close, and post in one go exactly as the hourly trigger would.

To exercise `POST /interactions` you need a real Ed25519 keypair, because
every interaction is signed and the Worker rejects anything that fails
verification:

```bash
node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');require('node:fs').writeFileSync('.test-key.pem',privateKey.export({type:'pkcs8',format:'pem'}));console.log(publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex'))"
```

Put that hex string in `.dev.vars` as `DISCORD_PUBLIC_KEY`, then:

```bash
npm run test:interactions -- <matchupId>
```

It checks that a bad signature is rejected with 401, PING answers PONG, a vote
records, changing a pick upserts rather than duplicates, another guild is
turned away, and an unknown `custom_id` is ignored.

Discord calls fail locally without a real bot token, which is useful in its own
right — it is how the failed-post cleanup path gets tested.

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

## Worth verifying before scaling the per-tick cap

`MAX_IMAGES_PER_TICK` is 15, sized against the 50-subrequest limit on Workers
Free. Confirm whether D1 and R2 binding calls also count against that limit —
if they do, the effective ceiling is lower than it looks.
