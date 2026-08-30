# scrandle-worker

The whole game. One Cloudflare Worker, one hourly cron, no frontend.

- `scheduled()` — ingest new photos, close what is due, post what is due, post weekly standings
- `fetch()` — `POST /interactions` for button clicks, plus `/backfill` and `/health`

Two shapes of round. The everyday matchup is a pair with a button each, in
`matchups.ts`. The weekly place round puts five photographs on one card and
each voter ranks them, in `rounds.ts` — its own tables, its own close path,
the same Elo underneath.

Rendering lives in the Next app (`app/api/scrandle/*`) because Workers Free
allows 10ms of CPU per invocation, which cannot rasterize an image. The Worker
builds a signed URL, fetches the PNG itself, and mirrors it into R2 — Discord
is handed a static object, never a render it has to wait on. See **Cards are
rendered before they are posted** below.

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

## Deploying

Merging to `main` deploys. `.github/workflows/deploy-scrandle-worker.yml` runs
`wrangler deploy` on any push touching `scrandle-worker/**`, which includes
`wrangler.toml` — a schedule change is a deploy like any other.

That path matters more than it looks. The Worker ships separately from the
site: Vercel builds the Next app and never touches Cloudflare, so before this
workflow existed a merged `wrangler.toml` change sat on `main` looking live
while the running Worker kept the old vars. The Monday place round was merged
one night and silently skipped the next day for exactly that reason.

The workflow needs one repository secret:

| Secret | Where it comes from |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template |

Use the template rather than a hand-rolled token — the deploy binds D1 and R2,
so a Workers-Scripts-only token fails at the binding step, not at upload.

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo BigFancyBen/badams-homepage
```

The token is scoped to a single Cloudflare account, so wrangler resolves the
account itself. If that token ever covers more than one, add
`CLOUDFLARE_ACCOUNT_ID` to the deploy step's `env`.

Deploying by hand still works and is still the right move when testing:

```bash
npm run deploy
```

**Migrations are not automated.** `npm run migrate` is still a manual step, and
it has to run *before* the deploy of any code that reads a new column. Since
merging is what deploys, that means running it *before* the merge, not after:
a merge that lands table-reading code on a database without the tables leaves
every tick throwing until the migration catches up.

### Order matters

Do Vercel before Cloudflare, and backfill before the cron is allowed to post.

**1. Render endpoints first.** The Worker renders every card through
`https://benadams.dev/api/scrandle/...` before it posts. If that endpoint is
returning 503 because `SCRANDLE_IMAGE_SECRET` is not set yet, matchups go out
with no card on them at all — playable, but bare — and each one has to be
repaired by hand afterwards. So: merge, set the env var on Vercel, **redeploy**
(env changes only reach functions on a new deploy), and confirm a signed URL
renders in a browser:

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
`skippedFormat`, `failed`, `firstFailure`, `more` — or a readable error naming
the channel if the bot cannot see it. It proves the token, the intent, channel access, image
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
npm run test:interactions -- 1 1
```

The first argument is an open matchup id, the second an open ranking round id.

It checks that a bad signature is rejected with 401, PING answers PONG, a vote
records, changing a pick upserts rather than duplicates, another guild is
turned away, and an unknown `custom_id` is ignored.

With a round id it also walks a whole ballot: the first click opens it, the
second lands after the first, clicking the same photo twice is refused without
reordering anything, a slot that is not in the round is turned away, `Start
over` clears it, and the next click begins a fresh ballot. Leave the second
argument off and those are skipped.

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
suite — `npm run test:schedule` — and this one is about the draw. Ingest has a
third, `npm run test:ingest`, covering the batching rule that keeps the cursor
on a message boundary and the D1 write retry.

It runs three seeded catalogs, because no single one shows everything.

The **small catalog** is 12 dishes across 4 chefs, all in play, ratings
clustered with two outliers. It strains pair recency and gives the deliberate
mismatch something to find. A 25-round run should leave every dish played 4–5
times and within one of every other dish, with gaps mostly in single digits and
a handful over 150.

The **backlog catalog** is the shape the real channel is in: four dishes that
have already been on the board six times with ratings far from the opening one,
behind 36 that have never played. It checks the rotation — that nothing is
drawn while something less-played was available, and that the veterans stay
benched entirely until the backlog is swept. Weighing rating ahead of the play
count fails this one loudly: the four veterans take over a quarter of the
matchups and the backlog barely moves.

The **trickle catalog** is 40 never-played photos with one new arrival added
between every round, which is the only way to exercise the fresh slot — it
needs new photos to keep arriving, and a fixed seed can only run it dry. It
checks that arrivals take under half the slots and that at least a quarter of
boards are drawn entirely from the backlog. Giving recency the front of the
queue rather than a share of it fails both: every primary is then a photo from
the last fortnight, so arrivals take exactly half the slots and no board is
ever free of one.

The small and backlog catalogs are also checked for pair repeats inside the
20-matchup recency window, and the small one for Elo staying zero-sum.

### Testing ranking rounds

`simulate-rounds.mjs` is the same idea for the weekly place round, and needs
the same mock and dev server running:

```bash
npm run test:rounds 15
```

It seeds places rather than food — the round draws nothing else, so a food
seed would leave every query empty and the suite would pass having tested
nothing — posts each round through `/admin/post-matchup?place=1`, writes
ballots straight into `round_votes`, and closes through
`/admin/close-matchup`.

Three catalogs again. A **deep** one of 40 places across 8 people, with six
voters ranking in six different orders, covers the rotation, the two-per-person
cap, Elo staying zero-sum, and the rule that a round is one match played rather
than one per comparison. A **unanimous** one, where five voters submit the same
order, is the only place the arithmetic is legible: it checks that the photo
everyone put first wins, that the finishing order is the ranked order, and that
a clean sweep of a five-way round moves a rating exactly as far as a clean
sweep of a matchup would — which is the whole point of dividing K by `n-1`.
The deep catalog cannot show that last one, because six voters disagreeing
split every pair near even and nothing moves more than a point.

The third is the one worth having: **nobody ranks more than one photo**. That
is the ballot most people will actually cast, and it checks that a single click
still scores, still beats the four it did not rank, and still leaves those four
unscored against each other.

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
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&person=1"
```

Posts a weekly bonus on demand — `place=1` for the five-photo place ranking
round, `person=1` for person-vs-person — the same thing the scheduled cron
does. Always overlaps, always gets the 24-hour window. `place=1` answers
`{"posted":false}` when fewer than three places are available to rank, or when
the per-poster cap leaves it short.

```bash
curl "https://<your-worker>.workers.dev/admin/close-matchup?secret=<BACKFILL_SECRET>"
```

Closes everything open right now, ignoring `closes_at` — matchups and ranking
rounds alike. Answers `{"closed":N,"rounds":N}`.

```bash
curl "https://<your-worker>.workers.dev/admin/repair-card?secret=<BACKFILL_SECRET>&message=<discord message id>"
curl "https://<your-worker>.workers.dev/admin/repair-card?secret=<BACKFILL_SECRET>&matchup=<id>"
curl "https://<your-worker>.workers.dev/admin/repair-card?secret=<BACKFILL_SECRET>&round=<id>"
```

Takes the Discord message id — the last segment of the message link, and the
only handle a card-less round gives you — or a matchup id, or a ranking round
id. By message it tries the matchups first and then the rounds, so you do not
have to know which kind you are looking at.

Puts a card back on a matchup that went out without one — or one posted before
cards were proven, where Discord holds a failure it will never re-fetch. It
re-renders, writes the copy under a stamped key, and edits only the embed, so
the text and the vote buttons are untouched. Open matchups get the matchup
card, closed ones the result card. It answers `{"repaired":true}`, or a reason
why not.

## Behaviour notes

- **Only JPEG and PNG are ingested.** satori rasterizes those two; a WebP or
  GIF would ingest fine and then fail to render mid-matchup. They are dropped
  while the page is being read, before they can take up a slot in the ten-image
  budget — a burst of reaction GIFs used to fill all ten and store nothing.
  Skips are counted in the ingest report but deliberately not logged: a
  reaction GIF being turned away is the filter working, and nobody wants to be
  told about it every time it happens. The logs webhook hears about downloads
  and writes that failed, and now hears why the first one failed.
- **Ingest batches whole messages, never part of one.** Discord's `after` and
  `before` cursors are exclusive, so a cursor left on a half-handled message
  skips the rest of its attachments permanently — and a meal posted as three
  photos is the common case. The budget is spent in whole messages so the
  cursor always lands on a boundary. A single message carrying more than the
  budget is taken anyway: refusing it would park the cursor in front of it and
  stall ingest for good.
- **Idempotent D1 writes are retried.** `D1_ERROR: Network connection lost` is
  on [Cloudflare's list of transient D1 errors][d1-errors], and since September
  2025 D1 retries them itself — but only for statements it can prove are
  read-only. Writes are left to the caller, so an hourly ingest could die on a
  blip that a `SELECT` two lines earlier would have shrugged off. `retryWrite`
  in `db.ts` covers the writes that are safe to repeat: the cursor upsert, the
  chef upsert, and the `ON CONFLICT`-guarded dish insert. Nothing else.
- **Chefs are written before their dishes.** A dish row whose poster never made
  it into `players` reads as "unknown chef" for good, because the dedupe check
  skips that message on every later run and the upsert never gets a second
  chance. Writing chefs first means a failure there leaves nothing committed
  and the batch simply runs again next tick.

[d1-errors]: https://developers.cloudflare.com/d1/observability/debug-d1/#error-list
- **Cards are rendered before they are posted.** The Worker fetches the card
  from the render endpoint, mirrors the PNG into R2 under `cards/`, and puts
  that R2 URL in the embed. Discord fetches an embed image once, at post time,
  and caches whatever it gets against that URL forever — so a render that is
  slow or briefly failing used to leave a card broken with no way back, which
  is exactly how a place round went out with no image on it. Rendering it here
  first moves the waiting somewhere that can afford it: the Worker has no
  proxy deadline to miss, retries twice more on a fresh URL, and hands Discord
  a static object. Large photographs are the ones that made this matter — two
  full-size landscapes take seconds to rasterize where a pair of phone photos
  takes under one. A card is a megabyte or two, and at two or three a day that
  is a couple of gigabytes a year against R2's 10 GB free tier: `cards/` will
  want sweeping eventually. Nothing reads a matchup card once its result card
  has replaced it.
- **A matchup with no card still posts.** If all three render attempts fail,
  the round goes out as jump links and vote buttons with no embed at all,
  rather than an embed pointing at nothing. It stays playable, the logs
  webhook says so, and `/admin/repair-card` attaches the card afterwards. The
  weekly standings post is the exception — it is nothing *but* the card, so it
  waits for the next tick instead.
- **Matchups never ping the role.** A ping would correlate with new dishes
  entering the pool, which tells people which photo is the new one. The weekly
  standings post is the only thing that pings.
- **Sides are randomized** for the same reason — position 1 is not always the
  newer dish.
- **Votes are ephemeral until the round closes.** Nobody sees who voted or the
  running tally while it is running, which is why this uses buttons rather than
  a native Discord poll. The close then publishes the ballot as a second embed
  under the result card — who voted for what, in the order they voted. That is
  a deliberate reversal of half the original reasoning: the secrecy was there
  to stop bandwagoning, closing the round ends the reason for it, and who
  picked what is the part people actually want to argue about. Names rather
  than mentions, so nothing pings, and markdown in a username is escaped.
- **The vote log rides on the edit that was already happening.** It is an embed
  on the same message rather than a follow-up post or a thread, which costs no
  extra API call, no extra permission and no second message in the channel. It
  also means `/admin/repair-card` has to rebuild it: a PATCH replaces the
  embeds it names, so sending only the card would quietly delete the log.
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
  `PLACE_HOUR_UTC` and `PERSON_HOUR_UTC` are the same story and need shifting
  with it. The clock lives entirely in these vars: the cron stays broad and
  UTC. It ticks on the hour and at `:11`, and `:11` is the only reason the
  second entry exists — the person bonus fires at 11:11am, and an hourly cron
  cannot reach that minute on its own.
- **One matchup at a time**, with a single exception. Posting refuses while
  anything is open, even when forced, because two live matchups split the
  vote. The exception is a bonus: `?overlap=1` on `/admin/post-matchup`, and
  the weekly place and person matchups, which are meant to run beside the
  ordinary one. Closing already handles more than one being open, and a vote
  carries its matchup id on the button, so nothing else needs to know.
- **Places and people only play on their own days.** The classifier labels
  rooms, views and landscapes `place`, and photos whose subject is a person
  `person`; the everyday draw filters both out. They are drawn only by their
  weekly bonuses — a five-photo place ranking round on `PLACE_WEEKDAY` (Monday
  noon by default), person against person on `PERSON_WEEKDAY` (Tuesday 11:11am).
  Each bonus overlaps whatever is open, gets a flat window instead of closing
  on a posting hour, and keeps its own slot key so posting one never consumes a
  food slot. `PLACE_WEEKDAY = "-1"` / `PERSON_WEEKDAY = "-1"` turn them off.
- **Places are ranked, not paired.** Five places go up on one card and each
  voter clicks them in the order they like them, best first. A pair asks the
  wrong question of places — two holiday snaps side by side is close to a coin
  toss — while five in an order is a real opinion and gets four comparisons out
  of what used to be one. It runs once a week rather than the twice the pair
  round did, because it eats five photos instead of two.
- **A partial ballot counts.** Click one and wander off and that is a valid
  vote: whatever you ranked beat everything you did not, and the ones you left
  say nothing about each other. Demanding all five would collect fewer opinions
  than the one-click matchup it replaced, not more. `Start over` clears a
  ballot; there is deliberately no undo of a single pick, because what that
  should do to the picks after it is a worse interface than starting again.
- **A ranking round is scored as the round-robin it already is.** Every pair
  inside it is an ordinary matchup with its own vote split, resolved by the
  same vote-share Elo, against the ratings as they stood when the round opened
  — summed and applied once, so the answer cannot depend on the order the pairs
  are walked in. Each comparison carries `K/(n-1)`: a photo in a five-way round
  is judged four times, and at full `K` one bonus round would move a rating as
  far as four matchups and the weekly bonus would outweigh the week. A round is
  one match played, not four — the rotation counts rounds.
- **Places do not count toward chef standings**, and neither do people. They
  earn an Elo like any other photo, but averaging a holiday snap or a group
  shot into someone's cooking record would rate them on the wrong thing.
- **The draw is a rotation.** Both halves of a pair come off the least-played
  end of the pool, in every category, so the whole catalog plays once before
  anything plays twice and then again before anything plays three times. Within
  a play count the pick is random. Rating still shapes the pairing — the Elo
  band and the every-fifth deliberate mismatch both still apply — but only as a
  tiebreak between dishes on the same count, never as a reason to reach past one
  that has played less. That is a preference rather than a gate: the draw spills
  into the next count on its own when the least-played dishes are all one
  person's or have all been paired recently. It also means the deliberate
  mismatch has nothing to find while the unplayed backlog is being swept, since
  every dish in it is still on the opening rating.
- **Recency gets a share of the draw, not the front of it.** Every fourth
  primary is reserved for something posted in the last fortnight that has never
  played, so new cooking reaches the board quickly; the other three are drawn
  from the unplayed catalog at large. That slot used to fire unconditionally,
  which reads as a rotation rule only if the backlog eventually empties — and
  at two matchups a day against hundreds of photos it never does. Every primary
  came from the last fortnight and the rest of the catalog was unreachable.
- **Two photos from the same person never meet.** Matchmaking excludes the
  primary's own poster when drawing the opponent, in every category — a matchup
  between two of your own shots is not something anyone can take a side on. If a
  category holds only one person's photos, that draw is skipped rather than
  bent.

## Worth verifying before scaling the per-tick cap

`MAX_IMAGES_PER_TICK` is 15, sized against the 50-subrequest limit on Workers
Free. Confirm whether D1 and R2 binding calls also count against that limit —
if they do, the effective ceiling is lower than it looks.
