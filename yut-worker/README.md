# yut-worker

The Yut Hut campaign: a workout-accountability game for the yut-hut channel,
with RuneScape flavour. A Cloudflare Worker with a D1 database and an R2
bucket, woken by an hourly cron and by Discord's interactions webhook. Cards
(the stats sheet, level-up banners, the weekly standings) are rendered by the
Next app on Vercel under `app/api/yut/` and mirrored into R2. The rules page
is `app/yut-hut/`.

Two rules sit above everything and every formula obeys them:

- **Two a week is the whole game.** The first two check-ins of the week are
  full value, the third and fourth half, the fifth to seventh a fifth. Seven a
  week earns 1.8× two a week, not 3.5×.
- **Only players exist.** Somebody who has not pressed Join is furniture. They
  are never counted, named, pinged or penalised.

Nothing is ever awarded for anything other than a check-in, and a check-in in
the last four days ("fresh") is what unlocks every action.

## Layout

```
src/
  index.ts        fetch(): /interactions, /admin/*, /health. scheduled(): the tick.
  tick.ts         one hourly tick: daily resolution, morning post, last call.
  weekly.ts       the Monday boundary: form weeks, Rings, Prayer, rivalries, standings, Foundings.
  interactions.ts button routing, the running-reply pattern, the freshness gate.
  commands.ts     slash commands.
  register.ts     the command list Discord is told about.
  checkins.ts     the check-in transaction and everything a check-in can produce.
  events.ts       random events (seeded on player + day).
  clues.ts        clue scrolls.
  rivalries.ts    the weekly head-to-head.
  streaks.ts      resolveWeek() — pure.
  xp.ts           the curve (RuneScape's table, exactly), the weight, tiers — pure.
  config.ts       every number in the game. Edit this and nothing else.
  digest.ts       the morning post. board.ts the pinned board.
  sheet.ts        signed render URLs and R2 mirroring. images.ts attachment mirroring.
  town.ts         stores, workers and sacks, buildings, upkeep, the quiet-day rule, Foundings.
  votes.ts        group votes (build, relic, raid). relics.ts the relics. raids.ts raid weeks.
  actions.ts      the town buttons and vote handlers. bingo.ts the grids. shop.ts the shop.
  db.ts           every D1 query. discord.ts the REST client. roles.ts the opt-in ping role.
migrations/       0001 the game, 0002 the town, 0003 votes and raids, 0004 bingo and shop. One number per file, forever.
scripts/          the harness (below).
config/choices.json  option lists shared by the runtime and the registration script.
```

## Setup

1. **Cloudflare.** `npx wrangler d1 create yut-hut` and paste the id into
   `wrangler.toml`. `npx wrangler r2 bucket create yut-hut-images`, enable its
   public dev URL, and put that in `R2_PUBLIC_BASE`.
2. **Secrets.** `npx wrangler secret put` each of `DISCORD_BOT_TOKEN`,
   `YUT_IMAGE_SECRET` (must byte-match the Vercel env of the same name),
   `ADMIN_SECRET`, and optionally `DISCORD_LOG_WEBHOOK_URL`. The Discord public
   key and application id are plain vars in `wrangler.toml` — a verification
   key is not sensitive.
3. **Vercel.** Add `YUT_IMAGE_SECRET` and redeploy; env changes reach the
   functions only on a new deploy. `node scripts/yut-sign.mjs` at the repo
   root hand-signs a render URL to check.
4. **Deploy.** `npm run migrate && npm run deploy`, or merge to main — the
   `deploy-yut-worker` workflow applies migrations and deploys.
5. **Discord portal** (application `1544835406661423185`). Bot → reset token
   → secret. No privileged intents: attachments arrive on the slash option.
   Interactions Endpoint URL: `https://yut-hut.<account>.workers.dev/interactions`
   — deploy first; Discord probes with a bad signature and expects a 401.
   Invite with scopes `bot applications.commands` and permissions View
   Channel, Send Messages, Embed Links, Attach Files, Read Message History,
   Manage Messages (pinning the board), Manage Roles (the opt-in Players role;
   the bot's own role must sit above it).
6. **Commands.** `npm run register` with `DISCORD_BOT_TOKEN` in `.dev.vars`,
   or hit `/admin/register-commands?secret=…`. Guild commands appear at once.
   Re-run after editing `src/register.ts` or `config/choices.json`.
7. **Go live.** Ship with `DAILY_POST_HOUR_UTC = "-1"` until the roster has
   joined, then set it to `14` (8am MDT) and deploy.

## The clock

Everything is UTC and the crons do not follow DST. The game day runs
`ROLLOVER_HOUR_UTC` to `ROLLOVER_HOUR_UTC` (9 = 3am MDT) so a midnight session
counts as today; the week is Monday to Monday at that hour. Shift every
`*_HOUR_UTC` var by +1 in November and −1 in March, by hand, as scrandle does.

## Running locally

```
cp .dev.vars.example .dev.vars           # then fill it in, see below
node scripts/test-interactions.mjs --keygen   # writes .test-key.pem, prints DISCORD_PUBLIC_KEY
npm run migrate:local
npm run mock:discord                     # terminal 1, :9912
npm run dev:local                        # terminal 2, :8788
```

`.dev.vars` for the harness: `DISCORD_API_BASE=http://127.0.0.1:9912`,
`R2_PUBLIC_BASE=https://images.test.local`, the `DISCORD_PUBLIC_KEY` the keygen
printed (a `.dev.vars` value overrides the `[vars]` entry), and any values for
the three secrets. `wrangler.test.toml` is generated because wrangler refuses
an empty D1 id even locally; it is gitignored.

## Testing

- `npm run test:xp` — pure: the curve against its anchors, the weight, tiers,
  event rates, clue draws, the week boundary, rivalry draws, the calendar.
  No wrangler needed; runs in CI before every deploy.
- `npm run test:interactions` — signed requests against `dev:local` with the
  mock up: bad signature 401, join-and-check-in, the second check-in refused,
  XP and the haul landing, verification (self refused, twice refused, two
  verifiers), the four-day freshness gate, `/sheet` deferring.
- `npm run test:year` — walks a year through the real Worker: six players with
  the design's attendance profiles, every daily tick and Monday resolution,
  then prints the balance table and checks the invariants (nobody above 99,
  the two-a-week player reaches Dragon, Rings only spent on one-check-in
  weeks, no duplicate check-ins, stores never negative, Foundings ran). Start
  from a fresh local database: `rm -rf .wrangler/state && npm run migrate:local`.

There is no way to fire a cron by hand, so the `/admin/*` routes (all gated
on `?secret=ADMIN_SECRET`) are the test seams: `tick?at=<ISO>` runs the tick
with a synthetic clock (`daily=1`, `post=1`, `lastcall=1` force a phase),
`seed?players=a,b`, `checkin-as?player=&day=&photo=1&post=1`,
`resolve-week?day=`, `render-sheet?player=`, `register-commands`, and
`sql?q=SELECT …` for the harness.

## Behaviour worth knowing

- **One check-in per game day**, enforced by the `UNIQUE (player_id, day)`
  constraint rather than in code. No backfill, no edits.
- **Rolls are seeded** on the player and the day, so a check-in that has to be
  recomputed rolls the same event and the same clue.
- **Every message the bot writes is unmentioning** except the opt-in Players
  role on the morning post and Sunday's last call.
- **The receipt is the play hub.** Lamps, clues, the sheet, the camp and the
  log hang off it; a stale player gets "Check in to play" and nothing else.
- **Group rewards wait.** Founding lamps, holiday rings and titles are
  credited to `pending_claims` and surface on the next check-in receipt.
- **Discord caches an embed image per URL forever**, so every sheet key carries
  a stamp and a retry mints a different signed URL.
- **Attachment URLs expire** within a day; a photo is mirrored into R2 before
  the check-in line goes out and only the key is kept.
- **Until Founding I the camp is stores only.** Workers, buildings and the
  Monday build vote arrive at week 13; relics and raids at Act 3 (week 27);
  Dragon workers and the statue at Act 4. The tables are there from the start
  (`0002_town.sql`, `0003_votes_raids.sql`, `0004_bingo_shop.sql`); the
  campaign calendar in `config.ts` decides when each system wakes up.
- **The experience table is RuneScape's, exactly.** Level 99 is 13,034,431 XP
  and every unlock sits at its RuneScape level; a check-in is worth about two
  thousand so the pace lands a two-a-week player at Dragon by the finale.
