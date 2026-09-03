# scrandle-worker

The whole game. One Cloudflare Worker, one hourly cron, no frontend.

- `scheduled()` — ingest new photos, close what is due, post what is due, post weekly standings
- `fetch()` — `POST /interactions` for button clicks, plus `/backfill` and `/health`

Three shapes of round. The everyday matchup is a pair with a button each, in
`matchups.ts`. A ranking round puts up to five photographs on one card and each
voter ranks them, in `rounds.ts` — its own tables, its own close path, the same
ratings underneath. The caption contest is in `contests.ts` and is the odd one
out: players write rather than judge, and nothing gets a rating.

Eight slots. Cooking five matchups at 9am, all open for a full day, drinks at
happy hour as often as there is drink to post, places ranked on Monday, people
on Tuesday, five of one kind of plate on Wednesday, the week's new cooking on
Thursday, five of one kind of drink on Friday, and the caption contest across
the weekend on everything left over.

The Wednesday and Friday fives are *themed*: five pastas, five steaks, five
beers. Ranking five things asks a question a pair does not, and it only works
when the five are comparable — so the classifier labels every dish and drink
with a `kind` as well as a category, and the round is built around one of them.
See **Kinds** below.

Thursday's five is the other kind of round, grouped on recency instead: the
week's new cooking, deliberately unthemed, so a photograph arrives with a
rating rather than the opening one. See **The placement round seeds the week's
new cooking**.

Ratings are Glicko rather than plain Elo: every photograph carries a deviation
alongside its rating, so a photograph nobody has voted on moves a long way on
its first result and a photograph with a history behind it barely moves at all.
See **Ratings carry a deviation** — at a fixed K, on a catalog this deep and a
cadence this slow, nothing ever converged.

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

Merging to `main` deploys. `.github/workflows/deploy-scrandle-worker.yml`
applies pending D1 migrations and then runs `wrangler deploy` on any push
touching `scrandle-worker/**`, which includes `wrangler.toml` and
`migrations/` — a schedule change is a deploy like any other, and a new
migration file is one too.

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
so a Workers-Scripts-only token fails at the binding step, not at upload. The
migration step needs **D1 → Edit** on top of that; the template grants it, but
a token minted before D1 was added to it will not have it and the step will
fail on authorization. Re-roll the token from the template if so.

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

**Migrations run on merge, before the deploy.** Add a numbered file to
`migrations/`, merge it, and the workflow applies it to the remote D1 and only
then uploads the bundle. That order is the whole point: code that reads a new
column must never be live against a database that lacks it, or every tick
throws until somebody runs `npm run migrate` by hand. Applying is idempotent —
wrangler tracks what has run in `d1_migrations` — so code-only deploys pass
straight through the step.

If the migration fails, the job stops there and the deploy never happens: the
live Worker stays on the old bundle against the old schema, which is a working
pair, rather than new code against a schema that never changed.

`npm run migrate` still exists for applying a migration out of band, and
`npm run migrate:local` is the local equivalent.

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

Two blocks cover the running reply. The vote block checks that a second vote
cast from a different card comes back as `DEFERRED_UPDATE_MESSAGE`, having
edited the first one's reply — the 9am batch is five matchups on five messages
and gets one reply between them — and that somebody else's first vote is still
their own message. The ranking block checks the same thing one card at a time:
the first click sends, the ones after it edit, and another card is another
conversation. Editing is a real call to Discord, so both need the mock running
(below) with `DISCORD_API_BASE` pointed at it; without it they are skipped, and
the worker correctly falls back to sending a fresh message every time.

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

If you have more than one worktree of this repo — and you probably do — the
ports collide, and the failure is quiet rather than loud: the second checkout's
requests go to the first one's worker, which is running different code against
a different database, and you spend an hour reading a diff that was never the
problem. Both ends override:

```bash
MOCK_DISCORD_PORT=9931 npm run mock:discord
npx wrangler dev --local --config wrangler.test.toml --port 8842
SCRANDLE_WORKER_URL=http://127.0.0.1:8842 npm run test:matchups 25
```

with `DISCORD_API_BASE` in `.dev.vars` pointed at the mock's port. `wrangler
dev` also leaves `workerd.exe` running after the parent is killed, so check
nothing is still holding the port before blaming the code.

It drives each round through `/admin/post-matchup` and `/admin/close-matchup`
rather than the cron, so it needs `BACKFILL_SECRET` in `.dev.vars` (the value
from `.dev.vars.example` is what it assumes). Forcing is deliberate: the cron
only posts on a named hour, so a cron-driven run posts nothing at all unless
you happen to start it at 15:00 UTC. It drives the draw with `?count=1` and the
batch with `?count=3`, which override `MATCHUPS_PER_SLOT` for that one call —
the suite cannot restart the worker to change a var, and the draw invariants
want one matchup a round. The posting schedule has its own
suite — `npm run test:schedule`, which also covers the drink cadence — and this
one is about the draw. Ingest has a third, `npm run test:ingest`, covering the
batching rule that keeps the cursor on a message boundary and the D1 write
retry.

It runs four seeded catalogs, because no single one shows everything.

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

The **mixed catalog** is 14 food and 10 drinks, and covers the slot split. It
checks that the everyday draw never reaches a drink and leaves all ten for the
drink slot, that `?drink=1` draws two drinks, and — the sharp one — that a live
drink matchup does not block the next cooking post while still not letting a
second cooking matchup up beside the first. Counting drinks in the
one-at-a-time rule fails the middle two and nothing else, which is exactly the
bug: the drink slot looks like it works and quietly eats a cooking slot a day.

The small and backlog catalogs are also checked for pair repeats inside the
20-matchup recency window, and the small one for a settled catalog's total
barely moving and for no deviation ever widening.

A fifth is the rating change itself: one photograph on the opening deviation
among three settled ones, all on the same rating, with every voter picking the
newcomer every time. Four dishes rather than a deep catalog because the
rotation decides how often it plays — a sweep of four is two matchups, so it is
drawn about every other round, where on twelve it would play once in six and
there would be no curve to look at.

It reaches 1790 in six games against the 1566 a fixed `K` of 24 would have
managed, and the suite checks the gap rather than the number, so the assertion
survives the rotation handing it a different run. It also has to move further
than the settled dish it beat drops in every one of those matchups, and its
last matchup has to move it less than its first did. That asymmetry, and that
slowing down, are the two things a fixed `K` could not express.

### Testing caption contests

```bash
npm run test:contests
```

A contest has two live phases and three transitions, one more than anything
else here, and most of what can go wrong lives in the seams. Captions and
ballots are written straight into the database rather than clicked — the
button path is signed and has its own suite — so this one is about the
engine.

Three scenarios. The **full contest** walks one photograph through writing,
voting and the result, with three ballots whose Borda arithmetic is small
enough to do in your head: it checks the bot's caption is the name the
classifier wrote and that it arrives only when the vote opens, that slots are
numbered from one, that the points are what the ballots say, and that no
points are invented — every ballot is worth exactly 3+2+1 and no more.

The **abandoned** one has a single caption in it. The vote must not open, the
bot must not enter a contest that never ran, and the slot must free up
immediately so the next weekend is not blocked by a contest nobody entered.

The **shuffle** runs twelve contests with the same four writers in the same
order every time and checks slot 1 does not always go to whoever wrote first.
Without the shuffle that is exactly what happens, and people learn to read
the slot instead of the caption. It also confirms the rotation holds — twelve
photographs over twelve contests, none drawn twice.

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

Six catalogs. A **deep** one of 40 places across 8 people, with six voters
ranking in six different orders, covers the rotation, the two-per-person cap,
and the rule that a round is one match played rather than one per comparison.
A **unanimous** one, where five voters submit the same order, is the only place
the arithmetic is legible: it checks that the photo everyone put first wins,
that the finishing order is the ranked order, and that a clean sweep of a
five-way round is worth a little under four matchup shutouts — which is what
Glicko's prior does in place of dividing K by `n-1`. The deep catalog cannot
show that, because six voters disagreeing split every pair near even and
nothing moves more than a point.

The third is the one worth having: **nobody ranks more than one photo**. That
is the ballot most people will actually cast, and it checks that a single click
still scores, still beats the four it did not rank, and still leaves those four
unscored against each other. It is seeded unrated, because that is also the
common case — a one-click ballot on a card of newcomers is exactly what the
placement round collects — and because it is where the deviation stops being an
accounting detail. Slots 1 and 2 are judged four times, slots 3 to 5 twice, so
the round knows more about the top of the card than the bottom and the
movements deliberately do not cancel.

The fourth is a **placement round**: the same unanimous ballots on five
photographs nobody has ever voted on. One card spreads them across 500 rating
points, where the identical card on settled ratings spreads them across 73 —
which is the entire reason the placement slot exists, and the thing a fixed K
could not do.

Two more cover the themed food round, which is the same machinery pointed at a
pool that has kinds in it. The **themed catalog** holds four kinds deep enough
to fill a card, a handful of `other`, and a fifth kind that is one person's
entire collection: it checks that every round is all one kind, that `other` is
never themed on, that a kind nobody can field a card from is not drawn, and
that the kinds rotate rather than the draw landing on burgers every week. The
**unthemeable catalog** is six plates and six kinds, and checks the fallback —
a week where nothing can be themed still gets a round, and that round is
honestly a mixed one.

### Testing the placement round

```bash
npm run test:placement
```

Same mock and dev server as the others. The placement slot is a *draw* before
it is a round, and what this covers is which of four shapes a week arrives in:

- **A full week** — eight new photographs across three people, on top of a
  played backlog. The card is five, all of them new and unplayed, and no more
  than two from one kitchen while there is a choice.
- **One person's week** — five photographs from one person and nobody else
  cooking. The card still fills. The two-per-poster rule is a preference here
  and not the place round's hard cap, because refusing to rank somebody's
  Saturday is refusing to seed any of it.
- **Nothing new** — unplayed but old, and recent but already played, which are
  the two ways the filter could be got wrong. Nothing posts, and the slot is
  deliberately not marked used, so the next tick tries again.
- **Too few for a card** — two newcomers from two kitchens meet each other; two
  from one kitchen never can, so the newest goes up against the catalog
  instead; and a lone newcomer whose category holds nobody else posts nothing
  rather than bending the rule that two of your own never meet.

The sharp one is that a placement pair is marked a bonus. It is a food pair,
and food is what the everyday matchup draws, so under the old
work-it-out-from-the-category rule it would have counted as the day's cooking
matchup and blacked out the next slot. The suite checks the flag is set and
that the everyday matchup can still post beside it.

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
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&placement=1"
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&person=1"
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&drink=1"
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&caption=1"
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&foodround=1"
curl "https://<your-worker>.workers.dev/admin/post-matchup?secret=<BACKFILL_SECRET>&drinkround=1"
```

Posts one of the other slots on demand — `place=1` for the five-photo place
ranking round, `person=1` for person-vs-person, `drink=1` for drink-vs-drink,
`foodround=1` and `drinkround=1` for the themed fives, `placement=1` for the
week's new cooking — the same thing the scheduled cron does. Always overlaps,
always gets that slot's flat window. `place=1` answers `{"posted":false}` when
fewer than three places are available to rank, or when the per-poster cap
leaves it short; `drink=1` answers the same when the catalog holds fewer than
two drinks or they are all one person's; `placement=1` when there is no new
cooking inside the window at all, or its one new photograph has no legal
opponent. Forcing ignores the cadence entirely, so `drink=1` posts on a day the
slot would not have fired on.

The flags are read in the order they are listed in `index.ts`, and the first
one set wins — passing two is a request nobody meant to make, not two posts.

`caption=1` opens a caption contest. It refuses while another is live —
forced or not, because two open contests would ask people to write and to
rank at the same time on two photographs in one channel.

```bash
curl "https://<your-worker>.workers.dev/admin/open-vote?secret=<BACKFILL_SECRET>"
```

Ends a contest's writing phase early and puts the vote up. Its own route
rather than a flag on the close, because the two halves have to be callable
separately — forcing them together would open a vote and shut it in the same
request. Answers `{"opened":0}` when nothing is collecting captions.

```bash
curl "https://<your-worker>.workers.dev/admin/close-matchup?secret=<BACKFILL_SECRET>"
```

Closes everything open right now, ignoring `closes_at` — matchups, ranking
rounds and contests being voted on. Answers `{"closed":N,"rounds":N,
"contests":N}`. Contests still collecting captions are deliberately left
alone; `/admin/open-vote` is what moves those on.

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
the text and the vote buttons are untouched. Open matchups get the matchup card
on the post they went out as; closed ones get the result card on the result
post, which is a different message. Either link finds the round, so it does not
matter which of the two you paste. It answers `{"repaired":true}`, or a reason
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
  want sweeping eventually — but a sweep cannot simply drop the matchup cards
  once the result cards exist, because the post people voted on keeps its card
  and stays in the channel as the pointer at the result.
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
- **One private reply per person per scope, edited in place.** Ranking five
  photographs is five clicks, and every click used to answer with its own
  ephemeral message — the card scrolled away above a stack of five
  near-identical "Your order:" lines, four of them already wrong, each needing
  dismissing by hand. The first click now sends a message and every click after
  it edits that one.
  Discord has no id for an ephemeral message, so the only way to edit one is
  through the token of the interaction that created it, which is why migration
  0009 stores that token, keyed by the person and by whatever the click belongs
  to. It is good for fifteen minutes; past that, or if they dismissed the
  reply, the edit fails and the click falls back to a fresh message whose token
  becomes the one to edit. The click itself is answered with
  `DEFERRED_UPDATE_MESSAGE` — the buttons are on a public card that must not
  change, and the reply is somewhere else. The hourly tick sweeps rows past the
  fifteen minutes, since a dead token is a stored credential that no longer
  means anything.
  What a click belongs to is a scope string rather than the round or the
  contest, so the ranking round and the caption ballot get this without the
  code knowing what either of them is: their scope is the message their buttons
  are on, and one card is one conversation. The pair vote is the exception, and
  migration 0010 is why the key stopped being the message outright. Five
  cooking matchups at 9am are five messages with one button pair each, so
  keying their replies by message handed a voter five of them — the same stack,
  rearranged rather than avoided. Every pair vote shares one scope instead, and
  the line follows them down the board.
- **The vote reply reads back the whole board.** One message being rewritten
  can only say things that stay true of the lines it replaces, so "Voted 2."
  had to go: it is true of the click and wrong about the four votes before it.
  The reply is now every open matchup this person has voted on and what they
  picked — `Voted: #341 → 2 · #342 → 1. Three still open.` — in the numbers
  printed on the cards and the buttons, which is all a voter has to go on. Only
  their own picks, mind; the channel still sees nothing until the round closes.
- **The result goes out as a new message, not as an edit.** A vote window is a
  day long, so by the time a round shuts, the card people voted on is a day of
  channel traffic above the fold — and Discord shows nothing at all for an
  edit. The reveal used to land silently in the middle of the backlog, and only
  the people who thought to scroll up ever saw who won. The result now gets a
  post of its own, replying to the card, and the card is edited down to a line
  pointing at it: the reply header jumps up to the photographs, the pointer
  jumps back down to the result. Every format does it — matchups, ranking
  rounds, and the caption contest, which needed it most because its ballot was
  already the second of two buried posts.
  The post goes out before the edit. The row is closed by the time either runs
  and cron does not retry, so a failure has to fall on the signposting rather
  than on the reveal; the vote buttons the edit strips are inert anyway,
  because a click is checked against the row and not the message. A round
  nobody voted in is the one exception — it is edited in place and gets no
  post, since there is nothing to reveal and a new message to say so would be
  the loudest thing the bot did all day.
- **The vote log rides on the result post.** It is a second embed under the
  result card rather than a follow-up or a thread, which costs no extra API
  call and no second message. It also means `/admin/repair-card` has to rebuild
  it: a PATCH replaces the embeds it names, so sending only the card would
  quietly delete the log.
- **A closed round lives on two messages**, which is why `matchups`, `rounds`
  and `contests` all carry a `result_message_id` (migration 0007). Repair edits
  whichever one is currently showing the card, and falls back to the original
  for rounds that closed before the result got a post of its own.
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
- **Cron hours are UTC and ignore DST.** `POST_HOURS_UTC = "15"` is 9am
  Mountain under MDT and 8am under MST — shift to `"16"` in November.
  `PLACE_HOUR_UTC`, `PERSON_HOUR_UTC`, `DRINK_HOUR_UTC` and `CAPTION_HOUR_UTC`
  are the same story and need shifting with it. The clock lives entirely in these vars: the cron stays broad and
  UTC. It ticks on the hour and at `:11`, and `:11` is the only reason the
  second entry exists — the person bonus fires at 11:11am, and an hourly cron
  cannot reach that minute on its own.
- **`MATCHUPS_PER_SLOT` matchups at a time**, with a single exception. The
  slot posts that many together and then refuses, even when forced, because a
  sixth live matchup on a slot of five splits the vote the same way a second
  did on a slot of one. The cap counts what is open rather than what was
  posted, so a batch that could not close — a failed tick, a D1 blip — is
  topped back up to five next time instead of being stacked on.

  The exception is a bonus: `?overlap=1` on `/admin/post-matchup`, and the
  place, person and drink slots, which are meant to run beside the ordinary
  ones. Closing already handles several being open, and a vote carries its
  matchup id on the button, so nothing else needs to know. "Open" here means an
  open *food* matchup, and that word is load-bearing: while it counted drinks,
  a live drink matchup stood in front of the next cooking slot and skipped it —
  the same cycle-skipping bug that closing on the schedule was written to fix,
  arriving from a new direction.
- **The batch is one hour, not one an hour.** Five matchups go up together at
  9am rather than at five times of day, because a matchup closes when the next
  posting hour comes round: spreading them would cut every window to a fifth of
  a day and make voting a matter of being in the channel at the right moment.
  Together on one hour, each of the five stays open until 9am tomorrow.

  The number is a decision about the backlog, and it is worth restating why.
  577 food photographs, 539 of which have never been on the board, refilling at
  about one a day. The Wednesday five comes out of the same pool, so three
  matchups a day spends 6.7 photographs and gains one — a runway of about three
  months before anything repeats. Five spends 10.7 and makes it under two.
  That is a real cost and worth paying: at three a day a photograph still gets
  under three outings a year, and a rating built on that is thin. Nothing here
  runs out — the draw orders by `matches_played`, so an empty backlog simply
  means a second lap — and the second lap is where the standings start to mean
  something.

  Turnout is the thing to watch rather than the catalog. Eight people vote,
  matchups average six votes each, and on 30 August six went up in one day and
  every one of them still took seven votes. Five a day sits inside what that
  day already proved. If that average starts sliding, this is the number to
  turn down.
- **The 9am posts are cooking, and only cooking.** The everyday draw
  is fixed to `food`. Everything else the classifier labels — `drink`,
  `place`, `person` — is drawn on a slot of its own: a five-photo place
  ranking round on `PLACE_WEEKDAY` (Monday noon by default), person against
  person on `PERSON_WEEKDAY` (Tuesday 11:11am), drink against drink on
  `DRINK_WEEKDAY` (happy hour, 5pm Mountain). Each overlaps whatever is open,
  gets a flat window instead of closing on a posting hour, and keeps its own
  slot key so posting one never consumes a food slot. Setting any of the
  `*_WEEKDAY` vars to `"-1"` turns that slot off.

  Drinks shared the everyday slots until they didn't. Both halves of a pair
  have to match category, so whenever the draw's primary came up a cocktail
  the day's cooking matchup was a drinks matchup instead — at a rate nobody
  chose and nobody could predict from the outside.
- **Nine categories, and every one of them now has somewhere to go.** The
  classifier labels `food`, `drink`, `place` and `person`, which each have a
  slot, and five more — `ingredient`, `pet`, `document`, `screenshot`,
  `other` — which for a long time had none. They were unreachable rather
  than unscheduled: `CATEGORIES` in `matchmaking.ts` gated the draw and none
  of the five were in it.

  The reason was not an oversight. Those photographs are the residue of the
  channel — a receipt, a meme, a shopping haul, somebody's cat — and every
  format up to now asks which of these is better, which is not a question
  anybody can put to two receipts. The caption contest asks a different one,
  and there a baffling photograph is worth more than a good one.
- **The caption contest is the first format where players make something.**
  One photograph goes up on Saturday with a button; the button opens a modal,
  which is the only way Discord will take free text from somebody without
  giving them a message box the whole channel can read. Sunday the captions
  go on the board, shuffled and numbered, and everyone ranks their top three.
  Monday names the winner.

  It is scored with Borda points — 3, 2, 1 — and not with Elo. A caption has
  no rating to carry anywhere: it exists for one photograph and will never
  appear again, so a rating would need a pool to be rated against and there
  is not one. A contest has a winner, which is a different thing.
- **The bot enters its own contest, anonymously.** The classifier already
  wrote a deadpan name for every photograph when it labelled it, and until
  now that line only ever appeared beside its own picture. It goes on the
  board with nothing marking it, and where it placed is the first line of the
  result. It is added when the vote opens rather than when the contest starts,
  so a contest nobody entered can tell "nobody wrote one" from "one person
  did" — below two human captions there is nothing to vote on and the contest
  is abandoned rather than posted.
- **Captions are text in the message, not a rendered card.** Every other
  format composites several photographs into one image and needs Vercel to
  rasterize it. A contest shows one photograph, which R2 already serves at a
  public URL, and a list of sentences, which Discord renders better as text
  than any PNG would — selectable, wrapping, and legible on a phone. So there
  is nothing here that can fail to render, and no `repair-card` path.
- **A contest's ballot is capped at three; a ranking round's is not.** The
  round wants every comparison it can get, because each one is an Elo update.
  A contest can carry ten captions and ranking all ten is a chore that would
  collect fewer ballots rather than better ones. Ranking your own is allowed:
  it costs one of your three, which is its own disincentive, and the reveal
  names every ballot — the same bargain the pair matchup makes with
  self-votes.
- **How often drinks post is computed, not configured.** `DRINK_WEEKDAY` is
  normally left at `"auto"`, which asks the catalog. A fixed weekly day is
  wrong in both directions: six drinks and a weekly post shows the same two
  every month, eighty drinks and a weekly post never gets through them. So
  the cadence aims at a constant **sweep** — the time it takes for every
  drink to have been on the board once. A matchup uses two, so a sweep is
  `ceil(count / 2)` posts, and a four-week sweep wants a quarter of that a
  week: roughly one post a week per eight drinks, clamped between weekly and
  daily. Eight drinks is Thursdays; sixteen adds Monday; fifty-two is every
  day. Below two drinks, or two people with a drink, there is no schedule at
  all — a matchup never pits someone against himself, so no pair exists to
  draw. An explicit comma-separated list overrides the whole thing.
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
  inside it is an ordinary matchup with its own vote split, against the ratings
  as they stood when the round opened, and a photograph's whole card is one
  Glicko rating period — the four comparisons it appears in, resolved together
  and applied once, so the answer cannot depend on the order the pairs are
  walked in. A round is one match played, not four; the rotation counts rounds.

  Four comparisons do not move a rating four times as far as one. The prior
  term damps them to about three and a half, and the round leaves the
  photograph on a tighter deviation so the round after moves it less. That is
  what replaced dividing `K` by `n-1` — the same worry, that one weekly bonus
  would outweigh the week it sits in, answered by the arithmetic rather than by
  hand.
- **Ratings carry a deviation.** Every photograph has an `rd` alongside its
  `elo`: how unsure the game is of that rating, in rating points. It opens at
  250, narrows as results come in, and floors at 60.

  The fixed `K` of 24 it replaced could not work here, and the numbers say so
  plainly. The everyday pool is 577 photographs and about 10.7 go on the board
  a day counting the weekly five, so a sweep takes under two months and a
  photograph gets about seven outings a year. At `K` 24 a photograph that
  belongs 300 points above the opening rating gains about eight points the
  first time it wins — thirty-five games to arrive, which even at seven a year
  is five years. Every rating in the table was 1500 plus a coin toss
  and would have stayed that way. Under Glicko the same photograph is where it
  belongs inside a handful of games.

  The floor is picked so that two settled photographs meeting produce an
  effective `K` near 20, which is close enough to the old 24 that nothing with
  a history behind it behaves differently. The change is meant to be felt at
  the new end of the catalog and nowhere else.

  Two departures from Glicko as written. There is no volatility term — that is
  Glicko-2, and it models a competitor's true strength drifting over time,
  which a photograph's does not; it is the same photograph. And the deviation
  is never inflated back between games for the same reason: a photograph that
  last played three months ago is exactly as well understood as it was then.
  Inflating it would be ruinous at this cadence anyway, since everything is
  inactive almost all of the time, and it would hand back the noise this
  replaced.

  One consequence worth knowing: ratings are no longer zero-sum. The side with
  the wider deviation moves further, which is the whole point — a newcomer
  beating a veteran teaches us far more about the newcomer than the veteran.
  Across a settled catalog the movements still cancel to within rounding, and
  the harnesses check that rather than an identity that no longer holds.
- **The placement round seeds the week's new cooking.** Thursday, up to five
  photographs posted in the last fortnight that nobody has voted on yet, ranked
  on one card.

  The everyday rotation does already put unplayed photographs first, and that
  is not the same thing as putting *new* ones first. 539 of the 577 in the pool
  have never played and the pick among them is random, so something posted on
  Tuesday joins the back of a queue about two months deep. The fresh slot
  fires on one primary in four and helps, but it draws one photograph at a
  time; this draws the week, and a card is four comparisons per photograph
  rather than one.

  It is the deviation that makes it worth doing. Five newcomers at their widest
  deviation judged against each other means one card can separate them by 500
  rating points; the identical card on settled ratings moves them 73. Under the
  fixed `K` it was worth twelve points a head and everything stayed at 1500.

  Below three new photographs it posts a pair instead — the two of them if they
  came from different people, otherwise the newest against the catalog — and
  below one it posts nothing and does not claim the slot. A quiet week is the
  normal case, not the edge one.

  The per-poster rule here is a preference rather than the place round's hard
  cap. The place round draws from the whole catalog and always has more to
  reach for; a week's new cooking might be four dishes from one person who had
  people over on Saturday, and refusing to rank those is refusing to seed them
  at all.
- **A placement pair is marked a bonus, in a column.** Which matchups are
  bonuses used to be worked out from the category: the everyday draw is food
  and nothing else, so a matchup holding anything else could only have been a
  bonus. The placement slot breaks that — it draws food, and falls back to a
  pair. Such a pair would have counted as the day's cooking matchup and blacked
  out the next slot for a full day, which is the exact cycle-skipping the
  one-at-a-time rule exists to prevent. Migration 0008 adds `matchups.bonus`
  and backfills it from the category, so the inference it replaces still holds
  for every row written before it.
- **Places do not count toward chef standings**, and neither do people. They
  earn an Elo like any other photo, but averaging a holiday snap or a group
  shot into someone's cooking record would rate them on the wrong thing. The
  themed food and drink rounds are the other way about: those *are* the
  categories the standings average, so winning one moves a cook up the table
  exactly as winning a matchup does.
- **Kinds: what a photograph is, one level below the category.** `category`
  answers what a photo may play against — food with food, drink with drink —
  and that is all a pair needs, because a pair can be drawn to be comparable.
  Five cannot. An ungrouped five drawn from food at large is a lasagne, a
  fry-up, a cheeseboard, a taco and a bowl of ramen, and what people rank there
  is which meal they fancy rather than which plate is better.

  So the classifier writes a `kind` alongside the category, in the same call,
  and the weekly fives are built around one of them: five pastas, five steaks,
  five beers. The list is closed and deliberately coarse — twenty-one kinds of
  food, seven of drink, and `other` — because a free-text kind fragments on
  contact with a channel. "Pasta", "spaghetti", "pasta bake" and "carbonara"
  are four groups of one, and a themed round needs three of something. See
  `kinds.ts`, which is also where the classifier's prompt for them is built,
  so the enum and the description it is chosen from cannot drift apart.

  Only food and drink have kinds. A pet or a receipt is only ever a caption
  prompt, and bucketing those would be labelling something nothing will draw on.
- **A kind is eligible when it can fill a card by itself.** Three photographs
  that are not already live, from at least two people — which are the ballot
  draw's own rules stated one step ahead of it rather than new ones, so a kind
  that qualifies always yields a postable round and never has to be tried and
  discarded. The per-poster cap is why the second condition is there: a kind
  that is one person's collection can only ever put two on the card however
  deep it goes.

  Among the eligible, the pick is the rotation the rest of the game runs on —
  the kind holding the least-played photographs goes first, which early on,
  when everything is unplayed, quietly favours the kinds deep enough to fill
  all five slots.
- **A themed round falls back to a mixed one rather than skipping the week.**
  A slot that fires only once the catalog is deep enough is a weekly post that
  does not appear for months, and the mixed five is what the place round has
  always been. The card says which it got: "rank the pasta" when it found a
  theme, "rank the plates" when it did not.
- **Kinds are backfilled by the classifier, not by a migration.** Every
  photograph already in the catalog has a category and no kind, so the pending
  query takes "labelled, but not to this depth" as work — and sorts it behind
  the photographs that have no category at all, which are the ones that cannot
  play until they are labelled. Twenty an hour drains a thousand-dish backlog
  in a couple of days, during which the themed rounds have progressively more
  to choose from and the rest of the game is untouched.

  The write is a `COALESCE` rather than an assignment, for the rows that are
  only there for the kind: overwriting a category under an open matchup is a
  pair that no longer shares one, and overwriting a name is a photograph the
  channel has already seen renaming itself.
- **Cards crop on the food, not the middle of the frame.** Every card cuts its
  photographs to a wide tile, and the cut used to be the centre of the frame —
  which on a tall phone photo of a plate at the end of a table is the table,
  with the plate off the bottom. The renderer draws with satori, which accepts
  `object-position` and then ignores it, so nothing about the layout could
  move the crop.

  So the classifier, which already looks at every photograph, also boxes what
  the photo is *of* — the plate, the glass, the person, the dog, the whole
  frame for a place — and the centre of that box is stored as a focal point
  (`focus_x`/`focus_y`, fractions of the frame). The Worker puts it in the
  signed payload beside the name, and the render endpoints cut the tile
  themselves with sharp, centred on it, before satori sees the image. A point
  is all a cover crop can use: the window is always the full width or the
  full height, so the only decision is where along the other axis it sits.

  It is one more field in the same vision call, not a second call, so a new
  photograph costs nothing extra. Everything already in the catalog needs one
  pass more, which the classifier treats as its third tier of pending work —
  behind unlabelled photographs and behind missing kinds, since a dish with no
  focal point is on the cards already, just cropped the old way. Until its
  turn comes the render falls back to sharp's attention crop, which scores
  regions on detail, saturation and skin: a fair guess at where the food is
  and a better one than the middle. A box the model fails to draw becomes the
  centre of the frame rather than a null, so the row leaves the queue instead
  of coming back every tick on a call that succeeded. Hurry the backfill with
  `/admin/classify?secret=…&limit=20` in a loop; it reports `remaining`.

  Handing satori a tile-sized JPEG rather than a multi-megapixel original also
  takes most of the rasterizing out of a render, which is where the seconds
  went.
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
