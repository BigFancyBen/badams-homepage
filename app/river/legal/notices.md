# Third-party notices

**Middle Fork Rafting Simulator**

Last updated: 24 August 2026

Other people's work holds this game up. Several of the licences below require
their text to travel with anything that ships, so this file goes in the build and
alongside the installer.

There is less here than in most games, for an unusual reason: **the game ships no
art and no audio**. Code generates every mesh, texture, and sound at runtime. The
only binary assets in the repository are two typefaces and one vendored SDK.

---

## Godot Engine

The engine the game runs on and ships inside.

- Copyright © 2014–2026 Godot Engine contributors; © 2007–2014 Juan Linietsky,
  Ariel Manzur.
- Licence: **MIT**
- <https://godotengine.org>

Godot itself includes third-party components under their own licences. Each
release publishes the engine's full copyright file at
<https://github.com/godotengine/godot/blob/master/COPYRIGHT.txt>.

---

## Discord Social SDK, Godot binding

The GDExtension that lets the game talk to Discord.

- Author: thiagola92
- Release **3.0.5**, published 2026-07-15
- Licence: **MIT**. The full text ships in
  `addons/discord_social_sdk/LICENSE`.
- <https://github.com/thiagola92/discord-social-sdk>

Vendored, pinned, and pruned to Windows x86_64. `addons/discord_social_sdk/VENDOR.md`
records what was kept and what was cut.

## Discord Social SDK, the library itself

The native `discord_partner_sdk` library the binding wraps. Discord distributes
it, and we use it under the Discord Developer Terms of Service and the Discord
Social SDK Terms.

- © Discord Inc.
- <https://discord.com/developers/docs/policies-and-agreements/developer-terms-of-service>

## The Discord mark

The Discord logo on the connect button.

- Path data from **Simple Icons** (<https://simpleicons.org>), licensed
  **CC0-1.0**.
- CC0 covers the path data. It does not waive the trademark, which belongs to
  Discord. We use the mark unaltered, in one of Discord's own permitted variants,
  on a control whose only purpose is connecting the player to Discord.

It lives as an SVG string in `scripts/ui/ui_kit.gd`. Do not restyle, recolour, or
stretch it.

---

## Typefaces

### Archivo Narrow

- Copyright © The Archivo Project Authors.
- Licence: **SIL Open Font License 1.1**. Full text in
  `assets/fonts/OFL-ArchivoNarrow.txt`.

### IBM Plex Mono

- Copyright © IBM Corp.
- Licence: **SIL Open Font License 1.1**. Full text in
  `assets/fonts/OFL-IBMPlexMono.txt`.

The game uses both as fonts, which is what the licences are for. We sell neither
and redistribute neither on its own.

---

## noray

The game does not ship this, but it talks to it: the connection orchestrator that
turns a trip code into a connection between two players.

- Author: foxssake
- Licence: **MIT**
- <https://github.com/foxssake/noray>

The game works without it, direct addresses never touch it, and it runs as a
separate service. [privacy-policy.md](privacy-policy.md) §3 covers what it
handles.

---

## What is not here

No stock art, no stock audio, no sample libraries, no asset-store packs, no
analytics SDK, no advertising SDK, no crash reporter. If you expected a longer
list, that absence is why it is short.
