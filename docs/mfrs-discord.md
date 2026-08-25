# The Discord half of Middle Fork Rafting Simulator, and the web half that holds it up

What each of the five URL fields on the application's General Information page
is for, what goes behind it, and the one thing that is not a portal field at
all: the path from "a friend clicked Join" to either a boat or a discount. The
web half of the first phase is built; the rest is a plan.

Two repos are involved and the split is clean:

| Lives in `mfrs` | Lives in `badams-homepage` |
| --- | --- |
| presence, join secrets, launch registration, the URI scheme | every URL Discord is given |
| the numbers a linked role is granted on | the OAuth dance, the role push, the slash commands |

Everything web-side hangs off `benadams.dev`, which already serves signed image
routes for scrandle out of `app/api/`, so the shape is familiar.

---

## What is already standing

`scripts/autoload/discord_social.gd` in the game is further along than the portal
is. It has: the app id, PKCE login with a stored refresh token, rich presence
with details and state, a public party with an id and a size, a join secret,
`set_activity_join_callback` wired to the trip code, and
`register_launch_command` on real builds only.

The legal text lived only as markdown inside the game repo, which is not a URL,
which is why two of the five fields were empty. Both are served now.

So this document is mostly about the parts that reach *outside* the game.

## What is built here now

The web half of phase 1 is in this repo and passes lint, types, build and five
Playwright tests:

| Path | What it is |
| --- | --- |
| `app/river/page.tsx` | the put-in page with no trip code, and the Deep Link URL to give Discord |
| `app/river/join/[code]/page.tsx` | the link a player hands a friend |
| `app/river/discord-join/route.ts` | unwraps `?secret=mfrs1:…` and redirects onto the code |
| `app/river/components/Handoff.tsx` | fires `mfrs://join/<code>`, then stops promising a game |
| `app/river/components/CodeChip.tsx` | the code, and a button that copies it |
| `app/river/config.ts` | store mode, itch URLs, coupon URL, timings, the two legal blanks |
| `app/river/terms`, `privacy`, `notices` | the legal text, unlinked and noindexed |
| `public/river/` | five stills and the lockup out of the press kit |

Still to do on the game side: registering the `mfrs://` scheme at first run.
Until that lands, every visitor sees the marketing page, which is the same thing
a visitor without the game sees afterwards.

---

## The five fields

### 1 & 2. Terms of Service URL / Privacy Policy URL

The easy ones, and the ones with a deadline attached: they are required
paperwork the moment the app leaves your own account, and Discord asks for them
for anything doing account linking, which this already does.

Both are live:

```
https://benadams.dev/river/terms
https://benadams.dev/river/privacy
https://benadams.dev/river/notices     (the terms link to it)
```

**Nothing links to them and all three carry `noindex, nofollow`.** They exist for
the application form and for a player who goes looking, not for search. There is
deliberately no `Disallow` in `robots.ts`: a crawler barred from fetching the
page never reads the tag telling it not to index the page, and a URL blocked that
way can still show up in results.

The markdown is copied from the game repo rather than fetched, because that repo
is private and a build-time fetch would need a token in Vercel. Copy the text
across in the same pull request that changes it. One pairing to watch: the
in-client "Disconnect" copy and the privacy page have to keep agreeing about the
token. The policy promises the refresh token is forgotten locally *and* revoked
at Discord, `revoke_token` is in the API table, and that promise is honest today.

Two blanks are still open in the source text, `[SUPPORT EMAIL]` and
`[STATE/COUNTRY]`. Fill `RIVER.legal` in `app/river/config.ts` and every
occurrence across all three documents follows. Until then they render in orange.

### 3. Deep Link URL

**This is the field the whole join-or-coupon idea rests on.** When a player
accepts an activity invite and Discord cannot hand it to a running game — the
mobile case, and the case worth designing for — it opens

```
<your deep link URL>/_discord/join?secret=<the join secret you set>
```

in a browser. The secret is opaque to Discord, and ours already wraps the trip
code, so that URL carries everything needed to put somebody in a boat.

Set it to `https://benadams.dev/river`, which makes the live route
`/river/_discord/join`. A folder called `_discord` in the app directory will not
serve that path: Next treats a leading underscore as a private folder and keeps
it out of routing. The segment is served by a rewrite in `next.config.ts` onto
`app/river/discord-join/route.ts`, which unwraps the secret and redirects.

### 4. Linked Roles Verification URL

What it is: a page **you** host that Discord sends people to when a server admin
has gated a role behind your app. You register a metadata schema once, the player
authorises with the `role_connections.write` scope, you push their numbers, and
Discord grants or withholds the role by comparing those numbers against the
admin's thresholds.

For this game it is the best-value field on the page, because the game already
measures everything a river role would want and none of it is a vanity stat:

| Metadata key | Type | A role an admin could build from it |
| --- | --- | --- |
| `miles_run` | integer ≥ | *Boatman* at 50, *Guide* at 250 |
| `trips_finished` | integer ≥ | *Has finished a canyon* at 1 |
| `swims` | integer ≤ | *Stayed in the boat* — a role you can lose |
| `rescues` | integer ≥ | *Threw the bag* at 10 |
| `biggest_drop_ft` | integer ≥ | *Went off something* |
| `first_run_on` | datetime ≤ | *Was here early* |

The `≤` ones are the interesting half: linked roles compare in both directions,
so "fewer than five swims" is expressible, and it is a better joke than another
counter that only goes up.

Route: `https://benadams.dev/river/linked-role`. The push endpoint is
`PUT /users/@me/applications/{app_id}/role-connection`, and schema registration
is a one-time script — put it in `scripts/` beside the screenshot one so it is
re-runnable rather than a thing you once did in a terminal.

The honest cost: none of those numbers exists on a server today. The game keeps
no accounts by design — `docs/joining.md` says so plainly, and it is a good
design — so linked roles means introducing the first thing that does: a row per
Discord user id with six integers on it. That is a real decision, and it is why
this field is proposed fourth rather than first.

### 5. Connection Entrypoint URL

Where Discord sends a user who picks your app in **User Settings → Connections** —
somebody who wants to link their river record without being prompted by a role
gate. Same OAuth flow as linked roles through a different door, and it costs
almost nothing once #4 exists.

Point it at `https://benadams.dev/river/connect` and have that page do what
`/river/linked-role` does, minus the role-specific copy.

### And the one that is not on your list: Interactions Endpoint URL

Filling this in means the app can carry **slash commands with no gateway
connection and no process running anywhere** — Discord POSTs, you answer. On
Vercel that is one route:

```
https://benadams.dev/api/discord/interactions
```

Three things it must do or Discord rejects the URL the moment you save it:
verify the `X-Signature-Ed25519` / `X-Signature-Timestamp` pair against the app's
public key over the *raw* body, answer a `type: 1` PING with a `type: 1` PONG,
and do both inside three seconds. The `discord-interactions` package handles the
verification; the raw-body part is the one that bites, because reading the parsed
body first destroys the bytes the signature was computed over.

Commands worth having, in the order they earn their keep:

- **`/trip`** — posts the put-in card for whatever trip you are on: the code, who
  is aboard, how far down the canyon, and a **Join link anybody can click**. See
  below — this is the command that does the thing this document is about.
- **`/permit`** — links your account; the same flow as the connection entrypoint.
- **`/river`** — the run's numbers after it ends. Fun, optional, last.

---

## The join → launch-or-coupon path

The thing you asked for, and one finding changes its shape.

**Discord's own Join button cannot do the coupon half.** For a friend who does
not have the game, that button does not lead anywhere you control — it renders
disabled with a *Game Not Detected* tooltip, which is also what a player sees who
owns the game but has never launched it, because the launch command is registered
by the SDK at runtime and nothing is registered on that machine yet. Discord will
not offer a stranger a download for a game it has no store entry for.

So the coupon path has to hang off a **link**, not off the native button. That is
fine, because a link is better in every other way: it works in a channel, in a
DM, on a phone, in a text message to somebody who is not on Discord at all — and
it is the same URL Discord itself opens for a mobile invite.

### One URL, three outcomes

```
https://benadams.dev/river/join/FrothGorgeSurf
        └─ and /river/_discord/join?secret=… unwraps to the same thing
```

What the page does, in order:

1. **Try the game.** Navigate to `mfrs://join/FrothGorgeSurf`. If the scheme is
   registered on that machine the game comes up — or the running copy takes the
   code — and the browser tab is left behind.
2. **Watch whether that worked.** Note the time, and if the page is still visible
   ~1.5s later, nothing handled it. `visibilitychange` plus a timer, no library.
3. **Fall through to the put-in page** — five stills out of `press-kit/`, a
   headline, and one button.

Nobody who has the game ever sees step 3, and nobody who does not is left staring
at a dead button.

**When the scheme is missing or broken, nothing breaks.** Step 1 is a navigation
that no application answers, so the browser stays put and step 3 runs. That path
also covers a player who owns the game on a machine where the registration never
happened: an old build, a Linux desktop that skipped
`update-desktop-database`, a browser that blocks the navigation. For them the
page carries the trip code and a copy button, and typing it into the trip board
is the way in that predates all of this. On Android the App Link handles the same
URL without a scheme at all.

### Registering `mfrs://`

The game already calls `register_launch_command(APP_ID, OS.get_executable_path())`,
which tells *Discord* how to start the game on this machine. A URI scheme is the
same idea aimed at the operating system, and it is what makes step 1 possible:

- **Windows** — three registry values under `HKCU\Software\Classes\mfrs`. No
  admin rights and no installer, so `OS.execute("reg", [...])` at first run,
  guarded by `OS.has_feature("template")` exactly as the Discord registration
  already is, and for the same reason: an editor run would point the scheme at a
  checkout.
- **Linux** — a `.desktop` file carrying `MimeType=x-scheme-handler/mfrs;` and a
  run of `update-desktop-database`. The itch app unpacks to a folder rather than
  installing, so the game has to do this for itself on first run.
- **Android** — no scheme needed. Use an **App Link** on the same
  `https://benadams.dev/river/join/…` URL, which means serving
  `/.well-known/assetlinks.json` from the homepage with the APK's signing
  fingerprint in it. This works for a sideloaded itch APK, which is worth
  knowing: a phone that has the game opens it straight from the link, no scheme
  and no prompt.

Then feed the same string to Discord — `register_launch_command(APP_ID, "mfrs://join/")`
if the binding accepts a scheme where it currently gets a path. Worth testing
early, because if it does, the native Join button and the web link converge on
one code path and one thing to debug.

### The other end of it

`Net.classify_join()` already sorts a typed string into code / address /
hostname, and the game already accepts a code that arrives while a trip is
underway. So the scheme handler is not new machinery — it is a third caller into
the function `main.gd` already has, alongside the typed field and the Discord
join callback. The parse is `mfrs://join/<code>` → the same string a player would
have typed.

### What the non-owner actually gets

itch coupons are not a query parameter. A coupon is a private sale with its own
URL built from your username and the code, like
`https://bigfancyben.itch.io/first-descent`, and anyone who opens that URL gets
the price. Public is fine. Set a maximum redeems on itch if a campaign ever
needs a ceiling, and otherwise treat the link as marketing.

The stronger version of that page does not lead with a discount at all:

> **You have been asked onto a trip.** Somebody is on the water right now and
> there is a seat on the thwart.
> **[Get the game — 25% off, this link only]**
> Already have it? **[Open the game]**

Because a discount still puts a checkout between a person and their friend's
boat, the thing worth shipping alongside it is a **free demo channel on itch** —
one canyon, no purchase, joins any trip. `run_itch.sh` already pushes per-platform
channels, so a `windows-demo` channel is a build flag and a push rather than a
project. Then the page can have somebody in the boat in four minutes and sell
them the full game afterwards, which is the version of this that converts.

Note where the store actually is: the itch page is not public yet and the build
is `0.1.0-spike`, which `run_itch.sh` refuses to push. So the page has to be
honest in three different worlds — restricted, demo, paid — and the cheapest way
to do that is one config object with a `mode` in it, not three pages.

---

## What to build, in order

**Phase 1 — the paperwork and the link.** The join link, the put-in page and the
three legal pages are done. What is left: the `mfrs://` registration in the game,
the two blanks in the legal text, and pasting the URLs into the portal. Nothing
here needs a database.

**Phase 2 — the bot.** `/api/discord/interactions`, then `/trip`, which is what
puts that link in front of people without anyone copying a URL. Still no
database: the trip code is in the presence payload the command can read.

**Phase 3 — the demo channel.** A build flag in `export_presets.cfg`, a new itch
channel, the put-in page pointed at it. Mostly game work, and the piece that
moves the numbers.

**Phase 4 — accounts, and only if you want the roles.** The six-integer table,
the OAuth flow, the schema registration, `/river/linked-role` and
`/river/connect`. Last, and decided on its own merits, because it is the one
phase that introduces something this game has spent its whole life not having.

---

## Open questions, and how to answer them cheaply

- **Does `register_launch_command` accept a URI scheme, or only a path?** The
  binding is generated and untested upstream. Register `mfrs://join/` on one
  machine, click Join from another account, see what starts. Ten minutes, and a
  yes collapses two code paths into one.
- **Does the desktop client ever open the Deep Link URL,** or is it mobile-only?
  The docs describe the mobile flow; desktop with no launch command registered is
  documented only as *Game Not Detected*. Test before relying on the browser
  fallback for anyone on a laptop — the `/trip` link path does not care either
  way, which is another reason to build that first.
- **Are trip codes safe in public?** A code is a live invite to a running trip
  for as long as the host is on the water. Posting one in a public channel is
  posting an open boat. Probably fine for this game, and still a decision, and
  `/trip` in a public channel is where it gets made.

---

## Sources

- [Managing game invites](https://docs.discord.com/developers/discord-social-sdk/development-guides/managing-game-invites) — join secrets, launch commands, the `/_discord/join?secret=` deep link
- [Discord Social SDK on mobile](https://docs.discord.com/developers/discord-social-sdk/core-concepts/mobile) — deep link requirements, presence differences between iOS and Android
- [Configuring app metadata for linked roles](https://docs.discord.com/developers/tutorials/configuring-app-metadata-for-linked-roles) — schema registration, `role_connections.write`
- [Interactions overview](https://discord.com/developers/docs/interactions/overview) — signature verification, PING/PONG, the three-second window
- [discord-interactions-js](https://github.com/discord/discord-interactions-js) — the verification helper
- [Hosting a sale or bundle](https://itch.io/docs/creators/sales) — how coupon URLs are formed and capped
- [itch.io app FAQ](https://itch.io/docs/app/faq) — what the app does with channels and patches
- [Discord Rich Presence guide (osu! wiki)](https://osu.ppy.sh/wiki/en/Guides/Discord_Rich_Presence) — the *Game Not Detected* behaviour, written down where Discord does not write it down
