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

The bot drives the day. Every morning it asks **did you work out in the last
24 hours?** with a Yes and a No; Yes is the check-in, No is a rest day that
is written down and never punished, and the post edits a roll call into
itself as answers arrive. Slash commands are for the things a player
chooses to do: `/lamp`, `/clue`, `/task`, `/town`, `/vote`, `/sheet`.

Progression is Old School RuneScape's, not an imitation of it. A check-in is
one training session against the player's Slayer task, worked out with the
wiki's formulas (max hit, accuracy, XP per damage, combat level) on the
wiki's numbers (monster stats, scimitar and armour bonuses, Slayer
assignment tables, bones, prayers, log/ore/fish tables), all pulled into
`config/osrs.json` by `scripts/fetch-osrs.mjs`. Levels and gear make every
session pay more, the way they do in the game. The one number that is the
campaign's own is the session length, tuned so two a week reaches Dragon
(Defence 60) in week 52.

## Layout

```
src/
  index.ts        fetch(): /interactions, /admin/*, /health. scheduled(): the tick.
  tick.ts         one hourly tick: daily resolution, morning post, last call.
  weekly.ts       the Monday boundary: form weeks, Rings, standings, Foundings.
  interactions.ts button routing, the running-reply pattern, the freshness gate.
  commands.ts     slash commands.
  register.ts     the command list Discord is told about.
  checkins.ts     the check-in transaction: the session, the haul, and everything a check-in can produce.
  loot.ts         the kills' drops, rolled per kill against config/drops.json — pure. bank.ts /bank.
  quests.ts       the Quest of the Week: the calendar's quest, supplies, mini-fights, completion, /quest.
  reminders.ts    the evening reminders and the going-stale @mention.
  combat.ts       Old School's combat as arithmetic: combat level, max hit, accuracy, the session, the quest mini-fight, masters and assignments — pure.
  events.ts       random events (seeded on player + day).
  clues.ts        clue scrolls.
  slayer.ts       Slayer tasks: a master by combat level, kills from the session, points and streaks.
  streaks.ts      resolveWeek() — pure.
  xp.ts           the curve (RuneScape's table, exactly), the weight, tiers by Defence — pure.
  config.ts       every number that is the game's own. Edit this and nothing else.
  digest.ts       the morning post. board.ts the pinned board.
  sheet.ts        signed render URLs and R2 mirroring of the cards. images.ts fetching a check-in's photo back from Discord to re-upload it.
  town.ts         stores, workers and sacks, buildings, upkeep, the quiet-day rule, Foundings.
  votes.ts        group votes (build, relic, raid). relics.ts the relics. raids.ts raid weeks.
  actions.ts      the town buttons and vote handlers. bingo.ts the grids. shop.ts the shop.
  db.ts           every D1 query. discord.ts the REST client. roles.ts the opt-in ping role.
migrations/       0001 the game, 0002 the town, 0003 votes and raids, 0004 bingo and shop, 0005 sessions and answers, 0006 the bank, 0007 quests. One number per file, forever.
scripts/          the harness (below), plus fetch-osrs.mjs (the wiki pull: --osrs, --drops, --quests), export-icons.mjs (item sprites from the prog-to-img-endpoint database into the Next app) and calibrate.mjs (the pace).
config/choices.json  option lists shared by the runtime and the registration script.
config/osrs.json     the wiki's numbers: masters, assignments, monsters, scimitars, armour sets. Regenerate with `npm run fetch:osrs -- --osrs`.
config/drops.json    every Slayer monster's real drop table (herb, seed, gem and rare-drop sub-tables expanded) with GE values. `npm run fetch:osrs -- --drops`, then `npm run export:icons` for any new sprites.
config/quests.json   the Quest of the Week calendar's data: difficulty, quest points, enemies with real stats, item counts, blurbs. `npm run fetch:osrs -- --quests`.
```

## Setup

Merging to main is the deploy and the setup. The `deploy-yut-worker`
workflow creates the D1 database and R2 bucket if they are missing
(`scripts/provision.mjs`; both exist and are named in `wrangler.toml`),
applies migrations, deploys, pushes the repository's secrets to the Worker
(`scripts/push-secrets.mjs`), registers the slash commands, and sets the
Discord application's Interactions Endpoint URL to the deployed Worker
(`scripts/discord-setup.mjs`). Every step is idempotent, so "Run workflow"
on the Actions tab redoes it all after a secret is added.

Three things only a person can do, once:

1. **Two repository secrets** (GitHub → Settings → Secrets and variables →
   Actions). `YUT_DISCORD_BOT_TOKEN`: Developer Portal → application
   `1544835406661423185` → Bot → Reset Token. `YUT_IMAGE_SECRET`: any long
   random string. Optional: `YUT_ADMIN_SECRET` (gates `/admin/*`) and
   `YUT_DISCORD_LOG_WEBHOOK_URL` (where tick failures are reported).
   `CLOUDFLARE_API_TOKEN` is already there, shared with scrandle.
2. **The same image secret on Vercel**, as `YUT_IMAGE_SECRET` on the project
   (then redeploy the site: env changes reach the functions only on a new
   deploy). Or skip this by making the repository secret equal Vercel's
   existing `SCRANDLE_IMAGE_SECRET` — the render routes fall back to it. The
   workflow signs a URL and asks Vercel, and says in its summary whether the
   pair matches.
3. **Invite the bot.** The workflow prints the invite link in its summary
   when the bot is not in the server (scopes `bot applications.commands`;
   permissions View Channel, Send Messages, Embed Links, Attach Files, Read
   Message History, Manage Messages for pinning the board, Create Public
   Threads and Send Messages in Threads for the day's check-in thread,
   Manage Roles for the opt-in Players role, whose position must be below
   the bot's own). A private channel's own permission overwrite for the bot
   needs the two thread permissions too; until it has them, check-in lines
   fall back to the channel and the log webhook says so.
   A server admin opens it. No privileged intents: attachments arrive on
   the slash option.

The Discord public key and application id are plain vars in `wrangler.toml`;
a verification key is not sensitive. The morning post is on from the first
deploy (`DAILY_POST_HOUR_UTC = "14"`, 8am MDT): before `CAMPAIGN_START` it
reads "Pre-season" and carries the Join button, which is the launch
announcement. Set the hour to `-1` to silence it.

By hand, the same steps are `npm run provision`, `npm run migrate`,
`npm run deploy`, `npm run secrets` (reads `.dev.vars`), `npm run register`,
and `WORKER_URL=… npm run discord:setup`. `node scripts/yut-sign.mjs` at the
repo root hand-signs a render URL to check the Vercel side.

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

- `npm run test:xp` — pure: the curve against its anchors, the combat
  formulas against the wiki (99 Strength with a dragon scimitar is a 22 max
  hit), the weight, tiers, masters and assignments, event rates, clue draws,
  the week boundary, the calendar. No wrangler needed; runs in CI before
  every deploy.
- `node scripts/calibrate.mjs [--attacks N]` — the pace without a database:
  the design's attendance profiles through a year of sessions, printing where
  each lands. Run it when touching `SESSION_ATTACKS` or the lamp sizes.
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
  role on the morning post and Sunday's last call, and the evening
  reminder's stale warning, which @mentions a player on their third day
  without a check-in (tomorrow the freshness gate closes on them).
- **A check-in is a session.** The player fights their Slayer task for a
  fixed stretch with the best scimitar, armour and prayers their levels
  allow; damage pays combat XP (4 per point, 4/3 to Hitpoints), every kill
  on task pays the monster's Slayer XP, the bones are buried for Prayer (a
  Chapel is a gilded altar), and the haul pays gathering XP at the best
  log, ore or fish the level can take. The session is expected values, not
  dice, so a retry produces the same numbers. Everybody starts at
  Hitpoints 10.
- **The receipt is the play hub.** Lamps, clues, the Slayer task, the sheet,
  the town, the log, bingo, the shop and the votes hang off it; a stale
  player gets "Check in to play" and nothing else. The receipt itself is
  one line plus whatever only the player can act on (a lamp, a quiz, a
  reward waiting); the session lives in the day's thread.
- **The day has a thread.** The morning post starts one ("Check-ins · Wed
  3 Sep", `daily_thread:<day>` in `state`), and every check-in's line and
  loot card go into it. The channel itself only hears from a check-in when
  the player brought a photo, a video or a note: a short post with the
  media, the quoted note and the Verify button, replying to the morning
  post. `checkins.message_id` is that media post, the one Verify edits. If
  the thread cannot be created or refuses a post, the line goes to the
  channel instead — a check-in line is never lost.
- **Every check-in carries a loot card**: the check-in's loot (coins,
  logs, a lamp, a clue, a casket, uniques) as OSRS item icons and the XP it
  paid, rendered by `app/api/yut/report` in the style of an OSRS progress
  report; a level-up reads `Hitpoints 12 -> 13` (the RuneScape fonts have no
  arrow glyph). The RuneScape level-up
  scroll only appears for milestone levels (every tenth, every fifth past
  60, every level past 90). The icons come from the prog-to-img-endpoint
  item database.
- **Evening reminders.** At `REMINDER_HOUR_UTC` the bot posts one message
  naming roster members with something to claim — lamps to rub (and when
  one will rub itself), Slayer points that buy a skip, bingo points that
  buy a lamp, open votes not cast, rewards waiting on a check-in — and
  @mentions anyone whose last check-in was three days ago, because tomorrow
  is day four and stale. Nothing at all is posted when nobody qualifies. It
  is deleted at the next rollover.
- **Drops are the wiki's.** Every kill of a session rolls the monster's real
  drop table from `config/drops.json` — herb, seed, gem and rare-drop
  sub-tables included — with a seeded RNG, so a retried check-in banks the
  same loot. Each row is rolled independently at its own rate (the game's
  main table is one exclusive roll per kill, so the expected rates match the
  wiki exactly and only the variance differs). Stacks go to the player's
  `bank` at their GE value; `/bank` lists them. Nothing reaches the town
  economy; bones are buried for Prayer, not banked. A drop at 1/1,024 or
  rarer, or worth 50k, is announced in the thread and logged as
  `drop:<item>`, counted apart from the curated 90-entry log.
- **A quest a week, cooperative, from the game's own book.** `QUEST_CALENDAR`
  in config.ts names 51 Old School quests — the free-to-play novice quests
  through Act 1, 37 quest points before the Champions' Guild beat at week 18
  (the game asks 32), members quests rising by act, Dragon Slayer I at the
  Elvarg beat, Dragon Slayer II the week after — and `config/quests.json`
  holds the wiki's data for each: quest points, the enemies to defeat with
  their real stats, the items list. The week's first check-in starts the
  quest; every check-in brings a supply (a note or a photo brings two) until
  the party has `min(items, ceil(roster / 2))`; then every check-in is a
  mini-fight of `QUEST_FIGHT_ATTACKS` swings against the current enemy, in
  the quest's order, each enemy's pool its hitpoints × count. The check-in
  that empties the last pool completes it: the quest points go to the group
  (`/quest log`), and everyone who checked in that week gets an antique lamp
  by difficulty (easy for Novice, medium for Intermediate, hard above) as a
  pending claim, plus a `quest:` log entry. Unfinished on Monday is noted
  and costs nothing. The pace check in test-xp.mjs keeps every quest inside
  two check-ins a head for a party of four (six for the Grandmasters), and
  `SESSION_ATTACKS` came down from 800 to 600 so two a week still reaches
  Dragon near the finale with the quest lamps counted.
- **Slayer tasks are the game's.** Every player always holds a task from the
  highest master their combat level earns (Turael, Mazchna 20, Vannaka 40,
  Chaeldar 70, Nieve 85, Duradel 100 and 50 Slayer), drawn from that
  master's real table with the real amounts, never one their Slayer level
  cannot damage. Finishing pays the master's points and the next task at
  once; tasks do not expire; a skip costs 30 points. The 10th, 50th and
  100th task in a row pay 5×, 15× and 25×. Points buy 10,000 Slayer XP (100)
  and the Slayer helmet (400), which is +16⅔% on task.
- **Tiers are armour.** A player's tier is the full set their Defence level
  can wear (steel 5, mithril 20, adamant 30, rune 40, dragon 60); Attack
  picks the scimitar the same way. The lamps the campaign hands out are the
  Achievement Diary's antique lamps (2,500 / 7,500 / 15,000 / 50,000); a
  genie's is ten times the level.
- **Group rewards wait.** Founding lamps, holiday rings and titles are
  credited to `pending_claims` and surface on the next check-in receipt.
- **Discord caches an embed image per URL forever**, so every sheet key carries
  a stamp and a retry mints a different signed URL.
- **Attachment URLs expire** within a day, so a check-in's photo or video is
  fetched back from Discord's CDN once and re-uploaded as the bot's own
  attachment on the channel post (multipart `payload_json` + `files[0]`).
  Discord keeps the file, shows the image and plays the video inline;
  nothing is copied into R2. `checkins.attachment_r2_key` holds
  `discord:<attachment id>` and `attachment_url` the posted attachment's
  URL. If Discord refuses the upload (over the server's size limit), the
  post goes out with the note and a link instead and the proof still counts.
- **Until Founding I the camp is stores only.** Workers, buildings and the
  Monday build vote arrive at week 13; relics and raids at Act 3 (week 27);
  Dragon workers and the statue at Act 4. The tables are there from the start
  (`0002_town.sql`, `0003_votes_raids.sql`, `0004_bingo_shop.sql`); the
  campaign calendar in `config.ts` decides when each system wakes up.
- **The experience table is RuneScape's, exactly.** Level 99 is 13,034,431 XP
  and every unlock sits at its RuneScape level. A session's XP grows with
  the player, as in the game; the session length is tuned so two a week
  reaches Dragon in week 52 and five a week around week 33.
